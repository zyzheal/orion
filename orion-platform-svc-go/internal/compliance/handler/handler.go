package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/compliance/models"
	"orion/platform-svc-go/internal/compliance/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel/trace"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/compliance")

	// Reports
	f.GET("/reports", auth.RequirePermission("compliance", "read"), h.ListReports)
	f.GET("/reports/:id", auth.RequirePermission("compliance", "read"), h.GetReport)
	f.POST("/reports", auth.RequirePermission("compliance", "write"), h.CreateReport)
	f.PUT("/reports/:id", auth.RequirePermission("compliance", "write"), h.UpdateReport)
	f.DELETE("/reports/:id", auth.RequirePermission("compliance", "write"), h.DeleteReport)

	// Schedules
	f.GET("/schedules", auth.RequirePermission("compliance", "read"), h.ListSchedules)
	f.POST("/schedules", auth.RequirePermission("compliance", "write"), h.CreateSchedule)
	f.DELETE("/schedules/:id", auth.RequirePermission("compliance", "write"), h.DeleteSchedule)
}

func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

func (h *Handler) ListReports(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListReports")
	defer span.End()
	tenantID := h.getTenantID(c)
	framework := c.Query("framework")
	reports, err := h.svc.ListReports(ctx, tenantID, framework)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"reports": reports, "count": len(reports)})
}

func (h *Handler) GetReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetReport")
	defer span.End()
	tenantID := h.getTenantID(c)
	report, err := h.svc.GetReport(ctx, c.Param("id"), tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "report not found")
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, gin.H{"report": report})
}

func (h *Handler) CreateReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateReport")
	defer span.End()
	var req models.CreateComplianceReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	report, err := h.svc.CreateReport(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"report": report})
}

func (h *Handler) UpdateReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateReport")
	defer span.End()
	var req models.UpdateComplianceReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	report, err := h.svc.UpdateReport(ctx, c.Param("id"), tenantID, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "report not found")
		} else {
			middleware.RespondInternalError(c, err.Error())
		}
		return
	}
	middleware.RespondSuccess(c, gin.H{"report": report})
}

func (h *Handler) DeleteReport(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteReport")
	defer span.End()
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.DeleteReport(ctx, c.Param("id"), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "report not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "report deleted"})
}

func (h *Handler) ListSchedules(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSchedules")
	defer span.End()
	tenantID := h.getTenantID(c)
	schedules, err := h.svc.ListSchedules(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"schedules": schedules, "count": len(schedules)})
}

func (h *Handler) CreateSchedule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateSchedule")
	defer span.End()
	var req models.CreateComplianceScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	schedule, err := h.svc.CreateSchedule(ctx, tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"schedule": schedule})
}

func (h *Handler) DeleteSchedule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteSchedule")
	defer span.End()
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.DeleteSchedule(ctx, c.Param("id"), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "schedule not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "schedule deleted"})
}
