// Package errors provides standardised error codes, categories, and
// helper constructors for the Orion API Gateway.
//
// Error codes follow the XYYZZ scheme:
//   X    = system category (1=platform, 2=auth, 3=business, 4=external)
//   YY   = module number
//   ZZ   = specific error
package errors

import (
	"fmt"
	"time"
)

// Category classifies an error by system area.
type Category string

const (
	CategoryPlatform Category = "PLATFORM"
	CategoryAuth     Category = "AUTH"
	CategoryBusiness Category = "BUSINESS"
	CategoryExternal Category = "EXTERNAL"
	CategoryUnknown  Category = "UNKNOWN"
)

// Standard error codes.
const (
	// Platform (1YYZZ)
	CodeGatewayUnavailable    = "10101"
	CodeRouteNotFound         = "10102"
	CodeMethodNotAllowed      = "10103"
	CodeRateLimitExceeded     = "10201"
	CodeConfigInvalid         = "10301"
	CodeVersionRetired        = "10601"
	CodeVersionRequired       = "10602"
	CodeVersionError          = "10603"
	CodeVersionUnsupported    = "10604"

	// Auth (2YYZZ)
	CodeTokenExpired       = "20101"
	CodeTokenInvalid       = "20102"
	CodeTokenMissing       = "20103"
	CodeOAuthCallbackError = "20201"
	CodeOAuthStateInvalid  = "20202"
	CodeAPIKeyInvalid      = "20301"
	CodeAPIKeyExpired      = "20302"
	CodeSessionExpired     = "20401"
	CodeSessionInvalid     = "20402"
	CodePermissionDenied   = "20501"
	CodeRoleNotFound       = "20502"

	// Business (3YYZZ)
	CodeValidationError         = "30101"
	CodeRequiredFieldMissing    = "30102"
	CodeInvalidParameterFormat  = "30103"
	CodeParameterOutOfRange     = "30104"
	CodeResourceNotFound        = "30201"
	CodeResourceExists          = "30202"
	CodeResourceDeleted         = "30203"
	CodeResourceLocked          = "30204"
	CodeInvalidState            = "30301"
	CodeStateTransitionForbidden = "30302"
	CodeDataInconsistent        = "30401"
	CodeConstraintViolation     = "30402"
	CodeQuotaExceeded           = "30501"
	CodeBizRateLimitExceeded     = "30502"

	// External (4YYZZ)
	CodeHTTPRequestFailed       = "40101"
	CodeHTTPTimeout             = "40102"
	CodeHTTPStatusError         = "40103"
	CodeDatabaseError           = "40201"
	CodeDatabaseConnectionLost  = "40202"
	CodeDatabaseQueryTimeout    = "40203"
	CodeDatabaseConstraintViolation = "40204"
	CodeCacheError              = "40301"
	CodeCacheMiss               = "40302"
	CodeCacheConnectionLost     = "40303"
	CodeMQPublishFailed         = "40401"
	CodeMQConsumeFailed         = "40402"
	CodeMQConnectionLost        = "40403"
	CodeThirdPartyError         = "40501"
	CodeThirdPartyTimeout       = "40502"
	CodeThirdPartyRateLimit     = "40503"
)

// statusMap maps error codes to HTTP status codes.
var statusMap = map[string]int{
	CodeGatewayUnavailable:        503,
	CodeRouteNotFound:             404,
	CodeMethodNotAllowed:          405,
	CodeRateLimitExceeded:         429,
	CodeConfigInvalid:             500,
	CodeVersionRetired:            410,
	CodeVersionRequired:           400,
	CodeVersionError:              500,
	CodeVersionUnsupported:        400,
	CodeTokenExpired:              401,
	CodeTokenInvalid:              401,
	CodeTokenMissing:              401,
	CodeOAuthCallbackError:        400,
	CodeOAuthStateInvalid:         400,
	CodeAPIKeyInvalid:             401,
	CodeAPIKeyExpired:             401,
	CodeSessionExpired:            401,
	CodeSessionInvalid:            401,
	CodePermissionDenied:          403,
	CodeRoleNotFound:              404,
	CodeValidationError:           400,
	CodeRequiredFieldMissing:      400,
	CodeInvalidParameterFormat:    400,
	CodeParameterOutOfRange:       400,
	CodeResourceNotFound:          404,
	CodeResourceExists:            409,
	CodeResourceDeleted:           410,
	CodeResourceLocked:            423,
	CodeInvalidState:              400,
	CodeStateTransitionForbidden:  400,
	CodeDataInconsistent:          500,
	CodeConstraintViolation:      409,
	CodeQuotaExceeded:            429,
	CodeBizRateLimitExceeded:     429,
	CodeHTTPRequestFailed:        502,
	CodeHTTPTimeout:             504,
	CodeHTTPStatusError:         502,
	CodeDatabaseError:           500,
	CodeDatabaseConnectionLost:  503,
	CodeDatabaseQueryTimeout:    504,
	CodeDatabaseConstraintViolation: 409,
	CodeCacheError:              500,
	CodeCacheMiss:               404,
	CodeCacheConnectionLost:    503,
	CodeMQPublishFailed:        500,
	CodeMQConsumeFailed:        500,
	CodeMQConnectionLost:      503,
	CodeThirdPartyError:      502,
	CodeThirdPartyTimeout:    504,
	CodeThirdPartyRateLimit:  429,
}

