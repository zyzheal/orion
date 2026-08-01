// Package handler provides generic Gin handler middleware and wrapper
// functions that eliminate per-method boilerplate (OTel span, tenantID,
// error-checking, response-wrapping) across all Orion handler packages.
//
// Before (797-line artifact-version pattern):
//
//	func (h *Handler) GetXXX(c *gin.Context) {
//	    ctx, span := otel.Tracer("svc").Start(c.Request.Context(), "GetXXX")
//	    defer span.End()
//	    tenantID := c.GetString("tenant_id")
//	    data, err := h.svc.GetXXX(ctx, tenantID, c.Param("id"))
//	    if err != nil { errors.WriteError(c, ...); return }
//	    errors.WriteSuccess(c, gin.H{"data": data, "total": len(data)})
//	}
//
// After (single line via WithSpan/WithTenant):
//
//	r.GET("/:id/stats", auth.RequirePermission("res", "read"),
//	    WithSpan("GetStats", WithJSON(h.svc.GetStats)))
//
// Each middleware is composable:
//
//	WithTenant(WithJSON(h.svc.List, "total"))
package handler

import (
	"net/http"
	"strconv"

	"orion/go-common/pkg/errors"
	"orion/go-common/pkg/otel"

	"github.com/gin-gonic/gin"
)

// ---------------------------------------------------------------------------
// spanMiddleware — wraps a gin.HandlerFunc with an OTel span.
// ---------------------------------------------------------------------------

// WithSpan wraps the next handler inside an OTel span named operationName
// traced by the named tracer. The span inherits the request context.
func WithSpan(tracerName, operationName string, next gin.HandlerFunc) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, span := otel.Tracer(tracerName).Start(c.Request.Context(), operationName)
		defer span.End()
		next(c)
	}
}

// ---------------------------------------------------------------------------
// tenantMiddleware — extracts tenant_id from context and passes to service.
// ---------------------------------------------------------------------------

// TenantFunc extracts tenantID from the gin context (set by auth middleware).
func TenantFunc(c *gin.Context) string {
	return c.GetString("tenant_id")
}

// ---------------------------------------------------------------------------
// Response helpers — typed wrappers over errors.Write*
// ---------------------------------------------------------------------------

// WriteOK writes a 200 success with the given data.
func WriteOK(c *gin.Context, data any) {
	errors.WriteSuccess(c, data)
}

// WriteOKWithTotal writes a 200 success wrapping data with a "total" count.
func WriteOKWithTotal(c *gin.Context, data any, total int) {
	errors.WriteSuccess(c, gin.H{"data": data, "total": total})
}

// WriteCreated writes a 201 created response.
func WriteCreated(c *gin.Context, data any) {
	errors.WriteCreated(c, data)
}

// WriteNoContent writes a 204 no-content response.
func WriteNoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

// WriteBadRequest writes a 400 response.
func WriteBadRequest(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrBadRequest, message, http.StatusBadRequest)
}

// WriteNotFound writes a 404 response.
func WriteNotFound(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrNotFound, message, http.StatusNotFound)
}

// WriteInternalError writes a 500 response.
func WriteInternalError(c *gin.Context, message string) {
	errors.WriteError(c, errors.ErrInternal, message, http.StatusInternalServerError)
}

// WriteError writes a custom error response.
func WriteError(c *gin.Context, code, message string, status int) {
	errors.WriteError(c, code, message, status)
}

// ---------------------------------------------------------------------------
// Service wrappers — convert service methods to gin.HandlerFunc.
// Each wrapper handles: span → tenant → call service → error check → response.
// ---------------------------------------------------------------------------

// ServiceFunc is the standard signature for a service method that takes
// (ctx, tenantID) and returns (result, error).
type ServiceFunc[T any] func(ctx *gin.Context, tenantID string) (T, error)

// ServiceFuncWithID is like ServiceFunc but also extracts an "id" path param.
type ServiceFuncWithID[T any] func(ctx *gin.Context, tenantID string, id string) (T, error)

// ServiceFuncWithParam is like ServiceFuncWithID but uses a custom param name.
type ServiceFuncWithParam[T any] func(ctx *gin.Context, tenantID string, paramName string) (T, error)

// ServiceAction is a service method that returns only an error (for delete, etc.).
type ServiceAction func(ctx *gin.Context, tenantID string) error

// ServiceActionWithID is like ServiceAction with an "id" param.
type ServiceActionWithID func(ctx *gin.Context, tenantID string, id string) error

// WriteFunc is a response writer that receives the gin context and result.
type WriteFunc func(c *gin.Context, data any)

// defaultWriteOK is the standard response writer: data-only envelope.
func defaultWriteOK[T any](c *gin.Context, data T) {
	WriteOK(c, data)
}

// defaultWriteOKWithTotal wraps data with total.
func defaultWriteOKWithTotal[T any](c *gin.Context, data T) {
	WriteOK(c, data)
}

// ---------------------------------------------------------------------------
// GetHandler — handles GET request: service(ctx, tenant) → result → response.
//
// Usage:
//   r.GET("", auth.RequirePermission("res","read"),
//     GetHandler("tracer", "List", WithJSON(h.svc.List), WriteTotal))
// ---------------------------------------------------------------------------

