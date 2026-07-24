// Package models defines the data types for the CMDB Collector — the SPI
// (Service Provider Interface) layer that drives vendor-specific device and
// database adapters.  Inspired by NeatLogic's 120+ vendor adapter registry.
//
// The collector is decoupled from the core CMDB CI repository: it discovers
// devices, collects attributes, and writes the raw results back to the CI store
// via the Service layer.  This package only carries the collector's own domain
// types.
//
// Domain types:
//   Target      — a remote endpoint to discover / collect from (IP, port, creds)
//   Device      — a discovered or known host / server / database
//   Collection  — a single collection run: status, attributes, errors
//   Attribute   — a key/value metric on a device (CPU%, disk free, …)

package models

import "time"

// ---- Constants ----

const (
	// Target / device types
	TypeNetwork  = "network"
	TypeServer   = "server"
	TypeDatabase = "database"
	TypeMiddle   = "middleware"
	TypeCloud    = "cloud"

	// Protocol tags (informational; the adapter chooses its own transport)
	ProtoSNMP  = "snmp"
	ProtoSSH   = "ssh"
	ProtoJDBC  = "jdbc"
	ProtoAPI   = "api"
	ProtoWMI   = "wmi"

	// Collection status
	CollectionPending  = "pending"
	CollectionRunning  = "running"
	CollectionSuccess  = "success"
	CollectionFailed   = "failed"
	CollectionSkipped  = "skipped"
)

// ---- Target ----

// Target is a single remote endpoint that an adapter may probe.
//
// The config map carries vendor-specific parameters: credentials,
// community strings, connection pools, etc.  Each adapter documents its
// own required keys via ConfigSchema().
type Target struct {
	ID         string                 `db:"id" json:"id"`
	Name       string                 `db:"name" json:"name"`
	Host       string                 `db:"host" json:"host"`
	Port       int                    `db:"port" json:"port"`
	TargetType string                 `db:"type" json:"type"`        // network | server | database | …
	Protocol   string                 `db:"protocol" json:"protocol"` // snmp | ssh | jdbc | api | wmi
	TenantID   string                 `db:"tenant_id" json:"tenant_id"`
	Config     map[string]interface{} `db:"config" json:"config"` // vendor-specific (JSONB)
	Metadata   map[string]interface{} `db:"metadata" json:"metadata"`
	CreatedAt  time.Time              `db:"created_at" json:"created_at"`
	UpdatedAt  time.Time              `db:"updated_at" json:"updated_at"`
}

// ---- Device ----

// Device is a discovered or registered CMDB asset.
//
// Discovered devices come from an adapter's Discover() call; registered
// devices are seeded manually or synced from another system.  The adapter
// maps its own vendor-specific attributes into this normalised shape.
type Device struct {
	ID           string                 `db:"id" json:"id"`
	DeviceID     string                 `db:"device_id" json:"device_id"` // external canonical ID (e.g. MAC, serial)
	Name         string                 `db:"name" json:"name"`
	DeviceType   string                 `db:"type" json:"type"`           // network | server | database | …
	Vendor       string                 `db:"vendor" json:"vendor"`
	Model        string                 `db:"model" json:"model"`
	IP           string                 `db:"ip" json:"ip"`
	SerialNumber string                 `db:"serial_number" json:"serial_number"`
	TenantID     string                 `db:"tenant_id" json:"tenant_id"`
	TargetID     *string                `db:"target_id" json:"target_id"` // FK → cmdb_targets.id (nullable)
	Adapter      string                 `db:"adapter" json:"adapter"`     // which adapter last reported
	LastSeenAt   *time.Time             `db:"last_seen_at" json:"last_seen_at"`
	Attributes   map[string]interface{} `db:"attributes" json:"attributes"` // current metrics (JSONB)
	Status       string                 `db:"status" json:"status"` // active | stale | decommissioned
	Metadata     map[string]interface{} `db:"metadata" json:"metadata"`
	CreatedAt    time.Time              `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time              `db:"updated_at" json:"updated_at"`
}

// ---- Collection ----

// Collection is the result of one collect() run against a single device (or a
// discovery sweep against a target).  Each collection is a time-stamped
// snapshot of attributes.
type Collection struct {
	ID            string                 `db:"id" json:"id"`
	CollectionID  string                 `db:"collection_id" json:"collection_id"` // external, stable ID
	Collector     string                 `db:"collector" json:"collector"`         // adapter name
	DeviceID      *string                `db:"device_id" json:"device_id"`         // FK → cmdb_devices.id (nullable for discovery)
	TargetID      *string                `db:"target_id" json:"target_id"`         // FK → cmdb_targets.id
	TenantID      string                 `db:"tenant_id" json:"tenant_id"`
	Phase         string                 `db:"phase" json:"phase"`                 // discover | collect
	Status        string                 `db:"status" json:"status"`               // pending | running | success | failed | skipped
	AttributeCount int                   `db:"attribute_count" json:"attribute_count"`
	Attributes    map[string]interface{} `db:"attributes" json:"attributes"` // full attribute payload (JSONB)
	Error         *string                `db:"error" json:"error"`
	DurationMs    int                    `db:"duration_ms" json:"duration_ms"`
	CreatedAt     time.Time              `db:"created_at" json:"created_at"`
}

// ---- Attribute ----

// Attribute is a single typed metric collected from a device.
type Attribute struct {
	Key       string      `json:"key"`       // e.g. "cpu.usage.percent", "disk.free.bytes"
	Value     interface{} `json:"value"`     // int / float / string
	Unit      string      `json:"unit"`      // "percent", "bytes", "seconds"
	Category  string      `json:"category"`  // "system", "network", "storage", "process"
	Timestamp time.Time   `json:"timestamp"`
}

// ---- Request / Response ----

// DiscoverRequest is the payload for the discovery endpoint.
type DiscoverRequest struct {
	TargetID  string                 `json:"target_id"`
	Collector string                 `json:"collector"`
	Config    map[string]interface{} `json:"config"`
}

// DiscoverResponse carries the list of discovered devices.
type DiscoverResponse struct {
	Collector  string   `json:"collector"`
	TargetID   string   `json:"target_id"`
	DeviceCount int     `json:"device_count"`
	Devices    []Device `json:"devices"`
	Error      *string  `json:"error,omitempty"`
}

// CollectRequest is the payload for the collection endpoint.
type CollectRequest struct {
	DeviceID  string                 `json:"device_id"`
	Collector string                 `json:"collector"`
	Config    map[string]interface{} `json:"config"`
}

// CollectResponse carries the collection result.
type CollectResponse struct {
	CollectionID  string            `json:"collection_id"`
	Collector     string            `json:"collector"`
	DeviceID      string            `json:"device_id"`
	Status        string            `json:"status"`
	AttributeCount int              `json:"attribute_count"`
	Attributes    []Attribute       `json:"attributes"`
	DurationMs    int               `json:"duration_ms"`
	Error         *string           `json:"error,omitempty"`
}

// PaginatedResponse wraps paginated data for list endpoints.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}

// HealthStatus is the response for health endpoints.
type HealthStatus struct {
	Status string `json:"status"`
}
