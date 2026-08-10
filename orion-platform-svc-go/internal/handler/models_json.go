package handler

type HandlerMetadata struct {
    Name      string `json:"name"`
    TenantID  string `json:"tenant_id"`
    HandlerType string `json:"handler_type"`
}
