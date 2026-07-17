package http

import (
	"net/http"

	"orion/platform-svc-go/internal/application/commands"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
)

// Handler exposes CQRS command endpoints as HTTP routes.
type Handler struct {
	bus *commands.CommandBus
}

// NewHandler creates a new CQRS HTTP handler.
func NewHandler(bus *commands.CommandBus) *Handler {
	return &Handler{bus: bus}
}

// RegisterRoutes mounts the CQRS command endpoints.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/commands")

	// Pipeline commands
	r.POST("/pipeline/activate", h.DispatchPipelineActivate)
	r.POST("/pipeline/deactivate", h.DispatchPipelineDeactivate)
	r.POST("/pipeline/update-yaml", h.DispatchPipelineUpdateYAML)

	// Approval commands
	r.POST("/approval/create", h.DispatchApprovalCreate)
	r.POST("/approval/approve-level", h.DispatchApprovalApproveLevel)
	r.POST("/approval/reject-level", h.DispatchApprovalRejectLevel)
	r.POST("/approval/cancel", h.DispatchApprovalCancel)

	// Feature flag commands
	r.POST("/feature-flag/toggle", h.DispatchFeatureFlagToggle)
	r.POST("/feature-flag/update-rollout", h.DispatchFeatureFlagUpdateRollout)
}

