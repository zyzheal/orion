package models

import "testing"

func TestPluginFields(t *testing.T) {
	d := Plugin{ID: "d1", TenantID: "t1", Description: "", Version: "", Author: "", Enabled: false, Config: nil, Entrypoint: ""}
	if d.TenantID != "t1" { t.Errorf("expected t1, got %s", d.TenantID) }
}

func TestPaginatedDefaults(t *testing.T) {
	p := PaginatedRequest{}
	if p.Limit() != 20 { t.Errorf("expected 20, got %d", p.Limit()) }
}
