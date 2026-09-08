package explain

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	dba_models "orion/platform-svc-go/internal/dba/models"
)

// Fetcher runs a single EXPLAIN command against a data source and
// returns the raw text (or JSON) output. It is intentionally narrow —
// it owns the connection lifecycle and nothing else.
type Fetcher struct {
	dsLookup DataSourceLookup
}

// DataSourceLookup resolves a data source ID to credentials. The
// base dba.Repository satisfies this so callers do not need a second
// lookup implementation.
type DataSourceLookup interface {
	GetDataSource(ctx context.Context, id string) (*dba_models.DataSource, error)
}

// NewFetcher constructs a Fetcher.
func NewFetcher(ds DataSourceLookup) *Fetcher {
	return &Fetcher{dsLookup: ds}
}

// FetchPG runs `EXPLAIN [ANALYZE] <sql>` on a PostgreSQL server and
// returns the multi-line text output. EXPLAIN returns one row per
// plan line, so we concatenate all rows with newlines.
func (f *Fetcher) FetchPG(ctx context.Context, ds *dba_models.DataSource, sqlText string, analyze bool) (string, time.Duration, error) {
	conn, err := sql.Open("postgres", buildPGDSN(ds))
	if err != nil {
		return "", 0, fmt.Errorf("open pg: %w", err)
	}
	defer conn.Close()
	if err := conn.PingContext(ctx); err != nil {
		return "", 0, fmt.Errorf("ping pg: %w", err)
	}

	var cmd string
	if analyze {
		cmd = "EXPLAIN (ANALYZE, BUFFERS) " + sqlText
	} else {
		cmd = "EXPLAIN (BUFFERS) " + sqlText
	}

	start := time.Now()
	rows, err := conn.QueryContext(ctx, cmd)
	if err != nil {
		return "", 0, fmt.Errorf("explain pg: %w", err)
	}
	defer rows.Close()

	var sb strings.Builder
	for rows.Next() {
		var line string
		if err := rows.Scan(&line); err != nil {
			return "", 0, fmt.Errorf("scan pg row: %w", err)
		}
		if sb.Len() > 0 {
			sb.WriteByte('\n')
		}
		sb.WriteString(line)
	}
	if err := rows.Err(); err != nil {
		return "", 0, fmt.Errorf("iterate pg rows: %w", err)
	}
	return sb.String(), time.Since(start), nil
}

// FetchMySQL runs `EXPLAIN FORMAT=JSON <sql>` on a MySQL server and
// returns the JSON string. The caller parses it via ParseMySQL.
func (f *Fetcher) FetchMySQL(ctx context.Context, ds *dba_models.DataSource, sqlText string, analyze bool) (string, time.Duration, error) {
	conn, err := sql.Open("mysql", buildMySQLDSN(ds))
	if err != nil {
		return "", 0, fmt.Errorf("open mysql: %w", err)
	}
	defer conn.Close()
	if err := conn.PingContext(ctx); err != nil {
		return "", 0, fmt.Errorf("ping mysql: %w", err)
	}

	start := time.Now()
	var jsonOut string
	if err := conn.QueryRowContext(ctx, "EXPLAIN FORMAT=JSON "+sqlText).Scan(&jsonOut); err != nil {
		return "", 0, fmt.Errorf("explain mysql: %w", err)
	}
	return jsonOut, time.Since(start), nil
}

// buildPGDSN builds a PostgreSQL DSN. sslmode=require enforces TLS so
// credentials are never sent in cleartext — consistent with dba/service
// and dba/query.
func buildPGDSN(ds *dba_models.DataSource) string {
	return fmt.Sprintf(
		"host=%s port=%d dbname=%s user=%s password=%s sslmode=require",
		ds.Host, ds.Port, ds.Database, derefString(ds.Username), derefString(ds.Password),
	)
}

func buildMySQLDSN(ds *dba_models.DataSource) string {
	return fmt.Sprintf(
		"%s:%s@tcp(%s:%d)/%s?timeout=10s&parseTime=true",
		derefString(ds.Username), derefString(ds.Password), ds.Host, ds.Port, ds.Database,
	)
}

func derefString(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
