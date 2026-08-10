package tenantutil

type TenantutilError struct { Code string; Message string; Cause error }

func (e *TenantutilError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}
func (e *TenantutilError) Is(target error) bool { _, ok := target.(*TenantutilError); return ok }
func (e *TenantutilError) Unwrap() error { return e.Cause }

var (
    ErrTenantutilNotFound     = &TenantutilError{Code: "tenantutil_not_found", Message: "tenantutil: not found"}
    ErrTenantutilInvalidInput = &TenantutilError{Code: "tenantutil_invalid_input", Message: "tenantutil: invalid input"}
)
