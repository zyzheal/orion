// Package apicomponent provides a declarative, component-based API routing
// system for Orion Go microservices. It replaces ad-hoc gin RouterGroup
// registration with a structured registry that supports middleware stacking,
// request validation, response serialization, and error handling.
//
// The system is fully additive: existing handlers with RegisterRoutes(*gin.RouterGroup)
// continue to work; the component system is an optional layer that can be
// used for new handlers or to gradually migrate existing ones.
//
// Usage:
//
//	// 1. Create a component with a named group of routes
//	component := apicomponent.NewAPIComponent(
//	    "feature-flag", "/flags", "Feature Flag CRUD",
//	    apicomponent.WithDescription("Manage feature flags for the platform"),
//	    apicomponent.WithVersion("v1"),
//	)
//
//	// 2. Add route definitions (each route is a RouteComponent)
//	component.AddRoute(apicomponent.RouteComponent{
//	    Methods:  apicomponent.Methods("GET", "POST"),
//	    Path:     "/flags",
//	    Handler:  h.Create,
//	    Metadata: gin.H{"description": "Create a feature flag"},
//	})
//
//	// 3. Register the component
//	registry := apicomponent.NewRegistry()
//	registry.Register(component)
//
//	// 4. Build the router
//	builder := apicomponent.NewRouterBuilder(registry)
//	engine := builder.Build()
package apicomponent

import (
	"net/http"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
)

// ---------------------------------------------------------------------------
// HTTP Methods
// ---------------------------------------------------------------------------

// HTTPMethod represents an HTTP method string.
type HTTPMethod string

const (
	MethodGet     HTTPMethod = "GET"
	MethodPost    HTTPMethod = "POST"
	MethodPut     HTTPMethod = "PUT"
	MethodPatch   HTTPMethod = "PATCH"
	MethodDelete  HTTPMethod = "DELETE"
	MethodHead    HTTPMethod = "HEAD"
	MethodOptions HTTPMethod = "OPTIONS"
)

// AllMethods is a convenience list of all standard HTTP methods.
var AllMethods = []HTTPMethod{
	MethodGet, MethodPost, MethodPut, MethodPatch, MethodDelete, MethodHead, MethodOptions,
}

// ---------------------------------------------------------------------------
// Middleware Chain
// ---------------------------------------------------------------------------

// MiddlewareFunc is the type alias for a Gin middleware function.
type MiddlewareFunc = gin.HandlerFunc

// MiddlewareChain is an ordered list of middleware handlers that execute
// before the route handler. Middlewares are applied in the order they are
// added to the chain.
type MiddlewareChain []MiddlewareFunc

// Clone returns a copy of the middleware chain.
func (c MiddlewareChain) Clone() MiddlewareChain {
	if c == nil {
		return nil
	}
	cp := make(MiddlewareChain, len(c))
	copy(cp, c)
	return cp
}

// Append returns a new chain with the given middleware added at the end.
func (c MiddlewareChain) Append(mw MiddlewareFunc) MiddlewareChain {
	cp := make(MiddlewareChain, len(c)+1)
	copy(cp, c)
	cp[len(cp)-1] = mw
	return cp
}

// ---------------------------------------------------------------------------
// Route Component
// ---------------------------------------------------------------------------

// RouteComponent defines a single API endpoint. It maps a path and HTTP method(s)
// to a handler function, optionally with its own middleware chain and metadata.
//
// A RouteComponent is the atomic unit of the component system. Each route is
// a self-contained definition that can be registered, discovered, and built
// into a Gin router.
type RouteComponent struct {
	// Methods is the list of HTTP methods this route responds to.
	// If empty, GET is assumed.
	Methods []HTTPMethod

	// Path is the route path relative to the component's prefix.
	// It can include Gin path parameters like :id or *filepath.
	Path string

	// Handler is the gin.HandlerFunc that processes this route.
	// It receives the gin.Context and is responsible for producing the response.
	Handler gin.HandlerFunc

	// Middleware is the per-route middleware chain. These execute AFTER any
	// component-level middleware but BEFORE the handler.
	Middleware MiddlewareChain

	// Metadata is arbitrary key-value data associated with this route.
	// Common uses include OpenAPI descriptions, tags, or security requirements.
	Metadata gin.H

	// Tags is a list of OpenAPI-style tags for grouping and documentation.
	Tags []string

	// Summary is a short human-readable description of what this route does.
	Summary string
}

