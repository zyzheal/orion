package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/compliance/models"
	"orion/platform-svc-go/internal/compliance/service"

	"github.com/gin-gonic/gin"
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
	tenantID := h.getTenantID(c)
	framework := c.Query("framework")
	reports, err := h.svc.ListReports(c.Request.Context(), tenantID, framework)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"reports": reports, "count": len(reports)})
}

func (h *Handler) GetReport(c *gin.Context) {
	tenantID := h.getTenantID(c)
	report, err := h.svc.GetReport(c.Request.Context(), c.Param("id"), tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "report not found")
		} else {
			respondInternalError(c, err.Error())
		}
		return
	}
	respondSuccess(c, gin.H{"report": report})
}

func (h *Handler) CreateReport(c *gin.Context) {
	var req models.CreateComplianceReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	report, err := h.svc.CreateReport(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, gin.H{"report": report})
}

func (h *Handler) UpdateReport(c *gin.Context) {
	var req models.UpdateComplianceReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	report, err := h.svc.UpdateReport(c.Request.Context(), c.Param("id"), tenantID, &req)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "report not found")
		} else {
			respondInternalError(c, err.Error())
		}
		return
	}
	respondSuccess(c, gin.H{"report": report})
}

func (h *Handler) DeleteReport(c *gin.Context) {
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.DeleteReport(c.Request.Context(), c.Param("id"), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if !deleted {
		respondNotFound(c, "report not found")
		return
	}
	respondSuccess(c, gin.H{"message": "report deleted"})
}

func (h *Handler) ListSchedules(c *gin.Context) {
	tenantID := h.getTenantID(c)
	schedules, err := h.svc.ListSchedules(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"schedules": schedules, "count": len(schedules)})
}

func (h *Handler) CreateSchedule(c *gin.Context) {
	var req models.CreateComplianceScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	schedule, err := h.svc.CreateSchedule(c.Request.Context(), tenantID, &req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, gin.H{"schedule": schedule})
}

func (h *Handler) DeleteSchedule(c *gin.Context) {
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.DeleteSchedule(c.Request.Context(), c.Param("id"), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if !deleted {
		respondNotFound(c, "schedule not found")
		return
	}
	respondSuccess(c, gin.H{"message": "schedule deleted"})
}
