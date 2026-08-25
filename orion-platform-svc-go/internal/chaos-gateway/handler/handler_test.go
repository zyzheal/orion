package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/chaos-gateway/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/chaos-gateway/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeChaos_gatewayService{})
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

type fakeChaos_gatewayService struct{}

func (f *fakeChaos_gatewayService) CreateExperiment(ctx context.Context, tenantID, createdBy string, req models.CreateExperimentRequest) (*models.ChaosExperiment, error) {
	return &models.ChaosExperiment{}, nil
}

func (f *fakeChaos_gatewayService) DeleteExperiment(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeChaos_gatewayService) GetExperiment(ctx context.Context, tenantID, id string) (*models.ChaosExperiment, error) {
	return &models.ChaosExperiment{}, nil
}

func (f *fakeChaos_gatewayService) GetLogs(ctx context.Context, tenantID, id string, q models.ListQuery) ([]models.ExperimentLog, int, error) {
	return []models.ExperimentLog{}, 0, nil
}

func (f *fakeChaos_gatewayService) GetResults(ctx context.Context, tenantID, id string, q models.ListQuery) ([]models.ExperimentResult, int, error) {
	return []models.ExperimentResult{}, 0, nil
}

func (f *fakeChaos_gatewayService) GetScenarios(ctx context.Context) ([]models.ChaosScenario, error) {
	return []models.ChaosScenario{}, nil
}

func (f *fakeChaos_gatewayService) ListExperiments(ctx context.Context, tenantID string, q models.ListQuery) ([]models.ChaosExperiment, int, error) {
	return []models.ChaosExperiment{}, 0, nil
}

func (f *fakeChaos_gatewayService) PauseExperiment(ctx context.Context, tenantID, id string) (*models.ChaosExperiment, error) {
	return &models.ChaosExperiment{}, nil
}

func (f *fakeChaos_gatewayService) ResumeExperiment(ctx context.Context, tenantID, id string) (*models.ChaosExperiment, error) {
	return &models.ChaosExperiment{}, nil
}

func (f *fakeChaos_gatewayService) ScheduleExperiment(ctx context.Context, tenantID, createdBy string, req models.ScheduleExperimentRequest) (*models.ChaosExperiment, error) {
	return &models.ChaosExperiment{}, nil
}

func (f *fakeChaos_gatewayService) StartExperiment(ctx context.Context, tenantID, id string) (*models.ChaosExperiment, error) {
	return &models.ChaosExperiment{}, nil
}

func (f *fakeChaos_gatewayService) StopExperiment(ctx context.Context, tenantID, id string) (*models.ChaosExperiment, error) {
	return &models.ChaosExperiment{}, nil
}

func (f *fakeChaos_gatewayService) UpdateExperiment(ctx context.Context, tenantID, id string, req models.UpdateExperimentRequest) (*models.ChaosExperiment, error) {
	return &models.ChaosExperiment{}, nil
}

var _ service.ServiceInterface = (*fakeChaos_gatewayService)(nil)


func TestCHAOS_GATEWAY_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestCHAOS_GATEWAY_Handler_GetScenarios(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetScenarios(c)
	if w.Code >= 500 {
		t.Fatalf("GetScenarios: got %d", w.Code)
	}
}

func TestCHAOS_GATEWAY_Handler_ListExperiments(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListExperiments(c)
	if w.Code >= 500 {
		t.Fatalf("ListExperiments: got %d", w.Code)
	}
}

func TestCHAOS_GATEWAY_Handler_CreateExperiment(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateExperiment(c)
	if w.Code >= 500 {
		t.Fatalf("CreateExperiment: got %d", w.Code)
	}
}

func TestCHAOS_GATEWAY_Handler_GetExperiment(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetExperiment(c)
	if w.Code >= 500 {
		t.Fatalf("GetExperiment: got %d", w.Code)
	}
}

func TestCHAOS_GATEWAY_Handler_UpdateExperiment(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateExperiment(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateExperiment: got %d", w.Code)
	}
}

func TestCHAOS_GATEWAY_Handler_DeleteExperiment(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteExperiment(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteExperiment: got %d", w.Code)
	}
}

func TestCHAOS_GATEWAY_Handler_StartExperiment(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().StartExperiment(c)
	if w.Code >= 500 {
		t.Fatalf("StartExperiment: got %d", w.Code)
	}
}

func TestCHAOS_GATEWAY_Handler_StopExperiment(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().StopExperiment(c)
	if w.Code >= 500 {
		t.Fatalf("StopExperiment: got %d", w.Code)
	}
}

func TestCHAOS_GATEWAY_Handler_PauseExperiment(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().PauseExperiment(c)
	if w.Code >= 500 {
		t.Fatalf("PauseExperiment: got %d", w.Code)
	}
}

func TestCHAOS_GATEWAY_Handler_ResumeExperiment(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ResumeExperiment(c)
	if w.Code >= 500 {
		t.Fatalf("ResumeExperiment: got %d", w.Code)
	}
}

func TestCHAOS_GATEWAY_Handler_GetResults(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetResults(c)
	if w.Code >= 500 {
		t.Fatalf("GetResults: got %d", w.Code)
	}
}

func TestCHAOS_GATEWAY_Handler_GetLogs(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetLogs(c)
	if w.Code >= 500 {
		t.Fatalf("GetLogs: got %d", w.Code)
	}
}

func TestCHAOS_GATEWAY_Handler_ScheduleExperiment(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ScheduleExperiment(c)
	if w.Code >= 500 {
		t.Fatalf("ScheduleExperiment: got %d", w.Code)
	}
}
