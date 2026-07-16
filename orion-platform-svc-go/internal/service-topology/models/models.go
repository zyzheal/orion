package models

import "time"

// ServiceStatus describes the operational state of a service node.
type ServiceStatus string

const (
	StatusActive   ServiceStatus = "ACTIVE"
	StatusInactive ServiceStatus = "INACTIVE"
	StatusDegraded ServiceStatus = "DEGRADED"
)

// RelationType describes the kind of dependency edge between services.
type RelationType string

const (
	RelDependsOn        RelationType = "depends_on"
	RelCommunicatesWith RelationType = "communicates_with"
	RelHealthChecks     RelationType = "health_checks"
)

// ServiceTopology represents a service node in the topology graph.
type ServiceTopology struct {
	ID           string            `json:"id" db:"id"`
	TenantID     string            `json:"tenant_id" db:"tenant_id"`
	ServiceName  string            `json:"service_name" db:"service_name"`
	ServiceURL   string            `json:"service_url" db:"service_url"`
	Port         int               `json:"port" db:"port"`
	Status       ServiceStatus     `json:"status" db:"status"`
	Dependencies []string          `json:"dependencies" db:"dependencies"`
	Metadata     map[string]string `json:"metadata" db:"metadata"`
	CreatedAt    time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at" db:"updated_at"`
}

// TopologyEdge represents a directed dependency edge.
type TopologyEdge struct {
	ID            string       `json:"id" db:"id"`
	TenantID      string       `json:"tenant_id" db:"tenant_id"`
	SourceService string       `json:"source_service" db:"source_service"`
	TargetService string       `json:"target_service" db:"target_service"`
	RelationType  RelationType `json:"relation_type" db:"relation_type"`
	CreatedAt     time.Time    `json:"created_at" db:"created_at"`
}

// TopologyStats aggregates topology-wide metrics.
type TopologyStats struct {
	ServiceCount    int  `json:"service_count"`
	DependencyCount int  `json:"dependency_count"`
	MaxDepth        int  `json:"max_depth"`
	HasCycle        bool `json:"has_cycle"`
}

// DependencyInfo describes a single dependency link returned by the API.
type DependencyInfo struct {
	ServiceName  string       `json:"service_name"`
	RelationType RelationType `json:"relation_type"`
}

// DependencyGraph holds a service node and its outgoing edges.
type DependencyGraph struct {
	ServiceName  string           `json:"service_name"`
	Dependencies []DependencyInfo `json:"dependencies"`
}

// ImpactScope describes downstream services affected if a service goes down.
type ImpactScope struct {
	ServiceName      string   `json:"service_name"`
	DownstreamCount  int      `json:"downstream_count"`
	AffectedServices []string `json:"affected_services"`
}

// CyclePath is a list of service names forming a cycle.
type CyclePath struct {
	Path []string `json:"path"`
}

// ValidateTopologyResult returns any cycles found during validation.
type ValidateTopologyResult struct {
	HasCycle bool        `json:"has_cycle"`
	Cycles   []CyclePath `json:"cycles"`
}

// Request types

type CreateServiceTopologyRequest struct {
	ServiceName  string            `json:"service_name" binding:"required"`
	ServiceURL   string            `json:"service_url"`
	Port         int               `json:"port"`
	Status       string            `json:"status"`
	Dependencies []string          `json:"dependencies"`
	Metadata     map[string]string `json:"metadata"`
}

type UpdateServiceTopologyRequest struct {
	ServiceName  *string           `json:"service_name"`
	ServiceURL   *string           `json:"service_url"`
	Port         *int              `json:"port"`
	Status       *string           `json:"status"`
	Dependencies []string          `json:"dependencies"`
	Metadata     map[string]string `json:"metadata"`
}

type AddDependencyRequest struct {
	TargetService string `json:"target_service" binding:"required"`
	RelationType  string `json:"relation_type"`
}
