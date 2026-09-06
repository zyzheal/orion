package approval

import (
	"strconv"

	"orion/go-common/pkg/auth"

	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Handler wires the approval service to HTTP endpoints. It mirrors the
// layout of internal/dba/handler: a single RegisterRoutes entry that
// mounts under /api/v1/db/approval/* on the shared router group.
type Handler struct {
	svc *Service
}

// NewHandler constructs a Handler bound to the given approval service.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts the approval endpoints on the provided group.
// The parent group is expected to be /api/v1/db per the task spec.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/approval")

	// --- Workflows ---
	f.POST("/workflows", auth.RequirePermission("dba", "write"), h.CreateWorkflow)
	f.GET("/workflows", auth.RequirePermission("dba", "read"), h.ListWorkflows)
	f.GET("/workflows/:id", auth.RequirePermission("dba", "read"), h.GetWorkflow)

	// --- Instances ---
	f.POST("/instances", auth.RequirePermission("dba", "write"), h.SubmitForApproval)
	f.GET("/instances", auth.RequirePermission("dba", "read"), h.ListInstances)
	f.GET("/instances/:id", auth.RequirePermission("dba", "read"), h.GetInstance)

	// --- Step actions ---
	f.POST("/instances/:id/steps/:idx/approve", auth.RequirePermission("dba", "approve"), h.ApproveStep)
	f.POST("/instances/:id/steps/:idx/reject", auth.RequirePermission("dba", "approve"), h.RejectStep)
	f.POST("/instances/:id/steps/:idx/escalate", auth.RequirePermission("dba", "approve"), h.EscalateStep)
}

// ---- Workflows ----

func (h *Handler) CreateWorkflow(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ApprovalCreateWorkflow")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req CreateWorkflowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	w, err := h.svc.CreateWorkflow(ctx, tenantID, req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, w)
}

func (h *Handler) ListWorkflows(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ApprovalListWorkflows")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	list, err := h.svc.ListWorkflows(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, list)
}

func (h *Handler) GetWorkflow(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ApprovalGetWorkflow")
	defer span.End()
	w, err := h.svc.GetWorkflow(ctx, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, "workflow not found")
		return
	}
	middleware.RespondSuccess(c, w)
}

// ---- Instances ----

func (h *Handler) SubmitForApproval(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ApprovalSubmit")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req SubmitForApprovalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	inst, err := h.svc.SubmitForApproval(ctx, tenantID, req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, inst)
}

func (h *Handler) ListInstances(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ApprovalListInstances")
	defer span.End()
	orderID := c.Query("order_id")
	if orderID == "" {
		middleware.RespondBadRequest(c, "order_id is required")
		return
	}
	list, err := h.svc.ListInstances(ctx, orderID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, list)
}

func (h *Handler) GetInstance(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ApprovalGetInstance")
	defer span.End()
	inst, err := h.svc.GetInstance(ctx, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, "instance not found")
		return
	}
	middleware.RespondSuccess(c, inst)
}

// ---- Step actions ----

func (h *Handler) ApproveStep(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ApprovalApproveStep")
	defer span.End()
	idx := parseStepIdx(c)
	if idx < 0 {
		middleware.RespondBadRequest(c, "invalid step index")
		return
	}
	userID := c.GetString("user_id")
	var req StepActionRequest
	_ = c.ShouldBindJSON(&req)
	inst, err := h.svc.ApproveStep(ctx, c.Param("id"), idx, userID, req.Comment)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, inst)
}

func (h *Handler) RejectStep(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ApprovalRejectStep")
	defer span.End()
	idx := parseStepIdx(c)
	if idx < 0 {
		middleware.RespondBadRequest(c, "invalid step index")
		return
	}
	userID := c.GetString("user_id")
	var req StepActionRequest
	_ = c.ShouldBindJSON(&req)
	inst, err := h.svc.RejectStep(ctx, c.Param("id"), idx, userID, req.Comment)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, inst)
}

func (h *Handler) EscalateStep(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ApprovalEscalateStep")
	defer span.End()
	idx := parseStepIdx(c)
	if idx < 0 {
		middleware.RespondBadRequest(c, "invalid step index")
		return
	}
	userID := c.GetString("user_id")
	inst, err := h.svc.Escalate(ctx, c.Param("id"), idx, userID)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, inst)
}

// parseStepIdx extracts and validates the ":idx" path parameter.
func parseStepIdx(c *gin.Context) int {
	v, err := strconv.Atoi(c.Param("idx"))
	if err != nil {
		return -1
	}
	if v < 0 {
		return -1
	}
	return v
}