// Validate checks the route component for common configuration errors.
func (r RouteComponent) Validate() error {
	if r.Path == "" {
		return &ConfigError{Field: "Path", Reason: "path is required"}
	}
	if r.Handler == nil {
		return &ConfigError{Field: "Handler", Reason: "handler is required"}
	}
	if len(r.Methods) == 0 {
		return &ConfigError{Field: "Methods", Reason: "at least one HTTP method is required"}
	}
	for _, m := range r.Methods {
		if !isValidHTTPMethod(m) {
			return &ConfigError{Field: "Methods", Reason: "invalid HTTP method: " + string(m)}
		}
	}
	return nil
}

// isDuplicateMethod checks if any method appears more than once.
func (r RouteComponent) HasDuplicateMethods() bool {
	seen := make(map[HTTPMethod]bool, len(r.Methods))
	for _, m := range r.Methods {
		if seen[m] {
			return true
		}
		seen[m] = true
	}
	return false
}

// isValidHTTPMethod checks if a method string is a known HTTP method.
func isValidHTTPMethod(m HTTPMethod) bool {
	for _, valid := range AllMethods {
		if m == valid {
			return true
		}
	}
	return false
}

// ---------------------------------------------------------------------------
// API Component
// ---------------------------------------------------------------------------

// APIComponent is a named group of related routes sharing a common prefix,
// version, and middleware. It represents a logical API domain (e.g.,
// "feature-flag", "pipeline", "user").
//
// The component model promotes discoverability: every route is explicitly
// declared, making it easy to generate OpenAPI specs, build dashboards,
// or audit the API surface.
type APIComponent struct {
	// Name is the unique identifier for this component (e.g., "feature-flag").
	Name string

	// Prefix is the URL path prefix for all routes in this component.
	// Combined with each route's Path to form the full URL.
	// Example: prefix="/flags" + path="/:id" -> /flags/:id
	Prefix string

	// Version is the API version (e.g., "v1", "v2"). Used for versioned routing.
	Version string

	// Summary is a short human-readable title for the component.
	Summary string

	// Description is a detailed description of what this component provides.
	Description string

	// Tags is a list of OpenAPI-style tags for grouping.
	Tags []string

	// Routes is the list of route definitions in this component.
	Routes []RouteComponent

	// Middleware is the component-level middleware chain applied to ALL routes.
	// Executed BEFORE per-route middleware and the handler.
	Middleware MiddlewareChain

	// Metadata is arbitrary key-value data for the component.
	Metadata gin.H

	// registered is true once this component has been registered in a registry.
	registered bool
	mu         sync.RWMutex
}

// NewAPIComponent creates a new APIComponent with the given name, prefix,
// and summary. Use options to customize further.
func NewAPIComponent(name, prefix, summary string, opts ...ComponentOption) *APIComponent {
	c := &APIComponent{
		Name:      name,
		Prefix:    prefix,
		Summary:   summary,
		Metadata:  make(gin.H),
		Tags:      []string{name},
		Middleware: nil,
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// ComponentOption is a functional option for configuring an APIComponent.
type ComponentOption func(*APIComponent)

// WithDescription sets the component description.
func WithDescription(desc string) ComponentOption {
	return func(c *APIComponent) { c.Description = desc }
}

// WithVersion sets the API version.
func WithVersion(version string) ComponentOption {
	return func(c *APIComponent) { c.Version = version }
}

// WithTags sets the OpenAPI tags.
func WithTags(tags []string) ComponentOption {
	return func(c *APIComponent) { c.Tags = tags }
}

// WithMetadata sets arbitrary metadata.
func WithMetadata(metadata gin.H) ComponentOption {
	return func(c *APIComponent) { c.Metadata = metadata }
}

// WithMiddleware adds middleware to the component-level chain.
func WithMiddleware(mw ...MiddlewareFunc) ComponentOption {
	return func(c *APIComponent) {
		c.Middleware = append(c.Middleware, mw...)
	}
}

// IsRegistered reports whether the component has been registered in a registry.
func (c *APIComponent) IsRegistered() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.registered
}

// SetRegistered marks the component as registered.
func (c *APIComponent) SetRegistered(b bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.registered = b
}

// AddRoute adds a route definition to the component. It validates the route
// and returns an error if the route is misconfigured.
func (c *APIComponent) AddRoute(route RouteComponent) error {
	if err := route.Validate(); err != nil {
		return err
	}
	if route.HasDuplicateMethods() {
		return &ConfigError{Field: "Methods", Reason: "duplicate HTTP method detected"}
	}
	// Normalize path: ensure leading slash
	route.Path = ensureLeadingSlash(route.Path)
	c.Routes = append(c.Routes, route)
	return nil
}

// FullPath returns the full URL path for a route given its relative path.
func (c *APIComponent) FullPath(routePath string) string {
	return normalizePath(c.Prefix, routePath)
}

// NumRoutes returns the number of routes in this component.
func (c *APIComponent) NumRoutes() int {
	return len(c.Routes)
}

// RoutesInfo returns a snapshot of the component's route paths for introspection.
func (c *APIComponent) RoutesInfo() []RouteInfo {
	info := make([]RouteInfo, 0, len(c.Routes))
	for _, r := range c.Routes {
		info = append(info, RouteInfo{
			Methods: r.Methods,
			Path:    c.FullPath(r.Path),
			Summary: r.Summary,
		})
	}
	return info
}

// RouteInfo is a lightweight view of a route for introspection and documentation.
type RouteInfo struct {
	Methods []HTTPMethod
	Path    string
	Summary string
}

// ---------------------------------------------------------------------------
// Path Helpers
// ---------------------------------------------------------------------------

// ensureLeadingSlash ensures a path starts with a slash.
func ensureLeadingSlash(path string) string {
	if path == "" {
		return "/"
	}
	if !strings.HasPrefix(path, "/") {
		return "/" + path
	}
	return path
}

// normalizePath joins a base path and a sub path, collapsing double slashes.
func normalizePath(base, sub string) string {
	// Remove trailing slash from base (except for root "/")
	base = strings.TrimRight(base, "/")
	// Ensure sub starts with "/"
	if sub != "" && !strings.HasPrefix(sub, "/") {
		sub = "/" + sub
	}
	result := base + sub
	// Collapse multiple slashes into one (but preserve param patterns like /:id/)
	result = strings.ReplaceAll(result, "//", "/")
	return result
}

// ---------------------------------------------------------------------------
// Response Helpers
// ---------------------------------------------------------------------------

// ResponseEnvelope is the standard JSON response envelope used by the
// component system. Handlers that use these helpers should follow this format.
type ResponseEnvelope struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   *ErrorBody  `json:"error,omitempty"`
}

