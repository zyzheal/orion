package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/chaos-enhanced/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/chaos-enhanced/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeHandlerService{})
}

func makeCtx(method string, path string, body interface{}, params map[string]string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	buf := new(bytes.Buffer)
	if body != nil {
		json.NewEncoder(buf).Encode(body)
	}
	c.Request = httptest.NewRequest(method, path, buf)
	if params != nil {
		c.Params = gin.Params{}
		for k, v := range params {
			c.Params = append(c.Params, gin.Param{Key: k, Value: v})
		}
	}
	return c, w
}

type fakeHandlerService struct{}

func (f *fakeHandlerService) AvailableFaultTypes() []string {
	return []string{}
}

func (f *fakeHandlerService) CreateExperiment(ctx context.Context, req *models.CreateExperimentRequest, tenantID string) (*models.Experiment, error) {
	return &models.Experiment{}, nil
}

func (f *fakeHandlerService) FaultConfigTemplate(faultType string) map[string]any {
	return map[string]any{}
}

func (f *fakeHandlerService) GetExperiment(ctx context.Context, id string, tenantID string) (*models.Experiment, error) {
	return &models.Experiment{}, nil
}

func (f *fakeHandlerService) GetExperimentRecovery(ctx context.Context, id string, tenantID string) (*service.ExperimentRecovery, error) {
	return &service.ExperimentRecovery{}, nil
}

func (f *fakeHandlerService) GetExperimentStatus(ctx context.Context, id string, tenantID string) (*service.ExperimentStatus, error) {
	return &service.ExperimentStatus{}, nil
}

func (f *fakeHandlerService) InjectFault(ctx context.Context, experimentID string, tenantID string, faultType string, faultConfig string) (*models.FaultInjection, error) {
	return &models.FaultInjection{}, nil
}

func (f *fakeHandlerService) ListExperiments(ctx context.Context, tenantID string, status *string, environmentID *string) ([]models.Experiment, int, error) {
	return []models.Experiment{}, 0, nil
}

func (f *fakeHandlerService) StartExperiment(ctx context.Context, id string, tenantID string) (*models.Experiment, error) {
	return &models.Experiment{}, nil
}

func (f *fakeHandlerService) StopExperiment(ctx context.Context, id string, tenantID string) (*models.Experiment, error) {
	return &models.Experiment{}, nil
}

var _ service.ServiceInterface = (*fakeHandlerService)(nil)

func TestCHAOS_ENHANCED_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestCHAOS_ENHANCED_Handler_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}

func TestCHAOS_ENHANCED_Handler_ListExperiments(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListExperiments(c)
	if w.Code >= 500 {
		t.Fatalf("ListExperiments: got %d", w.Code)
	}
}

func TestCHAOS_ENHANCED_Handler_CreateExperiment(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateExperiment(c)
	if w.Code >= 500 {
		t.Fatalf("CreateExperiment: got %d", w.Code)
	}
}

func TestCHAOS_ENHANCED_Handler_GetExperiment(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetExperiment(c)
	if w.Code >= 500 {
		t.Fatalf("GetExperiment: got %d", w.Code)
	}
}

func TestCHAOS_ENHANCED_Handler_StartExperiment(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().StartExperiment(c)
	if w.Code >= 500 {
		t.Fatalf("StartExperiment: got %d", w.Code)
	}
}

func TestCHAOS_ENHANCED_Handler_InjectFault(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().InjectFault(c)
	if w.Code >= 500 {
		t.Fatalf("InjectFault: got %d", w.Code)
	}
}

func TestCHAOS_ENHANCED_Handler_StopExperiment(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().StopExperiment(c)
	if w.Code >= 500 {
		t.Fatalf("StopExperiment: got %d", w.Code)
	}
}

func TestCHAOS_ENHANCED_Handler_GetExperimentStatus(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetExperimentStatus(c)
	if w.Code >= 500 {
		t.Fatalf("GetExperimentStatus: got %d", w.Code)
	}
}

func TestCHAOS_ENHANCED_Handler_GetExperimentRecovery(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetExperimentRecovery(c)
	if w.Code >= 500 {
		t.Fatalf("GetExperimentRecovery: got %d", w.Code)
	}
}

func TestCHAOS_ENHANCED_Handler_ListFaults(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListFaults(c)
	if w.Code >= 500 {
		t.Fatalf("ListFaults: got %d", w.Code)
	}
}

func TestCHAOS_ENHANCED_Handler_GetConfigTemplate(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetConfigTemplate(c)
	if w.Code >= 500 {
		t.Fatalf("GetConfigTemplate: got %d", w.Code)
	}
}
