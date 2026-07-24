package handler

import (
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/network/models"
	"orion/platform-svc-go/internal/network/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Handler exposes the network module's HTTP endpoints.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler bound to the network service.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all network endpoints under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/network")

	// --- VPC ---
	r.GET("/vpcs", auth.RequirePermission("network", "read"), h.ListVPCs)
	r.POST("/vpcs", auth.RequirePermission("network", "write"), h.CreateVPC)
	r.GET("/vpcs/:id", auth.RequirePermission("network", "read"), h.GetVPC)
	r.PUT("/vpcs/:id", auth.RequirePermission("network", "write"), h.UpdateVPC)
	r.DELETE("/vpcs/:id", auth.RequirePermission("network", "delete"), h.DeleteVPC)

	// --- Subnet ---
	r.GET("/vpcs/:vpc_id/subnets", auth.RequirePermission("network", "read"), h.ListSubnetsByVPC)
	r.POST("/subnets", auth.RequirePermission("network", "write"), h.CreateSubnet)
	r.GET("/subnets/:id", auth.RequirePermission("network", "read"), h.GetSubnet)
	r.PUT("/subnets/:id", auth.RequirePermission("network", "write"), h.UpdateSubnet)
	r.DELETE("/subnets/:id", auth.RequirePermission("network", "delete"), h.DeleteSubnet)

	// --- Firewall ---
	r.GET("/vpcs/:vpc_id/firewall-rules", auth.RequirePermission("network", "read"), h.ListFirewallRulesByVPC)
	r.POST("/firewall-rules", auth.RequirePermission("network", "write"), h.CreateFirewallRule)
	r.GET("/firewall-rules/:id", auth.RequirePermission("network", "read"), h.GetFirewallRule)
	r.PUT("/firewall-rules/:id", auth.RequirePermission("network", "write"), h.UpdateFirewallRule)
	r.DELETE("/firewall-rules/:id", auth.RequirePermission("network", "delete"), h.DeleteFirewallRule)

	// --- Load balancer ---
	r.GET("/load-balancers", auth.RequirePermission("network", "read"), h.ListLoadBalancers)
	r.POST("/load-balancers", auth.RequirePermission("network", "write"), h.CreateLoadBalancer)
	r.GET("/load-balancers/:id", auth.RequirePermission("network", "read"), h.GetLoadBalancer)
	r.PUT("/load-balancers/:id", auth.RequirePermission("network", "write"), h.UpdateLoadBalancer)
	r.DELETE("/load-balancers/:id", auth.RequirePermission("network", "delete"), h.DeleteLoadBalancer)

	// --- DNS ---
	r.GET("/dns-records", auth.RequirePermission("network", "read"), h.ListDNSRecords)
	r.POST("/dns-records", auth.RequirePermission("network", "write"), h.CreateDNSRecord)
	r.GET("/dns-records/:id", auth.RequirePermission("network", "read"), h.GetDNSRecord)
	r.PUT("/dns-records/:id", auth.RequirePermission("network", "write"), h.UpdateDNSRecord)
	r.DELETE("/dns-records/:id", auth.RequirePermission("network", "delete"), h.DeleteDNSRecord)
}

// ---------- helpers ----------

func (h *Handler) handleServiceError(err error, c *gin.Context) bool {
	if err != nil && service.IsNotFound(err) {
		errors.WriteError(c, errors.ErrNotFound, "resource not found", 404)
		return true
	}
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return true
	}
	return false
}

func (h *Handler) requireTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		errors.WriteError(c, errors.ErrUnauthorized, "tenant_id is required", 401)
	}
	return tenantID
}

// ---------- VPC ----------

func (h *Handler) ListVPCs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "network.ListVPCs")
	defer span.End()

	tenantID := h.requireTenantID(c)
	if tenantID == "" {
		return
	}

	vpcs, err := h.svc.ListVPCs(ctx, tenantID)
	if h.handleServiceError(err, c) {
		return
	}
	errors.WriteSuccess(c, vpcs)
}

