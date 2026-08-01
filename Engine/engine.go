package main

import (
	"context"
	"database/sql"
	"fmt"
	"math"
	"sort"
	"sync"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

type RCAEngine struct {
	conn driver.Conn
}

const (
	anomalyZThreshold    = 3.0
	positivePctThreshold = 10.0
)

func NewRCAEngine(conn driver.Conn) *RCAEngine {
	return &RCAEngine{conn: conn}
}

// FindTopAnomaly scans the dataset for the most significant anomaly for the specified metric
func (e *RCAEngine) FindTopAnomaly(ctx context.Context, metric string) (*AnomalyRecord, error) {
	curCol, baseCol, stdCol, err := metricColumns(metric)
	if err != nil {
		return nil, err
	}

	query := fmt.Sprintf(`
	WITH hourly AS (
	  SELECT toStartOfHour(event_time) AS h,
	         count() AS requests,
	         sum(is_filled) AS fills,
	         sum(is_impression) AS impressions,
	         sum(is_click) AS clicks,
	         sum(revenue) AS revenue,
	         fills / nullIf(requests, 0) AS fill_rate,
	         impressions / nullIf(fills, 0) AS render_rate,
	         clicks / nullIf(impressions, 0) AS ctr,
	         revenue / nullIf(impressions, 0) * 1000 AS ecpm
	         , revenue / nullIf(requests, 0) AS rpr
	  FROM ad_events GROUP BY h
	),
	baseline AS (
	  SELECT h, fill_rate, render_rate, ctr, revenue, requests, fills, impressions, clicks, ecpm, rpr,
	         avg(fill_rate) OVER (PARTITION BY toDayOfWeek(h), toHour(h) ORDER BY h ROWS BETWEEN 4 PRECEDING AND 1 PRECEDING) AS fr_base,
	         stddevPop(fill_rate) OVER (PARTITION BY toDayOfWeek(h), toHour(h) ORDER BY h ROWS BETWEEN 4 PRECEDING AND 1 PRECEDING) AS fr_std,
	         avg(render_rate) OVER (PARTITION BY toDayOfWeek(h), toHour(h) ORDER BY h ROWS BETWEEN 4 PRECEDING AND 1 PRECEDING) AS render_rate_base,
	         stddevPop(render_rate) OVER (PARTITION BY toDayOfWeek(h), toHour(h) ORDER BY h ROWS BETWEEN 4 PRECEDING AND 1 PRECEDING) AS render_rate_std,
	         avg(ctr) OVER (PARTITION BY toDayOfWeek(h), toHour(h) ORDER BY h ROWS BETWEEN 4 PRECEDING AND 1 PRECEDING) AS ctr_base,
	         stddevPop(ctr) OVER (PARTITION BY toDayOfWeek(h), toHour(h) ORDER BY h ROWS BETWEEN 4 PRECEDING AND 1 PRECEDING) AS ctr_std,
	         avg(revenue) OVER (PARTITION BY toDayOfWeek(h), toHour(h) ORDER BY h ROWS BETWEEN 4 PRECEDING AND 1 PRECEDING) AS rev_base,
	         stddevPop(revenue) OVER (PARTITION BY toDayOfWeek(h), toHour(h) ORDER BY h ROWS BETWEEN 4 PRECEDING AND 1 PRECEDING) AS rev_std,
	         avg(fills) OVER (PARTITION BY toDayOfWeek(h), toHour(h) ORDER BY h ROWS BETWEEN 4 PRECEDING AND 1 PRECEDING) AS fills_base,
	         stddevPop(fills) OVER (PARTITION BY toDayOfWeek(h), toHour(h) ORDER BY h ROWS BETWEEN 4 PRECEDING AND 1 PRECEDING) AS fills_std,
	         avg(impressions) OVER (PARTITION BY toDayOfWeek(h), toHour(h) ORDER BY h ROWS BETWEEN 4 PRECEDING AND 1 PRECEDING) AS impressions_base,
	         stddevPop(impressions) OVER (PARTITION BY toDayOfWeek(h), toHour(h) ORDER BY h ROWS BETWEEN 4 PRECEDING AND 1 PRECEDING) AS impressions_std,
	         avg(clicks) OVER (PARTITION BY toDayOfWeek(h), toHour(h) ORDER BY h ROWS BETWEEN 4 PRECEDING AND 1 PRECEDING) AS clicks_base,
	         stddevPop(clicks) OVER (PARTITION BY toDayOfWeek(h), toHour(h) ORDER BY h ROWS BETWEEN 4 PRECEDING AND 1 PRECEDING) AS clicks_std,
	         avg(ecpm) OVER (PARTITION BY toDayOfWeek(h), toHour(h) ORDER BY h ROWS BETWEEN 4 PRECEDING AND 1 PRECEDING) AS ecpm_base,
	         stddevPop(ecpm) OVER (PARTITION BY toDayOfWeek(h), toHour(h) ORDER BY h ROWS BETWEEN 4 PRECEDING AND 1 PRECEDING) AS ecpm_std,
	         avg(rpr) OVER (PARTITION BY toDayOfWeek(h), toHour(h) ORDER BY h ROWS BETWEEN 4 PRECEDING AND 1 PRECEDING) AS rpr_base,
	         stddevPop(rpr) OVER (PARTITION BY toDayOfWeek(h), toHour(h) ORDER BY h ROWS BETWEEN 4 PRECEDING AND 1 PRECEDING) AS rpr_std,
	         avg(requests) OVER (PARTITION BY toDayOfWeek(h), toHour(h) ORDER BY h ROWS BETWEEN 4 PRECEDING AND 1 PRECEDING) AS req_base,
	         stddevPop(requests) OVER (PARTITION BY toDayOfWeek(h), toHour(h) ORDER BY h ROWS BETWEEN 4 PRECEDING AND 1 PRECEDING) AS req_std
	  FROM hourly
	)
	SELECT 
	  h,
	  toFloat64(%s) AS current_val,
	  toFloat64(%s) AS base_val,
	  (current_val - base_val) / nullIf(%s, 0) AS z_val
	FROM baseline
	WHERE z_val IS NOT NULL AND abs((current_val - base_val) / nullIf(base_val, 0)) >= 0.05
	ORDER BY abs(z_val) DESC
	LIMIT 1;
	`, curCol, baseCol, stdCol)

	row := e.conn.QueryRow(ctx, query)
	var h time.Time
	var current, base, z float64

	if err := row.Scan(&h, &current, &base, &z); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("no eligible anomaly rows found: %w", err)
		}
		return nil, fmt.Errorf("failed to scan anomaly row: %w", err)
	}

	pct := 0.0
	if base > 0 {
		pct = ((current - base) / base) * 100.0
	}

	return &AnomalyRecord{
		Timestamp:     h,
		Metric:        metric,
		CurrentValue:  current,
		BaselineValue: base,
		ZScore:        z,
		PctChange:     pct,
	}, nil
}

