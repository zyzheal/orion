package migration

import (
	"encoding/json"
	"fmt"
	"time"
)

// VersionRecord represents the on-disk version tracking format (version.json).
// This matches the NeatLogic pattern: a JSON file tracking which migrations
// have been applied, with metadata for auditing.
type VersionRecord struct {
	Version   string   `json:"version"`
	Applied   []string `json:"applied"`
	Pending   []string `json:"pending"`
	AppliedAt string   `json:"applied_at"`
	Schema    string   `json:"schema"`
	TenantID  string   `json:"tenant_id,omitempty"`
}

// NewVersionRecord creates a fresh VersionRecord with the current time.
func NewVersionRecord(version string) *VersionRecord {
	return &VersionRecord{
		Version:   version,
		AppliedAt: time.Now().UTC().Format(time.RFC3339),
		Applied:   make([]string, 0),
		Pending:   make([]string, 0),
	}
}

// MarshalJSON returns the JSON representation of VersionRecord.
func (vr *VersionRecord) MarshalJSON() ([]byte, error) {
	type alias VersionRecord
	return json.MarshalIndent((*alias)(vr), "", "  ")
}

// UnmarshalJSON parses the JSON representation into VersionRecord.
func (vr *VersionRecord) UnmarshalJSON(data []byte) error {
	type alias VersionRecord
	if err := json.Unmarshal(data, (*alias)(vr)); err != nil {
		return err
	}
	if vr.Applied == nil {
		vr.Applied = make([]string, 0)
	}
	if vr.Pending == nil {
		vr.Pending = make([]string, 0)
	}
	return nil
}

// MarkApplied records a migration as applied and removes it from pending.
func (vr *VersionRecord) MarkApplied(name string) {
	vr.Applied = append(vr.Applied, name)
	vr.AppliedAt = time.Now().UTC().Format(time.RFC3339)
	for i, p := range vr.Pending {
		if p == name {
			vr.Pending = append(vr.Pending[:i], vr.Pending[i+1:]...)
			break
		}
	}
}

// IsApplied returns true if a migration with the given name is marked applied.
func (vr *VersionRecord) IsApplied(name string) bool {
	for _, a := range vr.Applied {
		if a == name {
			return true
		}
	}
	return false
}

// AppliedMap returns a set of applied migration names for efficient lookup.
func (vr *VersionRecord) AppliedMap() map[string]bool {
	m := make(map[string]bool, len(vr.Applied))
	for _, a := range vr.Applied {
		m[a] = true
	}
	return m
}

// DBVersionRecord holds a row from the migration_versions table.
type DBVersionRecord struct {
	Version    string    `db:"version"`
	Name       string    `db:"name"`
	AppliedAt  time.Time `db:"applied_at"`
	Checksum   string    `db:"checksum"`
	SchemaName string    `db:"schema_name"`
	TenantID   string    `db:"tenant_id"`
}

// TableName returns the database table name for version tracking.
func (DBVersionRecord) TableName() string {
	return "migration_versions"
}

// VersionTableDDL creates the new migration_versions table.
// This table supersedes schema_migrations but both are supported.
var VersionTableDDL = `
CREATE TABLE IF NOT EXISTS migration_versions (
    version     VARCHAR(255) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    checksum    VARCHAR(64),
    schema_name VARCHAR(64) NOT NULL DEFAULT 'public',
    tenant_id   VARCHAR(255) NOT NULL DEFAULT '',
    PRIMARY KEY (version, schema_name, tenant_id)
)`

// LegacyVersionTableDDL is the original schema_migrations table DDL (kept for backward compat).
var LegacyVersionTableDDL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
    version     INT PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`

// EnsureVersionTables creates both version tracking tables if they don't exist.
func EnsureVersionTables(execer interface{
	Exec(query string, args ...interface{}) (sql.Result, error)
}) error {
	for _, ddl := range []string{LegacyVersionTableDDL, VersionTableDDL} {
		if _, err := execer.Exec(ddl); err != nil {
			return fmt.Errorf("failed to create version tracking table: %w", err)
		}
	}
	return nil
}
