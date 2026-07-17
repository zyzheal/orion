package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/backup/models"
	"orion/platform-svc-go/internal/backup/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all backup endpoints under the given group.
// Mirrors /api/v1/backup routes from the TS source (15 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/backup")

	// --- Backup Plans ---
	// GET /backup/plans - List backup plans
	f.GET("/plans", auth.RequirePermission("backup", "read"), h.ListPlans)
	// GET /backup/plans/:id - Get backup plan by ID
	f.GET("/plans/:id", auth.RequirePermission("backup", "read"), h.GetPlan)
	// POST /backup/plans - Create backup plan
	f.POST("/plans", auth.RequirePermission("backup", "write"), h.CreatePlan)
	// PUT /backup/plans/:id - Update backup plan
	f.PUT("/plans/:id", auth.RequirePermission("backup", "write"), h.UpdatePlan)
	// DELETE /backup/plans/:id - Delete backup plan
	f.DELETE("/plans/:id", auth.RequirePermission("backup", "delete"), h.DeletePlan)

	// --- Recovery Plans ---
	// GET /backup/recoveries - List recovery plans
	f.GET("/recoveries", auth.RequirePermission("backup", "read"), h.ListRecoveryPlans)
	// GET /backup/recoveries/:id - Get recovery plan by ID
	f.GET("/recoveries/:id", auth.RequirePermission("backup", "read"), h.GetRecoveryPlan)
	// POST /backup/recoveries - Create recovery plan
	f.POST("/recoveries", auth.RequirePermission("backup", "write"), h.CreateRecoveryPlan)
	// PUT /backup/recoveries/:id - Update recovery plan
	f.PUT("/recoveries/:id", auth.RequirePermission("backup", "write"), h.UpdateRecoveryPlan)
	// DELETE /backup/recoveries/:id - Delete recovery plan
	f.DELETE("/recoveries/:id", auth.RequirePermission("backup", "delete"), h.DeleteRecoveryPlan)

	// --- Verify & Restore ---
	// POST /backup/verify/:backupId - Verify backup integrity
	f.POST("/verify/:backupId", auth.RequirePermission("backup", "write"), h.VerifyBackup)
	// POST /backup/restore/:planId - Initiate restore from recovery plan
	f.POST("/restore/:planId", auth.RequirePermission("backup", "write"), h.InitiateRestore)

	// --- Backups ---
	// GET /backup/backups - List backup records
	f.GET("/backups", auth.RequirePermission("backup", "read"), h.ListBackups)
	// GET /backup/backups/:id - Get backup detail
	f.GET("/backups/:id", auth.RequirePermission("backup", "read"), h.GetBackup)
	// POST /backup/backups/trigger/:planId - Trigger a backup
	f.POST("/backups/trigger/:planId", auth.RequirePermission("backup", "write"), h.TriggerBackup)
}

// getTenantID extracts tenant_id from Gin context, falling back to a zero UUID.
func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

// --- Backup Plan handlers ---

func (h *Handler) ListPlans(c *gin.Context) {
	tenantID := h.getTenantID(c)
	plans, total, err := h.svc.ListPlans(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:  plans,
		Total: total,
		Page:  1,
		PageSize: total,
	})
}

func (h *Handler) GetPlan(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	plan, err := h.svc.GetPlan(c.Request.Context(), id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "backup plan not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, plan)
}

func (h *Handler) CreatePlan(c *gin.Context) {
	var req models.CreateBackupPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	plan, err := h.svc.CreatePlan(c.Request.Context(), &req, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, plan)
}

func (h *Handler) UpdatePlan(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateBackupPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	plan, err := h.svc.UpdatePlan(c.Request.Context(), id, &req, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "backup plan not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, plan)
}

func (h *Handler) DeletePlan(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.DeletePlan(c.Request.Context(), id, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "backup plan not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "backup plan deleted"})
}

// --- Recovery Plan handlers ---

func (h *Handler) ListRecoveryPlans(c *gin.Context) {
	tenantID := h.getTenantID(c)
	plans, total, err := h.svc.ListRecoveryPlans(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:  plans,
		Total: total,
		Page:  1,
		PageSize: total,
	})
}

func (h *Handler) GetRecoveryPlan(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	plan, err := h.svc.GetRecoveryPlan(c.Request.Context(), id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "recovery plan not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, plan)
}

func (h *Handler) CreateRecoveryPlan(c *gin.Context) {
	var req models.CreateRecoveryPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	plan, err := h.svc.CreateRecoveryPlan(c.Request.Context(), &req, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, plan)
}

func (h *Handler) UpdateRecoveryPlan(c *gin.Context) {
	id := c.Param("id")
	var req models.UpdateRecoveryPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	plan, err := h.svc.UpdateRecoveryPlan(c.Request.Context(), id, &req, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "recovery plan not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, plan)
}

func (h *Handler) DeleteRecoveryPlan(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	deleted, err := h.svc.DeleteRecoveryPlan(c.Request.Context(), id, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "recovery plan not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "recovery plan deleted"})
}

// --- Verify & Restore handlers ---

func (h *Handler) VerifyBackup(c *gin.Context) {
	backupID := c.Param("backupId")
	tenantID := h.getTenantID(c)
	job, err := h.svc.VerifyBackup(c.Request.Context(), backupID, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "backup not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, job)
}

func (h *Handler) InitiateRestore(c *gin.Context) {
	planID := c.Param("planId")
	tenantID := h.getTenantID(c)
	restore, err := h.svc.InitiateRestore(c.Request.Context(), planID, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "backup plan not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"executionId": restore.ID,
		"planId":      planID,
		"status":      "initiated",
	})
}

// --- Backups handlers ---

func (h *Handler) ListBackups(c *gin.Context) {
	tenantID := h.getTenantID(c)
	status := c.Query("status")
	statusPtr := &status
	if status == "" {
		statusPtr = nil
	}
	jobs, total, err := h.svc.ListBackups(c.Request.Context(), tenantID, statusPtr)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data:  jobs,
		Total: total,
		Page:  1,
		PageSize: total,
	})
}

func (h *Handler) GetBackup(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	job, err := h.svc.GetBackup(c.Request.Context(), id, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "backup not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, job)
}

func (h *Handler) TriggerBackup(c *gin.Context) {
	planID := c.Param("planId")
	tenantID := h.getTenantID(c)
	job, err := h.svc.TriggerBackup(c.Request.Context(), planID, tenantID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "backup plan not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{
		"backupId": job.ID,
		"planId":   planID,
		"status":   job.Status,
	})
}