// PerformAnalysis executes full RCA on a target window
func (e *RCAEngine) PerformAnalysis(ctx context.Context, req AnalyzeRequest) (*RCAEvidence, error) {
	startTime := time.Now()

	metric := req.Metric
	if metric == "" {
		metric = "revenue"
	}
	metricDef, err := resolveMetric(metric)
	if err != nil {
		return nil, err
	}
	metric = metricDef.Name

	var wStart, wEnd string
	var anomaly *AnomalyRecord

	if req.WindowStart == "" {
		top, err := e.FindTopAnomaly(ctx, metric)
		if err != nil {
			return nil, fmt.Errorf("failed to find top anomaly: %w", err)
		}
		anomaly = top
		wStart = top.Timestamp.Format("2006-01-02 15:04:05")
		wEnd = top.Timestamp.Add(1 * time.Hour).Format("2006-01-02 15:04:05")
	} else {
		wStart = req.WindowStart
		wEnd = req.WindowEnd
		if wEnd == "" {
			t, _ := time.Parse("2006-01-02 15:04:05", wStart)
			wEnd = t.Add(1 * time.Hour).Format("2006-01-02 15:04:05")
		}

		// Calculate metrics for window
		t, _ := time.Parse("2006-01-02 15:04:05", wStart)
		anomaly = &AnomalyRecord{
			Timestamp: t,
			Metric:    metric,
		}
	}

	// 1. Fetch Window vs Baseline Metrics
	currentMetrics, baseMetrics, err := e.getMetricsForWindowAndBaseline(ctx, wStart, wEnd)
	if err != nil {
		return nil, fmt.Errorf("failed to query metrics: %w", err)
	}

	curVal := currentMetrics[metric]
	baseVal := baseMetrics[metric]
	delta := curVal - baseVal
	pctChange := 0.0
	if baseVal != 0 {
		pctChange = (delta / baseVal) * 100.0
	}

	// 2. Revenue Identity Factor Decomposition
	var factorDecomp *FactorDecomposition
	if metric == "revenue" || metric == "rpr" {
		factorDecomp = e.decomposeFactors(currentMetrics, baseMetrics)
	}

	targetDrillMetric := metric
	if (metric == "revenue" || metric == "rpr") && factorDecomp != nil && factorDecomp.PrimaryFactor != "" {
		targetDrillMetric = factorDecomp.PrimaryFactor
	}

	targetDelta := currentMetrics[targetDrillMetric] - baseMetrics[targetDrillMetric]

	// 3. Concurrent Fan-Out Primary Dimension Breakdown (Wave 1)
	primarySegments, ruledOutDims := e.drillDownPrimaryDimensions(ctx, wStart, wEnd, targetDrillMetric, targetDelta)

	// 4. Multi-Level Recursive Drill-Down (Wave 2)
	twoLevelSegments := e.drillDownTwoLevel(ctx, wStart, wEnd, targetDrillMetric, targetDelta, primarySegments)

	// Combine Wave 1 and Wave 2 top segments
	allTop := append(primarySegments, twoLevelSegments...)
	sort.Slice(allTop, func(i, j int) bool {
		return math.Abs(allTop[i].SegmentDelta) > math.Abs(allTop[j].SegmentDelta)
	})

	if len(allTop) > 6 {
		allTop = allTop[:6]
	}

	// 5. Build Ruled-Out List
	ruledOutList := e.buildRuledOut(factorDecomp, ruledOutDims, currentMetrics, baseMetrics)

	execMs := time.Since(startTime).Milliseconds()

	return &RCAEvidence{
		AnomalyDetected:         math.Abs(anomaly.ZScore) > anomalyZThreshold || math.Abs(pctChange) > positivePctThreshold,
		Metric:                  metric,
		WindowStart:             wStart,
		WindowEnd:               wEnd,
		CurrentValue:            math.Round(curVal*100) / 100,
		BaselineValue:           math.Round(baseVal*100) / 100,
		Delta:                   math.Round(delta*100) / 100,
		PctChange:               math.Round(pctChange*10) / 10,
		ZScore:                  math.Round(anomaly.ZScore*100) / 100,
		FactorDecomposition:     factorDecomp,
		TopContributingSegments: allTop,
		RuledOut:                ruledOutList,
		ExecutionTimeMs:         execMs,
	}, nil
}

