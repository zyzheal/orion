-- TASK-104: Plugin Management Database Schema
-- 创建插件管理数据库表结构

-- 插件类型枚举
CREATE TYPE plugin_type AS ENUM (
    'CUSTOM_TASK',
    'WEBHOOK_HANDLER',
    'AI_SKILL',
    'APPROVAL_PROVIDER',
    'NOTIFICATION_CHANNEL',
    'DEPLOYMENT_STRATEGY'
);

-- 安全等级枚举
CREATE TYPE security_level AS ENUM (
    'HIGH',
    'MEDIUM',
    'LOW'
);

-- 插件状态枚举
CREATE TYPE plugin_state AS ENUM (
    'AVAILABLE',
    'DOWNLOADED',
    'INSTALLED',
    'ACTIVE',
    'CONFIGURED',
    'INACTIVE',
    'UNINSTALLED'
);

-- 插件表
CREATE TABLE plugins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    version VARCHAR(100) NOT NULL,
    description TEXT,
    author VARCHAR(255) NOT NULL,
    tags TEXT[] DEFAULT '{}',
    type plugin_type NOT NULL,
    security_level security_level NOT NULL,
    config_schema JSONB DEFAULT '{}',
    state plugin_state NOT NULL DEFAULT 'AVAILABLE',
    installed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 唯一约束：name + version
    UNIQUE(name, version)
);

-- 插件标签表
CREATE TABLE plugin_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(plugin_id, tag)
);

-- 插件下载记录表
CREATE TABLE plugin_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
    downloaded_by VARCHAR(100) NOT NULL,
    downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- 插件使用统计表
CREATE TABLE plugin_usage_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL,
    usage_count INTEGER NOT NULL DEFAULT 1,
    execution_time_ms INTEGER,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(plugin_id, usage_date)
);

-- 创建索引
CREATE INDEX idx_plugins_name ON plugins(name);
CREATE INDEX idx_plugins_type ON plugins(type);
CREATE INDEX idx_plugins_state ON plugins(state);
CREATE INDEX idx_plugins_created_at ON plugins(created_at);
CREATE INDEX idx_plugins_tags ON plugins USING GIN(tags);
CREATE INDEX idx_plugin_tags_plugin_id ON plugin_tags(plugin_id);
CREATE INDEX idx_plugin_downloads_plugin_id ON plugin_downloads(plugin_id);
CREATE INDEX idx_plugin_usage_stats_plugin_id ON plugin_usage_stats(plugin_id);
CREATE INDEX idx_plugin_usage_stats_date ON plugin_usage_stats(usage_date);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_plugins_updated_at 
    BEFORE UPDATE ON plugins 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 创建插件使用统计触发器
CREATE OR REPLACE FUNCTION update_plugin_usage_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO plugin_usage_stats (plugin_id, usage_date, usage_count, execution_time_ms, success_count, failure_count)
        VALUES (
            NEW.plugin_id,
            NEW.downloaded_at::DATE,
            1,
            NULL,
            CASE WHEN NEW.success THEN 1 ELSE 0 END,
            CASE WHEN NOT NEW.success THEN 1 ELSE 0 END
        )
        ON CONFLICT (plugin_id, usage_date) DO UPDATE SET
            usage_count = plugin_usage_stats.usage_count + 1,
            execution_time_ms = COALESCE(NEW.execution_time_ms, plugin_usage_stats.execution_time_ms),
            success_count = plugin_usage_stats.success_count + CASE WHEN NEW.success THEN 1 ELSE 0 END,
            failure_count = plugin_usage_stats.failure_count + CASE WHEN NOT NEW.success THEN 1 ELSE 0 END;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_plugin_usage_stats
    AFTER INSERT ON plugin_downloads
    FOR EACH ROW
    EXECUTE FUNCTION update_plugin_usage_stats();