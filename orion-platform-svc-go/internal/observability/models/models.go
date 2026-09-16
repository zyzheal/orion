package models

import "time"

// Metric is scanned from SELECT *, so every returned column needs a destination.
// tenant_id is NOT NULL in the table and is written by CreateMetric, so TenantID
// is required here: without it ListMetrics/GetMetric failed in sqlx safe mode with
// "missing destination name tenant_id" on the very first request.
type Metric struct {
	Name  string  `json:"name" db:"name" binding:"required"`
	Value float64 `json:"value" db:"value"`
	// db:"-" rather than no tag: sqlx falls back to the lowercased Go field name
	// when the tag is absent, so an untagged Tags still claimed the tags column.
	// database/sql cannot scan []byte into a map — it fails with "unsupported
	// Scan, storing driver.Value type []uint8 into type *map[string]string" — so
	// the column goes to TagsJSON and the repository unmarshals it into Tags.
	Tags      map[string]string `json:"tags" db:"-"`
	Timestamp time.Time         `json:"timestamp" db:"timestamp"`
	TenantID  string            `json:"tenantId" db:"tenant_id"`
	// TagsJSON is the raw JSONB column; excluded from JSON because Tags is the
	// wire representation.
	TagsJSON []byte `json:"-" db:"tags"`
}

type Dashboard struct {
	ID     string `json:"id" db:"id"`
	Name   string `json:"name" db:"name"`
	Layout string `json:"layout" db:"layout"`
}

// AlertRule carries TenantID because tenant_id is NOT NULL in the table and is
// scanned back by ListAlertRules' SELECT *: the repository used to bind :tenantId
// to nothing and drop the tenantID parameter entirely, so every rule would have
// been inserted with an empty tenant and every SELECT * has no destination for
// the column without this field.
type AlertRule struct {
	ID        string  `json:"id" db:"id"`
	TenantID  string  `json:"tenantId" db:"tenant_id"`
	Metric    string  `json:"metric" db:"metric" binding:"required"`
	Operator  string  `json:"operator" db:"operator"`
	Threshold float64 `json:"threshold" db:"threshold"`
	Severity  string  `json:"severity" db:"severity" binding:"required"`
	Enabled   bool    `json:"enabled" db:"enabled"`
}

type MetricQuery struct {
	Name      string `json:"name"`
	From      string `json:"from"`
	To        string `json:"to"`
	Aggregate string `json:"aggregate"`
}
