package devops

import (
	"testing"
)

func TestExtractVersion(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"001_create_users.sql", "001"},
		{"20260826_add_index.sql", "20260826"},
		{"00099_fix_types.sql", "00099"},
		{"create_table.sql", "create"},
		{"file.sql", "file"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := extractVersion(tt.input)
			if result != tt.expected {
				t.Errorf("extractVersion(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestValidateCreateRequest(t *testing.T) {
	tests := []struct {
		name        string
		req         *CreateRequest
		shouldError bool
	}{
		{"nil request", nil, true},
		{"empty tenant", &CreateRequest{TenantID: "", Name: "test"}, true},
		{"valid request", &CreateRequest{TenantID: "t1", Name: "valid"}, false},
		{"name too long", &CreateRequest{TenantID: "t1", Name: string(make([]byte, 129))}, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateCreateRequest(tt.req)
			if tt.shouldError && err == nil {
				t.Error("expected error, got nil")
			}
			if !tt.shouldError && err != nil {
				t.Errorf("expected no error, got %v", err)
			}
		})
	}
}

func TestValidateListRequest(t *testing.T) {
	req := &ListRequest{}
	result := ValidateListRequest(req)

	if result.Page != 1 {
		t.Errorf("Page = %d, want 1", result.Page)
	}
	if result.PageSize != 20 {
		t.Errorf("PageSize = %d, want 20", result.PageSize)
	}
	if result.SortBy != "created_at" {
		t.Errorf("SortBy = %q, want %q", result.SortBy, "created_at")
	}
}

func TestValidateListRequestPageSizeLimit(t *testing.T) {
	req := &ListRequest{PageSize: 999}
	result := ValidateListRequest(req)
	if result.PageSize != 100 {
		t.Errorf("PageSize = %d, want 100 (capped)", result.PageSize)
	}
}

func TestValidateListRequestPageNegative(t *testing.T) {
	req := &ListRequest{Page: -1}
	result := ValidateListRequest(req)
	if result.Page != 1 {
		t.Errorf("Page = %d, want 1", result.Page)
	}
}
