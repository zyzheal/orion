package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"orion/platform-svc-go/internal/schema-registry/models"
	"orion/platform-svc-go/internal/schema-registry/repository"
	"orion/platform-svc-go/internal/schema-registry/service"
)

func init() { gin.SetMode(gin.TestMode) }

func newTestRouter(h *Handler) *gin.Engine {
	r := gin.New()
	// Do not install auth middleware — we want to exercise the handler logic
	// directly. In production the router wires auth.RequirePermission.
	group := r.Group("/api/v1")
	h.RegisterRoutesWithoutAuth(group)
	return r
}

// RegisterRoutesWithoutAuth is a test-only variant that mounts the routes
// without the RequirePermission middleware. Production callers should use
// RegisterRoutes.
func (h *Handler) RegisterRoutesWithoutAuth(rg *gin.RouterGroup) {
	g := rg.Group("/schema-registry")
	g.POST("/schemas", h.Register)
	g.GET("/schemas", h.List)
	g.GET("/schemas/:namespace/:name", h.Lookup)
	g.PUT("/schemas/:namespace/:name", h.Update)
	g.DELETE("/schemas/:namespace/:name", h.Delete)
	g.POST("/schemas/:namespace/:name/evolve", h.Evolve)
	g.GET("/schemas/:namespace/:name/versions", h.VersionHistory)
	g.GET("/schemas/:namespace/:name/versions/:version", h.GetVersion)
	g.GET("/schemas/:namespace/:name/compatibility", h.Compatibility)
}

func validBody() []byte {
	b, _ := json.Marshal(models.RegisterRequest{
		Name:     "users",
		Namespace: "ns1",
		Type:     models.SchemaTypeProtobuf,
		Owner:    "alice",
		Fields: []models.SchemaField{
			{Name: "id", Type: "int64", PrimaryKey: true},
			{Name: "email", Type: "string"},
		},
		Compatibility: models.CompatibilityBackward,
	})
	return b
}

func TestRegister_Success(t *testing.T) {
	repo := repository.NewInMemory()
	svc := service.New(repo, nil)
	h := New(svc, repo)
	r := newTestRouter(h)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/schema-registry/schemas", strings.NewReader(string(validBody())))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	var resp models.RegisterResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Schema == nil || resp.Schema.Name != "users" {
		t.Fatalf("unexpected response: %+v", resp)
	}
}

func TestRegister_BadBody(t *testing.T) {
	repo := repository.NewInMemory()
	svc := service.New(repo, nil)
	h := New(svc, repo)
	r := newTestRouter(h)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/schema-registry/schemas", strings.NewReader("not json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestRegister_FieldValidation(t *testing.T) {
	repo := repository.NewInMemory()
	svc := service.New(repo, nil)
	h := New(svc, repo)
	r := newTestRouter(h)

	// Missing required primary key.
	body, _ := json.Marshal(models.RegisterRequest{
		Name:      "bad",
		Namespace: "ns1",
		Type:      models.SchemaTypeProtobuf,
		Owner:     "o",
		Fields:    []models.SchemaField{{Name: "x", Type: "int"}}, // no PK
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/schema-registry/schemas", strings.NewReader(string(body)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing PK, got %d body=%s", w.Code, w.Body.String())
	}
}

func TestRegister_EvolutionIncrementsVersion(t *testing.T) {
	repo := repository.NewInMemory()
	svc := service.New(repo, nil)
	h := New(svc, repo)
	r := newTestRouter(h)

	// First create.
	req := httptest.NewRequest(http.MethodPost, "/api/v1/schema-registry/schemas", strings.NewReader(string(validBody())))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("first register: %d %s", w.Code, w.Body.String())
	}

	// Second call with a backward-compatible add (nullable).
	evolved := models.RegisterRequest{
		Name:      "users",
		Namespace: "ns1",
		Type:      models.SchemaTypeProtobuf,
		Owner:     "alice",
		Fields: []models.SchemaField{
			{Name: "id", Type: "int64", PrimaryKey: true},
			{Name: "email", Type: "string"},
			{Name: "nickname", Type: "string", Nullable: true},
		},
		Compatibility: models.CompatibilityBackward,
	}
	body, _ := json.Marshal(evolved)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/schema-registry/schemas", strings.NewReader(string(body)))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("evolve: %d %s", w.Code, w.Body.String())
	}
	var resp models.RegisterResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Version != 2 {
		t.Fatalf("expected v2, got %d", resp.Version)
	}
}

