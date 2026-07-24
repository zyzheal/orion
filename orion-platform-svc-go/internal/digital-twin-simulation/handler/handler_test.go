package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	dt_service "orion/platform-svc-go/internal/digital-twin-simulation/service"
	"orion/platform-svc-go/internal/digital-twin-simulation/models"

	"github.com/gin-gonic/gin"
)

type mockSvc struct {
	createTwinFn      func(ctx context.Context, tenantID string, req models.CreateTwinRequest) (*models.DigitalTwin, error)
	listTwinsFn       func(ctx context.Context, tenantID string, q models.ListQuery) ([]models.DigitalTwin, int64, error)
	getTwinFn         func(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error)
	updateTwinFn      func(ctx context.Context, tenantID, id string, req models.UpdateTwinRequest) (*models.DigitalTwin, error)
	deleteTwinFn      func(ctx context.Context, tenantID, id string) error
	syncTwinFn        func(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error)
	getStateFn        func(ctx context.Context, twinID string) (*dt_service.TwinStateResponse, error)
	simulateFn        func(ctx context.Context, tenantID, twinID string, req models.SimulateRequest) (*models.Simulation, error)
	listSimulationsFn func(ctx context.Context, twinID string, q models.ListQuery) ([]models.Simulation, int64, error)
	getComparisonFn   func(ctx context.Context, twinID string) (*dt_service.TwinComparison, error)
	predictFn         func(ctx context.Context, twinID string, req models.PredictRequest) (*dt_service.PredictionResult, error)
}

func (m *mockSvc) CreateTwin(ctx context.Context, tenantID string, req models.CreateTwinRequest) (*models.DigitalTwin, error) {
	if m.createTwinFn != nil { return m.createTwinFn(ctx, tenantID, req) }
	return nil, nil
}
func (m *mockSvc) ListTwins(ctx context.Context, tenantID string, q models.ListQuery) ([]models.DigitalTwin, int64, error) {
	if m.listTwinsFn != nil { return m.listTwinsFn(ctx, tenantID, q) }
	return nil, 0, nil
}
func (m *mockSvc) GetTwin(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error) {
	if m.getTwinFn != nil { return m.getTwinFn(ctx, tenantID, id) }
	return nil, nil
}
func (m *mockSvc) UpdateTwin(ctx context.Context, tenantID, id string, req models.UpdateTwinRequest) (*models.DigitalTwin, error) {
	if m.updateTwinFn != nil { return m.updateTwinFn(ctx, tenantID, id, req) }
	return nil, nil
}
func (m *mockSvc) DeleteTwin(ctx context.Context, tenantID, id string) error {
	if m.deleteTwinFn != nil { return m.deleteTwinFn(ctx, tenantID, id) }
	return nil
}
func (m *mockSvc) SyncTwin(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error) {
	if m.syncTwinFn != nil { return m.syncTwinFn(ctx, tenantID, id) }
	return nil, nil
}
func (m *mockSvc) GetState(ctx context.Context, twinID string) (*dt_service.TwinStateResponse, error) {
	if m.getStateFn != nil { return m.getStateFn(ctx, twinID) }
	return nil, nil
}
func (m *mockSvc) Simulate(ctx context.Context, tenantID, twinID string, req models.SimulateRequest) (*models.Simulation, error) {
	if m.simulateFn != nil { return m.simulateFn(ctx, tenantID, twinID, req) }
	return nil, nil
}
func (m *mockSvc) ListSimulations(ctx context.Context, twinID string, q models.ListQuery) ([]models.Simulation, int64, error) {
	if m.listSimulationsFn != nil { return m.listSimulationsFn(ctx, twinID, q) }
	return nil, 0, nil
}
func (m *mockSvc) GetComparison(ctx context.Context, twinID string) (*dt_service.TwinComparison, error) {
	if m.getComparisonFn != nil { return m.getComparisonFn(ctx, twinID) }
	return nil, nil
}
func (m *mockSvc) Predict(ctx context.Context, twinID string, req models.PredictRequest) (*dt_service.PredictionResult, error) {
	if m.predictFn != nil { return m.predictFn(ctx, twinID, req) }
	return nil, nil
}

func newHandlerWithSvc(svc Service) *Handler {
	return &Handler{svc: svc}
}

func performRequest(h *Handler, handlerFn func(c *gin.Context), method string, body interface{}, pathParams map[string]string, queryParams map[string]string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "test-tenant")

	var buf bytes.Buffer
	if body != nil {
		b, _ := json.Marshal(body)
		buf = *bytes.NewBuffer(b)
	}
	c.Request = httptest.NewRequest(method, "/", &buf)
	c.Request.Header.Set("Content-Type", "application/json")

	if pathParams != nil {
		c.Params = gin.Params{}
		for k, v := range pathParams {
			c.Params = append(c.Params, gin.Param{Key: k, Value: v})
		}
	}

	if queryParams != nil {
		q := c.Request.URL.Query()
		for k, v := range queryParams {
			q.Set(k, v)
		}
		c.Request.URL.RawQuery = q.Encode()
	}

	handlerFn(c)
	return w
}

// --- CreateTwin ---

func TestHandler_CreateTwin_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		createTwinFn: func(ctx context.Context, tenantID string, req models.CreateTwinRequest) (*models.DigitalTwin, error) {
			return &models.DigitalTwin{ID: "twin-1", Name: req.Name, Status: "active"}, nil
		},
	})
	w := performRequest(h, h.CreateTwin, "POST", map[string]interface{}{
		"name": "test-twin", "entityType": "service", "sourceId": "svc-1",
	}, nil, nil)
	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d", w.Code)
	}
}

