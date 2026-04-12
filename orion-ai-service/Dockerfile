# ==================== 构建阶段 ====================
FROM python:3.11-slim AS builder

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# 复制应用代码
COPY src/ ./src/

# ==================== 运行阶段 ====================
FROM python:3.11-slim

LABEL maintainer="orion-team"
LABEL description="Orion AI Service - AI 增强域基础服务"

WORKDIR /app

# 从构建阶段复制依赖和代码
COPY --from=builder /install /usr/local
COPY --from=builder /app/src ./src

# 创建非 root 用户
RUN groupadd -r orion && useradd -r -g orion -d /app -s /sbin/nologin orion
RUN chown -R orion:orion /app
USER orion

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/ai/healthz')" || exit 1

# 启动命令
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
