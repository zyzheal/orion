package models

import "time"

// ---------------------------------------------------------------------------
// Adapter catalog — managed adapter metadata persisted to cmdb_adapters.
// ---------------------------------------------------------------------------

// CMDBAdapter represents a registered collector adapter instance.  The
// adapter catalog lives in cmdb_adapters; each row is a tenant-scoped
// instance of a vendor adapter (e.g. "aws-ec2" for tenant t1).  The
// Config column is a JSON blob carrying vendor-specific connection params.
type CMDBAdapter struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	Name        string    `db:"name" json:"name"`
	Category    string    `db:"category" json:"category"` // "cloud", "network", "database", "middleware", "os", "app"
	Vendor      string    `db:"vendor" json:"vendor"`
	Description string    `db:"description" json:"description"`
	Config      string    `db:"config" json:"config"` // JSON config (serialised)
	Enabled     bool      `db:"enabled" json:"enabled"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}

// ValidCategory returns true when Category is one of the allowed classes.
func (a *CMDBAdapter) ValidCategory() bool {
	switch a.Category {
	case "cloud", "network", "database", "middleware", "os", "app":
		return true
	}
	return false
}

// ---------------------------------------------------------------------------
// Discovery jobs — audit trail of every Discover() run.
// ---------------------------------------------------------------------------

// CMDBDiscoveryJob records one discovery execution.  The row is created when
// a job is submitted, updated as it runs, and finalised when it completes
// or fails.
type CMDBDiscoveryJob struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenant_id"`
	AdapterID   string    `db:"adapter_id" json:"adapter_id"`
	Target      string    `db:"target" json:"target"`
	Status      string    `db:"status" json:"status"` // "pending", "running", "completed", "failed"
	ResultCount int       `db:"result_count" json:"result_count"`
	Error       string    `db:"error" json:"error"`
	StartedAt   time.Time `db:"started_at" json:"started_at"`
	FinishedAt  time.Time `db:"finished_at" json:"finished_at"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
}

// ValidStatus returns true when Status is one of the allowed job states.
func (j *CMDBDiscoveryJob) ValidStatus() bool {
	switch j.Status {
	case "pending", "running", "completed", "failed":
		return true
	}
	return false
}

// ---------------------------------------------------------------------------
// Assets — the canonical inventory record produced by discovery.
// ---------------------------------------------------------------------------

// CMDBAsset is the output of a discovery sweep: a normalised inventory item
// written to cmdb_assets.  The Attributes column is a JSON blob of the raw
// attributes returned by the adapter (e.g. EC2 tags, switch ports, MySQL
// variables).
type CMDBAsset struct {
	ID           string    `db:"id" json:"id"`
	TenantID     string    `db:"tenant_id" json:"tenant_id"`
	Name         string    `db:"name" json:"name"`
	AdapterID    string    `db:"adapter_id" json:"adapter_id"`
	AssetType    string    `db:"asset_type" json:"asset_type"` // "server", "network_device", "database", "cloud_instance", ...
	Attributes   string    `db:"attributes" json:"attributes"` // JSON (serialised)
	Status       string    `db:"status" json:"status"`
	DiscoveredAt time.Time `db:"discovered_at" json:"discovered_at"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

// ---------------------------------------------------------------------------
// Request / Response DTOs for the adapter-factory API.
// ---------------------------------------------------------------------------

// AdapterRequest is the payload for creating a CMDBAdapter.
type AdapterRequest struct {
	Name        string `json:"name" binding:"required"`
	Category    string `json:"category" binding:"required"`
	Vendor      string `json:"vendor" binding:"required"`
	Description string `json:"description"`
	Config      string `json:"config"` // JSON blob
	Enabled     bool   `json:"enabled"`
}

// AdapterUpdateRequest is the payload for updating a CMDBAdapter.
type AdapterUpdateRequest struct {
	Name        *string `json:"name"`
	Category    *string `json:"category"`
	Vendor      *string `json:"vendor"`
	Description *string `json:"description"`
	Config      *string `json:"config"`
	Enabled     *bool   `json:"enabled"`
}

// DiscoveryJobRequest is the payload for submitting a discovery job.
type DiscoveryJobRequest struct {
	AdapterID string `json:"adapter_id" binding:"required"`
	Target    string `json:"target" binding:"required"`
}
