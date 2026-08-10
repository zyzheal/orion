package tenantutil

import "fmt"

type TenantutilValidator struct { MaxTenantIDLength int }

func DefaultTenantutilValidator() *TenantutilValidator { return &TenantutilValidator{MaxTenantIDLength: 64} }

func (v *TenantutilValidator) ValidateTenantID(tenantID string) error {
    if tenantID == "" { return ErrTenantutilInvalidInput }
    if len(tenantID) > v.MaxTenantIDLength { return fmt.Errorf("tenantutil: tenant_id too long") }
    return nil
}