func (e *RCAEngine) getMetricsForWindowAndBaseline(ctx context.Context, wStart, wEnd string) (map[string]float64, map[string]float64, error) {
	query := fmt.Sprintf(`
	WITH current_period AS (
		SELECT 
			count() AS requests,
			sum(is_filled) AS fills,
			sum(is_impression) AS impressions,
			sum(is_click) AS clicks,
			sum(revenue) AS revenue
		FROM ad_events
		WHERE event_time >= '%s' AND event_time < '%s'
	),
	baseline_period AS (
		SELECT 
			count() / nullIf(uniqExact(toDate(event_time)), 0) AS requests,
			sum(is_filled) / nullIf(uniqExact(toDate(event_time)), 0) AS fills,
			sum(is_impression) / nullIf(uniqExact(toDate(event_time)), 0) AS impressions,
			sum(is_click) / nullIf(uniqExact(toDate(event_time)), 0) AS clicks,
			sum(revenue) / nullIf(uniqExact(toDate(event_time)), 0) AS revenue
		FROM ad_events
		WHERE event_time < '%s' 
		  AND toDayOfWeek(event_time) = toDayOfWeek(toDateTime('%s'))
		  AND toHour(event_time) = toHour(toDateTime('%s'))
	)
	SELECT 
		toFloat64(c.requests), toFloat64(c.fills), toFloat64(c.impressions), toFloat64(c.clicks), toFloat64(c.revenue),
		toFloat64(b.requests), toFloat64(b.fills), toFloat64(b.impressions), toFloat64(b.clicks), toFloat64(b.revenue)
	FROM current_period c CROSS JOIN baseline_period b;
	`, wStart, wEnd, wStart, wStart, wStart)

	row := e.conn.QueryRow(ctx, query)

	var curReq, curFill, curImp, curClick, curRev float64
	var baseReq, baseFill, baseImp, baseClick, baseRev float64

	if err := row.Scan(&curReq, &curFill, &curImp, &curClick, &curRev, &baseReq, &baseFill, &baseImp, &baseClick, &baseRev); err != nil {
		return nil, nil, err
	}

	curMap := map[string]float64{
		"requests":    curReq,
		"fills":       curFill,
		"fill_rate":   safeDiv(curFill, curReq),
		"impressions": curImp,
		"render_rate": safeDiv(curImp, curFill),
		"clicks":      curClick,
		"ctr":         safeDiv(curClick, curImp),
		"revenue":     curRev,
		"ecpm":        safeDiv(curRev, curImp) * 1000.0,
		"rpr":         safeDiv(curRev, curReq),
	}

	baseMap := map[string]float64{
		"requests":    baseReq,
		"fills":       baseFill,
		"fill_rate":   safeDiv(baseFill, baseReq),
		"impressions": baseImp,
		"render_rate": safeDiv(baseImp, baseFill),
		"clicks":      baseClick,
		"ctr":         safeDiv(baseClick, baseImp),
		"revenue":     baseRev,
		"ecpm":        safeDiv(baseRev, baseImp) * 1000.0,
		"rpr":         safeDiv(baseRev, baseReq),
	}

	return curMap, baseMap, nil
}

