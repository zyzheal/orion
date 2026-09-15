-- 597_create_network_missing_tables.sql
-- network 模块 5 张表无 CREATE TABLE。
-- 回滚见 597_create_network_missing_tables_down.sql。

CREATE TABLE IF NOT EXISTS vpcs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL DEFAULT '',
    cidr        TEXT NOT NULL DEFAULT '',
    region      TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vpcs_tenant ON vpcs(tenant_id);

CREATE TABLE IF NOT EXISTS subnets (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL,
    vpc_id           UUID NOT NULL,
    name             TEXT NOT NULL DEFAULT '',
    cidr             TEXT NOT NULL DEFAULT '',
    availability_zone TEXT NOT NULL DEFAULT '',
    status           TEXT NOT NULL DEFAULT 'available',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subnets_tenant ON subnets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subnets_vpc ON subnets(vpc_id);

CREATE TABLE IF NOT EXISTS load_balancers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL DEFAULT '',
    vpc_id      UUID,
    scheme      TEXT NOT NULL DEFAULT 'internet-facing',
    type        TEXT NOT NULL DEFAULT 'application',
    dns_name    TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_load_balancers_tenant ON load_balancers(tenant_id);

CREATE TABLE IF NOT EXISTS firewall_rules (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    vpc_id       UUID NOT NULL,
    name         TEXT NOT NULL DEFAULT '',
    protocol     TEXT NOT NULL DEFAULT 'tcp',
    direction    TEXT NOT NULL DEFAULT 'ingress',
    source_cidr  TEXT NOT NULL DEFAULT '',
    dest_cidr    TEXT NOT NULL DEFAULT '',
    port_from    INTEGER,
    port_to      INTEGER,
    action       TEXT NOT NULL DEFAULT 'allow',
    priority     INTEGER NOT NULL DEFAULT 100,
    enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_firewall_rules_tenant ON firewall_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_firewall_rules_vpc ON firewall_rules(vpc_id);

CREATE TABLE IF NOT EXISTS dns_records (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    zone_id     UUID NOT NULL,
    name        TEXT NOT NULL DEFAULT '',
    type        TEXT NOT NULL DEFAULT 'A',
    value       TEXT NOT NULL DEFAULT '',
    ttl         INTEGER NOT NULL DEFAULT 3600,
    priority    INTEGER,
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dns_records_tenant ON dns_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dns_records_zone ON dns_records(zone_id);
