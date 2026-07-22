-- Incident-Action module tables (auto-generated)

CREATE TABLE IF NOT EXISTS l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns (
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

CREATE INDEX IF NOT EXISTS idx_l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns_tenant ON l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns_created ON l_i_l_n_l_c_l_i_l_d_l_e_l_n_l_t_lu_l_a_l_c_l_t_l_i_l_o_l_ns(created_at DESC);