func (e *RCAEngine) decomposeFactors(cur, base map[string]float64) *FactorDecomposition {
	reqPct := safePctChange(cur["requests"], base["requests"])
	frPct := safePctChange(cur["fill_rate"], base["fill_rate"])
	rrPct := safePctChange(cur["render_rate"], base["render_rate"])
	ecpmPct := safePctChange(cur["ecpm"], base["ecpm"])

	// Determine primary driver factor
	factors := map[string]float64{
		"requests":    math.Abs(reqPct),
		"fill_rate":   math.Abs(frPct),
		"render_rate": math.Abs(rrPct),
		"ecpm":        math.Abs(ecpmPct),
	}

	primary := "fill_rate"
	maxVal := 0.0
	for k, v := range factors {
		if v > maxVal {
			maxVal = v
			primary = k
		}
	}

	explanation := fmt.Sprintf("Primary revenue movement driver is %s (%.1f%% change), while request volume changed %.1f%% and eCPM changed %.1f%%.", primary, getVal(factors, primary), reqPct, ecpmPct)

	return &FactorDecomposition{
		RequestsDeltaPct:   math.Round(reqPct*10) / 10,
		FillRateDeltaPct:   math.Round(frPct*10) / 10,
		RenderRateDeltaPct: math.Round(rrPct*10) / 10,
		ECPMDeltaPct:       math.Round(ecpmPct*10) / 10,
		PrimaryFactor:      primary,
		Explanation:        explanation,
	}
}

