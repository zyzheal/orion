-- Webhook-Cache module tables (auto-generated)

CREATE TABLE IF NOT EXISTS l_w_l_e_l_u_l_h_l_o_l_o_l_k_lu_l_c_l_a_l_c_l_h_l_es (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_l_w_l_e_l_u_l_h_l_o_l_o_l_k_lu_l_c_l_a_l_c_l_h_l_es_tenant ON l_w_l_e_l_u_l_h_l_o_l_o_l_k_lu_l_c_l_a_l_c_l_h_l_es(tenant_id);
CREATE INDEX IF NOT EXISTS idx_l_w_l_e_l_u_l_h_l_o_l_o_l_k_lu_l_c_l_a_l_c_l_h_l_es_created ON l_w_l_e_l_u_l_h_l_o_l_o_l_k_lu_l_c_l_a_l_c_l_h_l_es(created_at DESC);

