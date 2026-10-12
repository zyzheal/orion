package handler

import (
    "bytes"
    "context"
    "encoding/json"
    "errors"
    "net/http"
    "net/http/httptest"
    "testing"

    "orion/platform-svc-go/internal/eventbus/models"
    "orion/platform-svc-go/internal/eventbus/service"

    "github.com/gin-gonic/gin"
)

func init() { gin.SetMode(gin.TestMode) }

func newHandler() *Handler {
    return NewHandler(&fakeEventbusService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
    w := httptest.NewRecorder()
    c, _ := gin.CreateTestContext(w)
    c.Set("tenant_id", "tenant-1")
    c.Params = gin.Params{}
    c.Request = httptest.NewRequest(method, path, nil)
    return c, w
}

func makeCtxWithBody(method, path string, body any) (*gin.Context, *httptest.ResponseRecorder) {
    w := httptest.NewRecorder()
    c, _ := gin.CreateTestContext(w)
    c.Set("tenant_id", "tenant-1")
    c.Params = gin.Params{}
    b, _ := json.Marshal(body)
    c.Request = httptest.NewRequest(method, path, bytesReader(b))
    c.Request.Header.Set("Content-Type", "application/json")
    return c, w
}

// noTenantCtx creates a context without tenant_id (for error path tests).
func noTenantCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
    w := httptest.NewRecorder()
    c, _ := gin.CreateTestContext(w)
    c.Params = gin.Params{}
    c.Request = httptest.NewRequest(method, path, nil)
    return c, w
}

// bytesReader wraps []byte into an io.Reader.
func bytesReader(b []byte) *bytes.Reader { return bytes.NewReader(b) }



// ---------------------------------------------------------------------------
// fakeEventbusService — supports error injection
// ---------------------------------------------------------------------------

type fakeEventbusService struct {
    publishErr     error
    listErr        error
    countErr       error
    connectErr     error
    getStatusErr   error
    listSubsErr    error
    getDLQErr      error
    getStatsErr    error
}

func (f *fakeEventbusService) Connect(ctx context.Context, tenantID string, req *models.ConnectRequest) (*models.ConnectResult, error) {
    return &models.ConnectResult{}, f.connectErr
}
func (f *fakeEventbusService) GetStatus(ctx context.Context, tenantID string) (*models.BusStatus, error) {
    return &models.BusStatus{}, f.getStatusErr
}
func (f *fakeEventbusService) ListSubscriptions(ctx context.Context, tenantID string) ([]models.Subscription, error) {
    return []models.Subscription{}, f.listSubsErr
}
func (f *fakeEventbusService) GetDLQ(ctx context.Context, tenantID string, q *models.DLQQuery) (*models.DLQResponse, error) {
    return &models.DLQResponse{}, f.getDLQErr
}
func (f *fakeEventbusService) GetStats(ctx context.Context, tenantID string) (*models.BusStats, error) {
    return &models.BusStats{}, f.getStatsErr
}
func (f *fakeEventbusService) Publish(ctx context.Context, tenantID string, userID string, req *models.PublishRequest) (*models.Event, error) {
    return &models.Event{}, f.publishErr
}
func (f *fakeEventbusService) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.Event, error) {
    return []models.Event{}, f.listErr
}
func (f *fakeEventbusService) Count(ctx context.Context, tenantID string) (int, error) {
    return 0, f.countErr
}

var _ service.ServiceInterface = (*fakeEventbusService)(nil)

// ---------------------------------------------------------------------------
// Constructor + basic tests
// ---------------------------------------------------------------------------

func TestNewHandler(t *testing.T) {
    h := NewHandler(&fakeEventbusService{})
    if h == nil { t.Fatal("NewHandler must return non-nil") }
    if h.svc == nil { t.Error("svc must be set") }
}

func TestHandler_RegisterRoutes(t *testing.T) {
    h := newHandler()
    gin.SetMode(gin.TestMode)
    r := gin.New()
    rg := r.Group("/api/v1/eventbus")
    h.RegisterRoutes(rg)
    // Verify routes were registered
    routes := r.Routes()
    if len(routes) == 0 { t.Error("no routes registered") }
}

