package models

import (
	"time"
)

// Contract represents an API contract.
type Contract struct {
	ID          string     `json:"id" db:"id"`
	TenantID    string     `json:"tenantId" db:"tenant_id"`
	Name        string     `json:"name" db:"name"`
	Description *string    `json:"description" db:"description"`
	Version     string     `json:"version" db:"version"`
	Status      string     `json:"status" db:"status"`
	CreatedBy   *string    `json:"createdBy" db:"created_by"`
	CreatedAt   time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time  `json:"updatedAt" db:"updated_at"`
}

// CreateContractRequest is the request body for creating a contract.
type CreateContractRequest struct {
	Name        string  `json:"name" binding:"required"`
	Description *string `json:"description"`
	Version     string  `json:"version" binding:"required"`
}

// UpdateContractRequest is the request body for updating a contract.
type UpdateContractRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Version     *string `json:"version"`
	Status      *string `json:"status"`
}

// Endpoint represents a contract endpoint.
type Endpoint struct {
	ID            string     `json:"id" db:"id"`
	ContractID    string     `json:"contractId" db:"contract_id"`
	Path          string     `json:"path" db:"path"`
	Method        string     `json:"method" db:"method"`
	Summary       *string    `json:"summary" db:"summary"`
	RequestSchema *string    `json:"requestSchema" db:"request_schema"`
	ResponseSchema *string   `json:"responseSchema" db:"response_schema"`
	AuthRequired  bool       `json:"authRequired" db:"auth_required"`
	CreatedAt     time.Time  `json:"createdAt" db:"created_at"`
}

// CreateEndpointRequest is the request body for creating an endpoint.
type CreateEndpointRequest struct {
	Path          string  `json:"path" binding:"required"`
	Method        string  `json:"method" binding:"required"`
	Summary       *string `json:"summary"`
	RequestSchema *string `json:"requestSchema"`
	ResponseSchema *string `json:"responseSchema"`
	AuthRequired  *bool   `json:"authRequired"`
}

// UpdateEndpointRequest is the request body for updating an endpoint.
type UpdateEndpointRequest struct {
	Summary        *string `json:"summary"`
	RequestSchema  *string `json:"requestSchema"`
	ResponseSchema *string `json:"responseSchema"`
	AuthRequired   *bool   `json:"authRequired"`
}

// ContractFilter represents filter parameters for listing contracts.
type ContractFilter struct {
	Status *string
	Version *string
	Limit  int
	Offset int
}

// ContractStats holds aggregated contract statistics.
type ContractStats struct {
	TotalContracts    int `json:"totalContracts"`
	PublishedCount    int `json:"publishedCount"`
	DraftCount        int `json:"draftCount"`
	DeprecatedCount   int `json:"deprecatedCount"`
	TotalEndpoints    int `json:"totalEndpoints"`
}
