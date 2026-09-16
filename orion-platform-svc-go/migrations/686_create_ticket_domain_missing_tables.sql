-- ticket 领域: 8 张表无 CREATE TABLE。
--
-- internal/ticket/repository 与 internal/ticketing/repository 两组仓库 (语句逐条
-- 比对后确认字节相同) 读写这 8 张表:
--   ticket_comments   ticket.go:165 ListComments / 181 AddComment
--                     (GET /tickets/:id/comments, POST /tickets/:id/comments)
--   sla_targets       POST /tickets/sla/targets, GET /tickets/sla/compliance
--   sla_records       GET /tickets/sla/breaches (sla.go / sla_policy.go)
--   dispatch_engineers  GET /tickets/dispatch/balancing/{report,suggestions,available}
--   dispatch_queue    GET /tickets/dispatch/queue/{sla-status,sla-entries,sla-alerts}
--                     POST /tickets/dispatch/queue/reprioritize
--   dispatch_records  POST /tickets/:id/dispatch/{auto,manual}
--   dispatch_rules
--   suspend_records   POST /tickets/transfer/suspend/:suspendId
--
-- 076_create_ticketing_tables.sql 只建了 ticketing_ 前缀的 17 张表, 从不建这 8 张
-- 无前缀的表; 两组语句虽然相同, 但内部模块用的是无前缀名。所以这 24 条在册路由
-- 全部在驱动层以 `relation "ticket_comments" does not exist` 失败。
--
-- created_at / updated_at 必须带 DEFAULT NOW(): 这 8 张表的每一条 INSERT 都故意
-- 不写这两个列 (comment.Create 只写 5 列, sla.CreateTarget 只写 6 列, suspend.Create
-- 只写 11 列), 仓库层也不填充它们。声明 NOT NULL 而不给 DEFAULT 会让每条在册路由
-- 的 INSERT 直接 500。
--
-- 故意不给 sla_records / suspend_records / ticket_comments 加 tenant_id:
-- 全代码库没有任何一条 INSERT 写入这三张表的 tenant_id, 也没有任何仓库方法带
-- tenantID 参数。加一个永远为 NULL 的列并加 WHERE 谓词, 会把每个合法调用变成
-- "not found" —— 是行为破坏, 不是修复。ticket_comments 的租户隔离已经通过父工单
-- 实现 (service 先调 s.repo.GetByID(ctx, ticketID, tenantID))。
-- sla_targets 例外: sla_policy.go:154 的 JOIN 谓词 t.tenant_id = $1 引用了该列,
-- 因此按 nullable 建出来, 让这条引用有列可读。
--
-- 故意不从这 8 张表向 tickets(id) 建外键: tickets.id 是 UUID, 而这些模型的
-- id / ticket_id 字段全是 string (TEXT), 类型不匹配会导致建表直接失败。
--
-- dispatch_queue 的主键是 ticket_id 而不是 id: models.DispatchQueueEntry 没有
-- id 字段, 且 Enqueue 用 ON CONFLICT (ticket_id) DO NOTHING —— 该子句要求
-- ticket_id 上有唯一约束, 否则 SQL 直接报 no unique or exclusion constraint。

CREATE TABLE IF NOT EXISTS sla_targets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    priority TEXT NOT NULL,
    target_response_time_ms BIGINT NOT NULL,
    target_resolution_time_ms BIGINT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    tenant_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_targets_priority ON sla_targets(priority);
CREATE INDEX IF NOT EXISTS idx_sla_targets_enabled ON sla_targets(enabled);

CREATE TABLE IF NOT EXISTS sla_records (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    sla_target_id TEXT REFERENCES sla_targets(id),
    priority TEXT NOT NULL,
    response_deadline_at TIMESTAMPTZ NOT NULL,
    resolution_deadline_at TIMESTAMPTZ NOT NULL,
    breached BOOLEAN NOT NULL DEFAULT FALSE,
    paused BOOLEAN NOT NULL DEFAULT FALSE,
    responded_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    breach_type TEXT NOT NULL DEFAULT '',
    paused_at TIMESTAMPTZ,
    paused_reason TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_records_ticket ON sla_records(ticket_id);
CREATE INDEX IF NOT EXISTS idx_sla_records_target ON sla_records(sla_target_id);
CREATE INDEX IF NOT EXISTS idx_sla_records_breached ON sla_records(breached);
CREATE INDEX IF NOT EXISTS idx_sla_records_priority ON sla_records(priority);
CREATE INDEX IF NOT EXISTS idx_sla_records_created ON sla_records(created_at);
CREATE INDEX IF NOT EXISTS idx_sla_records_resolution ON sla_records(resolution_deadline_at);

CREATE TABLE IF NOT EXISTS ticket_comments (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);

CREATE TABLE IF NOT EXISTS dispatch_engineers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    expertise TEXT NOT NULL DEFAULT '[]',
    current_load INTEGER NOT NULL DEFAULT 0,
    max_capacity INTEGER NOT NULL DEFAULT 0,
    availability TEXT NOT NULL,
    skills TEXT NOT NULL DEFAULT '[]',
    team TEXT NOT NULL DEFAULT '',
    on_call BOOLEAN NOT NULL DEFAULT FALSE,
    total_resolved INTEGER NOT NULL DEFAULT 0,
    avg_resolution_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
    sla_compliance DOUBLE PRECISION NOT NULL DEFAULT 0,
    success_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_engineers_name ON dispatch_engineers(name);
CREATE INDEX IF NOT EXISTS idx_dispatch_engineers_team ON dispatch_engineers(team);
CREATE INDEX IF NOT EXISTS idx_dispatch_engineers_availability ON dispatch_engineers(availability);

CREATE TABLE IF NOT EXISTS dispatch_records (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    engineer_id TEXT NOT NULL,
    assigned_by TEXT NOT NULL DEFAULT '',
    method TEXT NOT NULL,
    score DOUBLE PRECISION NOT NULL DEFAULT 0,
    reason TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_records_ticket ON dispatch_records(ticket_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_records_engineer ON dispatch_records(engineer_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_records_method ON dispatch_records(method);
CREATE INDEX IF NOT EXISTS idx_dispatch_records_created ON dispatch_records(created_at);

CREATE TABLE IF NOT EXISTS dispatch_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    condition TEXT NOT NULL,
    engineer_id TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_rules_priority ON dispatch_rules(priority);
CREATE INDEX IF NOT EXISTS idx_dispatch_rules_name ON dispatch_rules(name);
CREATE INDEX IF NOT EXISTS idx_dispatch_rules_engineer ON dispatch_rules(engineer_id);

CREATE TABLE IF NOT EXISTS dispatch_queue (
    ticket_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    priority TEXT NOT NULL,
    enqueued_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_dispatch_queue_tenant ON dispatch_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_queue_priority ON dispatch_queue(priority);
CREATE INDEX IF NOT EXISTS idx_dispatch_queue_enqueued ON dispatch_queue(enqueued_at);

CREATE TABLE IF NOT EXISTS suspend_records (
    id TEXT PRIMARY KEY,
    engineer_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    backup_engineer_id TEXT NOT NULL DEFAULT '',
    auto_reassign_pending BOOLEAN NOT NULL DEFAULT FALSE,
    pause_sla_for_pending BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL DEFAULT '',
    activated_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suspend_records_engineer ON suspend_records(engineer_id);
CREATE INDEX IF NOT EXISTS idx_suspend_records_status ON suspend_records(status);
