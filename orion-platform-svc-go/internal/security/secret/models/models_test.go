package models

import "testing"

func TestSecretFields(t *testing.T) {
	s := Secret{ID: "s1", TenantID: "t1", Name: "DB_PASS", Value: "enc123", Version: 1, Env: "production"}
	if s.Name != "DB_PASS" { t.Errorf("expected DB_PASS, got %s", s.Name) }
}

func TestPaginatedDefaults(t *testing.T) {
	p := PaginatedRequest{}
	if p.Limit() != 20 { t.Errorf("expected 20, got %d", p.Limit()) }
}
