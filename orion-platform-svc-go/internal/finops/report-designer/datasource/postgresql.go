package datasource

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"time"

	_ "github.com/lib/pq"
	"github.com/jmoiron/sqlx"
)

// PostgreSQLSource implements DataSource for PostgreSQL.
type PostgreSQLSource struct {
	cfg  *DataSourceConfig
	db   *sqlx.DB
	conn *sql.DB
}

// NewPostgreSQLSource creates a new PostgreSQLSource from config.
func NewPostgreSQLSource(cfg *DataSourceConfig) (*PostgreSQLSource, error) {
	if cfg == nil {
		return nil, fmt.Errorf("datasource config is nil")
	}
	return &PostgreSQLSource{cfg: cfg}, nil
}

// Type returns the data source type.
func (p *PostgreSQLSource) Type() DataSourceType {
	return TypePostgreSQL
}

// Connect establishes a connection to PostgreSQL.
func (p *PostgreSQLSource) Connect(ctx context.Context) error {
	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		"localhost", 5432, "postgres", "postgres", "postgres", "disable",
	)

	db, err := sqlx.ConnectContext(ctx, "postgres", dsn)
	if err != nil {
		return fmt.Errorf("failed to connect to postgresql: %w", err)
	}

	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	p.db = db
	p.conn = db.DB

	return db.PingContext(ctx)
}

// Close releases the database connection.
func (p *PostgreSQLSource) Close() error {
	if p.conn != nil {
		return p.conn.Close()
	}
	return nil
}

// Execute runs a SQL query against PostgreSQL.
func (p *PostgreSQLSource) Execute(ctx context.Context, query string, params map[string]interface{}) (*QueryResult, error) {
	if p.db == nil {
		return nil, fmt.Errorf("postgresql datasource not connected")
	}

	// Build parameterized query with positional args.
	args := []interface{}{}
	for i := 0; i < len(params); i++ {
		args = append(args, params[strconv.Itoa(i)])
	}

	rows, err := p.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to execute postgresql query: %w", err)
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("failed to get columns: %w", err)
	}

	result := &QueryResult{Fields: cols}
	for rows.Next() {
		values := make([]interface{}, len(cols))
		valuePtrs := make([]interface{}, len(cols))
		for i := range values {
			valuePtrs[i] = &values[i]
		}
		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}
		// Convert to concrete types.
		row := make([]interface{}, len(cols))
		for i, v := range values {
			if b, ok := v.([]byte); ok {
				row[i] = string(b)
			} else {
				row[i] = v
			}
		}
		result.Rows = append(result.Rows, row)
	}
	result.Total = len(result.Rows)

	return result, nil
}

// Health checks the PostgreSQL connection health.
func (p *PostgreSQLSource) Health(ctx context.Context) (bool, error) {
	if p.db == nil {
		return false, fmt.Errorf("postgresql datasource not connected")
	}
	return p.db.PingContext(ctx) == nil, nil
}
