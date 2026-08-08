package crud

import (
	"fmt"
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Option configures a CRUDHandler.
type Option func(*CRUDHandler)

// WithResource sets the resource name used for auth permission scopes and the
// route path prefix.
func WithResource(resource string) Option {
	return func(h *CRUDHandler) {
		h.resource = resource
	}
}

// WithPrefix sets the route path prefix explicitly. By default the prefix is
// "/" + resource.
func WithPrefix(prefix string) Option {
	return func(h *CRUDHandler) {
		h.prefix = prefix
	}
}

// WithParamKey sets the path parameter name for the resource ID. By default
// it is ":id".
func WithParamKey(paramKey string) Option {
	return func(h *CRUDHandler) {
		if paramKey != "" {
			h.paramKey = paramKey
		}
	}
}

// WithListQueryPaging enables parsing of page/limit query parameters for the
// List endpoint. Metadata and mlops use this; inspection and test-generation
// skip it by default.
func WithListQueryPaging() Option {
	return func(h *CRUDHandler) {
		h.parseListQuery = true
	}
}

// CRUDHandler provides shared CRUD route registration and handler methods.
// Embed it in a domain-specific handler and override/extend with domain
// endpoints.
type CRUDHandler struct {
	resource        string
	prefix          string
	paramKey        string
	parseListQuery  bool
	list            func(c *gin.Context)
	get             func(c *gin.Context)
	create          func(c *gin.Context)
	update          func(c *gin.Context)
	delete          func(c *gin.Context)
}

// NewCRUDHandler creates a CRUDHandler with the given service and options.
// The service is stored in the closures so domain-specific handler receivers
// can access it via the closures.
func NewCRUDHandler(svc ServiceInterface, opts ...Option) *CRUDHandler {
	h := &CRUDHandler{
		resource:     "",
		paramKey:     ":id",
		parseListQuery: false,
	}
	for _, opt := range opts {
		opt(h)
	}
	if h.prefix == "" {
		h.prefix = "/" + h.resource
	}
	h.list = makeListHandler(svc, h.parseListQuery)
	h.get = makeGetHandler(svc)
	h.create = makeCreateHandler(svc)
	h.update = makeUpdateHandler(svc)
	h.delete = makeDeleteHandler(svc)
	return h
}

// RegisterCRUDRoutes registers the canonical CRUD routes on the given group.
// The caller passes the router group (without a prefix) and CRUDHandler uses
// h.prefix. E.g. `rg.Group("")` + prefix="/mlops".
func (h *CRUDHandler) RegisterCRUDRoutes(rg *gin.RouterGroup) {
	r := rg.Group(h.prefix)
	r.GET("", auth.RequirePermission(h.resource, "read"), h.List)
	r.GET(h.paramKey, auth.RequirePermission(h.resource, "read"), h.Get)
	r.POST("", auth.RequirePermission(h.resource, "write"), h.Create)
	r.PUT(h.paramKey, auth.RequirePermission(h.resource, "write"), h.Update)
	r.DELETE(h.paramKey, auth.RequirePermission(h.resource, "delete"), h.Delete)
}

// RegisterCRUDRoutesOnGroup registers the canonical CRUD routes on a router
// group that already carries the prefix.
func (h *CRUDHandler) RegisterCRUDRoutesOnGroup(rg *gin.RouterGroup) {
	r := rg
	r.GET("", auth.RequirePermission(h.resource, "read"), h.List)
	r.GET(h.paramKey, auth.RequirePermission(h.resource, "read"), h.Get)
	r.POST("", auth.RequirePermission(h.resource, "write"), h.Create)
	r.PUT(h.paramKey, auth.RequirePermission(h.resource, "write"), h.Update)
	r.DELETE(h.paramKey, auth.RequirePermission(h.resource, "delete"), h.Delete)
}

// List handles GET /list with optional page/limit.
func (h *CRUDHandler) List(c *gin.Context) {
	h.list(c)
}

// Get handles GET /:id.
func (h *CRUDHandler) Get(c *gin.Context) {
	h.get(c)
}

// Create handles POST /.
func (h *CRUDHandler) Create(c *gin.Context) {
	h.create(c)
}

// Update handles PUT /:id.
func (h *CRUDHandler) Update(c *gin.Context) {
	h.update(c)
}

// Delete handles DELETE /:id.
func (h *CRUDHandler) Delete(c *gin.Context) {
	h.delete(c)
}

func makeListHandler(svc ServiceInterface, parsePaging bool) func(*gin.Context) {
	return func(c *gin.Context) {
		ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "List")
		defer span.End()
		tenantID := c.GetString("tenant_id")
		if parsePaging {
			_ = parsePageLimit(c)
		}
		records, err := svc.List(ctx, tenantID)
		if err != nil {
			errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
			return
		}
		errors.WriteSuccess(c, gin.H{"data": records, "total": len(records)})
	}
}

func parsePageLimit(c *gin.Context) ListQuery {
	var q ListQuery
	if p := c.Query("page"); p != "" {
		fmt.Sscanf(p, "%d", &q.Page)
	}
	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &q.Limit)
	}
	return q
}

func makeGetHandler(svc ServiceInterface) func(*gin.Context) {
	return func(c *gin.Context) {
		ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Get")
		defer span.End()
		tenantID := c.GetString("tenant_id")
		record, err := svc.Get(ctx, tenantID, c.Param("id"))
		if err != nil {
			// WriteNotFound is handled by domain-specific code in some modules;
			// shared handler uses the canonical ErrNotFound.
			errors.WriteError(c, errors.ErrNotFound, "not found", http.StatusNotFound)
			return
		}
		errors.WriteSuccess(c, record)
	}
}

func makeCreateHandler(svc ServiceInterface) func(*gin.Context) {
	return func(c *gin.Context) {
		ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Create")
		defer span.End()
		tenantID := c.GetString("tenant_id")
		var req CreateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
			return
		}
		record, err := svc.Create(ctx, tenantID, req)
		if err != nil {
			errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
			return
		}
		errors.WriteSuccess(c, record)
	}
}

func makeUpdateHandler(svc ServiceInterface) func(*gin.Context) {
	return func(c *gin.Context) {
		ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Update")
		defer span.End()
		tenantID := c.GetString("tenant_id")
		var req CreateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
			return
		}
		record, err := svc.Update(ctx, tenantID, c.Param("id"), req)
		if err != nil {
			errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
			return
		}
		errors.WriteSuccess(c, record)
	}
}

func makeDeleteHandler(svc ServiceInterface) func(*gin.Context) {
	return func(c *gin.Context) {
		ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Delete")
		defer span.End()
		tenantID := c.GetString("tenant_id")
		err := svc.Delete(ctx, tenantID, c.Param("id"))
		if err != nil {
			errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
			return
		}
		errors.WriteSuccess(c, nil)
	}
}
