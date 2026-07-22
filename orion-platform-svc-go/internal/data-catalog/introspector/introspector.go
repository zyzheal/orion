// Package introspector connects to external databases and introspects their schema
// (tables, columns, primary keys, foreign keys, indexes) using the standard
// information_schema views and engine-specific introspection APIs.
package introspector

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/data-catalog/models"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
)

// DefaultTimeoutSeconds is the default connection/query timeout when none is specified.
const DefaultTimeoutSeconds = 10

// Introspector discovers schema metadata from one or more databases.
type Introspector struct {
	// Driver names mapped from dialect.
	drivers map[models.ConnectionType]string
}

// New returns a new Introspector with the well-known driver registry.
func New() *Introspector {
	return &Introspector{
		drivers: map[models.ConnectionType]string{
			models.ConnectionTypePostgreSQL: "postgres",
			models.ConnectionTypeMySQL:      "mysql",
			"sqlite":       "sqlite3",
			"sqlite3":      "sqlite3",
		},
	}
}

// Discover connects to every config and returns per-database results plus errors.
func (i *Introspector) Discover(ctx context.Context, configs []models.DiscoveryConfig) (map[string][]*models.DiscoveredSchema, []string) {
	databaseSchemas := make(map[string][]*models.DiscoveredSchema)
	var errs []string

	for _, cfg := range configs {
		schemas, err := i.discoverOne(ctx, cfg)
		if err != nil {
			errs = append(errs, fmt.Sprintf("%s (%s): %v", cfg.Name, cfg.Dialect, err))
			continue
		}
		if schemas != nil {
			databaseSchemas[cfg.Name] = schemas
		}
	}

	return databaseSchemas, errs
}

// discoverOne connects to a single database and returns the discovered schemas.
func (i *Introspector) discoverOne(ctx context.Context, cfg models.DiscoveryConfig) ([]*models.DiscoveredSchema, error) {
	driver, ok := i.drivers[cfg.Dialect]
	if !ok {
		// Fallback: accept common alias spellings.
		switch strings.ToLower(string(cfg.Dialect)) {
		case "postgresql", "postgres":
			driver = "postgres"
		case "mysql", "maria":
			driver = "mysql"
		case "sqlite", "sqlite3":
			driver = "sqlite3"
		}
		if driver == "" {
			return nil, fmt.Errorf("unsupported dialect: %s", cfg.Dialect)
		}
	}

	db, err := sql.Open(driver, cfg.DSN)
	if err != nil {
		return nil, fmt.Errorf("open connection: %w", err)
	}
	defer db.Close()

	// Ping the database to confirm connectivity.
	pingCtx, cancel := context.WithTimeout(ctx, i.timeoutDuration(cfg.TimeoutSec))
	defer cancel()
	if err := db.PingContext(pingCtx); err != nil {
		return nil, fmt.Errorf("ping: %w", err)
	}

	switch string(cfg.Dialect) {
	case "postgresql", "postgres":
		return i.discoverPostgreSQL(ctx, db, cfg)
	case "mysql", "maria":
		return i.discoverMySQL(ctx, db, cfg)
	case "sqlite", "sqlite3":
		return i.discoverSQLite(ctx, db, cfg)
	}
	return nil, fmt.Errorf("unsupported dialect: %s", cfg.Dialect)
}

// discoverPostgreSQL queries the PostgreSQL catalog views for schema metadata.
func (i *Introspector) discoverPostgreSQL(ctx context.Context, db *sql.DB, cfg models.DiscoveryConfig) ([]*models.DiscoveredSchema, error) {
	schemaName := cfg.SchemaName
	if schemaName == "" {
		schemaName = "public"
	}

	// List tables.
	tableRows, err := db.QueryContext(ctx,
		`SELECT table_name FROM information_schema.tables WHERE table_schema=$1 AND table_type='BASE TABLE'`, schemaName)
	if err != nil {
		return nil, fmt.Errorf("list tables: %w", err)
	}
	var tableNames []string
	for tableRows.Next() {
		var t string
		if err := tableRows.Scan(&t); err != nil {
			tableRows.Close()
			return nil, fmt.Errorf("scan table: %w", err)
		}
		tableNames = append(tableNames, t)
	}
	tableRows.Close()

	schemas := make([]*models.DiscoveredSchema, 0, len(tableNames))
	for _, t := range tableNames {
		s, err := i.postgresTable(ctx, db, schemaName, t)
		if err != nil {
			// Log but continue; per-table failures should not abort discovery.
			s = &models.DiscoveredSchema{TableName: t, SchemaName: schemaName}
			s.Columns = append(s.Columns, models.ColumnInfo{Name: "", DataType: fmt.Sprintf("error: %v", err)})
		}
		schemas = append(schemas, s)
	}
	return schemas, nil
}

