@echo off
echo ========================================================
echo   Starting Peekachu RCA Platform Services
echo ========================================================

echo [1/2] Ensuring LibreChat & ClickHouse MCP Docker services are running...
cd LibreChat
docker compose -f deploy-compose.yml -f docker-compose.override.yml up -d
cd ..

echo [2/2] Launching Go Engine (8082), Fastify Backend (5001), and Frontend (3000)...
npm run dev
