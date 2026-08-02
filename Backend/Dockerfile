# ==========================================
# Stage 1: Build Go RCA Engine
# ==========================================
FROM golang:1.22-alpine AS engine-builder
WORKDIR /app/engine
COPY Engine/go.mod Engine/go.sum ./
RUN go mod download
COPY Engine/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o rca-engine main.go db.go engine.go metrics.go types.go

# ==========================================
# Stage 2: Build Fastify Backend
# ==========================================
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY Backend/package*.json ./
RUN npm ci
COPY Backend/ ./
RUN npm run build

# ==========================================
# Stage 3: Production Runtime Image for Render
# ==========================================
FROM node:20-alpine
WORKDIR /app

# Copy Go Engine executable
COPY --from=engine-builder /app/engine/rca-engine /app/rca-engine

# Copy Backend compiled code and dependencies
COPY --from=backend-builder /app/backend/dist /app/dist
COPY --from=backend-builder /app/backend/node_modules /app/node_modules
COPY --from=backend-builder /app/backend/package.json /app/package.json

# Copy startup script
COPY Backend/render-start.sh /app/render-start.sh
RUN chmod +x /app/render-start.sh

# Environment variables
ENV HOST=0.0.0.0
ENV PORT=10000
ENV RCA_ENGINE_PORT=8081
ENV RCA_ENGINE_URL=http://127.0.0.1:8081/analyze

EXPOSE 10000

CMD ["/app/render-start.sh"]