func TestHandler_CreateTwin_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.CreateTwin, "POST", map[string]interface{}{}, nil, nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestHandler_CreateTwin_ServiceError(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		createTwinFn: func(ctx context.Context, tenantID string, req models.CreateTwinRequest) (*models.DigitalTwin, error) {
			return nil, errors.New("db error")
		},
	})
	w := performRequest(h, h.CreateTwin, "POST", map[string]interface{}{
		"name": "test", "entityType": "service", "sourceId": "svc-1",
	}, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

// --- ListTwins ---

func TestHandler_ListTwins_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		listTwinsFn: func(ctx context.Context, tenantID string, q models.ListQuery) ([]models.DigitalTwin, int64, error) {
			return []models.DigitalTwin{{ID: "twin-1"}}, 1, nil
		},
	})
	w := performRequest(h, h.ListTwins, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

// --- GetTwin ---

func TestHandler_GetTwin_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getTwinFn: func(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error) {
			return &models.DigitalTwin{ID: id, Name: "test"}, nil
		},
	})
	w := performRequest(h, h.GetTwin, "GET", nil, map[string]string{"id": "twin-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetTwin_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getTwinFn: func(ctx context.Context, _, _ string) (*models.DigitalTwin, error) {
			return nil, errors.New("not found")
		},
	})
	w := performRequest(h, h.GetTwin, "GET", nil, map[string]string{"id": "nonexistent"}, nil)
	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

// --- UpdateTwin ---

func TestHandler_UpdateTwin_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		updateTwinFn: func(ctx context.Context, tenantID, id string, req models.UpdateTwinRequest) (*models.DigitalTwin, error) {
			return &models.DigitalTwin{ID: id, Name: "updated"}, nil
		},
	})
	w := performRequest(h, h.UpdateTwin, "PUT", map[string]interface{}{"name": "updated"}, map[string]string{"id": "twin-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestHandler_UpdateTwin_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.UpdateTwin, "PUT", "invalid json", map[string]string{"id": "twin-1"}, nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

// --- DeleteTwin ---

func TestHandler_DeleteTwin_Success(t *testing.T) {
	var called bool
	h := newHandlerWithSvc(&mockSvc{
		deleteTwinFn: func(ctx context.Context, tenantID, id string) error {
			called = true
			return nil
		},
	})
	w := performRequest(h, h.DeleteTwin, "DELETE", nil, map[string]string{"id": "twin-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
	if !called {
		t.Error("expected delete to be called")
	}
}

// --- SyncTwin ---

func TestHandler_SyncTwin_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		syncTwinFn: func(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error) {
			return &models.DigitalTwin{ID: id, Status: "syncing"}, nil
		},
	})
	w := performRequest(h, h.SyncTwin, "POST", nil, map[string]string{"id": "twin-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

// --- Simulate ---

func TestHandler_Simulate_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		simulateFn: func(ctx context.Context, tenantID, twinID string, req models.SimulateRequest) (*models.Simulation, error) {
			return &models.Simulation{ID: "sim-1", Name: req.Name, Status: "completed"}, nil
		},
	})
	w := performRequest(h, h.Simulate, "POST", map[string]interface{}{
		"type": "performance", "name": "test-sim", "parameters": map[string]interface{}{},
	}, map[string]string{"id": "twin-1"}, nil)
	if w.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d", w.Code)
	}
}

func TestHandler_Simulate_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.Simulate, "POST", map[string]interface{}{}, map[string]string{"id": "twin-1"}, nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

// --- Predict ---

func TestHandler_Predict_Success(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "test-tenant")
	c.Params = append(c.Params, gin.Param{Key: "id", Value: "twin-1"})

	body := map[string]interface{}{
		"predictionType": "cpu", "forecastPeriod": "7d",
	}
	b, _ := json.Marshal(body)
	c.Request = httptest.NewRequest("POST", "/", bytes.NewBuffer(b))
	c.Request.Header.Set("Content-Type", "application/json")

	h := newHandlerWithSvc(&mockSvc{
		predictFn: func(ctx context.Context, twinID string, req models.PredictRequest) (*dt_service.PredictionResult, error) {
			return &dt_service.PredictionResult{TwinID: twinID, PredictionType: req.PredictionType}, nil
		},
	})
	h.Predict(c)
	if c.Writer.Status() != http.StatusOK {
		t.Errorf("expected 200, got %d", c.Writer.Status())
	}
}

func TestHandler_Predict_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.Predict, "POST", map[string]interface{}{}, map[string]string{"id": "twin-1"}, nil)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

// --- ListSimulations ---

func TestHandler_ListSimulations_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		listSimulationsFn: func(ctx context.Context, twinID string, q models.ListQuery) ([]models.Simulation, int64, error) {
			return []models.Simulation{{ID: "sim-1"}}, 1, nil
		},
	})
	w := performRequest(h, h.ListSimulations, "GET", nil, map[string]string{"id": "twin-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

// --- GetState ---

func TestHandler_GetState_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getStateFn: func(ctx context.Context, twinID string) (*dt_service.TwinStateResponse, error) {
			return &dt_service.TwinStateResponse{TwinID: twinID}, nil
		},
	})
	w := performRequest(h, h.GetState, "GET", nil, map[string]string{"id": "twin-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

// --- GetComparison ---

func TestHandler_GetComparison_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getComparisonFn: func(ctx context.Context, twinID string) (*dt_service.TwinComparison, error) {
			return &dt_service.TwinComparison{TwinID: twinID}, nil
		},
	})
	w := performRequest(h, h.GetComparison, "GET", nil, map[string]string{"id": "twin-1"}, nil)
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}