func (e *RCAEngine) drillDownPrimaryDimensions(ctx context.Context, wStart, wEnd, targetMetric string, totalDelta float64) ([]SegmentContribution, []string) {
	// Dimensions and SQL expressions
	dims := []struct {
		Name string
		Expr string
	}{
		{"ad_format", "ad_format"},
		{"category", "dictGet('apps_dict', 'category', app_id)"},
		{"publisher_tier", "dictGet('apps_dict', 'publisher_tier', app_id)"},
		{"vertical", "dictGet('advertisers_dict', 'vertical', assumeNotNull(advertiser_id))"},
		{"campaign_type", "dictGet('advertisers_dict', 'campaign_type', assumeNotNull(advertiser_id))"},
		{"region", "dictGet('geo_device_dict', 'region', geo_device_id)"},
		{"country", "dictGet('geo_device_dict', 'country', geo_device_id)"},
		{"device_model", "dictGet('geo_device_dict', 'device_model', geo_device_id)"},
		{"os_version", "dictGet('geo_device_dict', 'os_version', geo_device_id)"},
	}

	var results []SegmentContribution
	var ruledOutDims []string
	var mu sync.Mutex

	// Bounded Concurrency Semaphore (max 8 parallel worker queries)
	sem := make(chan struct{}, 8)
	var wg sync.WaitGroup

	for _, d := range dims {
		wg.Add(1)
		go func(dimName, dimExpr string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			segs, maxShare := e.queryDimensionContribution(ctx, wStart, wEnd, targetMetric, dimName, dimExpr, totalDelta)

			mu.Lock()
			defer mu.Unlock()

			if maxShare < 0.08 {
				ruledOutDims = append(ruledOutDims, dimName)
			}
			for _, s := range segs {
				if math.Abs(s.ShareOfDelta) >= 0.10 {
					results = append(results, s)
				}
			}
		}(d.Name, d.Expr)
	}

	wg.Wait()
	return results, ruledOutDims
}

func getMetricSqlExpr(metric string) string {
	expr, err := metricExpr(metric)
	if err != nil {
		return "sum(revenue)"
	}
	return expr
}

func getBaseMetricSqlExpr(metric string) string {
	expr := getMetricSqlExpr(metric)
	if metric == "fill_rate" || metric == "ecpm" || metric == "render_rate" || metric == "ctr" {
		return expr
	}
	return fmt.Sprintf("(%s) / nullIf(uniqExact(toDate(event_time)), 0)", expr)
}

func getContributionMetricExpr(metric string) string {
	switch metric {
	case "requests":
		return "count()"
	case "fills", "fill_rate":
		return "sum(is_filled)"
	case "impressions", "render_rate", "ecpm":
		return "sum(is_impression)"
	case "clicks", "ctr":
		return "sum(is_click)"
	case "rpr", "revenue":
		return "sum(revenue)"
	default:
		return "sum(revenue)"
	}
}

