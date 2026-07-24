package handler

import (
	"net/http"
	"strconv"
	"time"

	"orion/platform-svc-go/internal/infrastructure/backup/models"
	"orion/platform-svc-go/internal/infrastructure/backup/service"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// Handler provides HTTP handlers for backup and recovery operations.
type Handler struct {
	backupSvc   *service.BackupService
	recoverySvc *service.RecoveryService
	log         *zap.Logger
}

// New creates a new backup handler instance.
func New(backupSvc *service.BackupService, recoverySvc *service.RecoveryService, log *zap.Logger) *Handler {
	return &Handler{
		backupSvc:   backupSvc,
		recoverySvc: recoverySvc,
		log:         log,
	}
}

// RegisterRoutes mounts all backup routes under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	bg := rg.Group("/backup")
	bg.POST("/plans", auth.RequirePermission("backup", "write"), h.CreatePlan)
	bg.GET("/plans", auth.RequirePermission("backup", "read"), h.ListPlans)
	bg.GET("/plans/:id", auth.RequirePermission("backup", "read"), h.GetPlan)
	bg.PUT("/plans/:id", auth.RequirePermission("backup", "write"), h.UpdatePlan)
	bg.DELETE("/plans/:id", auth.RequirePermission("backup", "delete"), h.DeletePlan)
	bg.POST("/plans/:id/execute", auth.RequirePermission("backup", "execute"), h.ExecuteBackup)
	bg.GET("/plans/:id/records", auth.RequirePermission("backup", "read"), h.ListBackupRecords)
	bg.GET("/plans/:id/records/:record_id", auth.RequirePermission("backup", "read"), h.GetBackupRecord)
	bg.DELETE("/plans/:id/records/:record_id", auth.RequirePermission("backup", "delete"), h.DeleteBackupRecord)

	bg.POST("/recovery", auth.RequirePermission("backup", "write"), h.CreateRecovery)
	bg.GET("/recovery", auth.RequirePermission("backup", "read"), h.ListRecoveries)
	bg.GET("/recovery/:id", auth.RequirePermission("backup", "read"), h.GetRecovery)
	bg.POST("/recovery/:id/execute", auth.RequirePermission("backup", "execute"), h.ExecuteRecovery)
	bg.DELETE("/recovery/:id", auth.RequirePermission("backup", "delete"), h.RollbackRecovery)
	bg.GET("/status", auth.RequirePermission("backup", "read"), h.GetBackupStats)
}

// ==================== Backup Plans ====================

func (h *Handler) CreatePlan(c *gin.Context) {
	var input models.CreateBackupPlanInput
	if err := c.ShouldBindJSON(&input); err != nil {
		respondBadRequest(c, "invalid request body: "+err.Error())
		return
	}
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id required")
		return
	}
	input.TenantID = tenantID
	plan, err := h.backupSvc.CreatePlan(c.Request.Context(), input)
	if err != nil {
		h.log.Error("failed to create backup plan", zap.Error(err))
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, plan)
}

func (h *Handler) ListPlans(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id required")
		return
	}
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	plans, err := h.backupSvc.ListPlans(c.Request.Context(), tenantID, offset, limit)
	if err != nil {
		h.log.Error("failed to list plans", zap.Error(err))
		respondInternalError(c, "internal error")
		return
	}
	respondSuccess(c, plans)
}

func (h *Handler) GetPlan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id required")
		return
	}
	plan, err := h.backupSvc.GetPlan(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, plan)
}

func (h *Handler) UpdatePlan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id required")
		return
	}
	var input models.UpdateBackupPlanInput
	if err := c.ShouldBindJSON(&input); err != nil {
		respondBadRequest(c, "invalid request body: "+err.Error())
		return
	}
	plan, err := h.backupSvc.UpdatePlan(c.Request.Context(), tenantID, c.Param("id"), input)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, plan)
}

func (h *Handler) DeletePlan(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id required")
		return
	}
	if err := h.backupSvc.DeletePlan(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	c.Status(http.StatusOK)
}

// ==================== Backup Execution ====================

func (h *Handler) ExecuteBackup(c *gin.Context) {
	var input models.CreateBackupInput
	if err := c.ShouldBindJSON(&input); err != nil {
		respondBadRequest(c, "invalid request body: "+err.Error())
		return
	}
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id required")
		return
	}
	input.TenantID = tenantID
	input.PlanID = c.Param("id")
	record, err := h.backupSvc.TriggerBackup(c.Request.Context(), input)
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, record)
}

func (h *Handler) ListBackupRecords(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id required")
		return
	}
	filter := models.BackupFilter{
		PlanID: c.Param("id"),
		Status: c.Query("status"),
		Type:   c.Query("type"),
	}
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	backups, err := h.backupSvc.ListBackups(c.Request.Context(), tenantID, filter, offset, limit)
	if err != nil {
		h.log.Error("failed to list backups", zap.Error(err))
		respondInternalError(c, "internal error")
		return
	}
	respondSuccess(c, backups)
}

func (h *Handler) GetBackupRecord(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id required")
		return
	}
	record, err := h.backupSvc.GetBackup(c.Request.Context(), tenantID, c.Param("record_id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, record)
}

func (h *Handler) DeleteBackupRecord(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id required")
		return
	}
	if err := h.backupSvc.DeleteBackup(c.Request.Context(), tenantID, c.Param("record_id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	c.Status(http.StatusOK)
}

// ==================== Recovery ====================

func (h *Handler) CreateRecovery(c *gin.Context) {
	var input models.CreateRecoveryInput
	if err := c.ShouldBindJSON(&input); err != nil {
		respondBadRequest(c, "invalid request body: "+err.Error())
		return
	}
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id required")
		return
	}
	input.TenantID = tenantID
	record, err := h.recoverySvc.CreateRecovery(c.Request.Context(), input)
	if err != nil {
		h.log.Error("failed to create recovery", zap.Error(err))
		respondBadRequest(c, err.Error())
		return
	}
	respondCreated(c, record)
}

func (h *Handler) ListRecoveries(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id required")
		return
	}
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	recoveries, err := h.recoverySvc.ListRecoveries(c.Request.Context(), tenantID, offset, limit)
	if err != nil {
		h.log.Error("failed to list recoveries", zap.Error(err))
		respondInternalError(c, "internal error")
		return
	}
	respondSuccess(c, recoveries)
}

func (h *Handler) GetRecovery(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id required")
		return
	}
	record, err := h.recoverySvc.GetRecovery(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, record)
}

func (h *Handler) ExecuteRecovery(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id required")
		return
	}
	record, err := h.recoverySvc.ExecuteRecovery(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, record)
}

func (h *Handler) RollbackRecovery(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id required")
		return
	}
	record, err := h.recoverySvc.RollbackRecovery(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, record)
}

// ==================== Stats ====================

func (h *Handler) GetBackupStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		respondBadRequest(c, "tenant_id required")
		return
	}
	stats, err := h.backupSvc.GetBackupStats(c.Request.Context(), tenantID)
	if err != nil {
		h.log.Error("failed to get backup stats", zap.Error(err))
		respondInternalError(c, "internal error")
		return
	}
	respondSuccess(c, stats)
}

// Helper for converting time
func parseTime(v string, fallback *time.Time) *time.Time {
	if v == "" {
		return fallback
	}
	t, err := time.Parse(time.RFC3339, v)
	if err != nil {
		return fallback
	}
	return &t
}