// ---------------------------------------------------------------------------
// getTenantID / getUserID
// ---------------------------------------------------------------------------

func TestGetTenantID_WithTenant(t *testing.T) {
    c, _ := makeCtx(http.MethodGet, "/")
    got := newHandler().getTenantID(c)
    if got != "tenant-1" { t.Errorf("got %q", got) }
}

func TestGetTenantID_MissingTenant_Unauthorized(t *testing.T) {
    c, w := noTenantCtx(http.MethodGet, "/")
    got := newHandler().getTenantID(c)
    if got != "" { t.Errorf("expected empty string, got %q", got) }
    if w.Code != http.StatusUnauthorized { t.Errorf("expected 401, got %d", w.Code) }
}

func TestGetUserID(t *testing.T) {
    c, _ := makeCtx(http.MethodGet, "/")
    c.Set("user_id", "user-42")
    got := newHandler().getUserID(c)
    if got != "user-42" { t.Errorf("got %q", got) }
}

func TestGetUserID_Empty(t *testing.T) {
    c, _ := makeCtx(http.MethodGet, "/")
    got := newHandler().getUserID(c)
    if got != "" { t.Errorf("expected empty, got %q", got) }
}

// ---------------------------------------------------------------------------
// parsePagination
// ---------------------------------------------------------------------------

func TestParsePagination_Defaults(t *testing.T) {
    c, _ := makeCtx(http.MethodGet, "/")
    page, pageSize := parsePagination(c)
    if page != 1 { t.Errorf("default page = %d, want 1", page) }
    if pageSize != 20 { t.Errorf("default pageSize = %d, want 20", pageSize) }
}

func TestParsePagination_WithPageParam(t *testing.T) {
    c, _ := makeCtx(http.MethodGet, "/?page=3&page_size=50")
    page, pageSize := parsePagination(c)
    if page != 3 { t.Errorf("page = %d, want 3", page) }
    if pageSize != 50 { t.Errorf("pageSize = %d, want 50", pageSize) }
}

func TestParsePagination_PageSizeCapped(t *testing.T) {
    c, _ := makeCtx(http.MethodGet, "/?page=1&page_size=999")
    _, pageSize := parsePagination(c)
    if pageSize != 100 { t.Errorf("pageSize = %d, want 100 (capped)", pageSize) }
}

func TestParsePagination_InvalidPage(t *testing.T) {
    c, _ := makeCtx(http.MethodGet, "/?page=abc")
    page, _ := parsePagination(c)
    if page != 1 { t.Errorf("invalid page should default to 1, got %d", page) }
}

func TestParsePagination_NegativePage(t *testing.T) {
    c, _ := makeCtx(http.MethodGet, "/?page=-1")
    page, _ := parsePagination(c)
    if page != 1 { t.Errorf("negative page should default to 1, got %d", page) }
}

func TestParsePagination_InvalidPageSize(t *testing.T) {
    c, _ := makeCtx(http.MethodGet, "/?page_size=xyz")
    _, pageSize := parsePagination(c)
    if pageSize != 20 { t.Errorf("invalid pageSize should default to 20, got %d", pageSize) }
}

// ---------------------------------------------------------------------------
// Handler error paths
// ---------------------------------------------------------------------------

func TestPublish_MissingTenant(t *testing.T) {
    c, w := noTenantCtx(http.MethodPost, "/events")
    b, _ := json.Marshal(models.PublishRequest{Type: "test", Payload: "{}"})
    c.Request = httptest.NewRequest(http.MethodPost, "/events", bytesReader(b))
    c.Request.Header.Set("Content-Type", "application/json")
    newHandler().Publish(c)
    if w.Code != http.StatusUnauthorized { t.Errorf("expected 401, got %d", w.Code) }
}

func TestPublish_InvalidJSON(t *testing.T) {
    c, w := makeCtx(http.MethodPost, "/events")
    c.Request = httptest.NewRequest(http.MethodPost, "/events", bytesReader([]byte("{invalid")))
    c.Request.Header.Set("Content-Type", "application/json")
    newHandler().Publish(c)
    if w.Code != http.StatusBadRequest { t.Errorf("expected 400, got %d", w.Code) }
}

