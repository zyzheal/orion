package handler

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/infrastructure/models"
	"orion/platform-svc-go/internal/infrastructure/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all infrastructure endpoints under the given group.
// Mirrors 19 endpoints from the TS source.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	infra := rg.Group("/admin/infrastructure")

	// === Connector Management ===
	// GET /connectors - List all connectors
	infra.GET("/connectors", auth.RequirePermission("infrastructure", "read"), h.ListConnectors)
	// GET /connectors/:id - Get connector detail
	infra.GET("/connectors/:id", auth.RequirePermission("infrastructure", "read"), h.GetConnector)
	// POST /connectors - Register a new connector
	infra.POST("/connectors", auth.RequirePermission("infrastructure", "write"), h.RegisterConnector)
	// POST /connectors/:id/connect - Connect to connector
	infra.POST("/connectors/:id/connect", auth.RequirePermission("infrastructure", "write"), h.Connect)
	// POST /connectors/:id/disconnect - Disconnect connector
	infra.POST("/connectors/:id/disconnect", auth.RequirePermission("infrastructure", "write"), h.Disconnect)
	// POST /connectors/:id/reconnect - Reconnect connector
	infra.POST("/connectors/:id/reconnect", auth.RequirePermission("infrastructure", "write"), h.Reconnect)
	// DELETE /connectors/:id - Unregister connector
	infra.DELETE("/connectors/:id", auth.RequirePermission("infrastructure", "delete"), h.UnregisterConnector)
	// GET /connectors/:id/health - Get connector health metrics
	infra.GET("/connectors/:id/health", auth.RequirePermission("infrastructure", "read"), h.GetHealthMetrics)
	// GET /connectors/health/all - Get all connectors health
	infra.GET("/connectors/health/all", auth.RequirePermission("infrastructure", "read"), h.ListAllHealthMetrics)

	// === Sandbox Network Isolation ===
	// GET /sandbox - List all sandboxes
	infra.GET("/sandbox", auth.RequirePermission("infrastructure", "read"), h.ListSandboxes)
	// GET /sandbox/:id - Get sandbox detail
	infra.GET("/sandbox/:id", auth.RequirePermission("infrastructure", "read"), h.GetSandbox)
	// POST /sandbox - Create sandbox network
	infra.POST("/sandbox", auth.RequirePermission("infrastructure", "write"), h.CreateSandbox)
	// POST /sandbox/:id/isolate - Isolate sandbox
	infra.POST("/sandbox/:id/isolate", auth.RequirePermission("infrastructure", "write"), h.IsolateSandbox)
	// POST /sandbox/:id/release - Release sandbox isolation
	infra.POST("/sandbox/:id/release", auth.RequirePermission("infrastructure", "write"), h.ReleaseSandbox)
	// POST /sandbox/:id/block-all - Block all traffic
	infra.POST("/sandbox/:id/block-all", auth.RequirePermission("infrastructure", "write"), h.BlockAllTraffic)
	// POST /sandbox/:id/allow-traffic - Allow traffic between environments
	infra.POST("/sandbox/:id/allow-traffic", auth.RequirePermission("infrastructure", "write"), h.AllowTraffic)
	// POST /sandbox/:id/deny-traffic - Deny traffic between environments
	infra.POST("/sandbox/:id/deny-traffic", auth.RequirePermission("infrastructure", "write"), h.DenyTraffic)
	// POST /sandbox/:id/dns-isolation - Configure DNS isolation
	infra.POST("/sandbox/:id/dns-isolation", auth.RequirePermission("infrastructure", "write"), h.ConfigureDnsIsolation)
	// POST /sandbox/:id/egress - Configure egress traffic control
	infra.POST("/sandbox/:id/egress", auth.RequirePermission("infrastructure", "write"), h.ConfigureEgressTraffic)
}

// --- Connector handlers ---

func (h *Handler) ListConnectors(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListConnectors(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": items, "total": len(items)})
}

func (h *Handler) GetConnector(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.GetConnector(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "connector not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) RegisterConnector(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.RegisterConnectorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	m, err := h.svc.RegisterConnector(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, m)
}

func (h *Handler) Connect(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.Connect(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) Disconnect(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Disconnect(c.Request.Context(), tenantID, id); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "disconnected successfully"})
}

func (h *Handler) Reconnect(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.Reconnect(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, m)
}

func (h *Handler) UnregisterConnector(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.UnregisterConnector(c.Request.Context(), tenantID, id); err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "connector unregistered"})
}

func (h *Handler) GetHealthMetrics(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	connectorID := c.Param("id")
	metrics, err := h.svc.GetHealthMetrics(c.Request.Context(), tenantID, connectorID)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "health metrics not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, metrics)
}

func (h *Handler) ListAllHealthMetrics(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	metrics, err := h.svc.ListAllHealthMetrics(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": metrics, "total": len(metrics)})
}

// --- Sandbox handlers ---

func (h *Handler) ListSandboxes(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListSandboxes(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"data": items, "total": len(items)})
}

func (h *Handler) GetSandbox(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	sb, err := h.svc.GetSandbox(c.Request.Context(), tenantID, id)
	if err != nil {
		if service.IsNotFound(err) {
			respondNotFound(c, "sandbox not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, sb)
}

func (h *Handler) CreateSandbox(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateSandboxRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	sb, err := h.svc.CreateSandbox(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, sb)
}

func (h *Handler) IsolateSandbox(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	sb, err := h.svc.IsolateSandbox(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, sb)
}

func (h *Handler) ReleaseSandbox(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	sb, err := h.svc.ReleaseSandbox(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, sb)
}

func (h *Handler) BlockAllTraffic(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	sb, err := h.svc.IsolateSandbox(c.Request.Context(), tenantID, id)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, sb)
}

func (h *Handler) AllowTraffic(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	_ = c.Param("id")
	var req models.AllowTrafficRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	policy, err := h.svc.AllowTraffic(c.Request.Context(), tenantID, req)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, policy)
}

func (h *Handler) DenyTraffic(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	_ = c.Param("id")
	var body struct {
		FromEnv string `json:"fromEnv" binding:"required"`
		ToEnv   string `json:"toEnv" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	policy, err := h.svc.DenyTraffic(c.Request.Context(), tenantID, body.FromEnv, body.ToEnv)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, policy)
}

func (h *Handler) ConfigureDnsIsolation(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	sandboxID := c.Param("id")
	var req models.DnsIsolationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	policy, err := h.svc.ConfigureDnsIsolation(c.Request.Context(), tenantID, req, sandboxID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, policy)
}

func (h *Handler) ConfigureEgressTraffic(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	sandboxID := c.Param("id")
	var req models.EgressTrafficRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	policy, err := h.svc.ConfigureEgressTraffic(c.Request.Context(), tenantID, req, sandboxID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, policy)
}
