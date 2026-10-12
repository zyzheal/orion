// Package common provides shared infrastructure primitives for the
// Orion platform service. The errors subfile (this file) defines the
// unified OrionError envelope and the CLIENT/SERVER error code
// namespaces mandated by Y 手册 §S0-T1.
//
// Design intent:
//   - Namespaced codes: CLIENT.* for user-correctable issues (4xx),
//     SERVER.* for platform-internal failures (5xx).
//   - Envelope shape: { code, message, http_status, retryable, meta }.
//   - Zero-allocation fast path: well-known codes use static messages.
//   - HTTPStatus mapping is derived from the namespace prefix; callers
//     cannot accidentally emit a 200 with a CLIENT.* code.
//   - Sentinel values (e.g. ErrInspectionNotFound) are wired to the
//     CLIENT.INSPECTION_NOT_FOUND code for direct errors.Is matching.
//
// This file is S0-T1 of the upgrade-execution-playbook. The 20+ P0
// constants are the minimum set required by downstream stages (S1-S6).
package common

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
)

// Namespace constants — the CODE prefix that classifies an OrionError
// into a coarse namespace for routing / audit / i18n.
const (
	NamespaceClient = "CLIENT"
	NamespaceServer = "SERVER"
)

// Retryable flag: whether the caller may safely retry the same request
// without side effects. SERVER.* errors are retryable by default;
// CLIENT.* errors are not.
type OrionError struct {
	// Code is the stable, namespaced identifier (e.g. "CLIENT.TICKET_NOT_FOUND").
	Code string

	// Message is a human-readable, safe-to-expose description.
	Message string

	// HTTPStatus is the derived HTTP status. It is filled by NewClient/NewServer;
	// callers should not construct OrionError directly.
	HTTPStatus int

	// Retryable signals whether the request may be replayed.
	Retryable bool

	// Meta carries structured context for audit logging (request_id, tenant_id,
	// entity_type, entity_id, ...). It is NOT exposed to the API caller.
	Meta map[string]string

	// Cause is the underlying error, if any. errors.Is / errors.As unwrap this.
	Cause error
}

