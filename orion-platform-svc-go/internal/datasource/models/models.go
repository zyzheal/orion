package models

import "time"

// DataSourceType defines supported datasource engine types.
type DataSourceType string

const (
	DSCPostgres      DataSourceType = "postgres"
	DSCMySQL         DataSourceType = "mysql"
	DSCClickHouse    DataSourceType = "clickhouse"
	DSCElasticsearch DataSourceType = "elasticsearch"
	DSCMongoDB       DataSourceType = "mongodb"
)

// DataSourceStatus tracks the connection state.
type DataSourceStatus string

const (
	DSStatusActive     DataSourceStatus = "active"
	DSStatusInactive   DataSourceStatus = "inactive"
	DSStatusError      DataSourceStatus = "error"
	DSStatusConnecting DataSourceStatus = "connecting"
)

// DataSource represents a managed data source configuration.
type DataSource struct {
	ID              string            `json:"id"`
	Name            string            `json:"name"`
	Type            DataSourceType    `json:"type"`
	Host            string            `json:"host"`
	Port            int               `json:"port"`
	Database        string            `json:"database"`
	Username        string            `json:"username"`
	Password        string            `json:"-"`
	PasswordEnc     string            `json:"-"`
	SSLMode         string            `json:"sslMode,omitempty"`
	AuthSource      string            `json:"authSource,omitempty"`
	MaxOpenConns    int               `json:"maxOpenConns,omitempty"`
	MaxIdleConns    int               `json:"maxIdleConns,omitempty"`
	ConnMaxLifetime time.Duration     `json:"connMaxLifetime,omitempty"`
	Status          DataSourceStatus  `json:"status"`
	LastChecked     time.Time         `json:"lastChecked,omitempty"`
	Error           string            `json:"error,omitempty"`
	Tags            map[string]string `json:"tags,omitempty"`
	CreatedAt       time.Time         `json:"createdAt"`
	UpdatedAt       time.Time         `json:"updatedAt"`
	TenantID        string            `json:"tenantId"`
}

// QueryResult holds the result of a SQL query execution.
type QueryResult struct {
	Columns  []string         `json:"columns"`
	Rows     []map[string]any `json:"rows"`
	RowCount int              `json:"rowCount"`
	Affected int64            `json:"affected,omitempty"`
	Took     time.Duration    `json:"took"`
}

// HealthStatus reports a single datasource health check result.
type HealthStatus struct {
	DataSourceID string           `json:"dataSourceId"`
	Status       DataSourceStatus `json:"status"`
	Latency      time.Duration    `json:"latency"`
	Error        string           `json:"error,omitempty"`
	CheckedAt    time.Time        `json:"checkedAt"`
}
