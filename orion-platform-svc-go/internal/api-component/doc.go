// Package apicomponent provides a declarative, component-based API routing
// system for Orion Go microservices.
//
// Overview
// ========
// The API Component system replaces ad-hoc gin RouterGroup registration with
// a structured model that makes every API endpoint an explicit, discoverable,
// and self-documenting artifact.
//
// Core Concepts
// =============
//
//   1. APIComponent: A named group of related routes sharing a common prefix,
//      version, and middleware chain. Represents a logical API domain
//      (e.g., "feature-flag", "pipeline", "user").
//
//   2. RouteComponent: A single API endpoint definition, mapping HTTP method(s)
//      and path to a handler function, with optional per-route middleware and
//      metadata for OpenAPI documentation.
//
//   3. Registry: A thread-safe collection of APIComponents. Provides discovery,
//      lookup, and iteration capabilities. The Registry is the single source
//      of truth for all registered API endpoints.
//
//   4. RouterBuilder: Compiles a Registry into a Gin engine. Applies the full
//      middleware chain (global -> component -> route -> handler) and returns
//      a ready-to-serve *gin.Engine.
//
// Architecture
// ============
//
//	  ┌──────────────┐     ┌───────────────┐     ┌──────────────┐
//	  │  APIComponent│────▶│   Registry    │────▶│ RouterBuilder│
//	  │  (domain)    │     │  (collection)  │     │  (compiler)  │
//	  └──────────────┘     └───────────────┘     └──────┬───────┘
//	         │                                         │
//	     contains                                    builds
//	         │                                         │
//	         ▼                                         ▼
//	  ┌──────────────┐                        ┌──────────────┐
//	  │ RouteComponent│                        │  gin.Engine  │
//	  │  (endpoint)  │                        │  (server)    │
//	  └──────────────┘                        └──────────────┘
//
// Middleware Chain
// ================
//
//   Global middleware
//     └── Component middleware
//           └── Route middleware
//                 └── Handler
//
// Each layer is optional and applies to all routes at or below its level.
//
// Response Format
// ===============
//
//   All responses use a standard envelope:
//
//      {
//        "success": true,
//        "data": { ... }
//      }
//
//   Errors use a structured format:
//
//      {
//        "success": false,
//        "error": {
//          "code": "not_found",
//          "message": "resource not found",
//          "status_code": 404
//        }
//      }
//
// Usage Example
// =============
//
//      // Step 1: Create the registry
//      registry := apicomponent.NewRegistry()
//
//      // Step 2: Define a component with routes
//      featureFlag := apicomponent.NewAPIComponent(
//          "feature-flag", "/flags", "Feature Flag Management",
//          apicomponent.WithDescription("CRUD operations for feature flags"),
//          apicomponent.WithVersion("v1"),
//          apicomponent.WithMiddleware(apicomponent.RequestIDMiddleware()),
//      )
//
//      featureFlag.AddRoute(apicomponent.RouteComponent{
//          Methods: []apicomponent.HTTPMethod{apicomponent.MethodGet},
//          Path:    "/:id",
//          Handler: handler.GetFlag,
//          Summary: "Get a feature flag by ID",
//          Tags:    []string{"feature-flags", "read"},
//      })
//
//      featureFlag.AddRoute(apicomponent.RouteComponent{
//          Methods: []apicomponent.HTTPMethod{apicomponent.MethodPost},
//          Path:    "",
//          Handler: handler.CreateFlag,
//          Summary: "Create a new feature flag",
//          Middleware: apicomponent.MiddlewareChain{
//              apicomponent.ValidateContentType("application/json"),
//          },
//          Tags: []string{"feature-flags", "write"},
//      })
//
//      // Step 3: Register the component
//      registry.Register(featureFlag)
//
//      // Step 4: Build the router
//      engine := apicomponent.NewRouterBuilder(registry).
//          WithGlobalMiddleware(
//              gin.Recovery(),
//              apicomponent.ErrorHandlerMiddleware(),
//          ).
//          Build()
//
//      // Step 5: Serve
//      engine.Run(":3001")
//
// Migration from Legacy Routing
// =============================
//
// The existing handler.RegisterRoutes(*gin.RouterGroup) pattern continues to
// work. The component system is additive — use it for new modules or gradually
// migrate existing ones by wrapping RegisterRoutes in a component:
//
//      func wrapLegacyHandler(h interface {
//          RegisterRoutes(*gin.RouterGroup)
//      }) *apicomponent.APIComponent {
//          comp := apicomponent.NewAPIComponent("module", "/module", "Module API")
//          // Register routes manually or use the component pattern
//          comp.AddRoute(apicomponent.RouteComponent{
//              Methods: []apicomponent.HTTPMethod{apicomponent.MethodGet},
//              Path:    "",
//              Handler: h.List,
//          })
//          return comp
//      }

package apicomponent