// Error implements the error interface.
func (e *OrionError) Error() string {
	if e == nil {
		return "<nil>"
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// Unwrap implements the errors.Wrapper interface.
func (e *OrionError) Unwrap() error { return e.Cause }

// Is implements the errors.Comparer interface. Two *OrionError values
// are considered equal iff their Code fields match. This allows a
// sentinel error (e.g. ErrInspectionNotFound) to be matched via
// errors.Is against any *OrionError with the same code, including
// wrapped instances produced by WrapClient / WrapServer.
func (e *OrionError) Is(target error) bool {
	if e == nil || e.Code == "" {
		return false
	}
	var t *OrionError
	if errors.As(target, &t) && t != nil {
		return e.Code == t.Code
	}
	return false
}

// IsClient reports whether the error belongs to the CLIENT namespace.
func (e *OrionError) IsClient() bool { return strings.HasPrefix(e.Code, NamespaceClient+".") }

// IsServer reports whether the error belongs to the SERVER namespace.
func (e *OrionError) IsServer() bool { return strings.HasPrefix(e.Code, NamespaceServer+".") }

// NewClient builds a CLIENT.* OrionError with the derived HTTP status.
func NewClient(code, message string) *OrionError {
	return &OrionError{
		Code:        code,
		Message:     message,
		HTTPStatus:  httpStatusForClient(code),
		Retryable:   false,
	}
}

// NewServer builds a SERVER.* OrionError with the derived HTTP status.
func NewServer(code, message string) *OrionError {
	return &OrionError{
		Code:       code,
		Message:    message,
		HTTPStatus: httpStatusForServer(code),
		Retryable:  true,
	}
}

// WrapClient wraps an underlying error into a CLIENT.* OrionError,
// preserving the cause for errors.Is / errors.As chains.
func WrapClient(code, message string, cause error) *OrionError {
	e := NewClient(code, message)
	e.Cause = cause
	e.Meta = map[string]string{"caused_by": cause.Error()}
	return e
}

// WrapServer wraps an underlying error into a SERVER.* OrionError.
func WrapServer(code, message string, cause error) *OrionError {
	e := NewServer(code, message)
	e.Cause = cause
	e.Meta = map[string]string{"caused_by": cause.Error()}
	return e
}

// WithMeta attaches metadata to an existing OrionError. Returns the
// same *OrionError for fluent call chains.
func (e *OrionError) WithMeta(meta map[string]string) *OrionError {
	if e.Meta == nil {
		e.Meta = meta
	} else {
		for k, v := range meta {
			e.Meta[k] = v
		}
	}
	return e
}

// CodeOf extracts the code from any error, returning "" if none.
func CodeOf(err error) string {
	if err == nil {
		return ""
	}
	var oe *OrionError
	if errors.As(err, &oe) {
		return oe.Code
	}
	return ""
}

// StatusOf extracts the HTTP status from any error, defaulting to 500
// for non-OrionError values (safer default than 200).
func StatusOf(err error) int {
	if err == nil {
		return http.StatusOK
	}
	var oe *OrionError
	if errors.As(err, &oe) {
		if oe.HTTPStatus == 0 {
			return http.StatusInternalServerError
		}
		return oe.HTTPStatus
	}
	// Unknown error — do not leak details, return 500.
	return http.StatusInternalServerError
}

// httpStatusForClient maps CLIENT.* codes to a specific HTTP 4xx.
// Defaults to 400 (Bad Request) for codes without an explicit mapping.
func httpStatusForClient(code string) int {
	if code == "" {
		return http.StatusBadRequest
	}
	switch code {
	case "CLIENT.UNAUTHORIZED", "CLIENT.AUTH_REQUIRED":
		return http.StatusUnauthorized
	case "CLIENT.FORBIDDEN", "CLIENT.PERMISSION_DENIED":
		return http.StatusForbidden
	case "CLIENT.NOT_FOUND":
		return http.StatusNotFound
	case "CLIENT.CONFLICT", "CLIENT.VERSION_CONFLICT",
		"CLIENT.CONFIGFILE_VERSION_CONFLICT", "CLIENT.ALREADY_EXISTS":
		return http.StatusConflict
	case "CLIENT.PRECONDITION_FAILED":
		return http.StatusPreconditionFailed
	case "CLIENT.VALIDATION_FAILED", "CLIENT.INVALID_ARGUMENT",
		"CLIENT.INSPECTION_THRESHOLD_INVALID", "CLIENT.RATE_LIMITED":
		return http.StatusBadRequest
	case "CLIENT.INSUFFICIENT_SCOPE", "CLIENT.SCOPE_DENIED":
		return http.StatusUnauthorized
	case "CLIENT.TENANT_MISMATCH":
		return http.StatusForbidden
	case "CLIENT.SLOW_QUERY":
		return http.StatusServiceUnavailable
	case "CLIENT.UNSUPPORTED_MEDIA_TYPE":
		return http.StatusUnsupportedMediaType
	default:
		return http.StatusBadRequest
	}
}

// httpStatusForServer maps SERVER.* codes to a specific HTTP 5xx.
// Defaults to 500 for unknown codes.
func httpStatusForServer(code string) int {
	if code == "" {
		return http.StatusInternalServerError
	}
	switch code {
	case "SERVER.DEPENDENCY_UNAVAILABLE",
		"SERVER.DB_UNAVAILABLE", "SERVER.NETWORK_UNREACHABLE":
		return http.StatusServiceUnavailable
	case "SERVER.TIMEOUT":
		return http.StatusGatewayTimeout
	case "SERVER.INTERNAL":
		return http.StatusInternalServerError
	case "SERVER.RATE_LIMITED", "SERVER.CIRCUIT_OPEN":
		return http.StatusTooManyRequests
	case "SERVER.NOT_IMPLEMENTED":
		return http.StatusNotImplemented
	default:
		return http.StatusInternalServerError
	}
}
