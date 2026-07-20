package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"orion/platform-svc-go/internal/auth-enhanced/models"

	"github.com/gin-gonic/gin"
)

// --- mock service (implements Service interface) ---

type mockSvc struct {
	createKeyFn        func(ctx context.Context, tenantID string, req *models.CreateAuthKeyRequest) (*models.AuthKey, error)
	getKeyFn           func(ctx context.Context, tenantID, id string) (*models.AuthKey, error)
	listKeysFn         func(ctx context.Context, tenantID string, status *string) ([]models.AuthKey, error)
	deactivateKeyFn    func(ctx context.Context, tenantID, id string) error
	deleteKeyFn        func(ctx context.Context, tenantID, id string) (bool, error)
	blacklistTokenFn   func(ctx context.Context, tenantID string, req *models.CreateBlacklistRequest, expiresAt time.Time) (*models.AuthTokenBlacklist, error)
	listBlacklistFn    func(ctx context.Context, tenantID string) ([]models.AuthTokenBlacklist, error)
	deleteBlacklistFn  func(ctx context.Context, tenantID, id string) (bool, error)
}

func (m *mockSvc) CreateKey(ctx context.Context, tenantID string, req *models.CreateAuthKeyRequest) (*models.AuthKey, error) {
	if m.createKeyFn != nil { return m.createKeyFn(ctx, tenantID, req) }
	return nil, nil
}
func (m *mockSvc) GetKey(ctx context.Context, tenantID, id string) (*models.AuthKey, error) {
	if m.getKeyFn != nil { return m.getKeyFn(ctx, tenantID, id) }
	return nil, nil
}
func (m *mockSvc) ListKeys(ctx context.Context, tenantID string, status *string) ([]models.AuthKey, error) {
	if m.listKeysFn != nil { return m.listKeysFn(ctx, tenantID, status) }
	return nil, nil
}
func (m *mockSvc) DeactivateKey(ctx context.Context, tenantID, id string) error {
	if m.deactivateKeyFn != nil { return m.deactivateKeyFn(ctx, tenantID, id) }
	return nil
}
func (m *mockSvc) DeleteKey(ctx context.Context, tenantID, id string) (bool, error) {
	if m.deleteKeyFn != nil { return m.deleteKeyFn(ctx, tenantID, id) }
	return false, nil
}
func (m *mockSvc) BlacklistToken(ctx context.Context, tenantID string, req *models.CreateBlacklistRequest, expiresAt time.Time) (*models.AuthTokenBlacklist, error) {
	if m.blacklistTokenFn != nil { return m.blacklistTokenFn(ctx, tenantID, req, expiresAt) }
	return nil, nil
}
func (m *mockSvc) ListBlacklist(ctx context.Context, tenantID string) ([]models.AuthTokenBlacklist, error) {
	if m.listBlacklistFn != nil { return m.listBlacklistFn(ctx, tenantID) }
	return nil, nil
}
func (m *mockSvc) DeleteBlacklist(ctx context.Context, tenantID, id string) (bool, error) {
	if m.deleteBlacklistFn != nil { return m.deleteBlacklistFn(ctx, tenantID, id) }
	return false, nil
}

func newAuthHandlerWithSvc(svc Service) *Handler {
	return &Handler{svc: svc}
}

func authPerformRequest(h *Handler, handlerFn func(c *gin.Context), method string, body interface{}, pathParams map[string]string, queryParams map[string]string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Set("user_id", "user-1")

	buf := new(bytes.Buffer)
	if body != nil {
		json.NewEncoder(buf).Encode(body)
	}
	c.Request = httptest.NewRequest(method, "/", buf)
	c.Params = gin.Params{}
	for k, v := range pathParams {
		c.Params = append(c.Params, gin.Param{Key: k, Value: v})
	}
	for k, v := range queryParams {
		q := c.Request.URL.Query()
		q.Add(k, v)
		c.Request.URL.RawQuery = q.Encode()
	}
	handlerFn(c)
	return w
}

func makeAuthKey(id string) *models.AuthKey {
	return &models.AuthKey{ID: id, TenantID: "tenant-1", KeyID: "key-1", Status: "active"}
}

// ==================== CreateKey ====================

func TestAuthHandler_CreateKey_Success(t *testing.T) {
	h := newAuthHandlerWithSvc(&mockSvc{
		createKeyFn: func(ctx context.Context, tenantID string, req *models.CreateAuthKeyRequest) (*models.AuthKey, error) {
			return makeAuthKey("k1"), nil
		},
	})
	w := authPerformRequest(h, h.CreateKey, "POST", models.CreateAuthKeyRequest{Algorithm: "RS256"}, nil, nil)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
}