func (i *Introspector) postgresTable(ctx context.Context, db *sql.DB, schema, table string) (*models.DiscoveredSchema, error) {
	ds := &models.DiscoveredSchema{
		TableName:  table,
		SchemaName: schema,
	}

	// Columns.
	colRows, err := db.QueryContext(ctx,
		`SELECT column_name, data_type, is_nullable, column_default, ordinal_position
		 FROM information_schema.columns
		 WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position`,
		schema, table)
	if err != nil {
		return nil, fmt.Errorf("columns: %w", err)
	}
	for colRows.Next() {
		var name, dataType, nullable, def sql.NullString
		var ordinal int
		if err := colRows.Scan(&name, &dataType, &nullable, &def, &ordinal); err != nil {
			continue
		}
		ds.Columns = append(ds.Columns, models.ColumnInfo{
			Name:            name.String,
			DataType:        dataType.String,
			IsNullable:      nullable.String == "YES",
			DefaultValue:    def.String,
			OrdinalPosition: ordinal,
		})
	}
	colRows.Close()

	// Primary keys.
	pkRows, err := db.QueryContext(ctx,
		`SELECT a.attname FROM pg_index i, pg_attribute a
		 WHERE i.indexrelid = i.indexrelid AND i.indrelid = $1::regclass::oid
		   AND a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) AND i.indisprimary`,
		fmt.Sprintf("%s.%s", schema, table))
	if err == nil {
		for pkRows.Next() {
			var col string
			if err := pkRows.Scan(&col); err == nil {
				ds.PrimaryKey = append(ds.PrimaryKey, col)
				for idx := range ds.Columns {
					if ds.Columns[idx].Name == col {
						ds.Columns[idx].IsPrimary = true
					}
				}
			}
		}
		pkRows.Close()
	}

	// Foreign keys.
	fkRows, err := db.QueryContext(ctx,
		`SELECT a.attname AS column_name,
			    concat(relpk.relname) AS referenced_table,
			    concat(attpk.attname) AS referenced_column
		 FROM pg_constraint con
		  JOIN pg_class rel ON rel.oid = con.conrelid
		  JOIN pg_class relpk ON relpk.oid = con.confrelid
		  JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
		  JOIN pg_attribute attpk ON attpk.attrelid = con.confrelid AND attpk.attnum = ANY(con.confkey)
		 WHERE con.contype = 'f' AND rel.relname = $1 AND rel.namespace = $2::regnamespace::oid`,
		table, schema)
	if err == nil {
		for fkRows.Next() {
			var col, refTable, refCol string
			if err := fkRows.Scan(&col, &refTable, &refCol); err == nil {
				ds.ForeignKeyRefs = append(ds.ForeignKeyRefs, models.ForeignKeyRef{
					ColumnName:       col,
					ReferencedTable:  refTable,
					ReferencedColumn: refCol,
				})
				for idx := range ds.Columns {
					if ds.Columns[idx].Name == col {
						ds.Columns[idx].IsForeignKey = true
					}
				}
			}
		}
		fkRows.Close()
	}

	// Indexes.
	idxRows, err := db.QueryContext(ctx,
		`SELECT i.relname AS index_name,
			    ARRAY(SELECT a.attname
				      FROM pg_index pi, pg_attribute a
				      WHERE pi.indexrelid = i.oid AND a.attrelid = i.parent
				        AND a.attnum = ANY(pi.indkey)
				      ORDER BY a.attnum) AS cols,
			    ix.indisunique AS is_unique,
			    ix.indisprimary AS is_primary
		 FROM pg_index ix, pg_class i, pg_class parent
		 WHERE ix.indexrelid = i.oid AND ix.indrelid = parent.oid
		   AND parent.relname = $1 AND parent.relnamespace = $2::regnamespace::oid`,
		table, schema)
	if err == nil {
		for idxRows.Next() {
			var name string
			var cols []string
			var isUnique, isPrimary bool
			if err := idxRows.Scan(&name, &cols, &isUnique, &isPrimary); err == nil {
				ds.Indexes = append(ds.Indexes, models.IndexInfo{
					Name:      name,
					Columns:   cols,
					IsUnique:  isUnique,
					IsPrimary: isPrimary,
				})
			}
		}
		idxRows.Close()
	}

	return ds, nil
}

// ---------- MySQL ----------