func TestPublish_ServiceError(t *testing.T) {
    svc := &fakeEventbusService{publishErr: errors.New("publish failed")}
    h := NewHandler(svc)
    c, w := makeCtxWithBody(http.MethodPost, "/events", models.PublishRequest{Type: "test", Payload: "{}"})
    h.Publish(c)
    if w.Code != http.StatusInternalServerError { t.Errorf("expected 500, got %d", w.Code) }
}

func TestPublish_Success(t *testing.T) {
    h := newHandler()
    c, w := makeCtxWithBody(http.MethodPost, "/events", models.PublishRequest{Type: "test", Payload: "{}"})
    h.Publish(c)
    if w.Code != http.StatusCreated { t.Errorf("expected 201, got %d", w.Code) }
}

func TestList_ServiceError(t *testing.T) {
    svc := &fakeEventbusService{listErr: errors.New("list failed")}
    h := NewHandler(svc)
    c, w := makeCtx(http.MethodGet, "/events")
    h.List(c)
    if w.Code != http.StatusInternalServerError { t.Errorf("expected 500, got %d", w.Code) }
}

func TestList_CountError(t *testing.T) {
    svc := &fakeEventbusService{countErr: errors.New("count failed")}
    h := NewHandler(svc)
    c, w := makeCtx(http.MethodGet, "/events")
    h.List(c)
    if w.Code != http.StatusInternalServerError { t.Errorf("expected 500, got %d", w.Code) }
}

func TestList_WithTypeFilter(t *testing.T) {
    h := newHandler()
    c, w := makeCtx(http.MethodGet, "/events?type=deploy.started")
    h.List(c)
    if w.Code != http.StatusOK { t.Errorf("expected 200, got %d", w.Code) }
}

func TestCount_ServiceError(t *testing.T) {
    svc := &fakeEventbusService{countErr: errors.New("count failed")}
    h := NewHandler(svc)
    c, w := makeCtx(http.MethodGet, "/events/count")
    h.Count(c)
    if w.Code != http.StatusInternalServerError { t.Errorf("expected 500, got %d", w.Code) }
}

func TestCount_Success(t *testing.T) {
    h := newHandler()
    c, w := makeCtx(http.MethodGet, "/events/count")
    h.Count(c)
    if w.Code != http.StatusOK { t.Errorf("expected 200, got %d", w.Code) }
}

func TestConnect_MissingTenant(t *testing.T) {
    c, w := noTenantCtx(http.MethodPost, "/connect")
    b, _ := json.Marshal(models.ConnectRequest{})
    c.Request = httptest.NewRequest(http.MethodPost, "/connect", bytesReader(b))
    c.Request.Header.Set("Content-Type", "application/json")
    newHandler().Connect(c)
    if w.Code != http.StatusUnauthorized { t.Errorf("expected 401, got %d", w.Code) }
}

func TestConnect_InvalidJSON(t *testing.T) {
    c, w := makeCtx(http.MethodPost, "/connect")
    c.Request = httptest.NewRequest(http.MethodPost, "/connect", bytesReader([]byte("{bad")))
    c.Request.Header.Set("Content-Type", "application/json")
    newHandler().Connect(c)
    if w.Code != http.StatusBadRequest { t.Errorf("expected 400, got %d", w.Code) }
}

func TestConnect_ServiceError(t *testing.T) {
    svc := &fakeEventbusService{connectErr: errors.New("connect failed")}
    h := NewHandler(svc)
    c, w := makeCtxWithBody(http.MethodPost, "/connect", models.ConnectRequest{})
    h.Connect(c)
    if w.Code != http.StatusInternalServerError { t.Errorf("expected 500, got %d", w.Code) }
}

func TestConnect_Success(t *testing.T) {
    h := newHandler()
    c, w := makeCtxWithBody(http.MethodPost, "/connect", models.ConnectRequest{})
    h.Connect(c)
    if w.Code != http.StatusCreated { t.Errorf("expected 201, got %d", w.Code) }
}

