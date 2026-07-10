package models

import "testing"

func TestArtifactFields(t *testing.T) {
	d := Artifact{ID: "d1", TenantID: "t1", Description: "", Type: "", Version: "", RepoURL: "", SizeBytes: int64(0), Metadata: nil}
	if d.TenantID != "t1" { t.Errorf("expected t1, got %s", d.TenantID) }
}

func TestPaginatedDefaults(t *testing.T) {
	p := PaginatedRequest{}
	if p.Limit() != 20 { t.Errorf("expected 20, got %d", p.Limit()) }
}
