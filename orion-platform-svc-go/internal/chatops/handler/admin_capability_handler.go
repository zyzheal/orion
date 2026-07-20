package handler

import (
	"context"
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/chatops/models"
	"orion/platform-svc-go/internal/chatops/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

// ---- Admin: Capability Mappings ----

func (h *Handler) GetAllCapabilityMappings(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAllCapabilityMappings")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	environment := c.Query("environment")
	var envPtr *string
	if environment != "" {
		envPtr = &environment
	}
	mappings, err := h.svc.GetAllCapabilityMappings(ctx, tenantID, envPtr)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": mappings})
}

func (h *Handler) CreateCapabilityMapping(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateCapabilityMapping")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateCapabilityMappingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.CommandID == "" || req.CapabilityID == "" {
		middleware.RespondBadRequest(c, "command_id and capability_id are required")
		return
	}
	mapping, err := h.svc.CreateCapabilityMapping(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"data": mapping})
}

func (h *Handler) UpdateCapabilityMapping(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateCapabilityMapping")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateCapabilityMappingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	mapping, err := h.svc.UpdateCapabilityMapping(ctx, tenantID, id, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "mapping not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": mapping})
}

func (h *Handler) DeleteCapabilityMapping(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteCapabilityMapping")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	_id := c.Param("id")
	if err := h.svc.DeleteCapabilityMapping(ctx, tenantID, _id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "mapping not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

// ---- Admin: Approval Configs ----

func (h *Handler) GetAllApprovalConfigs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetAllApprovalConfigs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	configs, err := h.svc.GetAllApprovalConfigs(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": configs})
}

func (h *Handler) UpdateApprovalConfigs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateApprovalConfigs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var configs []models.ApprovalConfigInput
	if err := c.ShouldBindJSON(&configs); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	req := models.UpdateApprovalConfigsRequest{Configs: configs}
	result, err := h.svc.UpdateApprovalConfigs(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result})
}

func (h *Handler) GetApprovalConfigByCapability(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetApprovalConfigByCapability")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	capability := c.Param("capability")
	config, err := h.svc.GetApprovalConfigByCapability(ctx, tenantID, capability)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "approval config not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": config})
}

func (h *Handler) UpdateApprovalConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateApprovalConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	capability := c.Param("capability")
	var req models.UpdateApprovalConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	config, err := h.svc.UpdateApprovalConfig(ctx, tenantID, capability, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "approval config not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": config})
}

// ---- Admin: Approvers ----

func (h *Handler) GetApprovers(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetApprovers")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	approvers, err := h.svc.GetApprovers(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": approvers})
}

func (h *Handler) GetApproverSchedule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetApproverSchedule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	schedule, err := h.svc.GetApproverSchedule(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": schedule})
}

func (h *Handler) UpdateApproverSchedule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateApproverSchedule")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var schedule []models.ApproverScheduleInput
	if err := c.ShouldBindJSON(&schedule); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	modelSchedule := make([]models.ApproverSchedule, len(schedule))
	for i, s := range schedule {
		modelSchedule[i] = models.ApproverSchedule{
			UserID:    s.UserID,
			StartTime: s.StartTime,
			EndTime:   s.EndTime,
		}
	}
	if err := h.svc.UpdateApproverSchedule(ctx, tenantID, modelSchedule); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

// ---- Admin: Global Approval Config ----

func (h *Handler) GetGlobalApprovalConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetGlobalApprovalConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	config, err := h.svc.GetGlobalApprovalConfig(ctx, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondSuccess(c, &models.GlobalApprovalConfig{})
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": config})
}

func (h *Handler) UpdateGlobalApprovalConfig(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateGlobalApprovalConfig")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.UpdateGlobalApprovalConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	config := &models.GlobalApprovalConfig{
		Enabled: req.Enabled,
		Mode:    req.Mode,
	}
	if err := h.svc.UpdateGlobalApprovalConfig(ctx, tenantID, config); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"success": true})
}

// ---- Admin: Roles ----

