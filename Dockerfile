# ==========================================
# Stage 1: Build React Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Build Go RCA Engine
# ==========================================
FROM golang:1.23-alpine AS engine-builder
WORKDIR /app/engine
COPY Engine/go.mod Engine/go.sum ./
RUN go mod download
COPY Engine/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o rca-engine .

# ==========================================
# Stage 3: Build Fastify TypeScript Backend
# ==========================================
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY Backend/package*.json ./
RUN npm ci
COPY Backend/ ./
RUN npm run build

# ==========================================
# Stage 4: Production Runtime Image
# ==========================================
FROM node:20-alpine

# Install Nginx
RUN apk add --no-cache nginx

WORKDIR /app

# Copy Frontend static build to Nginx directory
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Copy Go Engine executable
COPY --from=engine-builder /app/engine/rca-engine /app/engine/rca-engine

# Copy Backend compiled code and node_modules
COPY --from=backend-builder /app/backend/dist /app/backend/dist
COPY --from=backend-builder /app/backend/node_modules /app/backend/node_modules
COPY --from=backend-builder /app/backend/package.json /app/backend/package.json

# Copy Nginx config and entrypoint script
COPY nginx.conf /etc/nginx/http.d/default.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80 5001 8081

CMD ["/entrypoint.sh"]