type HandlerOption[T any] func(*handlerOpts[T])

type handlerOpts[T any] struct {
	writeFn WriteFunc
}

func WithWriteFn[T any](wf WriteFunc) HandlerOption[T] {
	return func(o *handlerOpts[T]) {
		o.writeFn = wf
	}
}

// GetHandler creates a gin.HandlerFunc for a simple GET endpoint.
// serviceFunc receives (ctx, tenantID) and returns (T, error).
func GetHandler[T any](
	tracerName, opName string,
	serviceFunc func(ctx *gin.Context, tenantID string) (T, error),
	opts ...HandlerOption[T],
) gin.HandlerFunc {
	o := &handlerOpts[T]{writeFn: func(c *gin.Context, data any) { WriteOK(c, data) }}
	for _, opt := range opts {
		opt(o)
	}
	return func(c *gin.Context) {
		_, span := otel.Tracer(tracerName).Start(c.Request.Context(), opName)
		defer span.End()
		tenantID := TenantFunc(c)
		result, err := serviceFunc(c, tenantID)
		if err != nil {
			WriteInternalError(c, err.Error())
			return
		}
		o.writeFn(c, result)
	}
}

// GetHandlerByID creates a gin.HandlerFunc that also extracts an "id" path param.
func GetHandlerByID[T any](
	tracerName, opName string,
	serviceFunc func(ctx *gin.Context, tenantID string, id string) (T, error),
	opts ...HandlerOption[T],
) gin.HandlerFunc {
	o := &handlerOpts[T]{writeFn: func(c *gin.Context, data any) { WriteOK(c, data) }}
	for _, opt := range opts {
		opt(o)
	}
	return func(c *gin.Context) {
		_, span := otel.Tracer(tracerName).Start(c.Request.Context(), opName)
		defer span.End()
		tenantID := TenantFunc(c)
		result, err := serviceFunc(c, tenantID, c.Param("id"))
		if err != nil {
			WriteInternalError(c, err.Error())
			return
		}
		o.writeFn(c, result)
	}
}

// DeleteHandler creates a gin.HandlerFunc for a DELETE endpoint.
func DeleteHandler(
	tracerName, opName string,
	actionFunc func(ctx *gin.Context, tenantID string, id string) error,
) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, span := otel.Tracer(tracerName).Start(c.Request.Context(), opName)
		defer span.End()
		tenantID := TenantFunc(c)
		if err := actionFunc(c, tenantID, c.Param("id")); err != nil {
			WriteInternalError(c, err.Error())
			return
		}
		WriteNoContent(c)
	}
}

// PostHandler creates a gin.HandlerFunc for a POST endpoint with JSON body.
func PostHandler[TReq any, TRes any](
	tracerName, opName string,
	handlerFunc func(ctx *gin.Context, tenantID string, req *TReq) (TRes, error),
) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, span := otel.Tracer(tracerName).Start(c.Request.Context(), opName)
		defer span.End()
		var req TReq
		if err := c.ShouldBindJSON(&req); err != nil {
			WriteBadRequest(c, "invalid request body: "+err.Error())
			return
		}
		tenantID := TenantFunc(c)
		result, err := handlerFunc(c, tenantID, &req)
		if err != nil {
			WriteInternalError(c, err.Error())
			return
		}
		WriteCreated(c, result)
	}
}

// PutHandler creates a gin.HandlerFunc for a PUT endpoint with JSON body and "id" param.
func PutHandler[TReq any, TRes any](
	tracerName, opName string,
	handlerFunc func(ctx *gin.Context, tenantID string, id string, req *TReq) (TRes, error),
) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, span := otel.Tracer(tracerName).Start(c.Request.Context(), opName)
		defer span.End()
		var req TReq
		if err := c.ShouldBindJSON(&req); err != nil {
			WriteBadRequest(c, "invalid request body: "+err.Error())
			return
		}
		tenantID := TenantFunc(c)
		result, err := handlerFunc(c, tenantID, c.Param("id"), &req)
		if err != nil {
			WriteInternalError(c, err.Error())
			return
		}
		WriteOK(c, result)
	}
}

// ---------------------------------------------------------------------------
// Param extractor helpers
// ---------------------------------------------------------------------------

// WithQueryInt extracts a query param as int with a default.
func WithQueryInt(c *gin.Context, name string, defaultValue int) int {
	v := c.DefaultQuery(name, "")
	if v == "" {
		return defaultValue
	}
	n, _ := strconv.Atoi(v)
	return n
}

// WithQueryParam extracts a query param as string.
func WithQueryParam(c *gin.Context, name string) string {
	return c.Query(name)
}

// WithQueryList extracts a comma-separated query param as string slice.
func WithQueryList(c *gin.Context, name string) []string {
	v := c.Query(name)
	if v == "" {
		return nil
	}
	var out []string
	for _, s := range splitComma(v) {
		out = append(out, s)
	}
	return out
}

func splitComma(s string) []string {
	var out []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == ',' {
			if i > start {
				out = append(out, s[start:i])
			}
			start = i + 1
		}
	}
	if start < len(s) {
		out = append(out, s[start:])
	}
	return out
}
