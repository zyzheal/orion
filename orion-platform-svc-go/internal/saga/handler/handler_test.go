package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/saga/models"
	"orion/platform-svc-go/internal/saga/service"

	"github.com/gin-gonic/gin"
)

// mockCoordinator implements Coordinator interface for testing.
type mockCoordinator struct {
	startFn             func(ctx context.Context, tenantID string, req *models.CreateSagaRequest) (*models.SagaTransaction, error)
	getTransactionFn    func(ctx context.Context, tenantID, txID string) (*models.SagaTransaction, error)
	listTransactionsFn  func(ctx context.Context, tenantID string, q models.ListSagasQuery) (*models.SagaListResponse, error)
	cancelFn            func(ctx context.Context, tenantID, txID string, reason string) (*models.SagaTransaction, error)
	startCompensationFn func(ctx context.Context, tenantID, txID string, reason string) error
	getStepsFn          func(ctx context.Context, tenantID, txID string) ([]models.SagaStep, error)
	getStepByIDFn       func(ctx context.Context, tenantID, stepID string) (*models.SagaStep, error)
}

func (m *mockCoordinator) Start(ctx context.Context, tenantID string, req *models.CreateSagaRequest) (*models.SagaTransaction, error) {
	if m.startFn != nil {
		return m.startFn(ctx, tenantID, req)
	}
	return nil, nil
}

func (m *mockCoordinator) GetTransaction(ctx context.Context, tenantID, txID string) (*models.SagaTransaction, error) {
	if m.getTransactionFn != nil {
		return m.getTransactionFn(ctx, tenantID, txID)
	}
	return nil, nil
}

func (m *mockCoordinator) ListTransactions(ctx context.Context, tenantID string, q models.ListSagasQuery) (*models.SagaListResponse, error) {
	if m.listTransactionsFn != nil {
		return m.listTransactionsFn(ctx, tenantID, q)
	}
	return nil, nil
}

func (m *mockCoordinator) Cancel(ctx context.Context, tenantID, txID string, reason string) (*models.SagaTransaction, error) {
	if m.cancelFn != nil {
		return m.cancelFn(ctx, tenantID, txID, reason)
	}
	return nil, nil
}

func (m *mockCoordinator) StartCompensation(ctx context.Context, tenantID, txID string, reason string) error {
	if m.startCompensationFn != nil {
		return m.startCompensationFn(ctx, tenantID, txID, reason)
	}
	return nil
}

func (m *mockCoordinator) GetSteps(ctx context.Context, tenantID, txID string) ([]models.SagaStep, error) {
	if m.getStepsFn != nil {
		return m.getStepsFn(ctx, tenantID, txID)
	}
	return nil, nil
}

func (m *mockCoordinator) GetStepByID(ctx context.Context, tenantID, stepID string) (*models.SagaStep, error) {
	if m.getStepByIDFn != nil {
		return m.getStepByIDFn(ctx, tenantID, stepID)
	}
	return nil, nil
}

// testTx returns a default SagaTransaction.
func testTx(txID string) *models.SagaTransaction {
	return &models.SagaTransaction{
		ID:       txID,
		TenantID: "tenant-1",
		SagaName: "deploy",
		Status:   models.SagaStatusRunning,
	}
}

// testStep returns a default SagaStep.
func testStep(stepID string, txID string) *models.SagaStep {
	return &models.SagaStep{
		ID:            stepID,
		TenantID:      "tenant-1",
		TransactionID: txID,
		StepName:      "build",
		Status:        models.SagaStepStatusCompleted,
	}
}

// setupHandler returns a Handler for testing.
func setupHandler(coord *mockCoordinator) *Handler {
	return NewHandler(coord)
}

func newGinCtx() (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	return c, w
}

// request creates a test request with body and sets gin context params.
func request(method, path string, body interface{}, params map[string]string, header map[string]string) (c *gin.Context, w *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)

	var buf bytes.Buffer
	if body != nil {
		if b, ok := body.([]byte); ok {
			buf = *bytes.NewBuffer(b)
		} else {
			data, _ := json.Marshal(body)
			buf = *bytes.NewBuffer(data)
		}
	}
	c.Request = httptest.NewRequest(method, path, &buf)
	c.Request.Header.Set("Content-Type", "application/json")
	if header != nil {
		for k, v := range header {
			c.Request.Header.Set(k, v)
		}
	}

	for k, v := range params {
		c.Params = append(c.Params, gin.Param{Key: k, Value: v})
	}

	return c, w
}

// --- Test cases ---

func TestCreateTransaction_Success(t *testing.T) {
	coord := &mockCoordinator{
		startFn: func(_ context.Context, tenantID string, req *models.CreateSagaRequest) (*models.SagaTransaction, error) {
			return testTx("tx-1"), nil
		},
	}
	c, w := request("POST", "/transactions", models.CreateSagaRequest{
		SagaName: "deploy",
		Input:    map[string]interface{}{},
	}, nil, nil)
	h := setupHandler(coord)
	h.CreateTransaction(c)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	data, ok := resp["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected response.data, got %v", resp["data"])
	}
	if data["id"] != "tx-1" {
		t.Errorf("expected id=tx-1, got %v", data["id"])
	}
}

