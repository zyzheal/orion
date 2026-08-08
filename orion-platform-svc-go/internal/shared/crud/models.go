// Package crud provides shared CRUD boilerplate for Orion Go microservice modules.
// It extracts common Record/CreateRequest/ListQuery models, RepositoryInterface,
// ServiceInterface, and handler methods so that domain-specific modules only
// maintain their business-logic endpoints.

package crud

import "time"

// Record is the canonical CRUD model shared by multiple Orion modules.
type Record struct {
	ID        string    `json:"id" db:"id"`
	TenantID  string    `json:"tenantId" db:"tenant_id"`
	Name      string    `json:"name" db:"name"`
	Status    string    `json:"status" db:"status"`
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
}

// ListQuery is the canonical list/filter query shared by multiple Orion modules.
type ListQuery struct {
	Page   int    `json:"page" query:"page"`
	Limit  int    `json:"limit" query:"limit"`
	Status string `json:"status" query:"status"`
}

// CreateRequest is the canonical create request shared by multiple Orion modules.
type CreateRequest struct {
	Name   string                 `json:"name" binding:"required"`
	Status string                 `json:"status"`
	Config map[string]interface{} `json:"config"`
}
