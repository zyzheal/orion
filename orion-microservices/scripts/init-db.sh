#!/bin/bash
# ==========================================
# PostgreSQL - 数据库初始化脚本
# 在 Docker entrypoint 时执行
# ==========================================
set -e

POSTGRES_USER="${POSTGRES_USER:-orion}"

echo "Initializing Orion databases..."

# 创建所有微服务数据库
for DB in platform_db pipeline_db deploy_db ticket_db monitor_db intelligence_db agent_db finops_db code_db plugin_db ai_db security_db artifact_db; do
    echo "Creating database: $DB"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
        SELECT 'CREATE DATABASE $DB' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB')\\gexec
        GRANT ALL PRIVILEGES ON DATABASE $DB TO $POSTGRES_USER;
EOSQL
done

echo "All databases created successfully."
