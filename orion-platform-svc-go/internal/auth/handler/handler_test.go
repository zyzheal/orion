package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/auth/models"
	"orion/platform-svc-go/internal/auth/service"

	"github.com/gin-gonic/gin"
)

// --- mock service ---

type mockService struct {
	loginFn    func(ctx context.Context, req *models.LoginRequest, tenantID string) (*models.LoginResponse, error)
	registerFn func(ctx context.Context, req *models.RegisterRequest, tenantID string) (*models.RegisterResponse, error)
	refreshFn  func(ctx context.Context, req *models.RefreshRequest) (*models.RefreshResponse, error)
	logoutFn   func(ctx context.Context, req *models.LogoutRequest) error
	getProfileFn func(ctx context.Context, tenantID, userID string) (*models.MeResponse, error)
}

func (m *mockService) Login(ctx context.Context, req *models.LoginRequest, tenantID string) (*models.LoginResponse, error) {
	return m.loginFn(ctx, req, tenantID)
}
func (m *mockService) Register(ctx context.Context, req *models.RegisterRequest, tenantID string) (*models.RegisterResponse, error) {
	return m.registerFn(ctx, req, tenantID)
}
func (m *mockService) Refresh(ctx context.Context, req *models.RefreshRequest) (*models.RefreshResponse, error) {
	return m.refreshFn(ctx, req)
}
func (m *mockService) Logout(ctx context.Context, req *models.LogoutRequest) error {
	return m.logoutFn(ctx, req)
}
func (m *mockService) GetProfile(ctx context.Context, tenantID, userID string) (*models.MeResponse, error) {
	return m.getProfileFn(ctx, tenantID, userID)
}

// --- handler constructor override for tests ---

func newHandlerWithSvc(svc AuthService) *Handler {
	return &Handler{svc: svc}
}

// --- helpers ---

func setupGin() *gin.Context {
	gin.SetMode(gin.TestMode)
	return &gin.Context{}
}

func performRequest(h *Handler, method, path string, body interface{}, headers map[string]string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	var buf bytes.Buffer
	if body != nil {
		b, _ := json.Marshal(body)
		buf = *bytes.NewBuffer(b)
	}
	c.Request = httptest.NewRequest(method, path, &buf)
	c.Request.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		c.Request.Header.Set(k, v)
	}

	// Call the appropriate handler method based on path
	switch path {
	case "/api/v1/auth/login":
		h.Login(c)
	case "/api/v1/auth/register":
		h.Register(c)
	case "/api/v1/auth/refresh":
		h.Refresh(c)
	case "/api/v1/auth/logout":
		h.Logout(c)
	case "/api/v1/auth/me":
		c.Set("tenant_id", headers["X-Tenant-ID"])
		c.Set("user_id", headers["X-User-ID"])
		h.Me(c)
	}

	return w
}

func TestHandler_Login_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		loginFn: func(_ context.Context, _ *models.LoginRequest, _ string) (*models.LoginResponse, error) {
			return &models.LoginResponse{
				AccessToken:  "token",
				RefreshToken: "refresh",
				ExpiresAt:    1000,
				TenantID:     "tenant-1",
				User: models.UserInfo{ID: "u1", Username: "test", Role: "user"},
			}, nil
		},
	})

	w := performRequest(h, "POST", "/api/v1/auth/login", models.LoginRequest{
		Username: "test", Password: "pass",
	}, nil)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["success"] != true {
		t.Error("expected success=true")
	}
}

func TestHandler_Login_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockService{})

	w := performRequest(h, "POST", "/api/v1/auth/login", "invalid json", nil)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandler_Login_InvalidCredentials(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		loginFn: func(_ context.Context, _ *models.LoginRequest, _ string) (*models.LoginResponse, error) {
			return nil, service.ErrInvalidCredentials
		},
	})

	w := performRequest(h, "POST", "/api/v1/auth/login", models.LoginRequest{
		Username: "test", Password: "wrong",
	}, nil)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestHandler_Login_UserDisabled(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		loginFn: func(_ context.Context, _ *models.LoginRequest, _ string) (*models.LoginResponse, error) {
			return nil, service.ErrUserDisabled
		},
	})

	w := performRequest(h, "POST", "/api/v1/auth/login", models.LoginRequest{
		Username: "test", Password: "pass",
	}, nil)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}
}

