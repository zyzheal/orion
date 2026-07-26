package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/auth-svc/internal/sso"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func newTestSSOHandler(tokenIssuer func(ctx context.Context, tenantID, email, username, source string) (string, string, int, error)) *SSOHandler {
	return NewSSOHandler(SSOConfig{
		Logger: zap.NewNop(),
	}, tokenIssuer)
}

func newTestSSOHandlerWithOIDC(tokenIssuer func(ctx context.Context, tenantID, email, username, source string) (string, string, int, error)) *SSOHandler {
	return NewSSOHandler(SSOConfig{
		OIDC: sso.OIDCConfig{
			Issuer:   "https://accounts.example.com",
			ClientID: "test-client",
		},
		Logger: zap.NewNop(),
	}, tokenIssuer)
}

func TestSSOHandler_OIDCProviders_Empty(t *testing.T) {
	h := newTestSSOHandler(nil)

	r := gin.New()
	r.GET("/providers", h.OIDCProviders)

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/providers", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var resp Response
	json.Unmarshal(w.Body.Bytes(), &resp)
	providers := resp.Data.([]interface{})
	if len(providers) != 0 {
		t.Errorf("expected 0 providers, got %d", len(providers))
	}
}

func TestSSOHandler_OIDCProviders_WithOIDC(t *testing.T) {
	h := newTestSSOHandlerWithOIDC(nil)

	r := gin.New()
	r.GET("/providers", h.OIDCProviders)

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/providers", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var resp Response
	json.Unmarshal(w.Body.Bytes(), &resp)
	providers := resp.Data.([]interface{})
	if len(providers) != 1 {
		t.Errorf("expected 1 provider, got %d", len(providers))
	}
}

func TestSSOHandler_OIDCLoginRedirect_NotConfigured(t *testing.T) {
	h := newTestSSOHandler(nil) // no OIDC config

	r := gin.New()
	r.GET("/oidc/login", h.OIDCLoginRedirect)

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/oidc/login", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d", w.Code)
	}
}

func TestSSOHandler_OIDCCallback_MissingCode(t *testing.T) {
	h := newTestSSOHandlerWithOIDC(nil)

	r := gin.New()
	r.GET("/oidc/callback", h.OIDCCallback)

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/oidc/callback?state=test", nil)
	req.AddCookie(&http.Cookie{Name: "oidc_state", Value: "test"})
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestSSOHandler_OIDCCallback_InvalidState(t *testing.T) {
	h := newTestSSOHandlerWithOIDC(nil)

	r := gin.New()
	r.GET("/oidc/callback", h.OIDCCallback)

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/oidc/callback?code=test&state=wrong", nil)
	req.AddCookie(&http.Cookie{Name: "oidc_state", Value: "expected"})
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestSSOHandler_OIDCCallback_MissingState(t *testing.T) {
	h := newTestSSOHandlerWithOIDC(nil)

	r := gin.New()
	r.GET("/oidc/callback", h.OIDCCallback)

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/oidc/callback?code=test&state=test", nil)
	// No state cookie set
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestSSOHandler_LDAPLogin_NotConfigured(t *testing.T) {
	h := newTestSSOHandler(nil) // no LDAP config

	r := gin.New()
	r.POST("/ldap/login", h.LDAPLogin)

	w := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/ldap/login", nil)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d", w.Code)
	}
}

func TestSSOHandler_WechatLoginRedirect_NotConfigured(t *testing.T) {
	h := newTestSSOHandler(nil) // no WeChat config

	r := gin.New()
	r.GET("/wechat/login", h.WechatLoginRedirect)

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/wechat/login", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d", w.Code)
	}
}

func TestSSOHandler_WechatCallback_NotConfigured(t *testing.T) {
	h := newTestSSOHandler(nil) // no WeChat config

	r := gin.New()
	r.GET("/wechat/callback", h.WechatCallback)

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/wechat/callback?code=test&state=test", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d", w.Code)
	}
}

func TestSSOHandler_WechatCallback_InvalidState(t *testing.T) {
	// We need a handler with WeChat configured
	h := NewSSOHandler(SSOConfig{
		WeChat: sso.WeChatConfig{AppID: "wx123", AppSecret: "secret"},
		Logger: zap.NewNop(),
	}, nil)

	r := gin.New()
	r.GET("/wechat/callback", h.WechatCallback)

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/wechat/callback?code=test&state=wrong", nil)
	req.AddCookie(&http.Cookie{Name: "wechat_state", Value: "expected"})
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestSSOHandler_WechatWorkLoginRedirect_NotConfigured(t *testing.T) {
	h := newTestSSOHandler(nil)

	r := gin.New()
	r.GET("/wechat-work/login", h.WechatWorkLoginRedirect)

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/wechat-work/login", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d", w.Code)
	}
}

func TestSSOHandler_WechatWorkCallback_NotConfigured(t *testing.T) {
	h := newTestSSOHandler(nil)

	r := gin.New()
	r.GET("/wechat-work/callback", h.WechatWorkCallback)

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/wechat-work/callback?code=test&state=test", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503, got %d", w.Code)
	}
}

func TestSSOHandler_WechatWorkCallback_InvalidState(t *testing.T) {
	h := NewSSOHandler(SSOConfig{
		WeChat: sso.WeChatConfig{AppID: "wx123", AppSecret: "secret"},
		Logger: zap.NewNop(),
	}, nil)

	r := gin.New()
	r.GET("/wechat-work/callback", h.WechatWorkCallback)

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/wechat-work/callback?code=test&state=wrong", nil)
	req.AddCookie(&http.Cookie{Name: "wechat_work_state", Value: "expected"})
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestSSOHandler_SuccessResponse(t *testing.T) {
	h := newTestSSOHandler(nil)

	r := gin.New()
	r.GET("/test", func(c *gin.Context) {
		h.success(c, gin.H{"key": "value"})
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var resp Response
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Code != 0 {
		t.Errorf("expected code=0, got %d", resp.Code)
	}
	if resp.Message != "success" {
		t.Errorf("expected message=success, got %s", resp.Message)
	}
}

func TestSSOHandler_ErrorResponse(t *testing.T) {
	h := newTestSSOHandler(nil)

	r := gin.New()
	r.GET("/test", func(c *gin.Context) {
		h.err(c, http.StatusForbidden, "forbidden")
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}

	var resp Response
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.Code != 403 {
		t.Errorf("expected code=403, got %d", resp.Code)
	}
	if resp.Message != "forbidden" {
		t.Errorf("expected message=forbidden, got %s", resp.Message)
	}
}
