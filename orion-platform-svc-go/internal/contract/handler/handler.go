package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/contract/models"
	"orion/platform-svc-go/internal/contract/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all contract endpoints under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/contract")

	// === Contract CRUD ===
	f.GET("", auth.RequirePermission("contract", "read"), h.ListContracts)
	f.POST("", auth.RequirePermission("contract", "write"), h.CreateContract)
	// Single resource endpoints
	f.GET("/contracts/:id", auth.RequirePermission("contract", "read"), h.GetContract)
	f.PUT("/contracts/:id", auth.RequirePermission("contract", "write"), h.UpdateContract)
	f.DELETE("/contracts/:id", auth.RequirePermission("contract", "delete"), h.DeleteContract)

	// === Endpoints ===
	f.POST("/contracts/:id/endpoints", auth.RequirePermission("contract", "write"), h.CreateEndpoint)
	f.GET("/contracts/:id/endpoints", auth.RequirePermission("contract", "read"), h.ListEndpoints)
	f.DELETE("/contracts/:id/endpoints/:endpointId", auth.RequirePermission("contract", "delete"), h.DeleteEndpoint)

	// === Stats ===
	f.GET("/stats", auth.RequirePermission("contract", "read"), h.GetStats)
}

// ==================== Contract ====================

func (h *Handler) ListContracts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	filter := &models.ContractFilter{Limit: 20}
	if l := c.Query("limit"); l != "" {
		filter.Limit, _ = strconv.Atoi(l)
	}
	if o := c.Query("offset"); o != "" {
		filter.Offset, _ = strconv.Atoi(o)
	}
	if s := c.Query("status"); s != "" {
		filter.Status = &s
	}
	if v := c.Query("version"); v != "" {
		filter.Version = &v
	}
	result, err := h.svc.ListContracts(c.Request.Context(), tenantID, filter)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) CreateContract(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateContractRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CreateContract(c.Request.Context(), tenantID, &req)
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

func (h *Handler) GetContract(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	result, err := h.svc.GetContract(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "contract not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) UpdateContract(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateContractRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.UpdateContract(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "contract not found")
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

func (h *Handler) DeleteContract(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	err := h.svc.DeleteContract(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "contract not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "contract deleted"})
}

// ==================== Endpoints ====================

func (h *Handler) CreateEndpoint(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	contractID := c.Param("id")
	var req models.CreateEndpointRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CreateEndpoint(c.Request.Context(), tenantID, contractID, &req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "contract not found")
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

func (h *Handler) ListEndpoints(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	contractID := c.Param("id")
	result, err := h.svc.ListEndpoints(c.Request.Context(), tenantID, contractID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) DeleteEndpoint(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	contractID := c.Param("id")
	endpointID := c.Param("endpointId")
	err := h.svc.DeleteEndpoint(c.Request.Context(), tenantID, contractID, endpointID)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "endpoint not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "endpoint deleted"})
}

// ==================== Stats ====================

func (h *Handler) GetStats(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	result, err := h.svc.GetStats(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}