func TestGetStatus_ServiceError(t *testing.T) {
    svc := &fakeEventbusService{getStatusErr: errors.New("status failed")}
    h := NewHandler(svc)
    c, w := makeCtx(http.MethodGet, "/status")
    h.GetStatus(c)
    if w.Code != http.StatusInternalServerError { t.Errorf("expected 500, got %d", w.Code) }
}

func TestGetStatus_Success(t *testing.T) {
    h := newHandler()
    c, w := makeCtx(http.MethodGet, "/status")
    h.GetStatus(c)
    if w.Code != http.StatusOK { t.Errorf("expected 200, got %d", w.Code) }
}

func TestListSubscriptions_ServiceError(t *testing.T) {
    svc := &fakeEventbusService{listSubsErr: errors.New("subs failed")}
    h := NewHandler(svc)
    c, w := makeCtx(http.MethodGet, "/subscriptions")
    h.ListSubscriptions(c)
    if w.Code != http.StatusInternalServerError { t.Errorf("expected 500, got %d", w.Code) }
}

func TestListSubscriptions_Success(t *testing.T) {
    h := newHandler()
    c, w := makeCtx(http.MethodGet, "/subscriptions")
    h.ListSubscriptions(c)
    if w.Code != http.StatusOK { t.Errorf("expected 200, got %d", w.Code) }
}

func TestGetDLQ_ServiceError(t *testing.T) {
    svc := &fakeEventbusService{getDLQErr: errors.New("dlq failed")}
    h := NewHandler(svc)
    c, w := makeCtx(http.MethodGet, "/dlq")
    h.GetDLQ(c)
    if w.Code != http.StatusInternalServerError { t.Errorf("expected 500, got %d", w.Code) }
}

func TestGetDLQ_Success(t *testing.T) {
    h := newHandler()
    c, w := makeCtx(http.MethodGet, "/dlq")
    h.GetDLQ(c)
    if w.Code != http.StatusOK { t.Errorf("expected 200, got %d", w.Code) }
}

func TestGetDLQ_LimitParam(t *testing.T) {
    h := newHandler()
    c, w := makeCtx(http.MethodGet, "/dlq?limit=50")
    h.GetDLQ(c)
    if w.Code != http.StatusOK { t.Errorf("expected 200, got %d", w.Code) }
}

func TestGetDLQ_LimitCapped(t *testing.T) {
    h := newHandler()
    c, w := makeCtx(http.MethodGet, "/dlq?limit=999")
    h.GetDLQ(c)
    if w.Code != http.StatusOK { t.Errorf("expected 200, got %d", w.Code) }
}

func TestGetDLQ_InvalidLimit(t *testing.T) {
    h := newHandler()
    c, w := makeCtx(http.MethodGet, "/dlq?limit=abc")
    h.GetDLQ(c)
    if w.Code != http.StatusOK { t.Errorf("expected 200, got %d", w.Code) }
}

func TestGetStats_ServiceError(t *testing.T) {
    svc := &fakeEventbusService{getStatsErr: errors.New("stats failed")}
    h := NewHandler(svc)
    c, w := makeCtx(http.MethodGet, "/stats")
    h.GetStats(c)
    if w.Code != http.StatusInternalServerError { t.Errorf("expected 500, got %d", w.Code) }
}

func TestGetStats_Success(t *testing.T) {
    h := newHandler()
    c, w := makeCtx(http.MethodGet, "/stats")
    h.GetStats(c)
    if w.Code != http.StatusOK { t.Errorf("expected 200, got %d", w.Code) }
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

func TestRespondBadRequest(t *testing.T) {
    c, w := makeCtx(http.MethodGet, "/")
    respondBadRequest(c, "bad")
    if w.Code != http.StatusBadRequest { t.Errorf("expected 400, got %d", w.Code) }
}

func TestRespondInternalError(t *testing.T) {
    c, w := makeCtx(http.MethodGet, "/")
    respondInternalError(c, "err")
    if w.Code != http.StatusInternalServerError { t.Errorf("expected 500, got %d", w.Code) }
}