// messageMap maps error codes to human-readable messages.
var messageMap = map[string]string{
	CodeGatewayUnavailable:           "Gateway service unavailable",
	CodeRouteNotFound:                "Route not found",
	CodeMethodNotAllowed:             "HTTP method not allowed",
	CodeRateLimitExceeded:            "Rate limit exceeded",
	CodeConfigInvalid:               "Invalid configuration",
	CodeVersionRetired:               "API version has been retired",
	CodeVersionRequired:              "API version is required",
	CodeVersionError:                 "Failed to process API version",
	CodeVersionUnsupported:           "Unsupported API version",
	CodeTokenExpired:                 "Token has expired",
	CodeTokenInvalid:                 "Token is invalid",
	CodeTokenMissing:                 "Token is missing",
	CodeOAuthCallbackError:           "OAuth callback error",
	CodeOAuthStateInvalid:            "OAuth state parameter invalid",
	CodeAPIKeyInvalid:               "API key is invalid",
	CodeAPIKeyExpired:               "API key has expired",
	CodeSessionExpired:              "Session has expired",
	CodeSessionInvalid:             "Session is invalid",
	CodePermissionDenied:           "Permission denied",
	CodeRoleNotFound:               "Role not found",
	CodeValidationError:            "Validation failed",
	CodeRequiredFieldMissing:       "Required field is missing",
	CodeInvalidParameterFormat:     "Invalid parameter format",
	CodeParameterOutOfRange:       "Parameter out of valid range",
	CodeResourceNotFound:           "Resource not found",
	CodeResourceExists:            "Resource already exists",
	CodeResourceDeleted:           "Resource has been deleted",
	CodeResourceLocked:            "Resource is locked",
	CodeInvalidState:              "Invalid resource state",
	CodeStateTransitionForbidden:  "State transition is forbidden",
	CodeDataInconsistent:          "Data inconsistency detected",
	CodeConstraintViolation:      "Constraint violation",
	CodeQuotaExceeded:            "Quota exceeded",
	CodeBizRateLimitExceeded:     "Rate limit exceeded",
	CodeHTTPRequestFailed:       "HTTP request failed",
	CodeHTTPTimeout:             "HTTP request timeout",
	CodeHTTPStatusError:        "Unexpected HTTP status code",
	CodeDatabaseError:          "Database operation failed",
	CodeDatabaseConnectionLost: "Database connection lost",
	CodeDatabaseQueryTimeout:   "Database query timeout",
	CodeDatabaseConstraintViolation: "Database constraint violation",
	CodeCacheError:              "Cache operation failed",
	CodeCacheMiss:               "Cache miss",
	CodeCacheConnectionLost:    "Cache connection lost",
	CodeMQPublishFailed:        "Failed to publish message",
	CodeMQConsumeFailed:        "Failed to consume message",
	CodeMQConnectionLost:       "Message queue connection lost",
	CodeThirdPartyError:       "Third-party service error",
	CodeThirdPartyTimeout:     "Third-party service timeout",
	CodeThirdPartyRateLimit:   "Third-party rate limit exceeded",
}

// AppError is the standard gateway error type.
type AppError struct {
	Code       string
	Message    string
	StatusCode int
	Details    interface{}
	Category   Category
	Timestamp  string
}

func (e *AppError) Error() string {
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// New creates an AppError from a code, looking up status and message.
func New(code string, details ...interface{}) *AppError {
	msg := messageMap[code]
	if msg == "" {
		msg = "Unknown error"
	}
	status := statusMap[code]
	if status == 0 {
		status = 500
	}
	return &AppError{
		Code:       code,
		Message:    msg,
		StatusCode: status,
		Details:    firstNonNil(details),
		Category:   parseCategory(code),
		Timestamp:  time.Now().UTC().Format(time.RFC3339),
	}
}

// NewWithMessage creates an AppError with a custom message.
func NewWithMessage(code, message string, details ...interface{}) *AppError {
	status := statusMap[code]
	if status == 0 {
		status = 500
	}
	return &AppError{
		Code:       code,
		Message:    message,
		StatusCode: status,
		Details:    firstNonNil(details),
		Category:   parseCategory(code),
		Timestamp:  time.Now().UTC().Format(time.RFC3339),
	}
}

func firstNonNil(args []interface{}) interface{} {
	if len(args) == 0 {
		return nil
	}
	return args[0]
}

func parseCategory(code string) Category {
	if len(code) == 0 {
		return CategoryUnknown
	}
	switch code[0] {
	case '1':
		return CategoryPlatform
	case '2':
		return CategoryAuth
	case '3':
		return CategoryBusiness
	case '4':
		return CategoryExternal
	default:
		return CategoryUnknown
	}
}

// HTTPStatusOf returns the HTTP status code for an error code.
func HTTPStatusOf(code string) int {
	if s, ok := statusMap[code]; ok {
		return s
	}
	return 500
}

// MessageOf returns the human-readable message for an error code.
func MessageOf(code string) string {
	if m, ok := messageMap[code]; ok {
		return m
	}
	return "Unknown error"
}

// --- Convenience constructors ---

func BadRequest(msg string, details ...interface{}) *AppError {
	e := New(CodeValidationError, details...)
	if msg != "" {
		e.Message = msg
	}
	return e
}

func NotFound(msg string, details ...interface{}) *AppError {
	e := New(CodeResourceNotFound, details...)
	if msg != "" {
		e.Message = msg
	}
	return e
}

func Unauthorized(msg string, details ...interface{}) *AppError {
	e := New(CodeTokenMissing, details...)
	if msg != "" {
		e.Message = msg
	}
	return e
}

func Forbidden(msg string, details ...interface{}) *AppError {
	e := New(CodePermissionDenied, details...)
	if msg != "" {
		e.Message = msg
	}
	return e
}

func Internal(msg string, details ...interface{}) *AppError {
	e := New(CodeConfigInvalid, details...)
	if msg != "" {
		e.Message = msg
	}
	return e
}
