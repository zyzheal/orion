package tenantgateway

import "errors"

type TenantGatewayError struct { Code string; Message string; Cause error }

func (e *TenantGatewayError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *TenantGatewayError) Is(target error) bool { _, ok := target.(*TenantGatewayError); return ok }
func (e *TenantGatewayError) Unwrap() error { return e.Cause }

var (
    ErrTenantGatewayNotFound     = &TenantGatewayError{Code: "tenantgateway_not_found", Message: "tenant-gateway: not found"}
    ErrTenantGatewayInvalidInput = &TenantGatewayError{Code: "tenantgateway_invalid_input", Message: "tenant-gateway: invalid input"}
    ErrTenantGatewayConflict     = &TenantGatewayError{Code: "tenantgateway_conflict", Message: "tenant-gateway: conflict"}
    ErrTenantGatewayUnauthorized = &TenantGatewayError{Code: "tenantgateway_unauthorized", Message: "tenant-gateway: unauthorized"}
    ErrTenantGatewayInternal     = &TenantGatewayError{Code: "tenantgateway_internal", Message: "tenant-gateway: internal error"}
)

func NewTenantGatewayError(code, msg string) error { return &TenantGatewayError{Code: code, Message: msg} }
func IsTenantGatewayNotFound(err error) bool { return errors.Is(err, ErrTenantGatewayNotFound) }
