package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/i18n/models"
	"orion/platform-svc-go/internal/i18n/service"

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
	// ==================== Locale Management ====================

	// POST /locales
	rg.POST("/locales",
		auth.RequirePermission("i18n", "write"),
		h.CreateLocale,
	)
	// GET /locales
	rg.GET("/locales",
		auth.RequirePermission("i18n", "read"),
		h.ListLocales,
	)

	// ==================== Translation Management ====================

	// POST /translations
	rg.POST("/translations",
		auth.RequirePermission("i18n", "write"),
		h.SetTranslation,
	)
	// POST /translations/bulk
	rg.POST("/translations/bulk",
		auth.RequirePermission("i18n", "write"),
		h.SetBulkTranslations,
	)
	// GET /translations/:localeCode
	rg.GET("/translations/:localeCode",
		auth.RequirePermission("i18n", "read"),
		h.GetTranslations,
	)
	// DELETE /translations/:localeCode/:namespace/:key
	rg.DELETE("/translations/:localeCode/:namespace/:key",
		auth.RequirePermission("i18n", "delete"),
		h.DeleteTranslation,
	)
}

// ==================== Locale Handlers ====================

func (h *Handler) CreateLocale(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateLocale")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateLocaleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	locale, err := h.svc.CreateLocale(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, locale)
}

func (h *Handler) ListLocales(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListLocales")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	locales, err := h.svc.ListLocales(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"locales": locales, "total": len(locales)})
}

// ==================== Translation Handlers ====================

func (h *Handler) SetTranslation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SetTranslation")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.SetTranslationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	translation, err := h.svc.SetTranslation(ctx, tenantID, req.LocaleCode, req.Namespace, req.Key, req.Value)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, translation)
}

func (h *Handler) SetBulkTranslations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SetBulkTranslations")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.SetBulkTranslationsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	count, err := h.svc.SetBulkTranslations(ctx, tenantID, req.LocaleCode, req.Namespace, req.Translations)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"count": count})
}

func (h *Handler) GetTranslations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTranslations")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	localeCode := c.Param("localeCode")
	namespace := c.Query("namespace")

	ctx := ctx
	if namespace != "" {
		translations, err := h.svc.GetTranslationsByNamespace(ctx, tenantID, localeCode, namespace)
		if err != nil {
			middleware.RespondInternalError(c, err.Error())
			return
		}
		middleware.RespondSuccess(c, gin.H{
			"localeCode":   localeCode,
			"namespace":    namespace,
			"translations": translations,
		})
		return
	}

	allTranslations, err := h.svc.GetAllTranslations(ctx, tenantID, localeCode)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"localeCode":   localeCode,
		"translations": allTranslations,
	})
}

func (h *Handler) DeleteTranslation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteTranslation")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	localeCode := c.Param("localeCode")
	namespace := c.Param("namespace")
	key := c.Param("key")

	deleted, err := h.svc.DeleteTranslation(ctx, tenantID, localeCode, namespace, key)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if !deleted {
		middleware.RespondNotFound(c, "translation not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"deleted": true})
}