// DispatchPipelineActivate dispatches ActivatePipelineCommand.
func (h *Handler) DispatchPipelineActivate(c *gin.Context) {
	var req struct {
		ID string `json:"id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	cmd := &commands.ActivatePipelineCommand{
		ID: req.ID,
	}
	cmd.SetTenantID(c.GetString("tenant_id"))
	result, err := commands.Dispatch[*commands.ActivatePipelineCommand, *commands.CommandResult](c.Request.Context(), h.bus, "ActivatePipelineCommand", cmd)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// DispatchPipelineDeactivate dispatches DeactivatePipelineCommand.
func (h *Handler) DispatchPipelineDeactivate(c *gin.Context) {
	var req struct {
		ID     string `json:"id" binding:"required"`
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	cmd := &commands.DeactivatePipelineCommand{
		ID:     req.ID,
		Reason: req.Reason,
	}
	cmd.SetTenantID(c.GetString("tenant_id"))
	result, err := commands.Dispatch[*commands.DeactivatePipelineCommand, *commands.CommandResult](c.Request.Context(), h.bus, "DeactivatePipelineCommand", cmd)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// DispatchPipelineUpdateYAML dispatches UpdatePipelineYAMLCommand.
func (h *Handler) DispatchPipelineUpdateYAML(c *gin.Context) {
	var req struct {
		ID        string `json:"id" binding:"required"`
		NewYAML   string `json:"newYAML" binding:"required"`
		ChangedBy string `json:"changedBy"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	cmd := &commands.UpdatePipelineYAMLCommand{
		ID:        req.ID,
		NewYAML:   req.NewYAML,
		ChangedBy: req.ChangedBy,
	}
	cmd.SetTenantID(c.GetString("tenant_id"))
	result, err := commands.Dispatch[*commands.UpdatePipelineYAMLCommand, *commands.CommandResult](c.Request.Context(), h.bus, "UpdatePipelineYAMLCommand", cmd)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// DispatchApprovalCreate dispatches CreateApprovalCommand.
func (h *Handler) DispatchApprovalCreate(c *gin.Context) {
	var req struct {
		ID           string                `json:"id" binding:"required"`
		ApprovalType string                `json:"approvalType" binding:"required"`
		TotalLevels  int                   `json:"totalLevels" binding:"required"`
		Title        string                `json:"title"`
		Levels       []commands.LevelInfo  `json:"levels" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	cmd := &commands.CreateApprovalCommand{
		ID:           req.ID,
		ApprovalType: req.ApprovalType,
		TotalLevels:  req.TotalLevels,
		Title:        req.Title,
		Levels:       req.Levels,
	}
	cmd.SetTenantID(c.GetString("tenant_id"))
	result, err := commands.Dispatch[*commands.CreateApprovalCommand, *commands.CommandResult](c.Request.Context(), h.bus, "CreateApprovalCommand", cmd)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// DispatchApprovalApproveLevel dispatches ApproveLevelCommand.
func (h *Handler) DispatchApprovalApproveLevel(c *gin.Context) {
	var req struct {
		ApprovalID string `json:"approvalId" binding:"required"`
		LevelID    string `json:"levelId" binding:"required"`
		ApproverID string `json:"approverId" binding:"required"`
		Comment    string `json:"comment"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	cmd := &commands.ApproveLevelCommand{
		ApprovalID: req.ApprovalID,
		LevelID:    req.LevelID,
		ApproverID: req.ApproverID,
		Comment:    req.Comment,
	}
	cmd.SetTenantID(c.GetString("tenant_id"))
	result, err := commands.Dispatch[*commands.ApproveLevelCommand, *commands.CommandResult](c.Request.Context(), h.bus, "ApproveLevelCommand", cmd)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// DispatchApprovalRejectLevel dispatches RejectLevelCommand.
func (h *Handler) DispatchApprovalRejectLevel(c *gin.Context) {
	var req struct {
		ApprovalID string `json:"approvalId" binding:"required"`
		LevelID    string `json:"levelId" binding:"required"`
		ApproverID string `json:"approverId" binding:"required"`
		Comment    string `json:"comment"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	cmd := &commands.RejectLevelCommand{
		ApprovalID: req.ApprovalID,
		LevelID:    req.LevelID,
		ApproverID: req.ApproverID,
		Comment:    req.Comment,
	}
	cmd.SetTenantID(c.GetString("tenant_id"))
	result, err := commands.Dispatch[*commands.RejectLevelCommand, *commands.CommandResult](c.Request.Context(), h.bus, "RejectLevelCommand", cmd)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// DispatchApprovalCancel dispatches CancelApprovalCommand.
func (h *Handler) DispatchApprovalCancel(c *gin.Context) {
	var req struct {
		ID          string `json:"id" binding:"required"`
		Reason      string `json:"reason"`
		CancelledBy string `json:"cancelledBy"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	cmd := &commands.CancelApprovalCommand{
		ID:          req.ID,
		Reason:      req.Reason,
		CancelledBy: req.CancelledBy,
	}
	cmd.SetTenantID(c.GetString("tenant_id"))
	result, err := commands.Dispatch[*commands.CancelApprovalCommand, *commands.CommandResult](c.Request.Context(), h.bus, "CancelApprovalCommand", cmd)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// DispatchFeatureFlagToggle dispatches ToggleFeatureFlagCommand.
func (h *Handler) DispatchFeatureFlagToggle(c *gin.Context) {
	var req struct {
		FlagKey   string `json:"flagKey" binding:"required"`
		Enabled   bool   `json:"enabled"`
		ToggledBy string `json:"toggledBy"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	cmd := &commands.ToggleFeatureFlagCommand{
		FlagKey:   req.FlagKey,
		Enabled:   req.Enabled,
		ToggledBy: req.ToggledBy,
	}
	cmd.SetTenantID(c.GetString("tenant_id"))
	result, err := commands.Dispatch[*commands.ToggleFeatureFlagCommand, *commands.CommandResult](c.Request.Context(), h.bus, "ToggleFeatureFlagCommand", cmd)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// DispatchFeatureFlagUpdateRollout dispatches UpdateRolloutCommand.
func (h *Handler) DispatchFeatureFlagUpdateRollout(c *gin.Context) {
	var req struct {
		FlagKey   string `json:"flagKey" binding:"required"`
		Percent   int    `json:"percent" binding:"required"`
		Strategy  string `json:"strategy" binding:"required"`
		UpdatedBy string `json:"updatedBy"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	cmd := &commands.UpdateRolloutCommand{
		FlagKey:   req.FlagKey,
		Percent:   req.Percent,
		Strategy:  req.Strategy,
		UpdatedBy: req.UpdatedBy,
	}
	cmd.SetTenantID(c.GetString("tenant_id"))
	result, err := commands.Dispatch[*commands.UpdateRolloutCommand, *commands.CommandResult](c.Request.Context(), h.bus, "UpdateRolloutCommand", cmd)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// blank import guards
var _ = http.StatusOK