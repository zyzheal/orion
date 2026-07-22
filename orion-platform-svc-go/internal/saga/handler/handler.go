package handler

import (
	"context"
	"orion/platform-svc-go/internal/middleware"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/saga/models"
	"orion/platform-svc-go/internal/saga/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
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
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateTransaction")
	defer span.End()
	var req models.CreateSagaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	tenantID := c.GetString("tenant_id")
	tx, err := h.coordinator.Start(ctx, tenantID, &req)
	if err != nil {
		if err.Error() == service.ErrSagaRunning.Error() {
			middleware.RespondConflict(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, tx)
}

// GetTransaction retrieves a saga transaction.
func (h *Handler) GetTransaction(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTransaction")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	txID := c.Param("transactionId")

	tx, err := h.coordinator.GetTransaction(ctx, tenantID, txID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, tx)
}

// ListTransactions lists saga transactions.
func (h *Handler) ListTransactions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListTransactions")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var q models.ListSagasQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	result, err := h.coordinator.ListTransactions(ctx, tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// CancelTransaction cancels a running saga.
func (h *Handler) CancelTransaction(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CancelTransaction")
	defer span.End()
	var req models.CancelSagaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}

	tenantID := c.GetString("tenant_id")
	txID := c.Param("transactionId")

	reason := req.Reason
	if reason == "" {
		reason = "cancelled by user"
	}

	tx, err := h.coordinator.Cancel(ctx, tenantID, txID, reason)
	if err != nil {
		if err.Error() == service.ErrInvalidStatus.Error() {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, tx)
}

// CompensateTransaction manually triggers compensation.
func (h *Handler) CompensateTransaction(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CompensateTransaction")
	defer span.End()
	var req struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&req)

	tenantID := c.GetString("tenant_id")
	txID := c.Param("transactionId")

	err := h.coordinator.StartCompensation(ctx, tenantID, txID, req.Reason)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"status": "compensation_started"})
}

// GetSteps retrieves all steps in a transaction.
func (h *Handler) GetSteps(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSteps")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	txID := c.Param("transactionId")

	var q models.GetStepsQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	_ = q

	steps, err := h.coordinator.GetSteps(ctx, tenantID, txID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, steps)
}

// GetStep retrieves a single step.
func (h *Handler) GetStep(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStep")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	stepID := c.Param("stepId")

	step, err := h.coordinator.GetStepByID(ctx, tenantID, stepID)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, step)
}

// No local response helpers — all handlers use middleware.RespondXXX (standardized).
