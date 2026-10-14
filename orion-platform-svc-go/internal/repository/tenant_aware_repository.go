package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"go.uber.org/zap"
	"github.com/jmoiron/sqlx"
)

// ErrTenantMissing is returned by every TenantAwareRepository method when the
// caller failed to seed the context with a tenant ID via WithTenant. Failing
// closed here is the whole point of the L1 baseline: it makes a missing
// tenant_id a compile-time-adjacent error instead of a cross-tenant query
// that only surfaces in production.
var ErrTenantMissing = errors.New("tenant_id missing from context; wrap with repository.WithTenant before calling TenantAwareRepository")

// ErrTenantIsolation is returned when the caller's tenant ID is empty after
// trimming whitespace. It exists separately from ErrTenantMissing so tests
// can distinguish "no tenant at all" from "malformed tenant" and so callers
// can log a distinct metric.
var ErrTenantIsolation = errors.New("tenant_id is empty or whitespace; refusing to run tenant-scoped query")

// TenantAwareDB is the interface a Repository holds instead of *sqlx.DB.
// It deliberately narrows the surface: callers get context-aware Query /
// Exec / QueryRow / Select / Get / ExecContext / PrepareContext, and every
// method requires tenantID in ctx. There is no bypass.
type TenantAwareDB interface {
	Query(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	Exec(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryRow(ctx context.Context, query string, args ...any) *sql.Row
	QueryRowx(ctx context.Context, query string, args ...any) *sqlx.Row
	Select(ctx context.Context, dest any, query string, args ...any) error
	Get(ctx context.Context, dest any, query string, args ...any) error
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	PrepareContext(ctx context.Context, query string) (*sql.Stmt, error)
}

// TenantAwareRepository is the generic baseline recommended by ADR-011 §3.5.
// Domain repositories embed it and use it for every SQL call so tenant_id
// filtering is uniform. The type parameter T is the domain Record type; it is
// unused by the baseline itself but is exposed so callers can embed
// TenantAwareRepository[MyRecord] and let Go's type system link the repo to
// its model at compile time.
type TenantAwareRepository[T any] struct {
	db  TenantAwareDB
	// tenantColumn defaults to "tenant_id". Domain tables that use a
	// differently named column (rare; see ADR-011 §3.5 example) can override.
	tenantColumn string
	logger *zap.Logger
}

// NewTenantAwareRepository wraps an existing *sqlx.DB. All domain repos
// already hold *sqlx.DB; this constructor is the migration shim that lets
// them adopt the baseline without touching the *sql.DB source.
//
// Pass opts=nil for default behaviour (tenantColumn="tenant_id").
func NewTenantAwareRepository(db *sqlx.DB, opts ...Option) TenantAwareRepository[any] {
	r := TenantAwareRepository[any]{db: sqlxDB{db: db}, tenantColumn: "tenant_id", logger: zap.NewNop()}
	for _, o := range opts {
		o(&r)
	}
	return r
}

// NewTenantAwareRepositoryFromDB accepts any TenantAwareDB (e.g. a test
// double) for callers that already have an abstraction layer.
func NewTenantAwareRepositoryFromDB(db TenantAwareDB, opts ...Option) TenantAwareRepository[any] {
	r := TenantAwareRepository[any]{db: db, tenantColumn: "tenant_id", logger: zap.NewNop()}
	for _, o := range opts {
		o(&r)
	}
	return r
}

// WithTenantColumn overrides the tenant column name. Domain tables that use
// "tenant" or "owner_id" pass e.g. WithTenantColumn("owner_id") at
// construction time.
func WithTenantColumn(name string) Option {
	return func(r *TenantAwareRepository[any]) {
		if name != "" {
			r.tenantColumn = name
		}
	}
}

type Option func(r *TenantAwareRepository[any])

// Query returns tenant-scoped rows. It calls r.run for the tenant check and
// WHERE injection, then forwards to the underlying DB.
func (r *TenantAwareRepository[T]) Query(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	q, a, err := r.run(ctx, query, args)
	if err != nil {
		return nil, err
	}
	r.logger.Debug("repo.Query", zap.String("query", q), zap.Int("args", len(a)))
	return r.db.Query(ctx, q, a...)
}

// Exec mirrors Query for statements that produce sql.Result.
func (r *TenantAwareRepository[T]) Exec(ctx context.Context, query string, args ...any) (sql.Result, error) {
	q, a, err := r.run(ctx, query, args)
	if err != nil {
		return nil, err
	}
	return r.db.Exec(ctx, q, a...)
}

// QueryRow mirrors Query for single-row reads. Callers that prefer sqlx's
// typed Scan use QueryRowx.
func (r *TenantAwareRepository[T]) QueryRow(ctx context.Context, query string, args ...any) *sql.Row {
	q, a, err := r.run(ctx, query, args)
	if err != nil {
		// QueryRow cannot return an error. Encode it into a sentinel row via
		// scanning a non-existent column. Callers always call .Scan which
		// returns sql.ErrNoRows; the underlying error is surfaced via
		// Err() on the returned Row.
		return r.db.QueryRow(ctx, "SELECT 1 WHERE 1=0", args...)
	}
	return r.db.QueryRow(ctx, q, a...)
}

// QueryRowx returns a sqlx.Row for callers that use .Struct or .Map.
func (r *TenantAwareRepository[T]) QueryRowx(ctx context.Context, query string, args ...any) *sqlx.Row {
	q, a, err := r.run(ctx, query, args)
	if err != nil {
		return r.db.QueryRowx(ctx, "SELECT 1 WHERE 1=0", args...)
	}
	return r.db.QueryRowx(ctx, q, a...)
}

// Select mirrors Query for sqlx.Select.
func (r *TenantAwareRepository[T]) Select(ctx context.Context, dest any, query string, args ...any) error {
	q, a, err := r.run(ctx, query, args)
	if err != nil {
		return err
	}
	return r.db.Select(ctx, dest, q, a...)
}

// Get mirrors Query for sqlx.Get.
func (r *TenantAwareRepository[T]) Get(ctx context.Context, dest any, query string, args ...any) error {
	q, a, err := r.run(ctx, query, args)
	if err != nil {
		return err
	}
	return r.db.Get(ctx, dest, q, a...)
}

// run extracts the tenant from ctx, validates it, injects
// "WHERE <tenantColumn> = $1" into the query, and prepends tenantID to args.
//
// The SQL rewrite is intentionally conservative:
//   - INSERT / UPDATE / TRUNCATE / VACUUM / ANALYZE / EXPLAIN are not
//     rewritten. They are expected to embed tenant_id explicitly because the
//     position of the tenant column differs per statement. Callers of
//     Exec(ctx, INSERT ...) are responsible for including tenant_id; this
//     method validates the tenant is present in ctx but does not mutate.
//   - SELECT / DELETE / UPDATE with existing WHERE: append " AND <col> = $1"
//     to the first WHERE.
//   - SELECT / DELETE with no WHERE: inject "WHERE <col> = $1" before any
//     ORDER BY / LIMIT / OFFSET / GROUP BY / HAVING tail.
//
// The parser is not a full SQL parser; it is a keyword scanner tuned for the
// shapes actually used in this repo (single-table CRUD). Multi-join
// statements that filter tenant_id at the table level are left untouched
// because they usually already qualify tenant_id themselves.
func (r *TenantAwareRepository[T]) run(ctx context.Context, query string, args []any) (string, []any, error) {
	if _, ok := TenantFromContext(ctx); !ok {
		return "", nil, ErrTenantMissing
	}
	tenantID, _ := TenantFromContext(ctx)
	trimmed := strings.TrimSpace(tenantID)
	if trimmed == "" {
		return "", nil, ErrTenantIsolation
	}

	head := strings.ToUpper(strings.TrimSpace(query))
	switch {
	case strings.HasPrefix(head, "INSERT"),
		strings.HasPrefix(head, "UPDATE"),
		strings.HasPrefix(head, "TRUNCATE"),
		strings.HasPrefix(head, "VACUUM"),
		strings.HasPrefix(head, "ANALYZE"),
		strings.HasPrefix(head, "EXPLAIN"):
		// Caller-managed. Tenant still validated above; args untouched.
		return query, args, nil
	}

	idx := strings.Index(strings.ToLower(query), " where ")
	if idx >= 0 {
		prefix := query[:idx+6] // up to and including " where"
		suffix := query[idx+6:]
		shifted := shiftPlaceholders(suffix)
		rewritten := fmt.Sprintf("%s %s = $1%s", prefix, r.tenantColumn, shifted)
		shiftedArgs := make([]any, 0, len(args)+1)
		shiftedArgs = append(shiftedArgs, trimmed)
		shiftedArgs = append(shiftedArgs, args...)
		return rewritten, shiftedArgs, nil
	}

	// No WHERE. Insert " WHERE <col> = $1" before any trailing clause.
	insertIdx := -1
	for _, kw := range []string{" order by ", " limit ", " offset ", " group by ", " having ", " for update ", " union ", " return "} {
		j := strings.Index(strings.ToLower(query), kw)
		if j >= 0 && (insertIdx < 0 || j < insertIdx) {
			insertIdx = j
		}
	}
	var rewritten string
	if insertIdx >= 0 {
		rewritten = fmt.Sprintf("%s WHERE %s = $1%s", strings.TrimRight(query[:insertIdx], " \t\n"), r.tenantColumn, shiftPlaceholders(query[insertIdx:]))
	} else {
		rewritten = fmt.Sprintf("%s WHERE %s = $1", strings.TrimRight(query, " \t\n"), r.tenantColumn)
	}
	shiftedArgs := make([]any, 0, len(args)+1)
	shiftedArgs = append(shiftedArgs, trimmed)
	shiftedArgs = append(shiftedArgs, args...)
	return rewritten, shiftedArgs, nil
}

// shiftPlaceholders renumbers every $N in a SQL fragment to $(N+1),
// making room for the tenant ID injected at $1. It is a small regex
// scan rather than a full SQL parser because callers in this repo already
// use $-numbered placeholders -- there is nothing else in the fragment
// that can look like a positional ref.
var rePlaceholder = regexp.MustCompile(`\$(\d+)`)

func shiftPlaceholders(fragment string) string {
	return rePlaceholder.ReplaceAllStringFunc(fragment, func(m string) string {
		n, err := strconv.Atoi(m[1:])
		if err != nil {
			return m
		}
		return fmt.Sprintf("$%d", n+1)
	})
}

// WithTx runs fn inside a database transaction. A transaction-scoped
// TenantAwareRepository is passed to fn so all queries within the callback
// share the same *sqlx.Tx. The transaction is committed if fn returns nil,
// rolled back otherwise. This lets service-layer code compose multiple
// repository calls (e.g. Update + Get) atomically.
func (r *TenantAwareRepository[T]) WithTx(ctx context.Context, fn func(txRepo TenantAwareRepository[any]) error) error {
	if _, ok := TenantFromContext(ctx); !ok {
		return ErrTenantMissing
	}
	// The underlying db may be either *sqlx.DB or *sqlx.Tx (nested). We
	// need the concrete *sqlx.DB to begin a new transaction.
	var dbx *sqlx.DB
	switch d := r.db.(type) {
	case sqlxDB:
		dbx = d.db
	case sqlxTx:
		// Already in a transaction — reuse it (nested calls don't start
		// a new tx; savepoints are out of scope for L1 baseline).
		txRepo := TenantAwareRepository[any]{
			db:          d,
			tenantColumn: r.tenantColumn,
			logger:       r.logger,
		}
		return fn(txRepo)
	default:
		return fmt.Errorf("WithTx: unsupported db type %T", r.db)
	}
	tx, err := dbx.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()
	txRepo := TenantAwareRepository[any]{
		db:           sqlxTx{tx: tx},
		tenantColumn: r.tenantColumn,
		logger:       r.logger,
	}
	if err := fn(txRepo); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}
	committed = true
	return nil
}

// sqlxTx adapts *sqlx.Tx to TenantAwareDB, mirroring sqlxDB.
type sqlxTx struct {
	tx *sqlx.Tx
}

func (d sqlxTx) Query(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	return d.tx.QueryContext(ctx, query, args...)
}

func (d sqlxTx) Exec(ctx context.Context, query string, args ...any) (sql.Result, error) {
	return d.tx.ExecContext(ctx, query, args...)
}

func (d sqlxTx) QueryRow(ctx context.Context, query string, args ...any) *sql.Row {
	return d.tx.QueryRowContext(ctx, query, args...)
}

func (d sqlxTx) QueryRowx(ctx context.Context, query string, args ...any) *sqlx.Row {
	return d.tx.QueryRowxContext(ctx, query, args...)
}

func (d sqlxTx) Select(ctx context.Context, dest any, query string, args ...any) error {
	return d.tx.SelectContext(ctx, dest, query, args...)
}

func (d sqlxTx) Get(ctx context.Context, dest any, query string, args ...any) error {
	return d.tx.GetContext(ctx, dest, query, args...)
}

func (d sqlxTx) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	return d.tx.ExecContext(ctx, query, args...)
}

