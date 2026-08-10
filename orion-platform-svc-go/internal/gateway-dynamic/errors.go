package gatewaydynamic

import "errors"

// GatewayDynamicError represents domain errors for the gateway-dynamic module.
type GatewayDynamicError struct {
    Code    string
    Message string
    Cause   error
}

func (e *GatewayDynamicError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *GatewayDynamicError) Is(target error) bool {
    _, ok := target.(*GatewayDynamicError)
    return ok
}

func (e *GatewayDynamicError) Unwrap() error {
    return e.Cause
}

var (
    ErrGatewayDynamicNotFound     = &GatewayDynamicError{Code: "gatewaydynamic_not_found", Message: "gateway-dynamic: resource not found"}
    ErrGatewayDynamicInvalidInput = &GatewayDynamicError{Code: "gatewaydynamic_invalid_input", Message: "gateway-dynamic: invalid input"}
    ErrGatewayDynamicConflict     = &GatewayDynamicError{Code: "gatewaydynamic_conflict", Message: "gateway-dynamic: resource conflict"}
    ErrGatewayDynamicUnauthorized = &GatewayDynamicError{Code: "gatewaydynamic_unauthorized", Message: "gateway-dynamic: unauthorized access"}
    ErrGatewayDynamicInternal     = &GatewayDynamicError{Code: "gatewaydynamic_internal", Message: "gateway-dynamic: internal error"}
)

func NewGatewayDynamicError(code, message string) error {
    return &GatewayDynamicError{Code: code, Message: message}
}

func IsGatewayDynamicNotFound(err error) bool {
    return errors.Is(err, ErrGatewayDynamicNotFound)
}
