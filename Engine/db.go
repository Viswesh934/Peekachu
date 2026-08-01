package main

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

func ConnectClickHouse() (driver.Conn, error) {
	chURL := os.Getenv("CLICKHOUSE_URL")
	if chURL == "" {
		chURL = "https://v8k6il94hg.ap-south-1.aws.clickhouse.cloud:8443"
	}
	username := os.Getenv("CLICKHOUSE_USERNAME")
	if username == "" {
		username = "default"
	}
	password := os.Getenv("CLICKHOUSE_PASSWORD")
	if password == "" {
		password = "i2D_29fLWj8i3"
	}

	// Parse host and port from URL
	parsedURL, err := url.Parse(chURL)
	var host string
	var port uint16 = 9440
	useTLS := true
	useHTTP := false

	if err == nil {
		host = parsedURL.Hostname()
		pStr := parsedURL.Port()
		if pStr != "" {
			pInt, _ := strconv.Atoi(pStr)
			if pInt > 0 {
				port = uint16(pInt)
			}
		}
		if parsedURL.Scheme == "http" {
			useTLS = false
		}
		if port == 8443 || port == 80 {
			useHTTP = true
		}
	} else {
		host = "v8k6il94hg.ap-south-1.aws.clickhouse.cloud"
	}

	addr := fmt.Sprintf("%s:%d", host, port)

	opt := clickhouse.Options{
		Addr: []string{addr},
		Auth: clickhouse.Auth{
			Database: "default",
			Username: username,
			Password: password,
		},
		DialTimeout:     30 * time.Second,
		MaxOpenConns:    32,
		MaxIdleConns:    16,
		ConnMaxLifetime: 10 * time.Minute,
	}

	if useHTTP {
		opt.Protocol = clickhouse.HTTP
		if useTLS {
			opt.TLS = &tls.Config{InsecureSkipVerify: true}
		}
	} else {
		opt.Protocol = clickhouse.Native
		if useTLS {
			opt.TLS = &tls.Config{InsecureSkipVerify: true}
		}
	}

	conn, err := clickhouse.Open(&opt)
	if err != nil {
		return nil, fmt.Errorf("failed to open clickhouse connection: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := conn.Ping(ctx); err != nil {
		// If native connection fails, try fallback to HTTP on 8443
		if opt.Protocol == clickhouse.Native {
			fmt.Printf("Native connection failed (%v), trying HTTP fallback...\n", err)
			opt.Protocol = clickhouse.HTTP
			opt.Addr = []string{fmt.Sprintf("%s:8443", host)}
			opt.TLS = &tls.Config{InsecureSkipVerify: true}
			conn, err = clickhouse.Open(&opt)
			if err != nil {
				return nil, fmt.Errorf("http fallback open failed: %w", err)
			}
			if err := conn.Ping(ctx); err != nil {
				return nil, fmt.Errorf("http fallback ping failed: %w", err)
			}
		} else {
			return nil, fmt.Errorf("clickhouse ping failed: %w", err)
		}
	}

	fmt.Printf("Successfully connected to ClickHouse at %s\n", strings.Join(opt.Addr, ","))
	return conn, nil
}
