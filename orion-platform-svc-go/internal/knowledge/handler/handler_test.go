package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestNewHandler(t *testing.T) {
	h := NewHandler(nil)
	if h == nil {
		t.Fatal("NewHandler returned nil")
	}
}

func TestMakeCtx(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(http.MethodGet, "/test", nil)
	if c.GetString("tenant_id") != "tenant-1" {
		t.Fatal("tenant_id not set")
	}
}

func TestRAGRetrieveRequestBinding(t *testing.T) {
	body, _ := json.Marshal(map[string]string{"query": "test"})
	r := httptest.NewRequest(http.MethodPost, "/", bytes.NewBuffer(body))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = r
	c.Set("tenant_id", "t1")

	var req struct {
		Query string `json:"query" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		t.Fatalf("bind failed: %v", err)
	}
	if req.Query != "test" {
		t.Fatalf("expected 'test', got %q", req.Query)
	}
}

func TestRAGRetrieveEmptyQuery(t *testing.T) {
	body, _ := json.Marshal(map[string]string{"query": ""})
	r := httptest.NewRequest(http.MethodPost, "/", bytes.NewBuffer(body))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = r

	var req struct {
		Query string `json:"query" binding:"required"`
	}
	err := c.ShouldBindJSON(&req)
	if err == nil {
		t.Fatal("expected validation error for empty query")
	}
}

func TestRAGFeedbackRequestBinding(t *testing.T) {
	body, _ := json.Marshal(map[string]interface{}{
		"token":       "tok-123",
		"is_positive": true,
	})
	r := httptest.NewRequest(http.MethodPost, "/", bytes.NewBuffer(body))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = r
	c.Set("tenant_id", "t1")

	var req struct {
		Token      string `json:"token"`
		IsPositive bool   `json:"is_positive"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		t.Fatalf("bind failed: %v", err)
	}
	if req.Token != "tok-123" || !req.IsPositive {
		t.Fatalf("unexpected values: token=%s positive=%v", req.Token, req.IsPositive)
	}
}

func TestRAGQueryRequestBinding(t *testing.T) {
	body, _ := json.Marshal(map[string]interface{}{
		"query": "how to deploy",
		"top_k": 5,
	})
	r := httptest.NewRequest(http.MethodPost, "/", bytes.NewBuffer(body))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = r
	c.Set("tenant_id", "t1")

	var req struct {
		Query string `json:"query"`
		TopK  int    `json:"top_k"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		t.Fatalf("bind failed: %v", err)
	}
	if req.Query != "how to deploy" || req.TopK != 5 {
		t.Fatalf("unexpected values: query=%s top_k=%d", req.Query, req.TopK)
	}
}