func TestHandler_Login_UserSuspended(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		loginFn: func(_ context.Context, _ *models.LoginRequest, _ string) (*models.LoginResponse, error) {
			return nil, service.ErrUserSuspended
		},
	})

	w := performRequest(h, "POST", "/api/v1/auth/login", models.LoginRequest{
		Username: "test", Password: "pass",
	}, nil)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", w.Code)
	}
}

func TestHandler_Login_MultipleTenants(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		loginFn: func(_ context.Context, _ *models.LoginRequest, _ string) (*models.LoginResponse, error) {
			return nil, service.ErrMultipleTenants
		},
	})

	w := performRequest(h, "POST", "/api/v1/auth/login", models.LoginRequest{
		Username: "test", Password: "pass",
	}, nil)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandler_Register_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		registerFn: func(_ context.Context, _ *models.RegisterRequest, _ string) (*models.RegisterResponse, error) {
			return &models.RegisterResponse{
				ID: "u1", Username: "newuser", Role: "user", Message: "registration successful",
			}, nil
		},
	})

	w := performRequest(h, "POST", "/api/v1/auth/register", models.RegisterRequest{
		Username: "newuser", Password: "password123",
	}, nil)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
}

func TestHandler_Register_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockService{})

	w := performRequest(h, "POST", "/api/v1/auth/register", "invalid json", nil)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandler_Register_Conflict(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		registerFn: func(_ context.Context, _ *models.RegisterRequest, _ string) (*models.RegisterResponse, error) {
			return nil, service.ErrUsernameExists
		},
	})

	w := performRequest(h, "POST", "/api/v1/auth/register", models.RegisterRequest{
		Username: "existing", Password: "password123",
	}, nil)

	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d", w.Code)
	}
}

func TestHandler_Refresh_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		refreshFn: func(_ context.Context, _ *models.RefreshRequest) (*models.RefreshResponse, error) {
			return &models.RefreshResponse{
				AccessToken: "newtoken", RefreshToken: "newrefresh", ExpiresAt: 2000, TenantID: "t1",
			}, nil
		},
	})

	w := performRequest(h, "POST", "/api/v1/auth/refresh", models.RefreshRequest{
		RefreshToken: "validtoken",
	}, nil)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_Refresh_InvalidToken(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		refreshFn: func(_ context.Context, _ *models.RefreshRequest) (*models.RefreshResponse, error) {
			return nil, service.ErrInvalidRefreshToken
		},
	})

	w := performRequest(h, "POST", "/api/v1/auth/refresh", models.RefreshRequest{
		RefreshToken: "invalid",
	}, nil)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestHandler_Logout_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		logoutFn: func(_ context.Context, _ *models.LogoutRequest) error {
			return nil
		},
	})

	w := performRequest(h, "POST", "/api/v1/auth/logout", models.LogoutRequest{
		RefreshToken: "sometoken",
	}, nil)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_Logout_EmptyBody(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		logoutFn: func(_ context.Context, _ *models.LogoutRequest) error {
			return nil
		},
	})

	w := performRequest(h, "POST", "/api/v1/auth/logout", nil, nil)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_Me_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		getProfileFn: func(_ context.Context, tenantID, userID string) (*models.MeResponse, error) {
			return &models.MeResponse{
				ID: userID, Username: "testuser", Role: "user", Status: "active",
				Tenants: []string{"tenant-1"}, CurrentTenantID: tenantID,
			}, nil
		},
	})

	w := performRequest(h, "GET", "/api/v1/auth/me", nil, map[string]string{
		"X-Tenant-ID": "tenant-1",
		"X-User-ID":   "user-1",
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["success"] != true {
		t.Error("expected success=true")
	}
}

func TestHandler_Me_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockService{
		getProfileFn: func(_ context.Context, _, _ string) (*models.MeResponse, error) {
			return nil, service.ErrUserNotFound
		},
	})

	w := performRequest(h, "GET", "/api/v1/auth/me", nil, map[string]string{
		"X-Tenant-ID": "tenant-1",
		"X-User-ID":   "nonexistent",
	})

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}