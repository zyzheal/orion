package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	goerr "orion/go-common/pkg/errors"

	"orion/platform-svc-go/internal/apk-upload-history/models"
	"orion/platform-svc-go/internal/apk-upload-history/service"

	"orion/go-common/pkg/sentinel"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/apk-uploads")
	r.GET("", auth.RequirePermission("apk_upload_history", "read"), h.ListRecords)
	r.GET("/:id", auth.RequirePermission("apk_upload_history", "read"), h.GetRecord)
	r.POST("", auth.RequirePermission("apk_upload_history", "write"), h.CreateRecord)
	r.PUT("/:id/status", auth.RequirePermission("apk_upload_history", "write"), h.UpdateStatus)
	r.DELETE("/:id", auth.RequirePermission("apk_upload_history", "delete"), h.DeleteRecord)
	r.GET("/stats", auth.RequirePermission("apk_upload_history", "read"), h.GetStats)
	r.GET("/failures", auth.RequirePermission("apk_upload_history", "read"), h.RecentFailures)
	r.POST("/duplicate-check", auth.RequirePermission("apk_upload_history", "read"), h.CheckDuplicate)
}

func (h *Handler) ListRecords(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListRecords")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	q := models.ListQuery{
		Limit:       &limit,
		Offset:      &offset,
		Market:      c.Query("market"),
		Status:      c.Query("status"),
		PackageName: c.Query("package_name"),
	}
	items, total, err := h.svc.ListRecords(ctx, tenantID, q)
	if err != nil {
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteSuccess(c, gin.H{"data": items, "total": total})
}

func (h *Handler) GetRecord(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetRecord")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	item, err := h.svc.GetRecord(ctx, tenantID, id)
	if err != nil {
		goerr.WriteError(c, goerr.ErrNotFound, "not found", 404)
		return
	}
	goerr.WriteSuccess(c, item)
}

func (h *Handler) CreateRecord(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateRecord")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateRecordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 400)
		return
	}
	if req.Checksum != "" && !service.ValidateChecksum(req.Checksum) {
		goerr.WriteError(c, goerr.ErrBadRequest, "invalid checksum format", 400)
		return
	}
	record := &models.ApkUploadRecord{
		Market:      req.Market,
		PackageName: req.PackageName,
		Version:     req.Version,
		VersionCode: req.VersionCode,
		FileName:    req.FileName,
		FileSize:    req.FileSize,
		Checksum:    req.Checksum,
		UploadedBy:  req.UploadedBy,
	}
	item, err := h.svc.CreateRecord(ctx, tenantID, record)
	if err != nil {
		if err == service.ErrBadRequest || err == service.ErrInvalidChecksum {
			goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 400)
			return
		}
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteCreated(c, item)
}

func (h *Handler) UpdateStatus(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateStatus")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req struct {
		Status   string `json:"status" binding:"required"`
		ErrorMsg string `json:"error_msg"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 400)
		return
	}
	item, err := h.svc.UpdateStatus(ctx, tenantID, id, models.ApkStatus(req.Status), req.ErrorMsg)
	if err != nil {
		if err == sentinel.NotFound {
			goerr.WriteError(c, goerr.ErrNotFound, "not found", 404)
			return
		}
		goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 400)
		return
	}
	goerr.WriteSuccess(c, item)
}

func (h *Handler) DeleteRecord(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteRecord")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	// Update status to failed as soft delete
	_, err := h.svc.UpdateStatus(ctx, tenantID, id, models.StatusFailed, "deleted by user")
	if err != nil {
		goerr.WriteError(c, goerr.ErrNotFound, "not found", 404)
		return
	}
	goerr.WriteSuccess(c, gin.H{"message": "record marked as deleted"})
}

func (h *Handler) GetStats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetStats")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	stats, err := h.svc.GetStats(ctx, tenantID)
	if err != nil {
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteSuccess(c, stats)
}

func (h *Handler) RecentFailures(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RecentFailures")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.RecentFailures(ctx, tenantID)
	if err != nil {
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteSuccess(c, gin.H{"data": items, "total": len(items)})
}

func (h *Handler) CheckDuplicate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CheckDuplicate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req struct {
		Market      string `json:"market" binding:"required"`
		PackageName string `json:"package_name" binding:"required"`
		Version     string `json:"version" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		goerr.WriteError(c, goerr.ErrBadRequest, err.Error(), 400)
		return
	}
	exists, err := h.svc.CheckDuplicate(ctx, tenantID, req.Market, req.PackageName, req.Version)
	if err != nil {
		goerr.WriteError(c, goerr.ErrInternal, err.Error(), 500)
		return
	}
	goerr.WriteSuccess(c, gin.H{"exists": exists})
}
