package models

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestSkillPackageFields(t *testing.T) {
	d := SkillPackage{ID: "d1", Name: "test-skill", Category: "ai", Version: "1.0.0"}
	if d.Name != "test-skill" {
		t.Errorf("expected test-skill, got %s", d.Name)
	}
	if d.Category != "ai" {
		t.Errorf("expected ai, got %s", d.Category)
	}
}

func TestPaginatedDefaults(t *testing.T) {
	p := PaginatedRequest{}
	if p.Limit() != 20 {
		t.Errorf("expected 20, got %d", p.Limit())
	}
	if p.Offset() != 0 {
		t.Errorf("expected 0, got %d", p.Offset())
	}
}

func TestPaginatedCustomValues(t *testing.T) {
	p := PaginatedRequest{Page: 3, PageSize: 50}
	if p.Limit() != 50 {
		t.Errorf("expected 50, got %d", p.Limit())
	}
	if p.Offset() != 100 {
		t.Errorf("expected 100, got %d", p.Offset())
	}
}

func TestPaginatedMaxPageSize(t *testing.T) {
	p := PaginatedRequest{PageSize: 500}
	if p.Limit() != 100 {
		t.Errorf("expected 100 (max), got %d", p.Limit())
	}
}

func TestJSONBValueNil(t *testing.T) {
	var j JSONB
	v, err := j.Value()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != nil {
		t.Errorf("expected nil, got %v", v)
	}
}

func TestJSONBValueNonNil(t *testing.T) {
	j := JSONB{"key": "val"}
	v, err := j.Value()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v == nil {
		t.Error("expected non-nil value")
	}
}

func TestJSONBScanNil(t *testing.T) {
	var j JSONB
	if err := j.Scan(nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if j != nil {
		t.Errorf("expected nil, got %v", j)
	}
}

func TestJSONBScanBytes(t *testing.T) {
	var j JSONB
	if err := j.Scan([]byte(`{"a":1}`)); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if j["a"] != float64(1) {
		t.Errorf("expected 1, got %v", j["a"])
	}
}

func TestStringArrayValueNil(t *testing.T) {
	var a StringArray
	v, err := a.Value()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != nil {
		t.Errorf("expected nil, got %v", v)
	}
}

func TestStringArrayScanBytes(t *testing.T) {
	var a StringArray
	if err := a.Scan([]byte(`["x","y"]`)); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(a) != 2 || a[0] != "x" || a[1] != "y" {
		t.Errorf("unexpected result: %v", a)
	}
}

// The tenant fields used to carry `binding:"required"`. That made the handler's
// `if req.TenantID == "" { req.TenantID = tenantID }` fallback unreachable: any
// request without a body tenant was rejected before the handler ran, so the
// body tenant won unconditionally. These tests pin that the field is optional —
// otherwise the fix would still let the body tenant choose.
func TestCreateInstanceRequest_TenantIDIsOptional(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(
		"POST", "/api/v1/skills/sk-1/instances",
		strings.NewReader(`{"skill_id":"sk-1","name":"instance-a"}`),
	)
	c.Request.Header.Set("Content-Type", "application/json")

	var req CreateInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		t.Fatalf("tenant_id must not be required: %v", err)
	}
	if req.Name != "instance-a" {
		t.Errorf("name = %q, want instance-a", req.Name)
	}
}

func TestCreateExecutionRequest_TenantIDIsOptional(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(
		"POST", "/api/v1/skills/sk-1/execute",
		strings.NewReader(`{"skill_id":"sk-1"}`),
	)
	c.Request.Header.Set("Content-Type", "application/json")

	var req CreateExecutionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		t.Fatalf("tenant_id must not be required: %v", err)
	}
}

// With a body tenant present the field still binds (backwards compatible), it
// just no longer governs anything.
func TestCreateInstanceRequest_BodyTenantStillBinds(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(
		"POST", "/api/v1/skills/sk-1/instances",
		strings.NewReader(`{"skill_id":"sk-1","name":"instance-a","tenant_id":"attacker-tenant"}`),
	)
	c.Request.Header.Set("Content-Type", "application/json")

	var req CreateInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		t.Fatalf("unexpected bind error: %v", err)
	}
	if req.TenantID != "attacker-tenant" {
		t.Errorf("tenant_id = %q, want attacker-tenant (bound, then ignored)", req.TenantID)
	}
}
