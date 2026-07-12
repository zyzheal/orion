package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/i18n/models"
	"orion/platform-svc-go/internal/i18n/service"

	"github.com/gin-gonic/gin"
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
	tenantID := c.GetString("tenant_id")
	var req models.CreateLocaleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	locale, err := h.svc.CreateLocale(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, locale)
}

func (h *Handler) ListLocales(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	locales, err := h.svc.ListLocales(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"locales": locales, "total": len(locales)})
}

// ==================== Translation Handlers ====================

func (h *Handler) SetTranslation(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.SetTranslationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	translation, err := h.svc.SetTranslation(c.Request.Context(), tenantID, req.LocaleCode, req.Namespace, req.Key, req.Value)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, translation)
}

func (h *Handler) SetBulkTranslations(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.SetBulkTranslationsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	count, err := h.svc.SetBulkTranslations(c.Request.Context(), tenantID, req.LocaleCode, req.Namespace, req.Translations)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": count})
}

func (h *Handler) GetTranslations(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	localeCode := c.Param("localeCode")
	namespace := c.Query("namespace")

	ctx := c.Request.Context()
	if namespace != "" {
		translations, err := h.svc.GetTranslationsByNamespace(ctx, tenantID, localeCode, namespace)
		if err != nil {
			respondInternalError(c, err.Error())
			return
		}
		respondSuccess(c, gin.H{
			"localeCode":   localeCode,
			"namespace":    namespace,
			"translations": translations,
		})
		return
	}

	allTranslations, err := h.svc.GetAllTranslations(ctx, tenantID, localeCode)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{
		"localeCode":   localeCode,
		"translations": allTranslations,
	})
}

func (h *Handler) DeleteTranslation(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	localeCode := c.Param("localeCode")
	namespace := c.Param("namespace")
	key := c.Param("key")

	deleted, err := h.svc.DeleteTranslation(c.Request.Context(), tenantID, localeCode, namespace, key)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	if !deleted {
		respondNotFound(c, "translation not found")
		return
	}
	respondSuccess(c, gin.H{"deleted": true})
}
