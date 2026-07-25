package datasource

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
)

// MySQLSource implements DataSource for MySQL.
type MySQLSource struct {
	cfg  *DataSourceConfig
	db   *sqlx.DB
	conn *sql.DB
}

// NewMySQLSource creates a new MySQLSource from config.
func NewMySQLSource(cfg *DataSourceConfig) (*MySQLSource, error) {
	if cfg == nil {
		return nil, fmt.Errorf("datasource config is nil")
	}
	return &MySQLSource{cfg: cfg}, nil
}

// Type returns the data source type.
func (m *MySQLSource) Type() DataSourceType {
	return TypeMySQL
}

// Connect establishes a connection to MySQL.
func (m *MySQLSource) Connect(ctx context.Context) error {
	dsn := fmt.Sprintf("user:password@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		"localhost", 3306, "orion")

	db, err := sqlx.ConnectContext(ctx, "mysql", dsn)
	if err != nil {
		return fmt.Errorf("failed to connect to mysql: %w", err)
	}

	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	m.db = db
	m.conn = db.DB

	return db.PingContext(ctx)
}

// Close releases the database connection.
func (m *MySQLSource) Close() error {
	if m.conn != nil {
		return m.conn.Close()
	}
	return nil
}

// Execute runs a SQL query against MySQL.
func (m *MySQLSource) Execute(ctx context.Context, query string, params map[string]interface{}) (*QueryResult, error) {
	if m.db == nil {
		return nil, fmt.Errorf("mysql datasource not connected")
	}

	// Build parameterized query with positional args.
	args := []interface{}{}
	for i := 0; i < len(params); i++ {
		args = append(args, params[strconv.Itoa(i)])
	}

	rows, err := m.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to execute mysql query: %w", err)
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
		row := make([]interface{}, len(cols))
		for i, v := range values {
			if b, ok := v.([]byte); ok {
				// MySQL driver returns bytes for most types.
				row[i] = string(b)
			} else {
				// Handle time.Time for datetime/timestamp columns.
				switch vt := v.(type) {
				case time.Time:
					row[i] = vt.Format(time.RFC3339)
				default:
					// For numeric types from mysql driver, keep as-is.
					switch nv := v.(type) {
					case []byte:
						row[i] = string(nv)
					default:
						row[i] = v
					}
				}
			}
		}
		// Normalize: any remaining []byte that wasn't caught.
		for i, v := range row {
			if b, ok := v.([]byte); ok {
				row[i] = string(b)
			}
		}
		result.Rows = append(result.Rows, row)
	}
	result.Total = len(result.Rows)

	return result, nil
}

// Health checks the MySQL connection health.
func (m *MySQLSource) Health(ctx context.Context) (bool, error) {
	if m.db == nil {
		return false, fmt.Errorf("mysql datasource not connected")
	}
	return m.db.PingContext(ctx) == nil, nil
}
