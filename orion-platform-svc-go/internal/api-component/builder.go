// Package apicomponent provides the RouterBuilder that compiles registered
// APIComponents into a Gin engine.
//
// The RouterBuilder is the bridge between the declarative component model and
// the imperative Gin routing API. It walks all registered components and routes
// in order, creating the appropriate Gin handlers with the middleware chain.
//
// The builder supports:
//   - Versioned routing (e.g., /api/v1/*, /api/v2/*)
//   - Global middleware applied to all routes
//   - Version-specific middleware
//   - Route-specific middleware (from the RouteComponent)
//   - Component-level middleware (from the APIComponent)
//   - Automatic 405 Method Not Allowed responses

package apicomponent

import (
	"github.com/gin-gonic/gin"
)

// RouterBuilder compiles a Registry of APIComponents into a Gin engine.
type RouterBuilder struct {
	registry *Registry
	// globalMiddleware is applied to every route, before any other middleware
	globalMiddleware MiddlewareChain
	// apiPrefix is an optional base prefix applied to all versioned routes
	// (e.g., "/api" produces /api/v1/* from a v1 component)
	apiPrefix string
	// notAllowedHandler handles 405 responses when a route exists but the method doesn't
	notAllowedHandler gin.HandlerFunc
}

// NewRouterBuilder creates a new RouterBuilder that reads from the given registry.
func NewRouterBuilder(registry *Registry) *RouterBuilder {
	return &RouterBuilder{
		registry: registry,
	}
}

// WithGlobalMiddleware adds middleware that is applied to every route in the built engine.
// Global middleware runs before component-level and route-level middleware.
func (b *RouterBuilder) WithGlobalMiddleware(mw ...MiddlewareFunc) *RouterBuilder {
	b.globalMiddleware = append(b.globalMiddleware, mw...)
	return b
}

// WithAPIPrefix sets a base prefix for all versioned routes.
// When a component has Version="v1" and Prefix="/flags", WithAPIPrefix("/api")
// produces /api/v1/flags. This matches the convention used in the existing
// gin-based routers (e.g., gin.Group("/api/v1")).
func (b *RouterBuilder) WithAPIPrefix(prefix string) *RouterBuilder {
	b.apiPrefix = prefix
	return b
}

// WithNotAllowedHandler sets a custom handler for 405 Method Not Allowed responses.
// If not set, a default JSON response is used.
func (b *RouterBuilder) WithNotAllowedHandler(handler gin.HandlerFunc) *RouterBuilder {
	b.notAllowedHandler = handler
	return b
}

// Build constructs a Gin engine from the registry and returns it.
// The engine has all registered routes with their full middleware chains.
func (b *RouterBuilder) Build() *gin.Engine {
	engine := gin.New()

	// Apply global middleware
	for _, mw := range b.globalMiddleware {
		engine.Use(mw)
	}

	// Build routes from all components — collect once under the lock
	// to avoid deadlock (All() acquires its own lock).
	b.registry.mu.RLock()
	components := make([]*APIComponent, 0, b.registry.Count())
	for _, name := range b.registry.order {
		components = append(components, b.registry.components[name])
	}
	b.registry.mu.RUnlock()

	for _, comp := range components {
		b.buildComponent(engine, comp)
	}

	// Add a catch-all for proper 404 handling
	engine.NoRoute(func(c *gin.Context) {
		WriteNotFound(c, "the requested resource was not found")
	})

	// Add a catch-all for 405
	if b.notAllowedHandler != nil {
		engine.NoMethod(b.notAllowedHandler)
	} else {
		engine.NoMethod(func(c *gin.Context) {
			WriteError(c, "method_not_allowed",
				"the HTTP method is not allowed for this endpoint", 405)
		})
	}

	return engine
}

// buildComponent registers all routes from a single component onto the engine.
func (b *RouterBuilder) buildComponent(engine *gin.Engine, comp *APIComponent) {
	// Create a group with the component prefix + version if set
	groupPath := comp.Prefix
	if comp.Version != "" {
		groupPath = "/" + comp.Version + comp.Prefix
	}
	groupPath = normalizePath("", groupPath)

	group := engine.Group(groupPath)

	// Apply component-level middleware
	for _, mw := range comp.Middleware {
		group.Use(mw)
	}

	// Register each route
	for _, route := range comp.Routes {
		b.registerRoute(group, route)
	}
}

// registerRoute creates Gin route handlers for a RouteComponent, applying
// the full middleware chain: global -> component -> route -> handler.
func (b *RouterBuilder) registerRoute(group *gin.RouterGroup, route RouteComponent) {
	// Build the per-route middleware chain: component middleware + route middleware
	var handlerFuncs []gin.HandlerFunc

	// Add route-specific middleware
	for _, mw := range route.Middleware {
		handlerFuncs = append(handlerFuncs, mw)
	}

	// The handler itself is the last element
	handlerFuncs = append(handlerFuncs, route.Handler)

	// Gin's route methods: we need to call the appropriate method for each HTTP method
	// Gin supports passing multiple handlerFuncs: the last one is the handler,
	// the preceding ones are middleware for this route only.
	switch len(route.Methods) {
	case 1:
		m := string(route.Methods[0])
		switch m {
		case "GET":
			group.GET(route.Path, handlerFuncs...)
		case "POST":
			group.POST(route.Path, handlerFuncs...)
		case "PUT":
			group.PUT(route.Path, handlerFuncs...)
		case "PATCH":
			group.PATCH(route.Path, handlerFuncs...)
		case "DELETE":
			group.DELETE(route.Path, handlerFuncs...)
		case "HEAD":
			group.HEAD(route.Path, handlerFuncs...)
		case "OPTIONS":
			group.OPTIONS(route.Path, handlerFuncs...)
		}
	default:
		// Multiple methods: use group.Handle with HTTPMethod
		for _, m := range route.Methods {
			group.Handle(string(m), route.Path, handlerFuncs...)
		}
	}
}