func (h *Handler) CreateVPC(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "network.CreateVPC")
	defer span.End()

	tenantID := h.requireTenantID(c)
	if tenantID == "" {
		return
	}

	var req models.CreateVPCRequest
	if err := c.ShouldBindJSON(&req); err != nil {
	errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}

	vpc, err := h.svc.CreateVPC(ctx, tenantID, &req)
	if h.handleServiceError(err, c) {
		return
	}
	errors.WriteCreated(c, vpc)
}

func (h *Handler) GetVPC(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "network.GetVPC")
	defer span.End()

	tenantID := h.requireTenantID(c)
	if tenantID == "" {
		return
	}

	id := c.Param("id")
	vpc, err := h.svc.GetVPC(ctx, tenantID, id)
	if h.handleServiceError(err, c) {
		return
	}
	if vpc == nil {
		errors.WriteError(c, errors.ErrNotFound, "VPC not found", 404)
		return
	}
	errors.WriteSuccess(c, vpc)
}

func (h *Handler) UpdateVPC(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "network.UpdateVPC")
	defer span.End()

	tenantID := h.requireTenantID(c)
	if tenantID == "" {
		return
	}

	id := c.Param("id")
	var req models.UpdateVPCRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}

	vpc, err := h.svc.UpdateVPC(ctx, tenantID, id, &req)
	if h.handleServiceError(err, c) {
		return
	}
	errors.WriteSuccess(c, vpc)
}

func (h *Handler) DeleteVPC(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "network.DeleteVPC")
	defer span.End()

	tenantID := h.requireTenantID(c)
	if tenantID == "" {
		return
	}

	id := c.Param("id")
	deleted, err := h.svc.DeleteVPC(ctx, tenantID, id)
	if h.handleServiceError(err, c) {
		return
	}
	if !deleted {
	errors.WriteError(c, errors.ErrNotFound, "VPC not found", 404)
		return
	}
	c.AbortWithStatus(http.StatusNoContent)
}

// ---------- Subnet ----------

func (h *Handler) ListSubnetsByVPC(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "network.ListSubnetsByVPC")
	defer span.End()

	tenantID := h.requireTenantID(c)
	if tenantID == "" {
		return
	}

	vpcID := c.Param("vpc_id")
	subnets, err := h.svc.ListSubnetsByVPC(ctx, tenantID, vpcID)
	if h.handleServiceError(err, c) {
		return
	}
	errors.WriteSuccess(c, subnets)
}

func (h *Handler) CreateSubnet(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "network.CreateSubnet")
	defer span.End()

	tenantID := h.requireTenantID(c)
	if tenantID == "" {
		return
	}

	var req models.CreateSubnetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
	errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}

	subnet, err := h.svc.CreateSubnet(ctx, tenantID, &req)
	if h.handleServiceError(err, c) {
		return
	}
	errors.WriteCreated(c, subnet)
}

func (h *Handler) GetSubnet(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "network.GetSubnet")
	defer span.End()

	tenantID := h.requireTenantID(c)
	if tenantID == "" {
		return
	}

	id := c.Param("id")
	subnet, err := h.svc.GetSubnet(ctx, tenantID, id)
	if h.handleServiceError(err, c) {
		return
	}
	if subnet == nil {
		errors.WriteError(c, errors.ErrNotFound, "subnet not found", 404)
		return
	}
	errors.WriteSuccess(c, subnet)
}

func (h *Handler) UpdateSubnet(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "network.UpdateSubnet")
	defer span.End()

	tenantID := h.requireTenantID(c)
	if tenantID == "" {
		return
	}

id := c.Param("id")
	var req models.UpdateSubnetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}

	subnet, err := h.svc.UpdateSubnet(ctx, tenantID, id, &req)
	if h.handleServiceError(err, c) {
		return
	}
errors.WriteSuccess(c, subnet)
}