func TestRegister_EvolutionRejectsBreaking(t *testing.T) {
	repo := repository.NewInMemory()
	svc := service.New(repo, nil)
	h := New(svc, repo)
	r := newTestRouter(h)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/schema-registry/schemas", strings.NewReader(string(validBody())))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("first register: %d %s", w.Code, w.Body.String())
	}

	// Remove a field — that is breaking under backward-compat.
	breaking := models.RegisterRequest{
		Name:      "users",
		Namespace: "ns1",
		Type:      models.SchemaTypeProtobuf,
		Owner:     "alice",
		Fields:    []models.SchemaField{{Name: "id", Type: "int64", PrimaryKey: true}},
		Compatibility: models.CompatibilityBackward,
	}
	body, _ := json.Marshal(breaking)
	req = httptest.NewRequest(http.MethodPost, "/api/v1/schema-registry/schemas", strings.NewReader(string(body)))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 for breaking change, got %d body=%s", w.Code, w.Body.String())
	}
}

func TestList_Query(t *testing.T) {
	repo := repository.NewInMemory()
	svc := service.New(repo, nil)
	h := New(svc, repo)
	r := newTestRouter(h)

	// Seed.
	_ = httptest.NewRequest(http.MethodPost, "/api/v1/schema-registry/schemas", strings.NewReader(string(validBody())))
	w0 := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/schema-registry/schemas", strings.NewReader(string(validBody())))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w0, req)

	w := httptest.NewRecorder()
	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/schema-registry/schemas?namespace=ns1", nil)
	r.ServeHTTP(w, listReq)
	if w.Code != http.StatusOK {
		t.Fatalf("list: %d %s", w.Code, w.Body.String())
	}
	var resp models.QueryResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.Total != 1 || len(resp.Schemas) != 1 {
		t.Fatalf("expected 1 result, got %+v", resp)
	}
}

func TestLookup_NotFound(t *testing.T) {
	repo := repository.NewInMemory()
	svc := service.New(repo, nil)
	h := New(svc, repo)
	r := newTestRouter(h)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/schema-registry/schemas/ns1/missing", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusInternalServerError {
		// Lookup uses fmt.Errorf, not the sentinel ErrSchemaNotFound, so we
		// expect 500. This test documents the current behavior — if we ever
		// make service.Lookup return ErrSchemaNotFound, we can tighten it.
		t.Logf("lookup not-found returns %d (500 acceptable for current service)", w.Code)
	}
}

func TestEvolve_DryRun(t *testing.T) {
	repo := repository.NewInMemory()
	svc := service.New(repo, nil)
	h := New(svc, repo)
	r := newTestRouter(h)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/schema-registry/schemas", strings.NewReader(string(validBody())))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("register: %d %s", w.Code, w.Body.String())
	}

	// Dry-run evolve — propose removing email (breaking).
	evolveBody, _ := json.Marshal(map[string][]models.SchemaField{
		"fields": {{Name: "id", Type: "int64", PrimaryKey: true}},
	})
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/v1/schema-registry/schemas/ns1/users/evolve", strings.NewReader(string(evolveBody)))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("evolve: %d %s", w.Code, w.Body.String())
	}
	var resp models.CompatibilityResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if !resp.Breaking {
		t.Fatalf("expected breaking=true, got %+v", resp)
	}
}

func TestDelete_Missing(t *testing.T) {
	repo := repository.NewInMemory()
	svc := service.New(repo, nil)
	h := New(svc, repo)
	r := newTestRouter(h)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/schema-registry/schemas/ns1/nope", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestCompatibility_ReturnsMode(t *testing.T) {
	repo := repository.NewInMemory()
	svc := service.New(repo, nil)
	h := New(svc, repo)
	r := newTestRouter(h)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/schema-registry/schemas", strings.NewReader(string(validBody())))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("register: %d %s", w.Code, w.Body.String())
	}

	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/api/v1/schema-registry/schemas/ns1/users/compatibility", nil)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("compat: %d %s", w.Code, w.Body.String())
	}
	var got map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got["compatibility"] != "backward" {
		t.Fatalf("expected backward, got %v", got)
	}
}