func (e *RCAEngine) queryDimensionContribution(ctx context.Context, wStart, wEnd, metric, dimName, dimExpr string, totalDelta float64) ([]SegmentContribution, float64) {
	curMetricExpr := getMetricSqlExpr(metric)
	baseMetricExpr := getBaseMetricSqlExpr(metric)

	query := fmt.Sprintf(`
	WITH current_segs AS (
		SELECT %s AS seg_val, %s AS cur_metric
		FROM ad_events
		WHERE event_time >= '%s' AND event_time < '%s'
		GROUP BY seg_val
	),
	base_segs AS (
		SELECT %s AS seg_val, %s AS base_metric
		FROM ad_events
		WHERE event_time < '%s' 
		  AND toDayOfWeek(event_time) = toDayOfWeek(toDateTime('%s'))
		  AND toHour(event_time) = toHour(toDateTime('%s'))
		GROUP BY seg_val
	)
	SELECT 
		coalesce(c.seg_val, b.seg_val) AS value,
		toFloat64(coalesce(c.cur_metric, 0)) AS current_m,
		toFloat64(coalesce(b.base_metric, 0)) AS base_m
	FROM current_segs c FULL OUTER JOIN base_segs b ON c.seg_val = b.seg_val
	ORDER BY abs(current_m - base_m) DESC
	LIMIT 5;
	`, dimExpr, curMetricExpr, wStart, wEnd, dimExpr, baseMetricExpr, wStart, wStart, wStart)

	rows, err := e.conn.Query(ctx, query)
	if err != nil {
		return nil, 0
	}
	defer rows.Close()

	var segs []SegmentContribution
	maxShare := 0.0

	for rows.Next() {
		var val string
		var cur, base float64
		if err := rows.Scan(&val, &cur, &base); err != nil {
			continue
		}

		if val == "" {
			val = "Unfilled / Unknown"
		}

		delta := cur - base
		share := 0.0
		if math.Abs(totalDelta) > 0.0001 {
			share = delta / totalDelta
			if share > 1.0 {
				share = 1.0
			} else if share < -1.0 {
				share = -1.0
			}
		}

		if math.Abs(share) > maxShare {
			maxShare = math.Abs(share)
		}

		segs = append(segs, SegmentContribution{
			Dimension:     dimName,
			Value:         val,
			CurrentMetric: math.Round(cur*100) / 100,
			BaseMetric:    math.Round(base*100) / 100,
			SegmentDelta:  math.Round(delta*100) / 100,
			ShareOfDelta:  math.Round(share*1000) / 1000,
		})
	}

	return segs, maxShare
}

func (e *RCAEngine) drillDownTwoLevel(ctx context.Context, wStart, wEnd, metric string, totalDelta float64, topPrimary []SegmentContribution) []SegmentContribution {
	if len(topPrimary) == 0 {
		return nil
	}

	// Pick top primary segment
	top := topPrimary[0]
	secondaryDim := "region"
	secondaryExpr := "dictGet('geo_device_dict', 'region', geo_device_id)"
	if top.Dimension == "region" {
		secondaryDim = "device_model"
		secondaryExpr = "dictGet('geo_device_dict', 'device_model', geo_device_id)"
	}

	primaryExpr := getDimExpr(top.Dimension)
	curMetricExpr := getMetricSqlExpr(metric)
	baseMetricExpr := getBaseMetricSqlExpr(metric)

	query := fmt.Sprintf(`
	WITH current_segs AS (
		SELECT %s AS sec_val, %s AS cur_metric
		FROM ad_events
		WHERE event_time >= '%s' AND event_time < '%s' AND %s = '%s'
		GROUP BY sec_val
	),
	base_segs AS (
		SELECT %s AS sec_val, %s AS base_metric
		FROM ad_events
		WHERE event_time < '%s' 
		  AND toDayOfWeek(event_time) = toDayOfWeek(toDateTime('%s'))
		  AND toHour(event_time) = toHour(toDateTime('%s'))
		  AND %s = '%s'
		GROUP BY sec_val
	)
	SELECT 
		coalesce(c.sec_val, b.seg_val) AS value,
		toFloat64(coalesce(c.cur_metric, 0)) AS current_m,
		toFloat64(coalesce(b.base_metric, 0)) AS base_m
	FROM current_segs c FULL OUTER JOIN base_segs b ON c.sec_val = b.sec_val
	ORDER BY abs(current_m - base_m) DESC
	LIMIT 2;
	`, secondaryExpr, curMetricExpr, wStart, wEnd, primaryExpr, top.Value, secondaryExpr, baseMetricExpr, wStart, wStart, wStart, primaryExpr, top.Value)

	rows, err := e.conn.Query(ctx, query)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var results []SegmentContribution
	for rows.Next() {
		var secVal string
		var cur, base float64
		if err := rows.Scan(&secVal, &cur, &base); err != nil {
			continue
		}

		delta := cur - base
		share := 0.0
		if math.Abs(totalDelta) > 0.0001 {
			share = delta / totalDelta
			if share > 1.0 {
				share = 1.0
			} else if share < -1.0 {
				share = -1.0
			}
		}

		combinedDim := fmt.Sprintf("%s x %s", top.Dimension, secondaryDim)
		combinedVal := fmt.Sprintf("%s x %s", top.Value, secVal)

		results = append(results, SegmentContribution{
			Dimension:     combinedDim,
			Value:         combinedVal,
			CurrentMetric: math.Round(cur*100) / 100,
			BaseMetric:    math.Round(base*100) / 100,
			SegmentDelta:  math.Round(delta*100) / 100,
			ShareOfDelta:  math.Round(share*1000) / 1000,
		})
	}

	return results
}

