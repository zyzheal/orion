package handler

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/user/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/user/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeHandler{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	return makeCtxWithBody(method, path, "")
}

// makeCtxWithBody is like makeCtx but sends a body, because the handlers that
// read one (Update, Authenticate, ChangePassword) answer 400 before they ever
// reach the service when the body is empty.
func makeCtxWithBody(method string, path string, body string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, strings.NewReader(body))
	return c, w
}

type fakeHandler struct{}

func (f *fakeHandler) Create(ctx context.Context, tenantID, creatorID string, req *models.CreateUserRequest) (*service.CreateUserResponse, error) {
	return &service.CreateUserResponse{}, nil
}

func (f *fakeHandler) Authenticate(ctx context.Context, req *models.AuthenticateRequest) (*models.User, error) {
	return &models.User{}, nil
}

func (f *fakeHandler) List(ctx context.Context, tenantID string, filter *models.GetUserFilters, offset, limit int) ([]models.User, error) {
	return []models.User{}, nil
}

func (f *fakeHandler) GetByID(ctx context.Context, tenantID, id string) (*models.User, error) {
	return &models.User{}, nil
}

func (f *fakeHandler) Count(ctx context.Context, tenantID string) (int, error) {
	return 0, nil
}

func (f *fakeHandler) Update(ctx context.Context, tenantID, id string, req *models.UpdateUserRequest) (*models.User, error) {
	return &models.User{}, nil
}

func (f *fakeHandler) ChangePassword(ctx context.Context, tenantID, userID string, req *models.ChangePasswordRequest) error {
	return nil
}

func (f *fakeHandler) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func TestHandler_USER_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_USER_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_USER_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_USER_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_USER_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_USER_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_USER_Count(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Count(c)
	if w.Code >= 500 {
		t.Fatalf("Count: got %d", w.Code)
	}
}
func TestHandler_USER_Authenticate(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Authenticate(c)
	if w.Code >= 500 {
		t.Fatalf("Authenticate: got %d", w.Code)
	}
}
func TestHandler_USER_ChangePassword(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ChangePassword(c)
	if w.Code >= 500 {
		t.Fatalf("ChangePassword: got %d", w.Code)
	}
}

// --- 404 must mean "no such user", not "the database failed" ---

// errSvc returns a configurable error from whichever method the handler calls,
// so each status mapping can be exercised in isolation.
type errSvc struct {
	getErr      error
	updateErr   error
	deleteErr   error
	authErr     error
	changePwErr error
}

func (e *errSvc) Create(ctx context.Context, tenantID, creatorID string, req *models.CreateUserRequest) (*service.CreateUserResponse, error) {
	return &service.CreateUserResponse{}, nil
}
func (e *errSvc) Authenticate(ctx context.Context, req *models.AuthenticateRequest) (*models.User, error) {
	return nil, e.authErr
}
func (e *errSvc) List(ctx context.Context, tenantID string, filter *models.GetUserFilters, offset, limit int) ([]models.User, error) {
	return []models.User{}, nil
}
func (e *errSvc) GetByID(ctx context.Context, tenantID, id string) (*models.User, error) {
	if e.getErr != nil {
		return nil, e.getErr
	}
	return &models.User{}, nil
}
func (e *errSvc) Count(ctx context.Context, tenantID string) (int, error) { return 0, nil }
func (e *errSvc) Update(ctx context.Context, tenantID, id string, req *models.UpdateUserRequest) (*models.User, error) {
	if e.updateErr != nil {
		return nil, e.updateErr
	}
	return &models.User{}, nil
}
func (e *errSvc) ChangePassword(ctx context.Context, tenantID, userID string, req *models.ChangePasswordRequest) error {
	return e.changePwErr
}
func (e *errSvc) Delete(ctx context.Context, tenantID, id string) error { return e.deleteErr }

var errUsersRelationMissing = errors.New(`pq: relation "users" does not exist`)

