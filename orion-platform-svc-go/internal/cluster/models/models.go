package models

import "time"

// ClusterStatus represents the lifecycle status of a K8s cluster.
type ClusterStatus string

const (
	StatusActive   ClusterStatus = "ACTIVE"
	StatusInactive ClusterStatus = "INACTIVE"
	StatusError    ClusterStatus = "ERROR"
	StatusDeleted  ClusterStatus = "DELETED"
)

// Cluster is the core K8s cluster record.
type Cluster struct {
	ID          string        `json:"id" db:"id"`
	TenantID    string        `json:"tenant_id" db:"tenant_id"`
	Name        string        `json:"name" db:"name"`
	APIEndpoint string        `json:"api_endpoint" db:"api_endpoint"`
	CaCert      string        `json:"ca_cert" db:"ca_cert"`
	Token       string        `json:"token" db:"token"`
	Version     *string       `json:"version,omitempty" db:"version"`
	Status      ClusterStatus `json:"status" db:"status"`
	CreatedAt   time.Time     `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at" db:"updated_at"`
}

// Namespace represents a namespace within a cluster.
type Namespace struct {
	ID        string      `json:"id" db:"id"`
	ClusterID string      `json:"cluster_id" db:"cluster_id"`
	Name      string      `json:"name" db:"name"`
	Status    string      `json:"status" db:"status"`
	CreatedAt time.Time   `json:"created_at" db:"created_at"`
}

// CreateClusterRequest is the request body for creating a cluster.
type CreateClusterRequest struct {
	Name        string `json:"name" binding:"required"`
	APIEndpoint string `json:"api_endpoint" binding:"required"`
	CaCert      string `json:"ca_cert"`
	Token       string `json:"token" binding:"required"`
}

// UpdateClusterRequest contains optional fields for updating a cluster.
type UpdateClusterRequest struct {
	Name        *string `json:"name"`
	APIEndpoint *string `json:"api_endpoint"`
	CaCert      *string `json:"ca_cert"`
	Token       *string `json:"token"`
	Status      *ClusterStatus `json:"status"`
}

// --- K8s cluster info response types ---

// ClusterInfo holds live K8s cluster information.
type ClusterInfo struct {
	ServerVersion *string                    `json:"server_version,omitempty"`
	NodeCount     int                        `json:"node_count"`
	Nodes         []NodeInfo                 `json:"nodes"`
	NamespaceCount int                        `json:"namespace_count"`
	Namespaces    []NamespaceInfo            `json:"namespaces"`
	PodCount      int                        `json:"pod_count"`
}

// NodeInfo holds K8s node information.
type NodeInfo struct {
	Name    string `json:"name"`
	Status  string `json:"status"`
	Role    string `json:"role"`
	Version string `json:"version"`
}

// NamespaceInfo holds K8s namespace information.
type NamespaceInfo struct {
	Name       string `json:"name"`
	Status     string `json:"status"`
	PodCount   int    `json:"pod_count"`
}
