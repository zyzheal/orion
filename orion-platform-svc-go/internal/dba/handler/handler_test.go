package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/dba/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/dba/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeDbaService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeDbaService struct{}

func (f *fakeDbaService) ApproveOrder(ctx context.Context, id, approvedBy string) (*models.SqlOrder, error) {
	return &models.SqlOrder{}, nil
}

func (f *fakeDbaService) CreateAuditRule(ctx context.Context, tenantID string, req models.CreateAuditRuleRequest) (*models.AuditRule, error) {
	return &models.AuditRule{}, nil
}

func (f *fakeDbaService) CreateDataSource(ctx context.Context, tenantID string, req models.CreateDataSourceRequest) (*models.DataSource, error) {
	return &models.DataSource{}, nil
}

func (f *fakeDbaService) CreateOrder(ctx context.Context, tenantID, userID string, req models.CreateOrderRequest) (*models.SqlOrder, error) {
	return &models.SqlOrder{}, nil
}

func (f *fakeDbaService) DeleteDataSource(ctx context.Context, id string) error {
	return nil
}

func (f *fakeDbaService) ExecuteDirectQuery(ctx context.Context, tenantID, userID string, req models.DirectQueryRequest) (*models.DirectQueryResponse, error) {
	return &models.DirectQueryResponse{}, nil
}

func (f *fakeDbaService) ExecuteOrder(ctx context.Context, id string) (*models.SqlOrder, error) {
	return &models.SqlOrder{}, nil
}

func (f *fakeDbaService) GetDataSource(ctx context.Context, id string) (*models.DataSource, error) {
	return &models.DataSource{}, nil
}

func (f *fakeDbaService) GetOrder(ctx context.Context, id string) (*models.SqlOrder, error) {
	return &models.SqlOrder{}, nil
}

func (f *fakeDbaService) ListAuditRules(ctx context.Context, tenantID string) ([]models.AuditRule, error) {
	return []models.AuditRule{}, nil
}

func (f *fakeDbaService) ListDataSources(ctx context.Context, tenantID string) ([]models.DataSource, error) {
	return []models.DataSource{}, nil
}

func (f *fakeDbaService) ListOrders(ctx context.Context, tenantID, status string, page, limit int) (*models.OrderListResult, error) {
	return &models.OrderListResult{}, nil
}

func (f *fakeDbaService) ListQueryLogs(ctx context.Context, tenantID string, q models.QueryLogQuery) (*models.QueryLogResult, error) {
	return &models.QueryLogResult{}, nil
}

func (f *fakeDbaService) RejectOrder(ctx context.Context, id string) (*models.SqlOrder, error) {
	return &models.SqlOrder{}, nil
}

func (f *fakeDbaService) TestConnection(ctx context.Context, id string) (*models.TestConnectionResult, error) {
	return &models.TestConnectionResult{}, nil
}

func (f *fakeDbaService) UpdateAuditRule(ctx context.Context, id string, req models.UpdateAuditRuleRequest) (*models.AuditRule, error) {
	return &models.AuditRule{}, nil
}

func (f *fakeDbaService) UpdateDataSource(ctx context.Context, id string, req models.UpdateDataSourceRequest) (*models.DataSource, error) {
	return &models.DataSource{}, nil
}

var _ service.ServiceInterface = (*fakeDbaService)(nil)

func TestHandler_DBA_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_DBA_ListOrders(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListOrders(c)
	if w.Code >= 500 {
		t.Fatalf("ListOrders: got %d", w.Code)
	}
}
func TestHandler_DBA_GetOrder(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetOrder(c)
	if w.Code >= 500 {
		t.Fatalf("GetOrder: got %d", w.Code)
	}
}
func TestHandler_DBA_CreateOrder(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateOrder(c)
	if w.Code >= 500 {
		t.Fatalf("CreateOrder: got %d", w.Code)
	}
}
func TestHandler_DBA_ApproveOrder(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ApproveOrder(c)
	if w.Code >= 500 {
		t.Fatalf("ApproveOrder: got %d", w.Code)
	}
}
func TestHandler_DBA_RejectOrder(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RejectOrder(c)
	if w.Code >= 500 {
		t.Fatalf("RejectOrder: got %d", w.Code)
	}
}
func TestHandler_DBA_ExecuteOrder(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ExecuteOrder(c)
	if w.Code >= 500 {
		t.Fatalf("ExecuteOrder: got %d", w.Code)
	}
}
func TestHandler_DBA_ListDataSources(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListDataSources(c)
	if w.Code >= 500 {
		t.Fatalf("ListDataSources: got %d", w.Code)
	}
}
func TestHandler_DBA_GetDataSource(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetDataSource(c)
	if w.Code >= 500 {
		t.Fatalf("GetDataSource: got %d", w.Code)
	}
}
func TestHandler_DBA_CreateDataSource(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateDataSource(c)
	if w.Code >= 500 {
		t.Fatalf("CreateDataSource: got %d", w.Code)
	}
}
func TestHandler_DBA_UpdateDataSource(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateDataSource(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateDataSource: got %d", w.Code)
	}
}
func TestHandler_DBA_DeleteDataSource(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteDataSource(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteDataSource: got %d", w.Code)
	}
}
func TestHandler_DBA_TestConnection(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().TestConnection(c)
	if w.Code >= 500 {
		t.Fatalf("TestConnection: got %d", w.Code)
	}
}
func TestHandler_DBA_ListAuditRules(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListAuditRules(c)
	if w.Code >= 500 {
		t.Fatalf("ListAuditRules: got %d", w.Code)
	}
}
func TestHandler_DBA_CreateAuditRule(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateAuditRule(c)
	if w.Code >= 500 {
		t.Fatalf("CreateAuditRule: got %d", w.Code)
	}
}
func TestHandler_DBA_UpdateAuditRule(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateAuditRule(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateAuditRule: got %d", w.Code)
	}
}
func TestHandler_DBA_ExecuteDirectQuery(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ExecuteDirectQuery(c)
	if w.Code >= 500 {
		t.Fatalf("ExecuteDirectQuery: got %d", w.Code)
	}
}
func TestHandler_DBA_ListQueryLogs(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListQueryLogs(c)
	if w.Code >= 500 {
		t.Fatalf("ListQueryLogs: got %d", w.Code)
	}
}