func (i *Introspector) discoverMySQL(ctx context.Context, db *sql.DB, cfg models.DiscoveryConfig) ([]*models.DiscoveredSchema, error) {
	tableName := cfg.SchemaName // for MySQL, SchemaName field is reused as the database name.

	tableRows, err := db.QueryContext(ctx,
		`SELECT table_name FROM information_schema.tables WHERE table_schema=? AND table_type='BASE TABLE'`, tableName)
	if err != nil {
		return nil, fmt.Errorf("list tables: %w", err)
	}
	var tableNames []string
	for tableRows.Next() {
		var t string
		if err := tableRows.Scan(&t); err != nil {
			tableRows.Close()
			return nil, fmt.Errorf("scan table: %w", err)
		}
		tableNames = append(tableNames, t)
	}
	// tableRows already closed via defer; avoid double-close.
	_ = tableRows.Close()

	schemas := make([]*models.DiscoveredSchema, 0, len(tableNames))
	for _, t := range tableNames {
		s, err := i.mysqlTable(ctx, db, tableName, t)
		if err != nil {
			s = &models.DiscoveredSchema{TableName: t, SchemaName: tableName}
			s.Columns = append(s.Columns, models.ColumnInfo{Name: "", DataType: fmt.Sprintf("error: %v", err)})
		}
		schemas = append(schemas, s)
	}
	return schemas, nil
}

func (i *Introspector) mysqlTable(ctx context.Context, db *sql.DB, database, table string) (*models.DiscoveredSchema, error) {
	ds := &models.DiscoveredSchema{
		TableName:  table,
		SchemaName: database,
	}

	// Columns.
	colRows, err := db.QueryContext(ctx,
		`SELECT column_name, data_type, is_nullable, column_default, ordinal_position
		 FROM information_schema.columns WHERE table_schema=? AND table_name=? ORDER BY ordinal_position`,
		database, table)
	if err != nil {
		return nil, fmt.Errorf("columns: %w", err)
	}
	defer colRows.Close()
	for colRows.Next() {
		var name, dataType, nullable string
		var def sql.NullString
		var ordinal int
		if err := colRows.Scan(&name, &dataType, &nullable, &def, &ordinal); err != nil {
			continue
		}
		ds.Columns = append(ds.Columns, models.ColumnInfo{
			Name:            name,
			DataType:        dataType,
			IsNullable:      strings.EqualFold(nullable, "YES"),
			DefaultValue:    def.String,
			OrdinalPosition: ordinal,
		})
	}

	// Primary keys.
	pkRows, err := db.QueryContext(ctx,
		`SELECT column_name FROM information_schema.key_column_usage
		 WHERE table_schema=? AND table_name=? AND constraint_name='PRIMARY' ORDER BY ordinal_position`,
		database, table)
	if err == nil {
		defer pkRows.Close()
		for pkRows.Next() {
			var col string
			if err := pkRows.Scan(&col); err == nil {
				ds.PrimaryKey = append(ds.PrimaryKey, col)
				for idx := range ds.Columns {
					if ds.Columns[idx].Name == col {
						ds.Columns[idx].IsPrimary = true
					}
				}
			}
		}
	}

	// Foreign keys.
	fkRows, err := db.QueryContext(ctx,
		`SELECT kcu.column_name,
			    kcu.referenced_table_name,
			    kcu.referenced_column_name
		 FROM information_schema.referential_constraints rc
		 JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = rc.constraint_name
		 WHERE rc.constraint_schema=? AND kcu.table_schema=? AND kcu.table_name=?`,
		database, database, table)
	if err == nil {
		defer fkRows.Close()
		for fkRows.Next() {
			var col, refTable, refCol sql.NullString
			if err := fkRows.Scan(&col, &refTable, &refCol); err == nil && col.String != "" {
				ds.ForeignKeyRefs = append(ds.ForeignKeyRefs, models.ForeignKeyRef{
					ColumnName:       col.String,
					ReferencedTable:  refTable.String,
					ReferencedColumn: refCol.String,
				})
				for idx := range ds.Columns {
					if ds.Columns[idx].Name == col.String {
						ds.Columns[idx].IsForeignKey = true
					}
				}
			}
		}
	}

	// Indexes.
	idxRows, err := db.QueryContext(ctx,
		`SELECT index_name, group_concat(column_name order by seq_in_index) as cols, non_unique
		 FROM information_schema.statistics
		 WHERE table_schema=? AND table_name=? GROUP BY index_name`,
		database, table)
	if err == nil {
		defer idxRows.Close()
		for idxRows.Next() {
			var name, cols string
			nonUnique := 0
			if err := idxRows.Scan(&name, &cols, &nonUnique); err != nil {
				continue
			}
			ds.Indexes = append(ds.Indexes, models.IndexInfo{
				Name:      name,
				Columns:   strings.Split(cols, ","),
				IsUnique:  nonUnique == 0,
				IsPrimary: strings.EqualFold(name, "PRIMARY"),
			})
		}
	}

	return ds, nil
}

// ---------- SQLite ----------

