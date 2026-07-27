package datasource

import (
	"context"
	"errors"
	"time"
)

// DataSourceType defines the supported data source types.
type DataSourceType string

const (
	// Database-backed sources
	TypePostgreSQL DataSourceType = "postgresql"
	TypeMySQL      DataSourceType = "mysql"

	// API-backed sources
	TypeREST     DataSourceType = "rest"
	TypeGraphQL  DataSourceType = "graphql"

	// File-backed sources
	TypeCSV DataSourceType = "csv"
	TypeJSON DataSourceType = "json"

	// Metrics-backed sources
	TypePrometheus DataSourceType = "prometheus"
)

var ErrUnknownType = errors.New("unknown datasource type")

// DataSourceConfig holds common configuration for all data sources.
type DataSourceConfig struct {
	Type       DataSourceType            `json:"type"`
	Name       string                    `json:"name"`
	Timeout    time.Duration             `json:"timeout"`
	RetryCount int                       `json:"retry_count"`
	Config     map[string]interface{}    `json:"config"`
}

// DatabaseConfig holds configuration for database data sources.
type DatabaseConfig struct {
	Host      string `json:"host"`
	Port      int    `json:"port"`
	Database  string `json:"database"`
	User      string `json:"user"`
	Password  string `json:"password"`
	SSLMode   string `json:"ssl_mode,omitempty"`
	MaxConns  int    `json:"max_conns,omitempty"`
	MaxIdle   int    `json:"max_idle,omitempty"`
}

// APIConfig holds configuration for API data sources.
type APIConfig struct {
	BaseURL        string            `json:"base_url"`
	HTTPMethod     string            `json:"http_method"`
	Path           string            `json:"path"`
	Headers        map[string]string `json:"headers,omitempty"`
	AuthToken      string            `json:"auth_token,omitempty"`
	QueryParams    map[string]string `json:"query_params,omitempty"`
}

// FileConfig holds configuration for file-based data sources.
type FileConfig struct {
	Path     string `json:"path"`
	Encoding string `json:"encoding,omitempty"` // utf-8 (default), utf-16
}

// MetricsConfig holds configuration for Prometheus metrics data sources.
type MetricsConfig struct {
	Address     string `json:"address"`
	Timeout     string `json:"timeout,omitempty"`
	BearerToken string `json:"bearer_token,omitempty"`
}

// QueryResult holds the result of a query execution.
type QueryResult struct {
	Rows   [][]interface{} `json:"rows"`
	Fields []string        `json:"fields"`
	Total  int             `json:"total"`
	Error  string          `json:"error,omitempty"`
}

// DataSource is the interface that all data sources must implement.
type DataSource interface {
	// Type returns the type of the data source.
	Type() DataSourceType

	// Connect establishes a connection to the data source.
	Connect(ctx context.Context) error

	// Close releases any held resources.
	Close() error

	// Execute runs a query against the data source and returns results.
	Execute(ctx context.Context, query string, params map[string]interface{}) (*QueryResult, error)

	// Health returns the health status of the data source.
	Health(ctx context.Context) (bool, error)
}

// Connector wraps a DataSource with connection-pooling logic.
// It provides bounded, thread-safe access to a single DataSource instance.
type Connector struct {
	ds       DataSource
	poolSize int
	pool     chan DataSource
}

// NewConnector creates a new Connector for the given DataSource.
// poolSize must be >= 1.
func NewConnector(ds DataSource, poolSize int) *Connector {
	if poolSize < 1 {
		poolSize = 1
	}
	pool := make(chan DataSource, poolSize)
	// Single-instance pooling: we share one DataSource and use the pool
	// as a semaphore to bound concurrent execution.
	for i := 0; i < poolSize; i++ {
		pool <- ds
	}
	return &Connector{
		ds:       ds,
		poolSize: poolSize,
		pool:     pool,
	}
}

// acquire grabs a token from the pool within the context deadline.
func (c *Connector) acquire(ctx context.Context) error {
	select {
	case <-c.pool:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// release puts a token back into the pool.
func (c *Connector) release() {
	select {
	case c.pool <- c.ds:
	default:
		// Pool is full — this should not happen, but avoid blocking.
	}
}

// Execute acquires a connection from the pool, runs the query, and releases it.
func (c *Connector) Execute(ctx context.Context, query string, params map[string]interface{}) (*QueryResult, error) {
	if err := c.acquire(ctx); err != nil {
		return nil, err
	}
	defer c.release()

	return c.ds.Execute(ctx, query, params)
}

// PoolSize returns the configured pool size.
func (c *Connector) PoolSize() int {
	return c.poolSize
}

// Close closes the underlying data source.
func (c *Connector) Close() error {
	if c.ds == nil {
		return nil
	}
	return c.ds.Close()
}

// Health checks the underlying data source health.
func (c *Connector) Health(ctx context.Context) (bool, error) {
	return c.ds.Health(ctx)
}
