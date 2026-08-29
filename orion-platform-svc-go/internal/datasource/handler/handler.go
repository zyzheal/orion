package handler

import (
	"time"

	"orion/go-common/pkg/auth"
	dsm "orion/platform-svc-go/internal/datasource/models"
	"orion/platform-svc-go/internal/datasource/service"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Handler exposes the datasource service over HTTP at /api/v1/data-sources.
// Every route is guarded with resource "datasource"; the resource name is
// checked against the role maps by cmd/server/permission_guard_audit_test.go.
type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers the datasource endpoints under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/data-sources")

	f.GET("", auth.RequirePermission("datasource", "read"), h.List)
	f.GET("/types", auth.RequirePermission("datasource", "read"), h.Types)
	f.GET("/health", auth.RequirePermission("datasource", "read"), h.HealthAll)
	f.GET("/:id", auth.RequirePermission("datasource", "read"), h.Get)
	f.GET("/:id/health", auth.RequirePermission("datasource", "read"), h.Health)

	f.POST("", auth.RequirePermission("datasource", "write"), h.Register)
	f.POST("/:id/test", auth.RequirePermission("datasource", "write"), h.TestConnection)
	f.POST("/:id/query", auth.RequirePermission("datasource", "execute"), h.Query)
	f.POST("/:id/execute", auth.RequirePermission("datasource", "execute"), h.Execute)
	f.PUT("/:id", auth.RequirePermission("datasource", "write"), h.Update)
	f.DELETE("/:id", auth.RequirePermission("datasource", "delete"), h.Unregister)
}

// registerRequest is the create/update payload. Password is accepted on create
// and update; the service encrypts it and never echoes it back (Password and
// PasswordEnc both carry json:"-").
type registerRequest struct {
	Name            string            `json:"name" binding:"required"`
	Type            string            `json:"type" binding:"required"`
	Host            string            `json:"host" binding:"required"`
	Port            int               `json:"port"`
	Database        string            `json:"database"`
	Username        string            `json:"username"`
	Password        string            `json:"password,omitempty"`
	SSLMode         string            `json:"sslMode,omitempty"`
	AuthSource      string            `json:"authSource,omitempty"`
	MaxOpenConns    int               `json:"maxOpenConns,omitempty"`
	MaxIdleConns    int               `json:"maxIdleConns,omitempty"`
	ConnMaxLifetime time.Duration     `json:"connMaxLifetime,omitempty"`
	Tags            map[string]string `json:"tags,omitempty"`
}

// queryRequest carries an ad-hoc query plus positional arguments.
type queryRequest struct {
	Query string `json:"query" binding:"required"`
	Args  []any  `json:"args,omitempty"`
}

func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return ""
	}
	return tenantID
}

// List returns every datasource for the caller's tenant.
func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "datasource.List")
	defer span.End()
	tenantID := h.getTenantID(c)
	if tenantID == "" {
		return
	}
	items, err := h.svc.List(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"items": items, "total": len(items)})
}

// Types returns the engine types the service can connect to.
func (h *Handler) Types(c *gin.Context) {
	middleware.RespondSuccess(c, []dsm.DataSourceType{
		dsm.DSCPostgres, dsm.DSCMySQL, dsm.DSCClickHouse, dsm.DSCElasticsearch, dsm.DSCMongoDB,
	})
}

// Get returns one datasource by ID.
func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "datasource.Get")
	defer span.End()
	ds, err := h.svc.Get(ctx, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, "datasource not found")
		return
	}
	middleware.RespondSuccess(c, ds)
}

// Register persists a datasource and opens its connection.
func (h *Handler) Register(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "datasource.Register")
	defer span.End()
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	if tenantID == "" {
		return
	}
	ds := h.toDataSource(req, tenantID)
	if err := h.svc.Register(ctx, ds); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, ds)
}

// Update mutates the mutable fields of an existing datasource. It persists only;
// the service does not re-open the pool on update, so reconnects go through
// Unregister + Register.
func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "datasource.Update")
	defer span.End()
	id := c.Param("id")
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	current, err := h.svc.Get(ctx, id)
	if err != nil {
		middleware.RespondNotFound(c, "datasource not found")
		return
	}
	if req.Name != "" {
		current.Name = req.Name
	}
	if req.Type != "" {
		current.Type = dsm.DataSourceType(req.Type)
	}
	if req.Host != "" {
		current.Host = req.Host
	}
	if req.Port > 0 {
		current.Port = req.Port
	}
	if req.Database != "" {
		current.Database = req.Database
	}
	if req.Username != "" {
		current.Username = req.Username
	}
	if req.SSLMode != "" {
		current.SSLMode = req.SSLMode
	}
	if req.AuthSource != "" {
		current.AuthSource = req.AuthSource
	}
	if req.MaxOpenConns > 0 {
		current.MaxOpenConns = req.MaxOpenConns
	}
	if req.MaxIdleConns > 0 {
		current.MaxIdleConns = req.MaxIdleConns
	}
	if req.ConnMaxLifetime > 0 {
		current.ConnMaxLifetime = req.ConnMaxLifetime
	}
	if req.Tags != nil {
		current.Tags = req.Tags
	}
	if req.Password != "" {
		// Get() returns the row with PasswordEnc set and Password empty; the
		// service re-encrypts only when Password is non-empty.
		current.Password = req.Password
		current.PasswordEnc = ""
	}
	if err := h.svc.Update(ctx, current); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, current)
}

// Unregister closes the connection and removes the datasource.
func (h *Handler) Unregister(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "datasource.Unregister")
	defer span.End()
	if err := h.svc.Unregister(ctx, c.Param("id")); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "datasource unregistered"})
}

// TestConnection probes the stored credentials without persisting anything.
func (h *Handler) TestConnection(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "datasource.TestConnection")
	defer span.End()
	ds, err := h.svc.Get(ctx, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, "datasource not found")
		return
	}
	if err := h.svc.TestConnection(ctx, ds); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"ok": true})
}

// Query runs a read query against a datasource and returns rows.
func (h *Handler) Query(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "datasource.Query")
	defer span.End()
	var req queryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.Query(ctx, c.Param("id"), req.Query, req.Args...)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// Execute runs a write query against a datasource and returns affected counts.
func (h *Handler) Execute(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "datasource.Execute")
	defer span.End()
	var req queryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.Execute(ctx, c.Param("id"), req.Query, req.Args...)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

// Health reports the health of one datasource.
func (h *Handler) Health(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "datasource.Health")
	defer span.End()
	status, err := h.svc.HealthCheck(ctx, c.Param("id"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, status)
}

// HealthAll reports the health of every registered datasource.
func (h *Handler) HealthAll(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "datasource.HealthAll")
	defer span.End()
	statuses := h.svc.HealthCheckAll(ctx)
	middleware.RespondSuccess(c, gin.H{"total": len(statuses), "statuses": statuses})
}

func (h *Handler) toDataSource(req registerRequest, tenantID string) *dsm.DataSource {
	return &dsm.DataSource{
		Name:            req.Name,
		Type:            dsm.DataSourceType(req.Type),
		Host:            req.Host,
		Port:            req.Port,
		Database:        req.Database,
		Username:        req.Username,
		Password:        req.Password,
		SSLMode:         req.SSLMode,
		AuthSource:      req.AuthSource,
		MaxOpenConns:    req.MaxOpenConns,
		MaxIdleConns:    req.MaxIdleConns,
		ConnMaxLifetime: req.ConnMaxLifetime,
		Tags:            req.Tags,
		TenantID:        tenantID,
	}
}
