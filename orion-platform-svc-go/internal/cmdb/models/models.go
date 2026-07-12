package models

import "time"

// CI represents a Configuration Item (CMDB).
type CI struct {
	ID          string                 `json:"id" db:"id"`
	CIID        string                 `json:"ciId" db:"ci_id"`
	Name        string                 `json:"name" db:"name"`
	CIType      string                 `json:"ciType" db:"ci_type"`
	Status      string                 `json:"status" db:"status"`
	Description *string                `json:"description" db:"description"`
	TenantID    int64                  `json:"tenantId" db:"tenant_id"`
	CreatedBy   string                 `json:"createdBy" db:"created_by"`
	Environment *string                `json:"environment" db:"environment"`
	Tags        *string                `json:"tags" db:"tags"` // JSON array string
	CreatedAt   time.Time              `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time              `json:"updatedAt" db:"updated_at"`
}

// CreateCIRequest is the body for creating a CI.
type CreateCIRequest struct {
	CIID        string  `json:"ciId" binding:"required"`
	Name        string  `json:"name" binding:"required"`
	CIType      string  `json:"ciType" binding:"required"`
	Status      string  `json:"status"`
	Description *string `json:"description"`
	TenantID    *int64  `json:"tenantId"`
	CreatedBy   string  `json:"createdBy"`
}

// UpdateCIRequest is the body for updating a CI.
type UpdateCIRequest struct {
	Name        *string `json:"name"`
	CIType      *string `json:"ciType"`
	Status      *string `json:"status"`
	Description *string `json:"description"`
	Environment *string `json:"environment"`
	Tags        *string `json:"tags"`
	User        *string `json:"user"`
	TenantID    *int64  `json:"tenantId"`
}

// BatchCreateItem is a single item in batch create.
type BatchCreateItem struct {
	CIID        string  `json:"ciId" binding:"required"`
	Name        string  `json:"name" binding:"required"`
	CIType      string  `json:"ciType" binding:"required"`
	Status      string  `json:"status"`
	Description *string `json:"description"`
	Environment *string `json:"environment"`
	Tags        *string `json:"tags"`
}

// BatchCreateRequest is the body for batch creating CIs.
type BatchCreateRequest struct {
	Items     []BatchCreateItem `json:"items" binding:"required"`
	TenantID  *int64            `json:"tenantId"`
	CreatedBy string            `json:"createdBy"`
}

// BatchUpdateItem is a single item in batch update.
type BatchUpdateItem struct {
	ID          string  `json:"id" binding:"required"`
	CIID        *string `json:"ciId"`
	Name        *string `json:"name"`
	CIType      *string `json:"ciType"`
	Status      *string `json:"status"`
	Description *string `json:"description"`
	Environment *string `json:"environment"`
	Tags        *string `json:"tags"`
}

// BatchUpdateRequest is the body for batch updating CIs.
type BatchUpdateRequest struct {
	Items    []BatchUpdateItem `json:"items" binding:"required"`
	TenantID *int64            `json:"tenantId"`
	User     *string           `json:"user"`
}

// BatchDeleteRequest is the body for batch deleting CIs.
type BatchDeleteRequest struct {
	Items    []string `json:"items" binding:"required"` // IDs to delete
	TenantID *int64   `json:"tenantId"`
}

// BatchResult is the response for batch operations.
type BatchResult struct {
	Success int    `json:"success"`
	Failed  int    `json:"failed"`
	Errors  []any  `json:"errors,omitempty"`
}

// BatchQueryRequest is the body for complex CI query.
type BatchQueryRequest struct {
	CIType      *string `json:"ciType"`
	Status      *string `json:"status"`
	Environment *string `json:"environment"`
	Tags        *string `json:"tags"`
	Search      *string `json:"search"`
	TenantID    *int64  `json:"tenantId"`
	Limit       *int    `json:"limit"`
	Offset      *int    `json:"offset"`
	OrderBy     *string `json:"orderBy"`
	Order       *string `json:"order"`
}

// PaginatedResponse wraps paginated data.
type PaginatedResponse struct {
	Data     any   `json:"data"`
	Total    int   `json:"total"`
	Page     int   `json:"page"`
	PageSize int   `json:"pageSize"`
}

// ImportCIsRequest is the body for importing CIs.
type ImportCIsRequest struct {
	CIs          []any   `json:"cis" binding:"required"`
	TenantID     *int64  `json:"tenantId"`
	SkipDuplicates bool  `json:"skipDuplicates"`
	CreatedBy    string  `json:"createdBy"`
}

// ExportResult is the result of import/export.
type ExportResult struct {
	Count int `json:"count"`
	CIs   []any `json:"cis"`
}

// CIRelation represents a relationship between two CIs.
type CIRelation struct {
	ID            string     `json:"id" db:"id"`
	FromCID       string     `json:"fromCiId" db:"from_ci_id"`
	ToCIID        string     `json:"toCiId" db:"to_ci_id"`
	RelationType  string     `json:"relationType" db:"relation_type"`
	Description   *string    `json:"description" db:"description"`
	TenantID      *int64     `json:"tenantId" db:"tenant_id"`
	CreatedBy     string     `json:"createdBy" db:"created_by"`
	CreatedAt     time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt     time.Time  `json:"updatedAt" db:"updated_at"`
}

// CreateRelationRequest is the body for creating a relation.
type CreateRelationRequest struct {
	FromCID      string  `json:"fromCiId" binding:"required"`
	ToCIID       string  `json:"toCiId" binding:"required"`
	RelationType string  `json:"relationType" binding:"required"`
	Description  *string `json:"description"`
	TenantID     *int64  `json:"tenantId"`
	User         *string `json:"user"`
}

// CIVersion represents a version snapshot of a CI.
type CIVersion struct {
	ID          string     `json:"id" db:"id"`
	CIID        string     `json:"ciId" db:"ci_id"`
	Version     int        `json:"version" db:"version"`
	Snapshot    *string    `json:"snapshot" db:"snapshot"` // JSON
	TenantID    *int64     `json:"tenantId" db:"tenant_id"`
	CreatedBy   string     `json:"createdBy" db:"created_by"`
	CreatedAt   time.Time  `json:"createdAt" db:"created_at"`
}

// RestoreRequest is the body for restoring a CI version.
type RestoreRequest struct {
	Version int    `json:"version" binding:"required"`
	User    string `json:"user"`
	TenantID *int64 `json:"tenantId"`
}

// TopologyRequest is the query/body for topology.
type TopologyRequest struct {
	CIType   *string `json:"ciType"`
	Depth    *int    `json:"depth"`
	TenantID *int64  `json:"tenantId"`
}

// TopologyResult is the result of topology queries.
type TopologyResult struct {
	Nodes []TopologyNode  `json:"nodes"`
	Edges []TopologyEdge  `json:"edges"`
}

// TopologyNode is a node in the topology graph.
type TopologyNode struct {
	ID   string                 `json:"id"`
	Type string                 `json:"type"`
	Data map[string]interface{} `json:"data"`
}

// TopologyEdge is an edge in the topology graph.
type TopologyEdge struct {
	Source      string `json:"source"`
	Target      string `json:"target"`
	RelationType string `json:"relationType"`
}

// HealthStatus is the health check response.
type HealthStatus struct {
	Status string `json:"status"`
}
