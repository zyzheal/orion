package common

import "errors"

// =============================================================================
// CLIENT.* error code constants (P0 set, Y 手册 §S0-T1)
// =============================================================================
//
// Each constant is a stable string identifier. Downstream code matches on
// these via errors.Is(sentinelErr, code) or CodeOf(err) == code. The
// associated sentinel errors below are wired to the same code via the
// helper functions.

// --- Generic client errors ---
const (
	CodeUnauthorized     = "CLIENT.UNAUTHORIZED"
	CodeForbidden        = "CLIENT.FORBIDDEN"
	CodeNotFound         = "CLIENT.NOT_FOUND"
	CodeConflict         = "CLIENT.CONFLICT"
	CodePreconditionFail = "CLIENT.PRECONDITION_FAILED"
	CodeValidationFail   = "CLIENT.VALIDATION_FAILED"
	CodeInvalidArg       = "CLIENT.INVALID_ARGUMENT"
	CodeTooManyRequests  = "CLIENT.RATE_LIMITED"
	CodeTenantMismatch   = "CLIENT.TENANT_MISMATCH"
)

// --- Inspection family (S2) ---
const (
	CodeInspectionNotFound      = "CLIENT.INSPECTION_NOT_FOUND"
	CodeInspectionThresholdInv  = "CLIENT.INSPECTION_THRESHOLD_INVALID"
	CodeInspectionConfigFileMissing = "CLIENT.INSPECTION_CONFIGFILE_MISSING"
)

// --- Chaos family (S2) ---
const (
	CodeChaosInjectorUnavailable = "CLIENT.CHAOSS.InjectorUnavailable"
	CodeChaosExperimentInvalid   = "CLIENT.CHAOSS.ExperimentInvalid"
)

// --- Risk / Scenario family (S2) ---
const (
	CodeRiskApprovalRequired   = "CLIENT.RISK_APPROVAL_REQUIRED"
	CodeScenarioNotFound       = "CLIENT.SCENARIO_NOT_FOUND"
	CodeScenarioInactive       = "CLIENT.SCENARIO_INACTIVE"
)

// --- Configfile family (S2) ---
const (
	CodeConfigFileVersionConflict = "CLIENT.CONFIGFILE_VERSION_CONFLICT"
	CodeConfigFileNotFound        = "CLIENT.CONFIGFILE_NOT_FOUND"
)

// --- Ticket / ITSM family ---
const (
	CodeTicketNotFound        = "CLIENT.TICKET_NOT_FOUND"
	CodeTicketInvalidState    = "CLIENT.TICKET_INVALID_STATE"
	CodeChangeTemplateMissing = "CLIENT.CHANGE_TEMPLATE_MISSING"
)

// --- Alert family ---
const (
	CodeAlertNotFound     = "CLIENT.ALERT_NOT_FOUND"
	CodeAlertBreakerOpen  = "CLIENT.ALERT_BREAKER_OPEN"
	CodeAlertDedupBlocked = "CLIENT.ALERT_DEDUP_BLOCKED"
)

// --- Auth / Permission family ---
const (
	CodeAuthRequired       = "CLIENT.AUTH_REQUIRED"
	CodePermissionDenied   = "CLIENT.PERMISSION_DENIED"
	CodeInsufficientScope  = "CLIENT.INSUFFICIENT_SCOPE"
	CodeScopeDenied        = "CLIENT.SCOPE_DENIED"
)

// --- Slow query / DoS guard ---
const (
	CodeSlowQuery  = "CLIENT.SLOW_QUERY"
	CodePayloadTooLarge = "CLIENT.PAYLOAD_TOO_LARGE"
	CodeUnsupportedMediaType = "CLIENT.UNSUPPORTED_MEDIA_TYPE"
)

// --- Existence ---
const (
	CodeAlreadyExists = "CLIENT.ALREADY_EXISTS"
	CodeVersionConflict = "CLIENT.VERSION_CONFLICT"
)

// =============================================================================
// SERVER.* error code constants
// =============================================================================

const (
	CodeInternal     = "SERVER.INTERNAL"
	CodeDBUnavail    = "SERVER.DB_UNAVAILABLE"
	CodeDepUnavail   = "SERVER.DEPENDENCY_UNAVAILABLE"
	CodeNetworkUnreach = "SERVER.NETWORK_UNREACHABLE"
	CodeTimeout      = "SERVER.TIMEOUT"
	CodeCircuitOpen  = "SERVER.CIRCUIT_OPEN"
	CodeRateLimited  = "SERVER.RATE_LIMITED"
	CodeNotImplemented = "SERVER.NOT_IMPLEMENTED"
)

