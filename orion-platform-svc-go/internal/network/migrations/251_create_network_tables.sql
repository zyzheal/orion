-- 251_create_network_tables.sql
-- Network module: VPC, Subnet, FirewallRule, LoadBalancer, DNSRecord tables.

-- VPC
CREATE TABLE IF NOT EXISTS vpcs (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    cidr VARCHAR(45) NOT NULL,
    region VARCHAR(50) DEFAULT '',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vpcs_tenant_id ON vpcs (tenant_id);

-- Subnet
CREATE TABLE IF NOT EXISTS subnets (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    vpc_id UUID NOT NULL REFERENCES vpcs(id),
    name VARCHAR(255) NOT NULL,
    cidr VARCHAR(45) NOT NULL,
    availability_zone VARCHAR(50),
    status VARCHAR(20) DEFAULT 'available',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subnets_tenant_id ON subnets (tenant_id);
CREATE INDEX IF NOT EXISTS idx_subnets_vpc_id ON subnets (vpc_id);

-- FirewallRule
CREATE TABLE IF NOT EXISTS firewall_rules (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    vpc_id UUID NOT NULL REFERENCES vpcs(id),
    name VARCHAR(255) NOT NULL,
    protocol VARCHAR(10) NOT NULL,
    direction VARCHAR(10) NOT NULL,
    source_cidr VARCHAR(45) DEFAULT '0.0.0.0/0',
    dest_cidr VARCHAR(45) DEFAULT '0.0.0.0/0',
    port_from INT DEFAULT 0,
    port_to INT DEFAULT 65535,
    action VARCHAR(10) NOT NULL,
    priority INT DEFAULT 100,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_firewall_rules_tenant_id ON firewall_rules (tenant_id);
CREATE INDEX IF NOT EXISTS idx_firewall_rules_vpc_id ON firewall_rules (vpc_id);

-- LoadBalancer
CREATE TABLE IF NOT EXISTS load_balancers (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    vpc_id UUID NOT NULL REFERENCES vpcs(id),
    scheme VARCHAR(20) DEFAULT 'internet-facing',
    type VARCHAR(10) DEFAULT 'nlb',
    dns_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'provisioning',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_load_balancers_tenant_id ON load_balancers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_load_balancers_vpc_id ON load_balancers (vpc_id);

-- DNSRecord
CREATE TABLE IF NOT EXISTS dns_records (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    zone_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(10) NOT NULL,
    value TEXT NOT NULL,
    ttl INT DEFAULT 300,
    priority INT DEFAULT 0,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dns_records_tenant_id ON dns_records (tenant_id);
CREATE INDEX IF NOT EXISTS idx_dns_records_zone_id ON dns_records (zone_id);
