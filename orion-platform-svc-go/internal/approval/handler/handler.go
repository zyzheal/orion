package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/approval/models"
	"orion/platform-svc-go/internal/approval/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all approval endpoints under /api/v1/approvals.
// Mirrors 23 endpoints from the TS approval-routes.ts source.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/approvals")

	// POST /approvals/requests - 提交审批请求
	f.POST("/requests", auth.RequirePermission("approval", "write"), h.SubmitApprovalRequest)
	// GET /approvals/requests - 审批列表
	f.GET("/requests", auth.RequirePermission("approval", "read"), h.ListApprovalRequests)
	// GET /approvals/requests/:id - 审批详情
	f.GET("/requests/:id", auth.RequirePermission("approval", "read"), h.GetApprovalRequest)
	// POST /approvals/requests/:id/review - 审批操作
	f.POST("/requests/:id/review", auth.RequirePermission("approval", "approve"), h.ReviewApproval)
	// POST /approvals/requests/:id/approve - 审批通过
	f.POST("/requests/:id/approve", auth.RequirePermission("approval", "approve"), h.ApproveRequest)
	// POST /approvals/requests/:id/reject - 审批拒绝
	f.POST("/requests/:id/reject", auth.RequirePermission("approval", "approve"), h.RejectRequest)
	// POST /approvals/requests/:id/withdraw - 撤回审批
	f.POST("/requests/:id/withdraw", auth.RequirePermission("approval", "approve"), h.WithdrawApproval)
	// POST /approvals/requests/:id/cancel - 取消审批
	f.POST("/requests/:id/cancel", auth.RequirePermission("approval", "approve"), h.CancelApproval)
	// POST /approvals/requests/:id/delegate - 委托审批
	f.POST("/requests/:id/delegate", auth.RequirePermission("approval", "approve"), h.DelegateApproval)
	// POST /approvals/requests/:id/reassign - 重新分配审批人
	f.POST("/requests/:id/reassign", auth.RequirePermission("approval", "approve"), h.ReassignApproval)
	// GET /approvals/statistics - 审批统计
	f.GET("/statistics", auth.RequirePermission("approval", "read"), h.GetApprovalStatistics)
	// GET /approvals/trend - 审批趋势
	f.GET("/trend", auth.RequirePermission("approval", "read"), h.GetApprovalTrend)
	// GET /approvals/requests/:id/history - 审批历史
	f.GET("/requests/:id/history", auth.RequirePermission("approval", "read"), h.GetApprovalHistory)
	// POST /approvals/agent/analyze - Agent 自动分析
	f.POST("/agent/analyze", auth.RequirePermission("approval", "read"), h.AgentAnalyze)
	// GET /approvals/pending - 待审批列表
	f.GET("/pending", auth.RequirePermission("approval", "read"), h.GetPendingApprovals)
	// GET /approvals/my-pending - 我的待审批列表
	f.GET("/my-pending", auth.RequirePermission("approval", "read"), h.GetMyPendingApprovals)
	// POST /approvals/emergency - 紧急审批
	f.POST("/emergency", auth.RequirePermission("approval", "write"), h.RequestEmergencyApproval)
	// POST /approvals/templates - 创建模板
	f.POST("/templates", auth.RequirePermission("approval", "write"), h.CreateTemplate)
	// GET /approvals/templates - 模板列表
	f.GET("/templates", auth.RequirePermission("approval", "read"), h.GetTemplates)

	// --- Pipeline approval gates (mounted on top-level group for runId param) ---
	// GET /pipeline-runs/:runId/approvals - 获取 run 的所有审批
	rg.GET("/pipeline-runs/:runId/approvals", auth.RequirePermission("approval", "read"), h.ListByRun)
	// GET /pipeline-runs/:runId/stages/:stageId/approval - 获取 stage 审批状态
	rg.GET("/pipeline-runs/:runId/stages/:stageId/approval", auth.RequirePermission("approval", "read"), h.GetStatus)
	// POST /pipeline-runs/:runId/stages/:stageId/approve - 审批通过
	rg.POST("/pipeline-runs/:runId/stages/:stageId/approve", auth.RequirePermission("approval", "approve"), h.ApproveGate)
	// POST /pipeline-runs/:runId/stages/:stageId/reject - 审批拒绝
	rg.POST("/pipeline-runs/:runId/stages/:stageId/reject", auth.RequirePermission("approval", "approve"), h.RejectGate)
}

// --- Approval request handlers ---

func (h *Handler) SubmitApprovalRequest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SubmitApprovalRequest")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	userName := c.GetString("user_name")
	var req models.CreateApprovalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.CreateApprovalRequest(ctx, tenantID, userID, userName, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, m)
}

func (h *Handler) ListApprovalRequests(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListApprovalRequests")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	approvalType := c.Query("type")
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.ListApprovalRequests(ctx, tenantID, approvalType, status, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) GetApprovalRequest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetApprovalRequest")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.GetApprovalRequest(ctx, tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "approval request not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, m)
}

