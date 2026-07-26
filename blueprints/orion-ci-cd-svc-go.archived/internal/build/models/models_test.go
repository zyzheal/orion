package models

import (
	"testing"
	"time"
)

func TestBuild_Fields(t *testing.T) {
	now := time.Now()
	build := Build{
		ID:          "test-id",
		TenantID:    "tenant-1",
		RepoID:      strPtr("repo-1"),
		Branch:      "main",
		CommitSHA:   "abc123",
		Status:      "pending",
		StartedAt:   &now,
		CompletedAt: nil,
		Logs:        strPtr("logs"),
		CreatedAt:   now,
	}

	if build.ID != "test-id" {
		t.Errorf("expected ID 'test-id', got '%s'", build.ID)
	}
	if build.TenantID != "tenant-1" {
		t.Errorf("expected TenantID 'tenant-1', got '%s'", build.TenantID)
	}
	if *build.RepoID != "repo-1" {
		t.Errorf("expected RepoID 'repo-1', got '%s'", *build.RepoID)
	}
	if build.Branch != "main" {
		t.Errorf("expected Branch 'main', got '%s'", build.Branch)
	}
	if build.CommitSHA != "abc123" {
		t.Errorf("expected CommitSHA 'abc123', got '%s'", build.CommitSHA)
	}
	if build.Status != "pending" {
		t.Errorf("expected Status 'pending', got '%s'", build.Status)
	}
	if build.CompletedAt != nil {
		t.Error("expected CompletedAt to be nil")
	}
}

func TestPaginatedRequest_Defaults(t *testing.T) {
	p := PaginatedRequest{}

	offset := p.Offset()
	if offset != 0 {
		t.Errorf("expected offset 0, got %d", offset)
	}

	limit := p.Limit()
	if limit != 20 {
		t.Errorf("expected limit 20, got %d", limit)
	}
}

func TestPaginatedRequest_Values(t *testing.T) {
	p := PaginatedRequest{Page: 2, PageSize: 50}

	offset := p.Offset()
	if offset != 50 {
		t.Errorf("expected offset 50, got %d", offset)
	}

	limit := p.Limit()
	if limit != 50 {
		t.Errorf("expected limit 50, got %d", limit)
	}
}

func TestPaginatedRequest_MaxPageSize(t *testing.T) {
	p := PaginatedRequest{Page: 1, PageSize: 200}

	limit := p.Limit()
	if limit != 100 {
		t.Errorf("expected limit 100 (max), got %d", limit)
	}
}

func strPtr(s string) *string {
	return &s
}