// =============================================================================
// Sentinel errors (P0 set) — used with errors.Is matching
// =============================================================================
//
// These are the 20+ P0 sentinel values required by S0-T1. Domain code
// returns these directly from service/repository layers; handlers call
// StatusOf / CodeOf to render.

// --- Generic ---
var (
	ErrUnauthorized     = NewClient(CodeUnauthorized, "authentication required")
	ErrForbidden        = NewClient(CodeForbidden, "permission denied")
	ErrNotFound         = NewClient(CodeNotFound, "resource not found")
	ErrConflict         = NewClient(CodeConflict, "resource conflict")
	ErrValidationFailed = NewClient(CodeValidationFail, "validation failed")
	ErrInvalidArgument  = NewClient(CodeInvalidArg, "invalid argument")
	ErrRateLimited      = NewClient(CodeTooManyRequests, "rate limit exceeded")
	ErrTenantMismatch   = NewClient(CodeTenantMismatch, "tenant mismatch")
)

// --- Inspection ---
var (
	ErrInspectionNotFound     = NewClient(CodeInspectionNotFound, "inspection not found")
	ErrInspectionThresholdInvalid = NewClient(CodeInspectionThresholdInv, "invalid inspection threshold")
	ErrInspectionConfigFileMissing = NewClient(CodeInspectionConfigFileMissing, "inspection config file missing")
)

// --- Chaos ---
var (
	ErrChaosInjectorUnavailable = NewClient(CodeChaosInjectorUnavailable, "chaos injector unavailable")
	ErrChaosExperimentInvalid   = NewClient(CodeChaosExperimentInvalid, "chaos experiment invalid")
)

// --- Risk / Scenario ---
var (
	ErrRiskApprovalRequired = NewClient(CodeRiskApprovalRequired, "risk approval required before execution")
	ErrScenarioNotFound     = NewClient(CodeScenarioNotFound, "scenario not found")
	ErrScenarioInactive     = NewClient(CodeScenarioInactive, "scenario is inactive")
)

// --- Configfile ---
var (
	ErrConfigFileVersionConflict = NewClient(CodeConfigFileVersionConflict, "configfile version conflict")
	ErrConfigFileNotFound        = NewClient(CodeConfigFileNotFound, "configfile not found")
)

// --- Ticket ---
var (
	ErrTicketNotFound        = NewClient(CodeTicketNotFound, "ticket not found")
	ErrTicketInvalidState    = NewClient(CodeTicketInvalidState, "ticket in invalid state")
	ErrChangeTemplateMissing = NewClient(CodeChangeTemplateMissing, "change template missing")
)

// --- Alert ---
var (
	ErrAlertNotFound     = NewClient(CodeAlertNotFound, "alert not found")
	ErrAlertBreakerOpen  = NewClient(CodeAlertBreakerOpen, "alert breaker is open")
	ErrAlertDedupBlocked = NewClient(CodeAlertDedupBlocked, "alert blocked by dedup")
)

// --- Auth / Permission ---
var (
	ErrAuthRequired       = NewClient(CodeAuthRequired, "authentication required")
	ErrPermissionDenied   = NewClient(CodePermissionDenied, "permission denied")
	ErrInsufficientScope  = NewClient(CodeInsufficientScope, "insufficient scope")
	ErrScopeDenied        = NewClient(CodeScopeDenied, "scope denied")
)

// --- DoS guard ---
var (
	ErrSlowQuery  = NewClient(CodeSlowQuery, "query too slow")
	ErrPayloadTooLarge = NewClient(CodePayloadTooLarge, "payload too large")
	ErrUnsupportedMediaType = NewClient(CodeUnsupportedMediaType, "unsupported media type")
)

// --- Existence ---
var (
	ErrAlreadyExists = NewClient(CodeAlreadyExists, "resource already exists")
	ErrVersionConflict = NewClient(CodeVersionConflict, "version conflict")
)

// --- SERVER.* ---
var (
	ErrInternal       = NewServer(CodeInternal, "internal error")
	ErrDBUnavailable  = NewServer(CodeDBUnavail, "database unavailable")
	ErrDependencyUnavail = NewServer(CodeDepUnavail, "dependency unavailable")
	ErrTimeout        = NewServer(CodeTimeout, "operation timeout")
	ErrCircuitOpen    = NewServer(CodeCircuitOpen, "circuit breaker open")
	ErrNotImplemented = NewServer(CodeNotImplemented, "operation not implemented")
)

// IsNotImplemented is a small helper that returns true if err is
// a wrapped ErrNotImplemented. Errors.Is already covers this; this
// exists for legacy grep patterns.
func IsNotImplemented(err error) bool { return errors.Is(err, ErrNotImplemented) }
