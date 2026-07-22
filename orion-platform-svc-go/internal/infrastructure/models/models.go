package models

import "time"

// --- Connector types ---

type ConnectorType string

const (
	ConnectorTypeGitHub  ConnectorType = "github"
	ConnectorTypeJenkins ConnectorType = "jenkins"
	ConnectorTypeArgoCD  ConnectorType = "argocd"
	ConnectorTypeK8s     ConnectorType = "kubernetes"
	ConnectorTypePrometheus ConnectorType = "prometheus"
	ConnectorTypeCustom  ConnectorType = "custom"
)

type ConnectorStatus string

const (
	ConnectorStatusConnected   ConnectorStatus = "connected"
	ConnectorStatusDisconnected ConnectorStatus = "disconnected"
	ConnectorStatusConnecting   ConnectorStatus = "connecting"
	ConnectorStatusFailed       ConnectorStatus = "failed"
)

// --- Connector model ---

type Connector struct {
	ID          string        `json:"id" db:"id"`
	TenantID    string        `json:"tenant_id" db:"tenant_id"`
	Type        ConnectorType `json:"type" db:"type"`
	Name        string        `json:"name" db:"name"`
	Endpoint    string        `json:"endpoint,omitempty" db:"endpoint"`
	Credentials string        `json:"-" db:"credentials"` // JSON blob, never exposed
	TimeoutMs   int           `json:"timeout_ms" db:"timeout_ms"`
	MaxRetries  int           `json:"max_retries" db:"max_retries"`
	Status      ConnectorStatus `json:"status" db:"status"`
	Metadata    string        `json:"metadata,omitempty" db:"metadata"` // JSON blob
	CreatedAt   time.Time     `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at" db:"updated_at"`
}

// --- Connector health ---

type HealthMetrics struct {
	ConnectorID  string    `json:"connector_id"`
	Status       string    `json:"status"`
	LastPingAt   *time.Time `json:"last_ping_at"`
	LatencyMs    float64   `json:"latency_ms"`
	ErrorCount   int       `json:"error_count"`
	SuccessCount int       `json:"success_count"`
}

// --- Sandbox model ---

type SandboxInfo struct {
	ID               string    `json:"id" db:"id"`
	TenantID         string    `json:"tenant_id" db:"tenant_id"`
	Name             string    `json:"name" db:"name"`
	Namespace        string    `json:"namespace" db:"namespace"`
	IsolationStatus  string    `json:"isolation_status" db:"isolation_status"`
	NetworkPolicyID  string    `json:"network_policy_id" db:"network_policy_id"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time `json:"updated_at" db:"updated_at"`
}

// --- SandboxNetworkPolicy model ---

type SandboxNetworkPolicy struct {
	ID          string                 `json:"id" db:"id"`
	SandboxID   string                 `json:"sandbox_id" db:"sandbox_id"`
	Name        string                 `json:"name" db:"name"`
	Namespace   string                 `json:"namespace" db:"namespace"`
	Labels      string                 `json:"labels,omitempty" db:"labels"`        // JSON blob
	Annotations string                 `json:"annotations,omitempty" db:"annotations"` // JSON blob
	IngressRules string               `json:"ingress_rules,omitempty" db:"ingress_rules"` // JSON blob
	EgressRules  string               `json:"egress_rules,omitempty" db:"egress_rules"`  // JSON blob
	CreatedAt    time.Time            `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time            `json:"updated_at" db:"updated_at"`
}

// --- Request/Response models ---

type RegisterConnectorRequest struct {
	Type        ConnectorType `json:"type" binding:"required"`
	Name        string        `json:"name" binding:"required"`
	Endpoint    string        `json:"endpoint"`
	Credentials map[string]any `json:"credentials"`
	TimeoutMs   int           `json:"timeout_ms"`
	MaxRetries  int           `json:"max_retries"`
	Metadata    map[string]any `json:"metadata"`
}

type UpdateConnectorRequest struct {
	TimeoutMs  *int          `json:"timeout_ms"`
	MaxRetries *int          `json:"max_retries"`
	Metadata   map[string]any `json:"metadata"`
}

type CreateSandboxRequest struct {
	Name        string            `json:"name" binding:"required"`
	Namespace   string            `json:"namespace" binding:"required"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
}

type AllowTrafficRequest struct {
	FromEnv string       `json:"fromEnv" binding:"required"`
	ToEnv   string       `json:"toEnv" binding:"required"`
	Ports   []PortSpec   `json:"ports" binding:"required"`
}

type PortSpec struct {
	Port     int    `json:"port" binding:"required"`
	Protocol string `json:"protocol" binding:"required"`
}

type DnsIsolationRequest struct {
	AllowedDomains   []string `json:"allowedDomains" binding:"required"`
	CustomDnsServers []string `json:"customDnsServers"`
	DnsTimeoutMs     int      `json:"dnsTimeoutMs"`
}

type EgressRule struct {
	Name        string     `json:"name" binding:"required"`
	Destination string     `json:"destination"`
	Ports       []PortSpec `json:"ports"`
	Allow       bool       `json:"allow"`
}

type EgressTrafficRequest struct {
	Rules         []EgressRule `json:"rules" binding:"required"`
	DefaultAction string       `json:"defaultAction" binding:"required"`
}
