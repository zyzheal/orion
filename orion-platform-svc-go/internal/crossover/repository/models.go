// Package repository provides persistence for crossover cross-module call
// records, statistics, and operation registry.
//
// It stores:
//   - CallRecord: each cross-module call (source→target→operation→result)
//   - CallOperation registry records
//   - Aggregated CallStats
//
// The SQL schema uses PostgreSQL-compatible $N parameters.
package repository

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// ---------------------------------------------------------------------------
// JSONB — mirrors orion/platform-svc-go JSONB helper
// ---------------------------------------------------------------------------

// JSONB is a json.Marshal/Unmarshal wrapper for map[string]interface{}.
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(src interface{}) error {
	if src == nil {
		*j = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, j)
	case string:
		return json.Unmarshal([]byte(v), j)
	default:
		return fmt.Errorf("cannot scan %T into JSONB", src)
	}
}

// ---------------------------------------------------------------------------
// CallRecord — a single cross-module call
// ---------------------------------------------------------------------------

// CallRecord is the persistence representation of a CrossoverCall.
type CallRecord struct {
	ID             string    `db:"id"               json:"id"`
	TenantID       string    `db:"tenant_id"        json:"tenant_id"`
	SourceDomain   string    `db:"source_domain"    json:"source_domain"`
	TargetDomain   string    `db:"target_domain"    json:"target_domain"`
	Method         string    `db:"method"           json:"method"`
	Payload        JSONB     `db:"payload"          json:"payload,omitempty"`
	Response       JSONB     `db:"response"         json:"response,omitempty"`
	Status         string    `db:"status"           json:"status"` // pending|succeeded|failed|timeout
	Duration       int64     `db:"duration_ms"      json:"duration_ms"` // duration in milliseconds
	CreatedAt      time.Time `db:"created_at"       json:"created_at"`
	UpdatedAt      time.Time `db:"updated_at"       json:"updated_at"`
}

// ---------------------------------------------------------------------------
// CallFilter — query filter for ListCalls
// ---------------------------------------------------------------------------

// CallFilter restricts which CallRecords are returned by ListCalls.
type CallFilter struct {
	TenantID     string
	SourceDomain string
	TargetDomain string
	Method       string
	Status       string
	StartTime    *time.Time
	EndTime      *time.Time
	Offset       int
	Limit        int
}

// DefaultLimit returns the configured limit, or 20 if unspecified.
func (f CallFilter) DefaultLimit() int {
	if f.Limit <= 0 {
		return 20
	}
	if f.Limit > 100 {
		return 100
	}
	return f.Limit
}

// ---------------------------------------------------------------------------
// CallStats — aggregated statistics for a time window
// ---------------------------------------------------------------------------

// CallStats holds aggregated crossover call statistics.
type CallStats struct {
	TotalCalls    int64   `db:"total_calls"    json:"total_calls"`
	SuccessCalls  int64   `db:"success_calls"  json:"success_calls"`
	FailedCalls   int64   `db:"failed_calls"   json:"failed_calls"`
	AvgDuration   float64 `db:"avg_duration_ms" json:"avg_duration_ms"` // average duration in milliseconds
	P99Duration   float64 `db:"p99_duration_ms" json:"p99_duration_ms"` // 99th percentile duration in milliseconds
}

// ---------------------------------------------------------------------------
// ErrNotFound — returned when a CallRecord does not exist
// ---------------------------------------------------------------------------

// ErrNotFound is returned by GetCall when the record is absent.
var ErrNotFound = fmt.Errorf("crossover call record not found")
