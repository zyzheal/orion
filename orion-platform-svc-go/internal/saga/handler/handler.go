package handler

import (
	"context"
	"encoding/json"
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/saga/models"
	"orion/platform-svc-go/internal/saga/service"

	"github.com/gin-gonic/gin"
	"orion/go-common/pkg/errors"
)

// Coordinator defines the interface for saga coordinator operations used by the handler.
// Extracted to enable testability with mock implementations.
type Coordinator interface {
	Start(ctx context.Context, tenantID string, req *models.CreateSagaRequest) (*models.SagaTransaction, error)
	GetTransaction(ctx context.Context, tenantID, txID string) (*models.SagaTransaction, error)
	ListTransactions(ctx context.Context, tenantID string, q models.ListSagasQuery) (*models.SagaListResponse, error)
	Cancel(ctx context.Context, tenantID, txID string, reason string) (*models.SagaTransaction, error)
	StartCompensation(ctx context.Context, tenantID, txID string, reason string) error
	GetSteps(ctx context.Context, tenantID, txID string) ([]models.SagaStep, error)
	GetStepByID(ctx context.Context, tenantID, stepID string) (*models.SagaStep, error)
}

type Handler struct {
	coordinator Coordinator
}

func NewHandler(coordinator Coordinator) *Handler {
	return &Handler{
		coordinator: coordinator,
	}
}

// RegisterRoutes registers saga routes.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/saga")

	// Transaction routes
	r.POST("/transactions", auth.RequirePermission("saga", "write"), h.CreateTransaction)
	r.GET("/transactions/:transactionId", auth.RequirePermission("saga", "read"), h.GetTransaction)
	r.GET("/transactions", auth.RequirePermission("saga", "read"), h.ListTransactions)
	r.POST("/transactions/:transactionId/cancel", auth.RequirePermission("saga", "delete"), h.CancelTransaction)
	r.POST("/transactions/:transactionId/compensate", auth.RequirePermission("saga", "write"), h.CompensateTransaction)

	// Step routes
	r.GET("/transactions/:transactionId/steps", auth.RequirePermission("saga", "read"), h.GetSteps)
	r.GET("/steps/:stepId", auth.RequirePermission("saga", "read"), h.GetStep)
}

// CreateTransaction starts a new saga transaction.
func (h *Handler) CreateTransaction(c *gin.Context) {
	var req models.CreateSagaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	tenantID := c.GetString("tenant_id")
	tx, err := h.coordinator.Start(c.Request.Context(), tenantID, &req)
	if err != nil {
		if err.Error() == service.ErrSagaRunning.Error() {
			respondConflict(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, tx)
}

// GetTransaction retrieves a saga transaction.
func (h *Handler) GetTransaction(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	txID := c.Param("transactionId")

	tx, err := h.coordinator.GetTransaction(c.Request.Context(), tenantID, txID)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, tx)
}

// ListTransactions lists saga transactions.
func (h *Handler) ListTransactions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	var q models.ListSagasQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	result, err := h.coordinator.ListTransactions(c.Request.Context(), tenantID, q)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// CancelTransaction cancels a running saga.
func (h *Handler) CancelTransaction(c *gin.Context) {
	var req models.CancelSagaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}

	tenantID := c.GetString("tenant_id")
	txID := c.Param("transactionId")

	reason := req.Reason
	if reason == "" {
		reason = "cancelled by user"
	}

	tx, err := h.coordinator.Cancel(c.Request.Context(), tenantID, txID, reason)
	if err != nil {
		if err.Error() == service.ErrInvalidStatus.Error() {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, tx)
}

// CompensateTransaction manually triggers compensation.
func (h *Handler) CompensateTransaction(c *gin.Context) {
	var req struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&req)

	tenantID := c.GetString("tenant_id")
	txID := c.Param("transactionId")

	err := h.coordinator.StartCompensation(c.Request.Context(), tenantID, txID, req.Reason)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"status": "compensation_started"})
}

// GetSteps retrieves all steps in a transaction.
func (h *Handler) GetSteps(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	txID := c.Param("transactionId")

	var q models.GetStepsQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	_ = q

	steps, err := h.coordinator.GetSteps(c.Request.Context(), tenantID, txID)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, steps)
}

// GetStep retrieves a single step.
func (h *Handler) GetStep(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	stepID := c.Param("stepId")

	step, err := h.coordinator.GetStepByID(c.Request.Context(), tenantID, stepID)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, step)
}

// --- response helpers ---

func respondSuccess(c *gin.Context, data interface{}) {
	_ = json.NewEncoder(c.Writer).Encode(data)
	c.Status(http.StatusOK)
}

func respondCreated(c *gin.Context, data interface{}) {
	errors.WriteCreated(c, data)
}

func respondBadRequest(c *gin.Context, message string) {
	c.JSON(http.StatusBadRequest, gin.H{"error": message})
}

func respondNotFound(c *gin.Context, message string) {
	c.JSON(http.StatusNotFound, gin.H{"error": message})
}

func respondConflict(c *gin.Context, message string) {
	c.JSON(http.StatusConflict, gin.H{"error": message})
}

func respondInternalError(c *gin.Context, message string) {
	c.JSON(http.StatusInternalServerError, gin.H{"error": message})
}
