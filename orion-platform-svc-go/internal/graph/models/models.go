package models

import "time"

// === Node ===

// GraphNode represents a node in the knowledge graph.
type GraphNode struct {
	ID         string                 `json:"id" db:"id"`
	TenantID   string                 `json:"tenant_id" db:"tenant_id"`
	Labels     string                 `json:"labels" db:"labels"` // JSON array, e.g. ["Service","Production"]
	Properties map[string]interface{} `json:"properties" db:"properties"` // JSON object, e.g. {"name":"api","version":"1.0"}
	CreatedAt  time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time              `json:"updated_at" db:"updated_at"`
}

// CreateNodeRequest is the body for creating a node.
type CreateNodeRequest struct {
	Labels     []string             `json:"labels" binding:"required,min=1"`
	Properties map[string]interface{} `json:"properties"`
}

// UpdateNodeRequest is the body for updating a node.
type UpdateNodeRequest struct {
	Labels     *[]string             `json:"labels"`
	Properties map[string]interface{} `json:"properties"`
}

// === Relationship ===

// GraphRelationship represents a directed edge between two nodes.
type GraphRelationship struct {
	ID          string                 `json:"id" db:"id"`
	TenantID    string                 `json:"tenant_id" db:"tenant_id"`
	Type        string                 `json:"type" db:"type"`
	StartNodeID string                 `json:"start_node_id" db:"start_node_id"`
	EndNodeID   string                 `json:"end_node_id" db:"end_node_id"`
	Properties  map[string]interface{} `json:"properties" db:"properties"` // JSON object
	CreatedAt   time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at" db:"updated_at"`
}

// CreateRelationshipRequest is the body for creating a relationship.
type CreateRelationshipRequest struct {
	Type        string                 `json:"type" binding:"required"`
	StartNodeID string                 `json:"startNodeId" binding:"required"`
	EndNodeID   string                 `json:"endNodeId" binding:"required"`
	Properties  map[string]interface{} `json:"properties"`
}

// UpdateRelationshipRequest is the body for updating a relationship.
type UpdateRelationshipRequest struct {
	Type        *string                `json:"type"`
	StartNodeID *string                `json:"startNodeId"`
	EndNodeID   *string                `json:"endNodeId"`
	Properties  map[string]interface{} `json:"properties"`
}

// === Graph Query / Result (from TS GraphQuery + GraphResult) ===

// GraphQueryRequest is the body for executing a Cypher-style graph query.
type GraphQueryRequest struct {
	Cypher string                 `json:"cypher" binding:"required"`
	Params map[string]interface{} `json:"params"`
}

// GraphResult is the response from a graph query.
type GraphResult struct {
	Nodes         []GraphNode         `json:"nodes"`
	Relationships []GraphRelationship `json:"relationships"`
	Count         int                 `json:"count"`
}

// === Traversal (from TS GraphPath) ===

// GraphPath represents a path of nodes and relationships.
type GraphPath struct {
	Nodes         []GraphNode         `json:"nodes"`
	Relationships []GraphRelationship `json:"relationships"`
}

// FindPathRequest is the body for finding shortest path between two nodes.
type FindPathRequest struct {
	StartID string `json:"startId" binding:"required"`
	EndID   string `json:"endId" binding:"required"`
}

// === Topology (from TS TopologyNode) ===

// TopologyNode is a node in the service topology.
type TopologyNode struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Type        string                 `json:"type"`
	Status      string                 `json:"status"`
	Properties  map[string]interface{} `json:"properties"`
	Connections []string               `json:"connections"`
}

// === Stats ===

// GraphStats returns aggregated graph statistics.
type GraphStats struct {
	TotalNodes      int `json:"total_nodes"`
	TotalRels       int `json:"total_relationships"`
	LabelsCount     int `json:"labels_count"`
	TypesCount      int `json:"types_count"`
	OldestNodeID    string `json:"oldest_node_id"`
	NewestNodeID    string `json:"newest_node_id"`
}

// === Pagination ===

// PaginatedNodes returns paginated node list.
type PaginatedNodes struct {
	Nodes []GraphNode `json:"nodes"`
	Total int64       `json:"total"`
}

// PaginatedRelationships returns paginated relationship list.
type PaginatedRelationships struct {
	Relationships []GraphRelationship `json:"relationships"`
	Total         int64               `json:"total"`
}