func TestCreateTransaction_BadRequest(t *testing.T) {
	coord := &mockCoordinator{}
	c, w := request("POST", "/transactions", map[string]interface{}{"bad": "json"}, nil, nil)
	h := setupHandler(coord)
	h.CreateTransaction(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestCreateTransaction_SagaRunning(t *testing.T) {
	coord := &mockCoordinator{
		startFn: func(_ context.Context, _ string, _ *models.CreateSagaRequest) (*models.SagaTransaction, error) {
			return nil, service.ErrSagaRunning
		},
	}
	c, w := request("POST", "/transactions", models.CreateSagaRequest{
		SagaName: "deploy",
		Input:    map[string]interface{}{},
	}, nil, nil)
	h := setupHandler(coord)
	h.CreateTransaction(c)

	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d", w.Code)
	}
}

func TestGetTransaction_Success(t *testing.T) {
	coord := &mockCoordinator{
		getTransactionFn: func(_ context.Context, _, txID string) (*models.SagaTransaction, error) {
			return testTx(txID), nil
		},
	}
	c, w := request("GET", "/transactions/tx-1", nil, map[string]string{"transactionId": "tx-1"}, nil)
	h := setupHandler(coord)
	h.GetTransaction(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestGetTransaction_NotFound(t *testing.T) {
	coord := &mockCoordinator{
		getTransactionFn: func(_ context.Context, _, _ string) (*models.SagaTransaction, error) {
			return nil, service.ErrSagaNotFound
		},
	}
	c, w := request("GET", "/transactions/tx-1", nil, map[string]string{"transactionId": "tx-1"}, nil)
	h := setupHandler(coord)
	h.GetTransaction(c)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestListTransactions_Success(t *testing.T) {
	coord := &mockCoordinator{
		listTransactionsFn: func(_ context.Context, _ string, _ models.ListSagasQuery) (*models.SagaListResponse, error) {
			return &models.SagaListResponse{
				Data:  []models.SagaTransaction{*testTx("tx-1"), *testTx("tx-2")},
				Total: 2,
			}, nil
		},
	}
	c, w := request("GET", "/transactions", nil, nil, nil)
	h := setupHandler(coord)
	h.ListTransactions(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestCancelTransaction_Success(t *testing.T) {
	coord := &mockCoordinator{
		cancelFn: func(_ context.Context, _, txID string, reason string) (*models.SagaTransaction, error) {
			tx := testTx(txID)
			tx.Status = models.SagaStatusFailed
			return tx, nil
		},
	}
	c, w := request("POST", "/transactions/tx-1/cancel", models.CancelSagaRequest{Reason: "test"}, map[string]string{"transactionId": "tx-1"}, nil)
	h := setupHandler(coord)
	h.CancelTransaction(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestCancelTransaction_BadRequest(t *testing.T) {
	coord := &mockCoordinator{
		cancelFn: func(_ context.Context, _, _ string, _ string) (*models.SagaTransaction, error) {
			return nil, service.ErrInvalidStatus
		},
	}
	c, w := request("POST", "/transactions/tx-1/cancel", models.CancelSagaRequest{Reason: "test"}, map[string]string{"transactionId": "tx-1"}, nil)
	h := setupHandler(coord)
	h.CancelTransaction(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestCompensateTransaction_Success(t *testing.T) {
	coord := &mockCoordinator{
		startCompensationFn: func(_ context.Context, _, _ string, _ string) error {
			return nil
		},
	}
	c, w := request("POST", "/transactions/tx-1/compensate", map[string]interface{}{"reason": "test"}, map[string]string{"transactionId": "tx-1"}, nil)
	h := setupHandler(coord)
	h.CompensateTransaction(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestGetSteps_Success(t *testing.T) {
	coord := &mockCoordinator{
		getStepsFn: func(_ context.Context, _, txID string) ([]models.SagaStep, error) {
			return []models.SagaStep{*testStep("step-1", txID), *testStep("step-2", txID)}, nil
		},
	}
	c, w := request("GET", "/transactions/tx-1/steps", nil, map[string]string{"transactionId": "tx-1"}, nil)
	h := setupHandler(coord)
	h.GetSteps(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestGetStep_Success(t *testing.T) {
	coord := &mockCoordinator{
		getStepByIDFn: func(_ context.Context, _, stepID string) (*models.SagaStep, error) {
			return testStep(stepID, "tx-1"), nil
		},
	}
	c, w := request("GET", "/steps/step-1", nil, map[string]string{"stepId": "step-1"}, nil)
	h := setupHandler(coord)
	h.GetStep(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestGetStep_NotFound(t *testing.T) {
	coord := &mockCoordinator{
		getStepByIDFn: func(_ context.Context, _, _ string) (*models.SagaStep, error) {
			return nil, service.ErrSagaNotFound
		},
	}
	c, w := request("GET", "/steps/step-1", nil, map[string]string{"stepId": "step-1"}, nil)
	h := setupHandler(coord)
	h.GetStep(c)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestCancelTransaction_DefaultReason(t *testing.T) {
	coord := &mockCoordinator{
		cancelFn: func(_ context.Context, _, txID string, reason string) (*models.SagaTransaction, error) {
			if reason != "cancelled by user" {
				t.Errorf("expected 'cancelled by user', got %q", reason)
			}
			return testTx(txID), nil
		},
	}
	c, w := request("POST", "/transactions/tx-1/cancel", models.CancelSagaRequest{}, map[string]string{"transactionId": "tx-1"}, nil)
	h := setupHandler(coord)
	h.CancelTransaction(c)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

// --- Interface check ---

func TestCoordinator_Interface(t *testing.T) {
	var _ Coordinator = (*mockCoordinator)(nil)
}