func (h *Handler) DeleteSubnet(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "network.DeleteSubnet")
	defer span.End()

	tenantID := h.requireTenantID(c)
	if tenantID == "" {
		return
	}

	id := c.Param("id")
	deleted, err := h.svc.DeleteSubnet(ctx, tenantID, id)
	if h.handleServiceError(err, c) {
		return
	}
	if !deleted {
	errors.WriteError(c, errors.ErrNotFound, "subnet not found", 404)
		return
	}
	c.AbortWithStatus(http.StatusNoContent)
}

// ---------- FirewallRule ----------

func (h *Handler) ListFirewallRulesByVPC(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "network.ListFirewallRulesByVPC")
	defer span.End()

	tenantID := h.requireTenantID(c)
	if tenantID == "" {
		return
	}

	vpcID := c.Param("vpc_id")
	rules, err := h.svc.ListFirewallRulesByVPC(ctx, tenantID, vpcID)
	if h.handleServiceError(err, c) {
		return
	}
	errors.WriteSuccess(c, rules)
}

func (h *Handler) CreateFirewallRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "network.CreateFirewallRule")
	defer span.End()

	tenantID := h.requireTenantID(c)
	if tenantID == "" {
		return
	}

	var req models.CreateFirewallRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}

	rule, err := h.svc.CreateFirewallRule(ctx, tenantID, &req)
	if h.handleServiceError(err, c) {
		return
	}
	errors.WriteCreated(c, rule)
}

func (h *Handler) GetFirewallRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "network.GetFirewallRule")
	defer span.End()

	tenantID := h.requireTenantID(c)
	if tenantID == "" {
		return
	}

	id := c.Param("id")
	rule, err := h.svc.GetFirewallRule(ctx, tenantID, id)
	if h.handleServiceError(err, c) {
		return
	}
	if rule == nil {
		errors.WriteError(c, errors.ErrNotFound, "firewall rule not found", 404)
		return
	}
errors.WriteSuccess(c, rule)
}

func (h *Handler) UpdateFirewallRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "network.UpdateFirewallRule")
	defer span.End()

	tenantID := h.requireTenantID(c)
	if tenantID == "" {
		return
	}

id := c.Param("id")
	var req models.UpdateFirewallRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}

	rule, err := h.svc.UpdateFirewallRule(ctx, tenantID, id, &req)
	if h.handleServiceError(err, c) {
		return
	}
	errors.WriteSuccess(c, rule)
}

func (h *Handler) DeleteFirewallRule(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "network.DeleteFirewallRule")
	defer span.End()

	tenantID := h.requireTenantID(c)
	if tenantID == "" {
	 return
	}

	id := c.Param("id")
	deleted, err := h.svc.DeleteFirewallRule(ctx, tenantID, id)
	if h.handleServiceError(err, c) {
		return
	}
	if !deleted {
	errors.WriteError(c, errors.ErrNotFound, "firewall rule not found", 404)
		return
	}
	c.AbortWithStatus(http.StatusNoContent)
}

// ---------- LoadBalancer ----------

func (h *Handler) ListLoadBalancers(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "network.ListLoadBalancers")
	defer span.End()

	tenantID := h.requireTenantID(c)
	if tenantID == "" {
		return
	}
	lbs, err := h.svc.ListLoadBalancers(ctx, tenantID)
	if h.handleServiceError(err, c) {
		return
	}
	errors.WriteSuccess(c, lbs)
}

func (h *Handler) CreateLoadBalancer(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "network.CreateLoadBalancer")
	defer span.End()

	tenantID := h.requireTenantID(c)
	if tenantID == "" {
		return
	}

	var req models.CreateLoadBalancerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
	errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}

	lb, err := h.svc.CreateLoadBalancer(ctx, tenantID, &req)
	if h.handleServiceError(err, c) {
		return
	}
errors.WriteCreated(c, lb)
}