func (h *Handler) ReviewApproval(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ReviewApproval")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	approvalID := c.Param("id")
	userID := c.GetString("user_id")
	userName := c.GetString("user_name")
	var req models.ReviewApprovalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.ReviewApproval(ctx, tenantID, approvalID, userID, userName, req); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "approval reviewed"})
}

func (h *Handler) ApproveRequest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ApproveRequest")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	approvalID := c.Param("id")
	userID := c.GetString("user_id")
	userName := c.GetString("user_name")
	var body struct {
		Comment string `json:"comment"`
	}
	c.ShouldBindJSON(&body)
	if err := h.svc.ApproveRequest(ctx, tenantID, approvalID, userID, userName, body.Comment); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "approval approved"})
}

func (h *Handler) RejectRequest(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RejectRequest")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	approvalID := c.Param("id")
	userID := c.GetString("user_id")
	userName := c.GetString("user_name")
	var body struct {
		Comment string `json:"comment"`
	}
	c.ShouldBindJSON(&body)
	if err := h.svc.RejectRequest(ctx, tenantID, approvalID, userID, userName, body.Comment); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "approval rejected"})
}

func (h *Handler) WithdrawApproval(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "WithdrawApproval")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	approvalID := c.Param("id")
	userID := c.GetString("user_id")
	userName := c.GetString("user_name")
	var body struct {
		Comment string `json:"comment"`
	}
	c.ShouldBindJSON(&body)
	if err := h.svc.WithdrawApproval(ctx, tenantID, approvalID, userID, userName, body.Comment); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "approval withdrawn"})
}

func (h *Handler) CancelApproval(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CancelApproval")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	approvalID := c.Param("id")
	userID := c.GetString("user_id")
	userName := c.GetString("user_name")
	var body struct {
		Comment string `json:"comment"`
	}
	c.ShouldBindJSON(&body)
	if err := h.svc.CancelApproval(ctx, tenantID, approvalID, userID, userName, body.Comment); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "approval cancelled"})
}

func (h *Handler) DelegateApproval(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DelegateApproval")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	approvalID := c.Param("id")
	userID := c.GetString("user_id")
	userName := c.GetString("user_name")
	var req models.DelegateApprovalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.DelegateApproval(ctx, tenantID, approvalID, userID, userName, req); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "approval delegated"})
}

func (h *Handler) ReassignApproval(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ReassignApproval")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	approvalID := c.Param("id")
	userID := c.GetString("user_id")
	userName := c.GetString("user_name")
	var req models.ReassignApprovalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.ReassignApproval(ctx, tenantID, approvalID, userID, userName, req); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "approval reassigned"})
}

func (h *Handler) GetApprovalStatistics(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetApprovalStatistics")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetStatistics(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

func (h *Handler) GetApprovalTrend(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetApprovalTrend")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	trend, err := h.svc.GetTrend(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, trend)
}

func (h *Handler) GetApprovalHistory(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetApprovalHistory")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	approvalID := c.Param("id")
	history, err := h.svc.GetHistory(ctx, tenantID, approvalID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, history)
}

func (h *Handler) AgentAnalyze(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AgentAnalyze")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.AgentAnalyzeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.AgentAnalyze(ctx, tenantID, req.ApprovalID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) GetPendingApprovals(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetPendingApprovals")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.GetPendingApprovals(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) GetMyPendingApprovals(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetMyPendingApprovals")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	items, err := h.svc.GetMyPendingApprovals(ctx, tenantID, userID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) RequestEmergencyApproval(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RequestEmergencyApproval")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	userName := c.GetString("user_name")
	var req models.EmergencyApprovalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.RequestEmergencyApproval(ctx, tenantID, userID, userName, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, m)
}

// --- Templates ---

func (h *Handler) CreateTemplate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateTemplate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.CreateTemplate(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, m)
}

func (h *Handler) GetTemplates(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTemplates")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.GetTemplates(ctx, tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

// --- Pipeline approval gates ---

func (h *Handler) ListByRun(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListByRun")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	runID := c.Param("runId")
	items, err := h.svc.ListByRun(ctx, tenantID, runID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, items)
}

func (h *Handler) GetStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	runID := c.Param("runId")
	stageID := c.Param("stageId")
	gate, err := h.svc.GetStatus(ctx, tenantID, runID, stageID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gate)
}

func (h *Handler) ApproveGate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ApproveGate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	runID := c.Param("runId")
	stageID := c.Param("stageId")
	userID := c.GetString("user_id")
	userName := c.GetString("user_name")
	var body struct {
		Comment string `json:"comment"`
	}
	c.ShouldBindJSON(&body)
	gate, err := h.svc.ApproveGate(ctx, tenantID, runID, stageID, userID, userName, body.Comment)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gate)
}

func (h *Handler) RejectGate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RejectGate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	runID := c.Param("runId")
	stageID := c.Param("stageId")
	userID := c.GetString("user_id")
	userName := c.GetString("user_name")
	var body struct {
		Comment string `json:"comment"`
	}
	c.ShouldBindJSON(&body)
	gate, err := h.svc.RejectGate(ctx, tenantID, runID, stageID, userID, userName, body.Comment)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gate)
}
