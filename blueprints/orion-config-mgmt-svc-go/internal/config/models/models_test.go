package models

import "testing"

func TestConfigItemFields(t *testing.T) {
	c := ConfigItem{ID: "c1", TenantID: "t1", Key: "max_retries", Value: "3", Environment: "production", Version: 1}
	if c.Key != "max_retries" { t.Errorf("expected max_retries, got %s", c.Key) }
}

func TestPaginatedDefaults(t *testing.T) {
	p := PaginatedRequest{}
	if p.Limit() != 20 { t.Errorf("expected 20, got %d", p.Limit()) }
}
