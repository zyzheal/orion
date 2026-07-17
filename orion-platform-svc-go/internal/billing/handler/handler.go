package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/billing/models"
	"orion/platform-svc-go/internal/billing/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

// Handler exposes the billing module's HTTP endpoints.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler bound to the billing service.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all billing endpoints under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/billing")

	// === Accounts ===
	f.GET("/accounts", auth.RequirePermission("billing", "read"), h.ListAccounts)
	f.POST("/accounts", auth.RequirePermission("billing", "write"), h.CreateAccount)
	f.GET("/accounts/:id", auth.RequirePermission("billing", "read"), h.GetAccount)
	f.PUT("/accounts/:id", auth.RequirePermission("billing", "write"), h.UpdateAccount)
	f.DELETE("/accounts/:id", auth.RequirePermission("billing", "delete"), h.DeleteAccount)

	// === Invoices ===
	f.GET("/invoices", auth.RequirePermission("billing", "read"), h.ListInvoices)
	f.POST("/invoices", auth.RequirePermission("billing", "write"), h.CreateInvoice)
	f.GET("/invoices/:id", auth.RequirePermission("billing", "read"), h.GetInvoice)
	f.PUT("/invoices/:id", auth.RequirePermission("billing", "write"), h.UpdateInvoice)
	f.DELETE("/invoices/:id", auth.RequirePermission("billing", "delete"), h.DeleteInvoice)

	// === Line Items ===
	f.POST("/invoices/:invoiceId/line-items", auth.RequirePermission("billing", "write"), h.CreateLineItem)
	f.GET("/invoices/:invoiceId/line-items", auth.RequirePermission("billing", "read"), h.ListLineItems)

	// === Subscriptions ===
	f.GET("/subscriptions", auth.RequirePermission("billing", "read"), h.ListSubscriptions)
	f.POST("/subscriptions", auth.RequirePermission("billing", "write"), h.CreateSubscription)
	f.GET("/subscriptions/:id", auth.RequirePermission("billing", "read"), h.GetSubscription)
	f.PUT("/subscriptions/:id", auth.RequirePermission("billing", "write"), h.UpdateSubscription)
	f.DELETE("/subscriptions/:id", auth.RequirePermission("billing", "delete"), h.DeleteSubscription)

	// === Stats ===
	f.GET("/stats", auth.RequirePermission("billing", "read"), h.GetStats)
}

// ==================== Accounts ====================

func (h *Handler) ListAccounts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var status *string
	if s := c.Query("status"); s != "" {
		status = &s
	}
	result, err := h.svc.ListAccounts(c.Request.Context(), tenantID, status)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) CreateAccount(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CreateAccount(c.Request.Context(), tenantID, &req)
	if err != nil {
		if service.IsBadRequest(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

func (h *Handler) GetAccount(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetAccount(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "account not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) UpdateAccount(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.UpdateAccount(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "account not found")
			return
		}
		if service.IsBadRequest(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) DeleteAccount(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	err := h.svc.DeleteAccount(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "account not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "account deleted"})
}

// ==================== Invoices ====================

func (h *Handler) ListInvoices(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	filter := &models.InvoiceFilter{Limit: 20}
	if l := c.Query("limit"); l != "" {
		filter.Limit, _ = strconv.Atoi(l)
	}
	if o := c.Query("offset"); o != "" {
		filter.Offset, _ = strconv.Atoi(o)
	}
	if s := c.Query("status"); s != "" {
		filter.Status = &s
	}
	if a := c.Query("accountId"); a != "" {
		filter.AccountID = &a
	}
	if ps := c.Query("periodStart"); ps != "" {
		filter.PeriodStart = &ps
	}
	if pe := c.Query("periodEnd"); pe != "" {
		filter.PeriodEnd = &pe
	}
	result, total, err := h.svc.ListInvoices(c.Request.Context(), tenantID, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": result, "total": total})
}

func (h *Handler) CreateInvoice(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateInvoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CreateInvoice(c.Request.Context(), tenantID, &req)
	if err != nil {
		if service.IsBadRequest(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

func (h *Handler) GetInvoice(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetInvoice(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "invoice not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) UpdateInvoice(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.UpdateInvoice(c.Request.Context(), tenantID, id, updates)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "invoice not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) DeleteInvoice(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	err := h.svc.DeleteInvoice(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "invoice not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "invoice deleted"})
}

// ==================== Line Items ====================

func (h *Handler) CreateLineItem(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	invoiceID := c.Param("invoiceId")
	var req models.CreateLineItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	req.InvoiceID = invoiceID
	result, err := h.svc.CreateLineItem(c.Request.Context(), tenantID, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "invoice not found")
			return
		}
		if service.IsBadRequest(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

func (h *Handler) ListLineItems(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	invoiceID := c.Param("invoiceId")
	result, err := h.svc.ListLineItems(c.Request.Context(), tenantID, invoiceID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// ==================== Subscriptions ====================

func (h *Handler) ListSubscriptions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var status *string
	if s := c.Query("status"); s != "" {
		status = &s
	}
	result, err := h.svc.ListSubscriptions(c.Request.Context(), tenantID, status)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) CreateSubscription(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CreateSubscription(c.Request.Context(), tenantID, &req)
	if err != nil {
		if service.IsBadRequest(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, result)
}

func (h *Handler) GetSubscription(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetSubscription(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "subscription not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) UpdateSubscription(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.UpdateSubscription(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "subscription not found")
			return
		}
		if service.IsBadRequest(err) {
			middleware.RespondBadRequest(c, err.Error())
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) DeleteSubscription(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	err := h.svc.DeleteSubscription(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "subscription not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "subscription deleted"})
}

// ==================== Stats ====================

func (h *Handler) GetStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.GetBillingStats(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}
