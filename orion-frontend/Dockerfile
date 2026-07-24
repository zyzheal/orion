# Orion Frontend - Multi-stage Dockerfile
# 使用 Debian-slim (glibc) 替代 Alpine (musl)，兼容 Rocky Linux 8+ / RHEL / CentOS
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --production=false

COPY . .
RUN npm run build

# ==================== Production (nginx) ====================
FROM nginx:stable-slim AS production

COPY --from=builder /app/dist /usr/share/nginx/html

# nginx 配置：将 API 请求代理到 API Gateway
RUN cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 请求代理到 API Gateway
    location /api/ {
        proxy_pass http://api-gateway:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        access_log off;
        return 200 "OK";
        add_header Content-Type text/plain;
    }
}
EOF

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]