func (i *Introspector) discoverSQLite(ctx context.Context, db *sql.DB, cfg models.DiscoveryConfig) ([]*models.DiscoveredSchema, error) {
	// List tables from sqlite_master.
	tableRows, err := db.QueryContext(ctx,
		`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
	if err != nil {
		return nil, fmt.Errorf("list tables: %w", err)
	}
	defer tableRows.Close()
	var tableNames []string
	for tableRows.Next() {
		var t string
		if err := tableRows.Scan(&t); err != nil {
			return nil, fmt.Errorf("scan table: %w", err)
		}
		tableNames = append(tableNames, t)
	}

	schemas := make([]*models.DiscoveredSchema, 0, len(tableNames))
	for _, t := range tableNames {
		s, err := i.sqliteTable(ctx, db, t)
		if err != nil {
			s = &models.DiscoveredSchema{TableName: t}
			s.Columns = append(s.Columns, models.ColumnInfo{Name: "", DataType: fmt.Sprintf("error: %v", err)})
		}
		schemas = append(schemas, s)
	}
	return schemas, nil
}

func (i *Introspector) sqliteTable(ctx context.Context, db *sql.DB, table string) (*models.DiscoveredSchema, error) {
	ds := &models.DiscoveredSchema{
		TableName: table,
	}

	// PRAGMA table_info.
	quoted := "`" + table + "`"
	colRows, err := db.QueryContext(ctx, fmt.Sprintf(`PRAGMA table_info(%s)`, quoted))
	if err != nil {
		return nil, fmt.Errorf("table_info: %w", err)
	}
	defer colRows.Close()
	for colRows.Next() {
		var cid int
		var name, dataType string
		var notNull, pk int
		var def sql.NullString
		if err := colRows.Scan(&cid, &name, &dataType, &notNull, &def, &pk); err != nil {
			continue
		}
		ds.Columns = append(ds.Columns, models.ColumnInfo{
			Name:            name,
			DataType:        dataType,
			IsNullable:      notNull == 0,
			IsPrimary:       pk != 0,
			DefaultValue:    def.String,
			OrdinalPosition: cid,
		})
	}

	// Primary keys (also captured from table_info, but gather names here).
	for idx := range ds.Columns {
		if ds.Columns[idx].IsPrimary {
			ds.PrimaryKey = append(ds.PrimaryKey, ds.Columns[idx].Name)
		}
	}

	// Foreign keys via PRAGMA foreign_key_list.
	fkRows, err := db.QueryContext(ctx, fmt.Sprintf(`PRAGMA foreign_key_list(%s)`, quoted))
	if err == nil {
		defer fkRows.Close()
		for fkRows.Next() {
			var seq int
			var refTable, fromCol, toCol string
			var onUpdate, onDelete, match string
			if err := fkRows.Scan(&seq, &refTable, &toCol, &fromCol, &onUpdate, &onDelete, &match); err != nil {
				continue
			}
			ds.ForeignKeyRefs = append(ds.ForeignKeyRefs, models.ForeignKeyRef{
				ColumnName:       fromCol,
				ReferencedTable:  refTable,
				ReferencedColumn: toCol,
			})
			for idx := range ds.Columns {
				if ds.Columns[idx].Name == fromCol {
					ds.Columns[idx].IsForeignKey = true
				}
			}
		}
	}

	// Indexes via PRAGMA index_list + index_info.
	idxListRows, err := db.QueryContext(ctx, fmt.Sprintf(`PRAGMA index_list(%s)`, quoted))
	if err == nil {
		defer idxListRows.Close()
		for idxListRows.Next() {
			var seq, unique, origin, partial int
			var idxName string
			if err := idxListRows.Scan(&seq, &idxName, &unique, &origin, &partial); err != nil {
				_ = origin // keep compiler happy; origin is a uint8 bitmask
				continue
			}
			if idxName == "" {
				continue
			}
			var cols []string
			// SQLite marks auto-created indexes (e.g., PK) with the sqlite_autoindex_ prefix.
			isPrimary := strings.HasPrefix(idxName, "sqlite_autoindex_")

			infoRows, err := db.QueryContext(ctx, fmt.Sprintf(`PRAGMA index_info(%q)`, idxName))
			if err == nil {
				defer infoRows.Close()
				for infoRows.Next() {
					seqno := 0
					var key, col string
					if err := infoRows.Scan(&seqno, &key, &col); err == nil {
						cols = append(cols, col)
					}
				}
			}

			ds.Indexes = append(ds.Indexes, models.IndexInfo{
				Name:      idxName,
				Columns:   cols,
				IsUnique:  unique != 0 || isPrimary,
				IsPrimary: isPrimary,
			})
		}
	}

	return ds, nil
}

// ---------- helper ----------

// timeoutDuration converts a timeout in seconds to a time.Duration.
// When the value is non-positive, the default is used.
func (i *Introspector) timeoutDuration(sec int) time.Duration {
	if sec <= 0 {
		sec = DefaultTimeoutSeconds
	}
	return time.Duration(sec) * time.Second
}

// ensureErrorsHandled suppresses unused-variable warnings in tests.
var _ = errors.Is
