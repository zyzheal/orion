package models

import (
	"time"
)

// Lineage represents a data lineage definition.
type Lineage struct {
	ID          string     `json:"id" db:"id"`
	TenantID    string     `json:"tenantId" db:"tenant_id"`
	Name        string     `json:"name" db:"name"`
	Description *string    `json:"description" db:"description"`
	Status      string     `json:"status" db:"status"`
	CreatedAt   time.Time  `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time  `json:"updatedAt" db:"updated_at"`
}

// CreateLineageRequest is the request body for creating a lineage.
type CreateLineageRequest struct {
	Name        string  `json:"name" binding:"required"`
	Description *string `json:"description"`
}

// UpdateLineageRequest is the request body for updating a lineage.
type UpdateLineageRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Status      *string `json:"status"`
}

// Node represents a node in a data lineage graph.
type Node struct {
	ID        string     `json:"id" db:"id"`
	LineageID string     `json:"lineageId" db:"lineage_id"`
	Name      string     `json:"name" db:"name"`
	Type      string     `json:"type" db:"type"`   // table, column, dataset, api, event
	Properties map[string]any `json:"properties" db:"properties"`
	CreatedAt time.Time  `json:"createdAt" db:"created_at"`
}

// CreateNodeRequest is the request body for creating a node.
type CreateNodeRequest struct {
	Name       string         `json:"name" binding:"required"`
	Type       string         `json:"type" binding:"required"`
	Properties map[string]any `json:"properties"`
}

// Relationship represents an edge between two nodes in a data lineage graph.
type Relationship struct {
	ID           string     `json:"id" db:"id"`
	LineageID    string     `json:"lineageId" db:"lineage_id"`
	SourceNodeID string     `json:"sourceNodeId" db:"source_node_id"`
	TargetNodeID string     `json:"targetNodeId" db:"target_node_id"`
	Type         string     `json:"type" db:"type"`        // reads, writes, transforms
	Description  *string    `json:"description" db:"description"`
	CreatedAt    time.Time  `json:"createdAt" db:"created_at"`
}

// CreateRelationshipRequest is the request body for creating a relationship.
type CreateRelationshipRequest struct {
	SourceNodeID string  `json:"sourceNodeId" binding:"required"`
	TargetNodeID string  `json:"targetNodeId" binding:"required"`
	Type         string  `json:"type"`
	Description  *string `json:"description"`
}

// LineageStats holds aggregated lineage statistics.
type LineageStats struct {
	TotalLineages      int `json:"totalLineages"`
	TotalNodes         int `json:"totalNodes"`
	TotalRelationships int `json:"totalRelationships"`
}
