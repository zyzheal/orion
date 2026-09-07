package advisor

import (
	"context"
	"database/sql"
	"fmt"

	dba_models "orion/platform-svc-go/internal/dba/models"
)

// Repository fetches schema + slow query data from the target
// database. Unlike the other DBA repositories (which write to the
// platform PG), this one is read-only against the source DB.
type Repository struct {
	dsLookup DataSourceLookup
}

// DataSourceLookup resolves a data source ID to credentials.
type DataSourceLookup interface {
	GetDataSource(ctx context.Context, id string) (*dba_models.DataSource, error)
}

// NewRepository returns a Repository backed by dsLookup.
func NewRepository(ds DataSourceLookup) *Repository {
	return &Repository{dsLookup: ds}
}

// ListExistingIndexes queries the schema for existing indexes on the
// target database. Returns an empty slice when the query fails so
// the advisor can still produce suggestions from slow query data
// alone.
func (r *Repository) ListExistingIndexes(ctx context.Context, ds *dba_models.DataSource, dbType, schema string) ([]ExistingIndex, error) {
	dsn, driver := buildDSN(ds, dbType)
	if dsn == "" {
		return nil, fmt.Errorf("unsupported db type: %s", ds.Type)
	}
	conn, err := sql.Open(driver, dsn)
	if err != nil {
		return nil, fmt.Errorf("open: %w", err)
	}
	defer conn.Close()
	if err := conn.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("ping: %w", err)
	}

	switch dbType {
	case "postgres":
		return r.listPGIndexes(ctx, conn, schema)
	case "mysql":
		return r.listMySQLIndexes(ctx, conn)
	default:
		return nil, fmt.Errorf("unsupported db type: %s", dbType)
	}
}

func (r *Repository) listPGIndexes(ctx context.Context, conn *sql.DB, schema string) ([]ExistingIndex, error) {
	sch := schema
	if sch == "" {
		sch = "public"
	}
	q := `SELECT
		i.relname AS index_name,
		t.relname AS table_name,
		a.attname AS column_name,
		i.indisunique AS unique
	FROM pg_index ix
	JOIN pg_class i ON i.oid = ix.indexrelid
	JOIN pg_class t ON t.oid = ix.indrelid
	JOIN pg_namespace n ON n.oid = t.relnamespace
	JOIN unnest(ix.indkey) WITH ORDINALITY AS col(attnum, ord) ON true
	JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = col.attnum
	WHERE n.nspname = $1 AND ix.indisvalid
	ORDER BY t.relname, i.relname, col.ord`
	rows, err := conn.QueryContext(ctx, q, sch)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	idx := map[string]*ExistingIndex{}
	for rows.Next() {
		var name, table, col string
		var unique bool
		if err := rows.Scan(&name, &table, &col, &unique); err != nil {
			return nil, err
		}
		key := name
		e, ok := idx[key]
		if !ok {
			e = &ExistingIndex{Name: name, Table: table, Unique: unique}
			idx[key] = e
		}
		e.Columns = append(e.Columns, col)
	}
	var out []ExistingIndex
	for _, e := range idx {
		out = append(out, *e)
	}
	return out, nil
}

func (r *Repository) listMySQLIndexes(ctx context.Context, conn *sql.DB) ([]ExistingIndex, error) {
	q := `SELECT
		TABLE_NAME AS table_name,
		INDEX_NAME AS index_name,
		COLUMN_NAME AS column_name,
		NON_UNIQUE AS non_unique
	FROM information_schema.statistics
	ORDER BY table_name, index_name, seq_in_index`
	rows, err := conn.QueryContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	idx := map[string]*ExistingIndex{}
	for rows.Next() {
		var table, name, col string
		var nonUnique int
		if err := rows.Scan(&table, &name, &col, &nonUnique); err != nil {
			return nil, err
		}
		key := table + "." + name
		e, ok := idx[key]
		if !ok {
			e = &ExistingIndex{Name: name, Table: table, Unique: nonUnique == 0}
			idx[key] = e
		}
		e.Columns = append(e.Columns, col)
	}
	var out []ExistingIndex
	for _, e := range idx {
		out = append(out, *e)
	}
	return out, nil
}

func buildDSN(ds *dba_models.DataSource, dbType string) (dsn, driver string) {
	user := derefString(ds.Username)
	pass := derefString(ds.Password)
	switch dbType {
	case "postgres":
		return fmt.Sprintf("host=%s port=%d dbname=%s user=%s password=%s sslmode=disable",
			ds.Host, ds.Port, ds.Database, user, pass), "postgres"
	case "mysql":
		return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?timeout=10s&parseTime=true",
			user, pass, ds.Host, ds.Port, ds.Database), "mysql"
	default:
		return "", ""
	}
}

func derefString(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
