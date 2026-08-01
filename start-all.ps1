Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Starting Peekachu RCA Platform Services" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

Write-Host "`n[1/2] Ensuring LibreChat & ClickHouse MCP Docker services are running..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\LibreChat"
docker compose -f deploy-compose.yml -f docker-compose.override.yml up -d
Set-Location "$PSScriptRoot"

Write-Host "`n[2/2] Launching Go Engine (8082), Fastify Backend (5001), and Frontend (3000)..." -ForegroundColor Green
npm run dev
