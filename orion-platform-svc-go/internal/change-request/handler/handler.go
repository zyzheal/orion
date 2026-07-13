package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/change-request/models"
	"orion/platform-svc-go/internal/change-request/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all change-request endpoints under the given group.
// Mirrors /api/v1/change-requests routes from the TS source (12 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/change-requests")

	// --- Change Request CRUD ---
	// GET /change-requests — List change requests
	f.GET("", auth.RequirePermission("change_request", "read"), h.ListRequests)
	// POST /change-requests — Create change request
	f.POST("", auth.RequirePermission("change_request", "write"), h.CreateRequest)
	// GET /change-requests/:id — Get change request detail
	f.GET("/:id", auth.RequirePermission("change_request", "read"), h.GetRequest)
	// PUT /change-requests/:id — Update change request
	f.PUT("/:id", auth.RequirePermission("change_request", "write"), h.UpdateRequest)
	// DELETE /change-requests/:id — Delete change request
	f.DELETE("/:id", auth.RequirePermission("change_request", "delete"), h.DeleteRequest)

	// --- Approval Chain ---
	// POST /change-requests/:id/submit — Submit for approval
	f.POST("/:id/submit", auth.RequirePermission("change_request", "write"), h.SubmitForApproval)
	// GET /change-requests/:id/approvals — Get approval chain
	f.GET("/:id/approvals", auth.RequirePermission("change_request", "read"), h.GetApprovalChain)
	// POST /change-requests/:id/approvals/:approvalId/approve — Approve
	f.POST("/:id/approvals/:approvalId/approve", auth.RequirePermission("change_request", "write"), h.ApproveRequest)
	// POST /change-requests/:id/approvals/:approvalId/reject — Reject
	f.POST("/:id/approvals/:approvalId/reject", auth.RequirePermission("change_request", "write"), h.RejectRequest)

	// --- Execution Management ---
	// POST /change-requests/:id/execution/start — Start execution
	f.POST("/:id/execution/start", auth.RequirePermission("change_request", "write"), h.StartExecution)
	// GET /change-requests/:id/execution — Get execution progress
	f.GET("/:id/execution", auth.RequirePermission("change_request", "read"), h.GetExecutionProgress)
	// PUT /change-requests/execution/:stepId — Update execution step
	f.PUT("/execution/:stepId", auth.RequirePermission("change_request", "write"), h.UpdateExecutionStep)
}

// getTenantID extracts tenant_id from Gin context, falling back to a zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// --- Change Request CRUD handlers ---

func (h *Handler) ListRequests(c *gin.Context) {
	tenantID := h.getTenantID(c)
	status := c.Query("status")
	changeType := c.Query("changeType")
	riskLevel := c.Query("riskLevel")

	filters := &models.ListChangeRequestRequest{
		Status:     ptrString(status),
		ChangeType: ptrString(changeType),
		RiskLevel:  ptrString(riskLevel),
	}

	reqs, total, err := h.svc.ListRequests(c.Request.Context(), tenantID, filters)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, models.PaginatedResponse{
		Data:     reqs,
		Total:    total,
		Page:     1,
		PageSize: total,
	})
}

func (h *Handler) GetRequest(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	req, err := h.svc.GetRequest(c.Request.Context(), id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "change request not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, req)
}

func (h *Handler) CreateRequest(c *gin.Context) {
	var req models.CreateChangeRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.Title == "" {
		respondBadRequest(c, "title is required")
		return
	}
	if req.ChangeType == "" {
		respondBadRequest(c, "changeType is required")
		return
	}
	validTypes := []string{"standard", "normal", "emergency"}
	valid := false
	for _, t := range validTypes {
		if req.ChangeType == t {
			valid = true
			break
		}
	}
	if !valid {
		respondBadRequest(c, "changeType must be one of: standard, normal, emergency")
		return
	}
	tenantID := h.getTenantID(c)
	cr, err := h.svc.CreateRequest(c.Request.Context(), &req, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, cr)
}

func (h *Handler) UpdateRequest(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateChangeRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	cr, err := h.svc.UpdateRequest(c.Request.Context(), id, tenantID, &req)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "change request not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, cr)
}

func (h *Handler) DeleteRequest(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.DeleteRequest(c.Request.Context(), id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "change request not found")
			return
		}
		if service.IsStateConflict(err) {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	if !deleted {
		respondNotFound(c, "change request not found")
		return
	}
	respondSuccess(c, gin.H{"message": "change request deleted"})
}

// --- Approval handlers ---

func (h *Handler) SubmitForApproval(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	cr, err := h.svc.SubmitForApproval(c.Request.Context(), id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "change request not found")
			return
		}
		if service.IsStateConflict(err) {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, cr)
}

func (h *Handler) GetApprovalChain(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	approvals, err := h.svc.GetApprovalChain(c.Request.Context(), id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "change request not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, approvals)
}

func (h *Handler) ApproveRequest(c *gin.Context) {
	requestID := c.Param("id")
	approvalID := c.Param("approvalId")
	var req models.CreateApprovalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.ApproverID == "" {
		respondBadRequest(c, "approverId is required")
		return
	}
	tenantID := h.getTenantID(c)
	approval, err := h.svc.ApproveRequest(c.Request.Context(), requestID, approvalID, tenantID, req.ApproverID, req.Comments)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "approval not found")
			return
		}
		if service.IsStateConflict(err) {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, approval)
}

func (h *Handler) RejectRequest(c *gin.Context) {
	requestID := c.Param("id")
	approvalID := c.Param("approvalId")
	var req models.CreateApprovalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.ApproverID == "" {
		respondBadRequest(c, "approverId is required")
		return
	}
	tenantID := h.getTenantID(c)
	approval, err := h.svc.RejectRequest(c.Request.Context(), requestID, approvalID, tenantID, req.ApproverID, req.Comments)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "approval not found")
			return
		}
		if service.IsStateConflict(err) {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, approval)
}

// --- Execution handlers ---

func (h *Handler) StartExecution(c *gin.Context) {
	id := c.Param("id")
	var req models.StartExecutionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if len(req.Steps) == 0 {
		respondBadRequest(c, "steps array is required and must not be empty")
		return
	}
	for _, step := range req.Steps {
		if step.StepName == "" || step.StepOrder == 0 {
			respondBadRequest(c, "each step must have stepName and stepOrder")
			return
		}
	}
	tenantID := h.getTenantID(c)
	steps, err := h.svc.StartExecution(c.Request.Context(), id, tenantID, req.Steps)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "change request not found")
			return
		}
		if service.IsStateConflict(err) {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, steps)
}

func (h *Handler) GetExecutionProgress(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	progress, err := h.svc.GetExecutionProgress(c.Request.Context(), id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "change request not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, progress)
}

func (h *Handler) UpdateExecutionStep(c *gin.Context) {
	stepID := c.Param("stepId")
	var req models.UpdateExecutionStepRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if req.Status == "" {
		respondBadRequest(c, "status is required")
		return
	}
	tenantID := h.getTenantID(c)
	step, err := h.svc.UpdateExecutionStep(c.Request.Context(), stepID, tenantID, req.Status, req.Result, req.StartedAt, req.CompletedAt)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "execution step not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, step)
}

// ptrString returns a pointer to the given string, or nil if empty.
func ptrString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