func TestHandler_USER_GetMapsNotFoundTo404(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/users/u1")
	NewHandler(&errSvc{getErr: sentinel.NotFound}).Get(c)
	if w.Code != http.StatusNotFound {
		t.Fatalf("want 404, got %d", w.Code)
	}
}

// The reason writeUserError exists: a hard SQL failure used to be answered
// 404, so an unreachable table looked like a missing user.
func TestHandler_USER_GetMapsAnOutageTo500(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/users/u1")
	NewHandler(&errSvc{getErr: errUsersRelationMissing}).Get(c)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("a missing relation is not a missing user: got %d", w.Code)
	}
}

func TestHandler_USER_UpdateMapsNotFoundTo404(t *testing.T) {
	c, w := makeCtxWithBody(http.MethodPut, "/users/u1", "{}")
	// Wrapped the way service.Update produces it: the handler must still see it.
	NewHandler(&errSvc{updateErr: fmt.Errorf("failed to update user: %w", sentinel.NotFound)}).Update(c)
	if w.Code != http.StatusNotFound {
		t.Fatalf("want 404, got %d", w.Code)
	}
}

func TestHandler_USER_UpdateMapsAnOutageTo500(t *testing.T) {
	c, w := makeCtxWithBody(http.MethodPut, "/users/u1", "{}")
	NewHandler(&errSvc{updateErr: errUsersRelationMissing}).Update(c)
	if w.Code == http.StatusNotFound {
		t.Fatalf("an outage is not a missing user: got %d", w.Code)
	}
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("want 500, got %d", w.Code)
	}
}

func TestHandler_USER_DeleteMapsNotFoundTo404(t *testing.T) {
	c, w := makeCtx(http.MethodDelete, "/users/u1")
	NewHandler(&errSvc{deleteErr: sentinel.NotFound}).Delete(c)
	if w.Code != http.StatusNotFound {
		t.Fatalf("want 404, got %d", w.Code)
	}
}

func TestHandler_USER_DeleteMapsAnOutageTo500(t *testing.T) {
	c, w := makeCtx(http.MethodDelete, "/users/u1")
	NewHandler(&errSvc{deleteErr: errUsersRelationMissing}).Delete(c)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("an outage is not a missing user: got %d", w.Code)
	}
}

func TestHandler_USER_AuthenticateMapsOnlyBadCredentialsTo401(t *testing.T) {
	for name, tc := range map[string]struct {
		err  error
		want int
	}{
		"bad credentials": {service.ErrInvalidPassword, http.StatusUnauthorized},
		"unknown user":    {sentinel.NotFound, http.StatusInternalServerError},
		"outage":          {errUsersRelationMissing, http.StatusInternalServerError},
	} {
		c, w := makeCtxWithBody(http.MethodPost, "/users/authenticate", "{\"username\":\"ada\",\"password\":\"x\"}")
		NewHandler(&errSvc{authErr: tc.err}).Authenticate(c)
		if w.Code != tc.want {
			t.Errorf("%s: want %d, got %d", name, tc.want, w.Code)
		}
	}
}

func TestHandler_USER_ChangePasswordMapsThreeErrorClasses(t *testing.T) {
	for name, tc := range map[string]struct {
		err  error
		want int
	}{
		"bad old password": {service.ErrInvalidPassword, http.StatusUnauthorized},
		"unknown user":     {sentinel.NotFound, http.StatusNotFound},
		"outage":           {errUsersRelationMissing, http.StatusInternalServerError},
	} {
		c, w := makeCtxWithBody(http.MethodPut, "/users/u1/password", "{\"old_password\":\"old\",\"new_password\":\"new\"}")
		NewHandler(&errSvc{changePwErr: tc.err}).ChangePassword(c)
		if w.Code != tc.want {
			t.Errorf("%s: want %d, got %d", name, tc.want, w.Code)
		}
	}
}
