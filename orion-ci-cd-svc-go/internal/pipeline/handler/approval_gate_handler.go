package handler

import (
	"net/http"

	"orion/ci-cd-svc-go/internal/pipeline/models"
	"orion/ci-cd-svc-go/internal/pipeline/service"

	"github.com/gin-gonic/gin"
)

type ApprovalGateHandler struct {
	svc *service.ApprovalGateService
}

func NewApprovalGateHandler(svc *service.ApprovalGateService) *ApprovalGateHandler {
	return &ApprovalGateHandler{svc: svc}
}

func (h *ApprovalGateHandler) Create(c *gin.Context) {
	pipelineID := c.Param("pipelineId")

	var req struct {
		RunID             string   `json:"run_id" binding:"required"`
		StageID           string   `json:"stage_id" binding:"required"`
		Approvers         []string `json:"approvers" binding:"required"`
		RequiredApprovals int      `json:"required_approvals"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.RequiredApprovals <= 0 {
		req.RequiredApprovals = 1
	}

	gate, err := h.svc.CreateGate(c.Request.Context(), req.RunID, req.StageID, pipelineID, req.Approvers, req.RequiredApprovals)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gate)
}

func (h *ApprovalGateHandler) GetByID(c *gin.Context) {
	gate, err := h.svc.GetGate(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "gate not found"})
		return
	}

	c.JSON(http.StatusOK, gate)
}

func (h *ApprovalGateHandler) GetByRun(c *gin.Context) {
	runID := c.Param("runId")

	gates, err := h.svc.GetGatesByRun(c.Request.Context(), runID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gates})
}

func (h *ApprovalGateHandler) Approve(c *gin.Context) {
	gateID := c.Param("id")
	userID := c.GetString("user_id")

	var req models.ApproveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Allow empty body
		req.Comments = ""
	}

	gate, err := h.svc.Approve(c.Request.Context(), gateID, userID, req.Comments)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gate)
}

func (h *ApprovalGateHandler) Reject(c *gin.Context) {
	gateID := c.Param("id")
	userID := c.GetString("user_id")

	var req models.RejectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		req.Reason = "rejected"
	}

	gate, err := h.svc.Reject(c.Request.Context(), gateID, userID, req.Reason)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gate)
}

func (h *ApprovalGateHandler) RegisterRoutes(rg *gin.RouterGroup) {
	gates := rg.Group("/approval-gates")
	{
		gates.POST("", h.Create)
		gates.GET("/:id", h.GetByID)
		gates.POST("/:id/approve", h.Approve)
		gates.POST("/:id/reject", h.Reject)
	}

	runGates := rg.Group("/runs/:runId/gates")
	{
		runGates.GET("", h.GetByRun)
	}
}
