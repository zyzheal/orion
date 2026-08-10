package chaosgateway

import "errors"

// ChaosGatewayError represents domain errors for the chaos-gateway module.
type ChaosGatewayError struct {
    Code    string
    Message string
    Cause   error
}

func (e *ChaosGatewayError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *ChaosGatewayError) Is(target error) bool {
    _, ok := target.(*ChaosGatewayError)
    return ok
}

func (e *ChaosGatewayError) Unwrap() error {
    return e.Cause
}

var (
    ErrChaosGatewayNotFound     = &ChaosGatewayError{Code: "chaosgateway_not_found", Message: "chaos-gateway: resource not found"}
    ErrChaosGatewayInvalidInput = &ChaosGatewayError{Code: "chaosgateway_invalid_input", Message: "chaos-gateway: invalid input"}
    ErrChaosGatewayConflict     = &ChaosGatewayError{Code: "chaosgateway_conflict", Message: "chaos-gateway: resource conflict"}
    ErrChaosGatewayUnauthorized = &ChaosGatewayError{Code: "chaosgateway_unauthorized", Message: "chaos-gateway: unauthorized access"}
    ErrChaosGatewayInternal     = &ChaosGatewayError{Code: "chaosgateway_internal", Message: "chaos-gateway: internal error"}
)

func NewChaosGatewayError(code, message string) error {
    return &ChaosGatewayError{Code: code, Message: message}
}

func IsChaosGatewayNotFound(err error) bool {
    return errors.Is(err, ErrChaosGatewayNotFound)
}
