-- PostgreSQL 初始化脚本
-- 创建扩展、用户和基础数据库

-- 启用常用扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- 创建应用用户
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'orion_app') THEN
        CREATE ROLE orion_app WITH LOGIN PASSWORD 'orion_app_password';
    END IF;
END
$$;

-- 创建复制用户
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'replicator') THEN
        CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'replicator_password';
    END IF;
END
$$;

-- 创建多租户数据库
CREATE DATABASE orion_tenant_db
    WITH
    OWNER = orion_app
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TEMPLATE = template0;

-- 创建审计数据库
CREATE DATABASE orion_audit_db
    WITH
    OWNER = orion_app
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TEMPLATE = template0;

-- 授予权限
GRANT ALL PRIVILEGES ON DATABASE orion_tenant_db TO orion_app;
GRANT ALL PRIVILEGES ON DATABASE orion_audit_db TO orion_app;

\c orion_tenant_db

-- 创建模式
CREATE SCHEMA IF NOT EXISTS core AUTHORIZATION orion_app;
CREATE SCHEMA IF NOT EXISTS cmdb AUTHORIZATION orion_app;
CREATE SCHEMA IF NOT EXISTS cicd AUTHORIZATION orion_app;
CREATE SCHEMA IF NOT EXISTS gitops AUTHORIZATION orion_app;
CREATE SCHEMA IF NOT EXISTS ai AUTHORIZATION orion_app;
CREATE SCHEMA IF NOT EXISTS audit AUTHORIZATION orion_app;

-- 默认模式搜索路径
ALTER ROLE orion_app SET search_path TO core, cmdb, cicd, gitops, ai, audit, public;

\c orion_audit_db

-- 创建审计模式
CREATE SCHEMA IF NOT EXISTS audit AUTHORIZATION orion_app;
