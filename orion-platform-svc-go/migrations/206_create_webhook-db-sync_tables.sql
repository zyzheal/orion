-- Webhook-Db-Sync module tables (auto-generated)

CREATE TABLE IF NOT EXISTS l_w_l_e_l_u_l_h_l_o_l_o_l_k_lu_l_d_l_u_lu_l_s_l_y_l_n_l_cs (
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

CREATE INDEX IF NOT EXISTS idx_l_w_l_e_l_u_l_h_l_o_l_o_l_k_lu_l_d_l_u_lu_l_s_l_y_l_n_l_cs_tenant ON l_w_l_e_l_u_l_h_l_o_l_o_l_k_lu_l_d_l_u_lu_l_s_l_y_l_n_l_cs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_l_w_l_e_l_u_l_h_l_o_l_o_l_k_lu_l_d_l_u_lu_l_s_l_y_l_n_l_cs_created ON l_w_l_e_l_u_l_h_l_o_l_o_l_k_lu_l_d_l_u_lu_l_s_l_y_l_n_l_cs(created_at DESC);

