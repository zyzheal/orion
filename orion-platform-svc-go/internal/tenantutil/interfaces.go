package tenantutil

type TenantutilRepository interface {
    FindByID(ctx interface{}, id string) (interface{}, error)
}

type TenantutilService interface {
    GetByTenantID(ctx interface{}, tenantID string) (interface{}, error)
}