func (h *Handler) GetLoadBalancer(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "network.GetLoadBalancer")
	defer span.End()

	tenantID := h.requireTenantID(c)
	if tenantID == "" {
		return
	}

	id := c.Param("id")
	lb, err := h.svc.GetLoadBalancer(ctx, tenantID, id)
	if h.handleServiceError(err, c) {
		return
	}
	if lb == nil {
		errors.WriteError(c, errors.ErrNotFound, "load balancer not found", 404)
		return
	}
	errors.WriteSuccess(c, lb)
}

func (h *Handler) UpdateLoadBalancer(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "network.UpdateLoadBalancer")
	defer span.End()

	tenantID := h.requireTenantID(c)
	if tenantID == "" {
		return
	}

	id := c.Param("id")
	var req models.UpdateLoadBalancerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
	errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}

	lb, err := h.svc.UpdateLoadBalancer(ctx, tenantID, id, &req)
	if h.handleServiceError(err, c) {
		return
	}
	errors.WriteSuccess(c, lb)
}

func (h *Handler) DeleteLoadBalancer(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "network.DeleteLoadBalancer")
	defer span.End()

	tenantID := h.requireTenantID(c)
	if tenantID == "" {
		return
	}

	id := c.Param("id")
	deleted, err := h.svc.DeleteLoadBalancer(ctx, tenantID, id)
	if h.handleServiceError(err, c) {
		return
	}
	if !deleted {
		errors.WriteError(c, errors.ErrNotFound, "load balancer not found", 404)
		return
	}
	c.AbortWithStatus(http.StatusNoContent)
}

// ---------- DNSRecord ----------

func (h *Handler) ListDNSRecords(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "network.ListDNSRecords")
	defer span.End()

	tenantID := h.requireTenantID(c)
	if tenantID == "" {
		return
	}
	records, err := h.svc.ListDNSRecords(ctx, tenantID)
	if h.handleServiceError(err, c) {
		return
	}
	errors.WriteSuccess(c, records)
}

func (h *Handler) CreateDNSRecord(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "network.CreateDNSRecord")
	defer span.End()

	tenantID := h.requireTenantID(c)
	if tenantID == "" {
		return
	}

	var req models.CreateDNSRecordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
	errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}

	record, err := h.svc.CreateDNSRecord(ctx, tenantID, &req)
	if h.handleServiceError(err, c) {
		return
	}
	errors.WriteCreated(c, record)
}

func (h *Handler) GetDNSRecord(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "network.GetDNSRecord")
	defer span.End()

	tenantID := h.requireTenantID(c)
	if tenantID == "" {
		return
	}

	id := c.Param("id")
	record, err := h.svc.GetDNSRecord(ctx, tenantID, id)
	if h.handleServiceError(err, c) {
		return
	}
	if record == nil {
	errors.WriteError(c, errors.ErrNotFound, "DNS record not found", 404)
		return
	}
errors.WriteSuccess(c, record)
}

func (h *Handler) UpdateDNSRecord(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "network.UpdateDNSRecord")
	defer span.End()

	tenantID := h.requireTenantID(c)
	if tenantID == "" {
		return
	}

	id := c.Param("id")
	var req models.UpdateDNSRecordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
	errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}

	record, err := h.svc.UpdateDNSRecord(ctx, tenantID, id, &req)
	if h.handleServiceError(err, c) {
		return
	}
	errors.WriteSuccess(c, record)
}

func (h *Handler) DeleteDNSRecord(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "network.DeleteDNSRecord")
	defer span.End()

	tenantID := h.requireTenantID(c)
	if tenantID == "" {
		return
	}

	id := c.Param("id")
	deleted, err := h.svc.DeleteDNSRecord(ctx, tenantID, id)
	if h.handleServiceError(err, c) {
		return
	}
	if !deleted {
	errors.WriteError(c, errors.ErrNotFound, "DNS record not found", 404)
		return
	}
	c.AbortWithStatus(http.StatusNoContent)
}