// ErrorBody is the structured error body sent in error responses.
type ErrorBody struct {
	Code       string            `json:"code"`
	Message    string            `json:"message"`
	Details    map[string]string `json:"details,omitempty"`
	StatusCode int               `json:"status_code"`
}

// WriteSuccess writes a success response using the ResponseEnvelope format.
func WriteSuccess(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, ResponseEnvelope{
		Success: true,
		Data:    data,
	})
}

// WriteSuccessWithMessage writes a success response with an optional message.
func WriteSuccessWithMessage(c *gin.Context, message string, data interface{}) {
	c.JSON(http.StatusOK, ResponseEnvelope{
		Success: true,
		Message: message,
		Data:    data,
	})
}

// WriteError writes an error response using the ResponseEnvelope format.
func WriteError(c *gin.Context, code string, message string, statusCode int, details ...map[string]string) {
	err := &ErrorBody{
		Code:       code,
		Message:    message,
		StatusCode: statusCode,
	}
	if len(details) > 0 {
		err.Details = details[0]
	}
	c.JSON(statusCode, ResponseEnvelope{
		Success: false,
		Error:   err,
	})
}

// WriteBadRequest writes a 400 Bad Request response.
func WriteBadRequest(c *gin.Context, message string) {
	WriteError(c, "bad_request", message, http.StatusBadRequest)
}

// WriteNotFound writes a 404 Not Found response.
func WriteNotFound(c *gin.Context, message string) {
	WriteError(c, "not_found", message, http.StatusNotFound)
}

// WriteUnauthorized writes a 401 Unauthorized response.
func WriteUnauthorized(c *gin.Context, message string) {
	WriteError(c, "unauthorized", message, http.StatusUnauthorized)
}

// WriteForbidden writes a 403 Forbidden response.
func WriteForbidden(c *gin.Context, message string) {
	WriteError(c, "forbidden", message, http.StatusForbidden)
}

// WriteConflict writes a 409 Conflict response.
func WriteConflict(c *gin.Context, message string) {
	WriteError(c, "conflict", message, http.StatusConflict)
}

// WriteInternalServerError writes a 500 Internal Server Error response.
func WriteInternalServerError(c *gin.Context, message string) {
	WriteError(c, "internal_error", message, http.StatusInternalServerError)
}

// WriteServiceUnavailable writes a 503 Service Unavailable response.
func WriteServiceUnavailable(c *gin.Context, message string) {
	WriteError(c, "service_unavailable", message, http.StatusServiceUnavailable)
}

// WriteNoContent writes a 204 No Content response.
func WriteNoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

// WriteCreated writes a 201 Created response.
func WriteCreated(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, ResponseEnvelope{
		Success: true,
		Data:    data,
	})
}