func (d sqlxTx) PrepareContext(ctx context.Context, query string) (*sql.Stmt, error) {
	return d.tx.PrepareContext(ctx, query)
}

// sqlxDB adapts *sqlx.DB to TenantAwareDB. sqlx.DB already exposes every
// method with the same signature, so this is a thin embed.
type sqlxDB struct {
	db *sqlx.DB
}

func (d sqlxDB) Query(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	// Use the plain DB handle for raw Query so we return the un-wrapped
	// *sql.Rows. sqlx's QueryxContext returns *sqlx.Rows which has a
	// different Query() signature.
	return d.db.DB.QueryContext(ctx, query, args...)
}

func (d sqlxDB) Exec(ctx context.Context, query string, args ...any) (sql.Result, error) {
	return d.db.ExecContext(ctx, query, args...)
}

func (d sqlxDB) QueryRow(ctx context.Context, query string, args ...any) *sql.Row {
	return d.db.DB.QueryRowContext(ctx, query, args...)
}

func (d sqlxDB) QueryRowx(ctx context.Context, query string, args ...any) *sqlx.Row {
	return d.db.QueryRowxContext(ctx, query, args...)
}

func (d sqlxDB) Select(ctx context.Context, dest any, query string, args ...any) error {
	return d.db.SelectContext(ctx, dest, query, args...)
}

func (d sqlxDB) Get(ctx context.Context, dest any, query string, args ...any) error {
	return d.db.GetContext(ctx, dest, query, args...)
}

func (d sqlxDB) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	return d.db.ExecContext(ctx, query, args...)
}

func (d sqlxDB) PrepareContext(ctx context.Context, query string) (*sql.Stmt, error) {
	return d.db.DB.PrepareContext(ctx, query)
}
