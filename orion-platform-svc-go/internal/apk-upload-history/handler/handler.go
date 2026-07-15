package handler

import (
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/apk-upload-history/models"
	"orion/platform-svc-go/internal/apk-upload-history/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/apk-upload-history")
	r.GET("", auth.RequirePermission("apk-upload-history", "read"), h.ListRecords)
	r.GET("/recent-failures", auth.RequirePermission("apk-upload-history", "read"), h.RecentFailures)
	r.GET("/:id", auth.RequirePermission("apk-upload-history", "read"), h.GetRecord)
	r.POST("", auth.RequirePermission("apk-upload-history", "write"), h.CreateRecord)
}

func (h *Handler) ListRecords(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	q := models.ListQuery{}
	if market := c.Query("market"); market != "" {
		q.Market = market
	}
	if status := c.Query("status"); status != "" {
		q.Status = status
	}
	records, total, err := h.svc.ListRecords(ctx, tenantID, q)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": records, "total": total})
}

func (h *Handler) RecentFailures(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	records, err := h.svc.RecentFailures(ctx, tenantID)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": records, "total": len(records)})
}

func (h *Handler) GetRecord(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	record, err := h.svc.GetRecord(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "record not found", http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, record)
}

func (h *Handler) CreateRecord(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	ctx := c.Request.Context()
	var record models.ApkUploadRecord
	if err := c.ShouldBindJSON(&record); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	result, err := h.svc.CreateRecord(ctx, tenantID, &record)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, result)
}