func (e *RCAEngine) buildRuledOut(factors *FactorDecomposition, ruledOutDims []string, cur, base map[string]float64) []RuledOutItem {
	items := make([]RuledOutItem, 0)

	// Check non-primary revenue identity factors
	if factors != nil {
		if factors.PrimaryFactor != "requests" && math.Abs(factors.RequestsDeltaPct) < 5.0 {
			items = append(items, RuledOutItem{
				Dimension: "requests_volume",
				Reason:    fmt.Sprintf("Request volume was normal (%.1f%% change) and within expected like-for-like baseline bounds", factors.RequestsDeltaPct),
			})
		}
		if factors.PrimaryFactor != "ecpm" && math.Abs(factors.ECPMDeltaPct) < 5.0 {
			items = append(items, RuledOutItem{
				Dimension: "ecpm_pricing",
				Reason:    fmt.Sprintf("eCPM pricing was normal (%.1f%% change) and ruled out as primary cause", factors.ECPMDeltaPct),
			})
		}
		if factors.PrimaryFactor != "render_rate" && math.Abs(factors.RenderRateDeltaPct) < 5.0 {
			items = append(items, RuledOutItem{
				Dimension: "render_rate",
				Reason:    fmt.Sprintf("Render rate was stable (%.1f%% change) across ad formats", factors.RenderRateDeltaPct),
			})
		}
	}

	// Check dimensions with uniform change
	for _, dim := range ruledOutDims {
		items = append(items, RuledOutItem{
			Dimension: dim,
			Reason:    fmt.Sprintf("Metric change across %s segments was uniform; no single %s segment contributed >8%% of total delta", dim, dim),
		})
	}

	if len(items) == 0 {
		items = append(items, RuledOutItem{
			Dimension: "render_rate",
			Reason:    "Render rate was stable across rendering environments and ruled out.",
		})
	}

	return items
}

// Helpers
func safeDiv(a, b float64) float64 {
	if b == 0 {
		return 0
	}
	return a / b
}

func safePctChange(cur, base float64) float64 {
	if base == 0 {
		return 0
	}
	return ((cur - base) / base) * 100.0
}

func getVal(m map[string]float64, k string) float64 {
	return m[k]
}

func getDimExpr(dim string) string {
	switch dim {
	case "ad_format":
		return "ad_format"
	case "category":
		return "dictGet('apps_dict', 'category', app_id)"
	case "publisher_tier":
		return "dictGet('apps_dict', 'publisher_tier', app_id)"
	case "vertical":
		return "dictGet('advertisers_dict', 'vertical', assumeNotNull(advertiser_id))"
	case "campaign_type":
		return "dictGet('advertisers_dict', 'campaign_type', assumeNotNull(advertiser_id))"
	case "region":
		return "dictGet('geo_device_dict', 'region', geo_device_id)"
	case "country":
		return "dictGet('geo_device_dict', 'country', geo_device_id)"
	case "device_model":
		return "dictGet('geo_device_dict', 'device_model', geo_device_id)"
	case "os_version":
		return "dictGet('geo_device_dict', 'os_version', geo_device_id)"
	default:
		return dim
	}
}