func TestAuthHandler_CreateKey_BadRequest(t *testing.T) {
	h := newAuthHandlerWithSvc(&mockSvc{})
	w := authPerformRequest(h, h.CreateKey, "POST", map[string]interface{}{"invalid": "data"}, nil, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestAuthHandler_CreateKey_ServiceError(t *testing.T) {
	h := newAuthHandlerWithSvc(&mockSvc{
		createKeyFn: func(ctx context.Context, tenantID string, req *models.CreateAuthKeyRequest) (*models.AuthKey, error) {
			return nil, errors.New("db error")
		},
	})
	w := authPerformRequest(h, h.CreateKey, "POST", models.CreateAuthKeyRequest{Algorithm: "HS256"}, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// ==================== GetKey ====================

func TestAuthHandler_GetKey_Success(t *testing.T) {
	h := newAuthHandlerWithSvc(&mockSvc{
		getKeyFn: func(ctx context.Context, tenantID, id string) (*models.AuthKey, error) {
			return makeAuthKey(id), nil
		},
	})
	w := authPerformRequest(h, h.GetKey, "GET", nil, map[string]string{"id": "k1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestAuthHandler_GetKey_NotFound(t *testing.T) {
	h := newAuthHandlerWithSvc(&mockSvc{
		getKeyFn: func(ctx context.Context, tenantID, id string) (*models.AuthKey, error) {
			return nil, errors.New("not found")
		},
	})
	w := authPerformRequest(h, h.GetKey, "GET", nil, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// ==================== ListKeys ====================

func TestAuthHandler_ListKeys_Success(t *testing.T) {
	h := newAuthHandlerWithSvc(&mockSvc{
		listKeysFn: func(ctx context.Context, tenantID string, status *string) ([]models.AuthKey, error) {
			return []models.AuthKey{*makeAuthKey("k1")}, nil
		},
	})
	w := authPerformRequest(h, h.ListKeys, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

// ==================== DeactivateKey ====================

func TestAuthHandler_DeactivateKey_Success(t *testing.T) {
	h := newAuthHandlerWithSvc(&mockSvc{
		deactivateKeyFn: func(ctx context.Context, tenantID, id string) error { return nil },
	})
	w := authPerformRequest(h, h.DeactivateKey, "PUT", nil, map[string]string{"id": "k1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestAuthHandler_DeactivateKey_NotFound(t *testing.T) {
	h := newAuthHandlerWithSvc(&mockSvc{
		deactivateKeyFn: func(ctx context.Context, tenantID, id string) error { return errors.New("not found") },
	})
	w := authPerformRequest(h, h.DeactivateKey, "PUT", nil, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// ==================== DeleteKey ====================

func TestAuthHandler_DeleteKey_Success(t *testing.T) {
	h := newAuthHandlerWithSvc(&mockSvc{
		deleteKeyFn: func(ctx context.Context, tenantID, id string) (bool, error) { return true, nil },
	})
	w := authPerformRequest(h, h.DeleteKey, "DELETE", nil, map[string]string{"id": "k1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestAuthHandler_DeleteKey_NotFound(t *testing.T) {
	h := newAuthHandlerWithSvc(&mockSvc{
		deleteKeyFn: func(ctx context.Context, tenantID, id string) (bool, error) { return false, nil },
	})
	w := authPerformRequest(h, h.DeleteKey, "DELETE", nil, map[string]string{"id": "k1"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// ==================== BlacklistToken ====================

func TestAuthHandler_BlacklistToken_Success(t *testing.T) {
	h := newAuthHandlerWithSvc(&mockSvc{
		blacklistTokenFn: func(ctx context.Context, tenantID string, req *models.CreateBlacklistRequest, expiresAt time.Time) (*models.AuthTokenBlacklist, error) {
			return &models.AuthTokenBlacklist{ID: "bl1"}, nil
		},
	})
	w := authPerformRequest(h, h.BlacklistToken, "POST", models.CreateBlacklistRequest{TokenID: "tok-1", Reason: "revoked"}, nil, nil)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
}

func TestAuthHandler_BlacklistToken_BadRequest(t *testing.T) {
	h := newAuthHandlerWithSvc(&mockSvc{})
	w := authPerformRequest(h, h.BlacklistToken, "POST", map[string]interface{}{"bad": true}, nil, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

// ==================== ListBlacklist ====================

func TestAuthHandler_ListBlacklist_Success(t *testing.T) {
	h := newAuthHandlerWithSvc(&mockSvc{
		listBlacklistFn: func(ctx context.Context, tenantID string) ([]models.AuthTokenBlacklist, error) {
			return []models.AuthTokenBlacklist{{ID: "bl1"}}, nil
		},
	})
	w := authPerformRequest(h, h.ListBlacklist, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

// ==================== DeleteBlacklist ====================

func TestAuthHandler_DeleteBlacklist_Success(t *testing.T) {
	h := newAuthHandlerWithSvc(&mockSvc{
		deleteBlacklistFn: func(ctx context.Context, tenantID, id string) (bool, error) { return true, nil },
	})
	w := authPerformRequest(h, h.DeleteBlacklist, "DELETE", nil, map[string]string{"id": "bl1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestAuthHandler_DeleteBlacklist_NotFound(t *testing.T) {
	h := newAuthHandlerWithSvc(&mockSvc{
		deleteBlacklistFn: func(ctx context.Context, tenantID, id string) (bool, error) { return false, nil },
	})
	w := authPerformRequest(h, h.DeleteBlacklist, "DELETE", nil, map[string]string{"id": "bl1"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}
