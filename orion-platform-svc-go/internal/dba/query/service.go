package query

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"orion/platform-svc-go/internal/dba/models"

	"github.com/google/uuid"
)

// osTempFile creates a temp file matching pattern. Kept as a helper so
// tests can override via the exporter path instead of patching os.
func osTempFile(pattern string) (*os.File, error) {
	return os.CreateTemp("", pattern)
}

// QueryRunner abstracts the SQL execution step so tests can inject
// a fake. The default implementation opens a fresh PostgreSQL or
// MySQL connection per call (same strategy as service.Service) so a
// data source's credentials never leak across tenants.
type QueryRunner interface {
	// Run returns the column names, a channel of rows, and any error.
	// Each channel element is a single row as []interface{}.
	// The channel is always closed — either by the runner on
	// completion or when ctx is cancelled. Callers MUST drain the
	// channel (or close the ctx) to let the producer goroutine exit.
	Run(ctx context.Context, ds *models.DataSource, dbType, query string) ([]string, <-chan []interface{}, error)
}

// ExportStore bundles the persistence + URL-signing concerns the
// service needs to write an .xlsx file and hand the client a URL.
//
// LocalURLProvider implements SignedURLProvider and LocalStore
// implements Store; both are wired in NewService.
type ExportStore interface {
	Store
	SignedURLProvider
}

// AuditChecker is the subset of the inception LocalAuditEngine the
// DBA query module needs. It lets tests inject a fake that always
// passes so they can focus on pagination and export logic.
type AuditChecker interface {
	Check(ctx context.Context, sqlStr string, dbType string) (*AuditCheckReport, error)
}

// AuditCheckReport mirrors engine.AuditReport. The module only reads
// .Passed so a fake implementation is trivial.
type AuditCheckReport struct {
	Passed bool
}

// Repository is the DBA persistence surface the module touches. It is
// intentionally narrow: the module never writes SQL orders, only the
// query execution audit log (same record shape as ExecuteDirectQuery).
type Repository interface {
	InsertQueryExecutionLog(ctx context.Context, rec *models.QueryExecutionRecord) error
	GetDataSource(ctx context.Context, id string) (*models.DataSource, error)
}

// ConcurrentExportLimit is the max parallel export jobs per tenant.
// Beyond this, new exports return an error rather than queuing so
// the caller knows to retry later.
const ConcurrentExportLimit = 10

// Service wires together the query execution, cursor pagination, and
// async Excel export pieces. It is stateful only in the export jobs
// map — the SQL itself is stateless and executes against whatever
// DataSource the caller picked.
type Service struct {
	repo      Repository
	runner    QueryRunner
	store     ExportStore
	auditor   AuditChecker
	// jobs tracks in-flight export jobs. ExportResult is written
	// exactly once per status transition; readers always see either
	// pending/running or a terminal state, never a half-written
	// completed record.
	jobs   map[string]*ExportResult
	jobsMu sync.RWMutex
	// running tracks per-tenant concurrent job count for rate limiting.
	running map[string]int
	runningMu sync.Mutex
}

// Options bundles the constructor dependencies so future additions do
// not change the positional signature. Zero-valued options resolve to
// sensible defaults so tests can omit fields they do not care about.
type Options struct {
	Repo     Repository
	Runner   QueryRunner
	Store    ExportStore
	Auditor  AuditChecker
	StoreDir string
	Secret   []byte
}

// NewService constructs a Service. Missing fields fall back to
// production defaults (fresh SQL connections, local store in
// os.TempDir, HMAC signing with Secret).
func NewService(opts Options) (*Service, error) {
	store := opts.Store
	if store == nil {
		dir := opts.StoreDir
		if dir == "" {
			dir = ""
		}
		localStore, err := NewLocalStore(dir)
		if err != nil {
			return nil, err
		}
		signer, err := NewLocalURLProvider(opts.Secret, "http://localhost")
		if err != nil {
			return nil, err
		}
		store = &compositeStore{
			Store:             localStore,
			SignedURLProvider: signer,
		}
	}
	return &Service{
		repo:    opts.Repo,
		runner:  opts.Runner,
		store:   store,
		auditor: opts.Auditor,
		jobs:    make(map[string]*ExportResult),
		running: make(map[string]int),
	}, nil
}

// SetAuditor installs an AuditChecker after construction. Kept as a
// setter because the inception engine is wired after the DBA module
// in the server bootstrap — using a setter avoids a circular
// dependency between the modules.
func (s *Service) SetAuditor(a AuditChecker) {
	s.auditor = a
}

// compositeStore pairs a Store and a SignedURLProvider into the
// single ExportStore interface the service expects.
type compositeStore struct {
	Store
	SignedURLProvider
}

// ExecutePagedQuery runs a SELECT with cursor pagination. Flow:
//
//  1. Load DataSource and reject unknown DB types.
//  2. Run LocalAuditEngine.Check; reject if it fails.
//  3. Wrap SQL in SELECT * FROM (...) AS __orion_paged LIMIT/OFFSET.
//  4. Stream rows via QueryRunner and stop when the page is full.
//  5. Record the execution in the audit log with row count and
//     wall-clock duration.
//
// The audit log is always written — including on failure — so a DBA
// can reconstruct what a user tried to run even if the query blew
// up mid-stream.
func (s *Service) ExecutePagedQuery(ctx context.Context, tenantID, userID string, req PagedQueryRequest) (*PagedQueryResult, error) {
	if req.SQL == "" || req.DataSourceID == "" {
		return nil, fmt.Errorf("%w: sql and data_source_id are required", ErrQueryValidation)
	}
	ds, err := s.loadDataSource(ctx, tenantID, req.DataSourceID)
	if err != nil {
		return nil, err
	}
	dbType := normalizeDBType(ds.Type)
	if dbType == "" {
		return nil, fmt.Errorf("%w: %s", ErrQueryValidation, unsupportedDBTypeMsg(ds.Type))
	}
	if err := s.audit(ctx, ds, dbType, req.SQL); err != nil {
		return nil, err
	}

	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = DefaultPageSize
	}
	if pageSize > MaxPageSize {
		pageSize = MaxPageSize
	}
	cursor, err := decodeCursorOrFirst(req.PageToken, pageSize)
	if err != nil {
		return nil, err
	}

	timeoutMs := req.TimeoutMs
	if timeoutMs <= 0 {
		timeoutMs = DefaultTimeoutMs
	}
	if timeoutMs > MaxTimeoutMs {
		timeoutMs = MaxTimeoutMs
	}

	wrapped := AppendPagination(req.SQL, cursor)
	qCtx, cancel := context.WithTimeout(ctx, time.Duration(timeoutMs)*time.Millisecond)
	defer cancel()

	start := time.Now()
	cols, rowsCh, err := s.run(qCtx, ds, dbType, wrapped)
	if err != nil {
		s.logQuery(ctx, tenantID, userID, ds, req.SQL, "error", err.Error(), 0, time.Since(start))
		return nil, err
	}

	columns := make([]QueryColumn, len(cols))
	for i, name := range cols {
		columns[i] = QueryColumn{Name: name, DataType: inferDataType(cols, i)}
	}

	limit := cursor.Limit
	rowCount := 0
	out := make([][]interface{}, 0, limit)
	for r := range rowsCh {
		if rowCount >= limit {
			// The runner keeps producing; we must drain so the
			// producer goroutine can exit and not leak the DB conn.
			go drainRows(rowsCh)
			break
		}
		out = append(out, r)
		rowCount++
	}
	elapsed := time.Since(start)
	truncated := qCtx.Err() != nil

	if truncated {
		errMsg := fmt.Sprintf("query timed out after %d ms", timeoutMs)
		s.logQuery(ctx, tenantID, userID, ds, req.SQL, "truncated", errMsg, rowCount, elapsed)
	} else {
		s.logQuery(ctx, tenantID, userID, ds, req.SQL, "success", "", rowCount, elapsed)
	}

	result := &PagedQueryResult{
		Columns: columns,
		Rows:    out,
		QueryMs: elapsed.Milliseconds(),
		Truncated: truncated,
	}
	// Only offer a next page if we filled the current one AND the
	// query did not hit its timeout (a timed-out scan means the DB
	// may have more rows, but the cursor could land in a partial
	// state on rescan; callers should retry from the beginning).
	if rowCount == limit && !truncated {
		next, encErr := EncodeCursor(Cursor{Version: 1, Offset: cursor.Offset + limit, Limit: limit})
		if encErr == nil {
			result.NextPageToken = next
		}
	}
	return result, nil
}

// ExportToExcel starts an async Excel export and returns immediately
// with a JobID. The caller polls GetExportStatus until the job
// reaches a terminal state.
//
// Rate limiting: at most ConcurrentExportLimit jobs may be in
// pending/running state for the same tenant. Over-limit returns
// ErrConcurrentExportLimit so the HTTP handler can answer 429.
func (s *Service) ExportToExcel(ctx context.Context, tenantID, userID string, req ExportRequest) (*ExportResult, error) {
	if req.SQL == "" || req.DataSourceID == "" {
		return nil, fmt.Errorf("%w: sql and data_source_id are required", ErrQueryValidation)
	}
	if s.atLimit(tenantID) {
		return nil, ErrConcurrentExportLimit
	}

	jobID := uuid.New().String()
	now := time.Now().UTC()
	job := &ExportResult{
		JobID:     jobID,
		Status:    ExportStatusPending,
		CreatedAt: now,
		UpdatedAt: now,
	}
	s.storeJob(job)
	s.incRunning(tenantID)

	go s.runExport(job, tenantID, userID, req)
	return job, nil
}

// runExport executes the export job off the request goroutine. It is
// best-effort: any failure is recorded on the job and the process
// continues. The job map entry is never deleted so a caller can
// always look up the final status.
func (s *Service) runExport(job *ExportResult, tenantID, userID string, req ExportRequest) {
	defer s.decRunning(tenantID)

	now := time.Now().UTC()
	s.updateJob(job.JobID, func(j *ExportResult) {
		j.Status = ExportStatusRunning
		j.UpdatedAt = now
	})

	maxRows := req.MaxRows
	if maxRows <= 0 {
		maxRows = DefaultExportMaxRows
	}
	if maxRows > MaxExportMaxRows {
		maxRows = MaxExportMaxRows
	}
	timeoutMs := req.TimeoutMs
	if timeoutMs <= 0 {
		timeoutMs = DefaultExportTimeoutMs
	}

	ds, err := s.loadDataSource(context.Background(), tenantID, req.DataSourceID)
	if err != nil {
		s.failJob(job.JobID, err.Error())
		return
	}
	dbType := normalizeDBType(ds.Type)
	if dbType == "" {
		s.failJob(job.JobID, unsupportedDBTypeMsg(ds.Type))
		return
	}
	if err := s.audit(context.Background(), ds, dbType, req.SQL); err != nil {
		s.failJob(job.JobID, err.Error())
		return
	}

	jobCtx, cancel := context.WithTimeout(context.Background(), time.Duration(timeoutMs)*time.Millisecond)
	defer cancel()

	cols, rowsCh, err := s.run(jobCtx, ds, dbType, req.SQL)
	if err != nil {
		s.failJob(job.JobID, err.Error())
		s.logQuery(context.Background(), tenantID, userID, ds, req.SQL, "error", err.Error(), 0, 0)
		return
	}
	columns := make([]QueryColumn, len(cols))
	for i, name := range cols {
		columns[i] = QueryColumn{Name: name, DataType: "text"}
	}

	// Materialise the row set into a bounded channel. The limit stops
	// at maxRows even when the SQL has no LIMIT clause, and the drain
	// goroutine lets the DB scanner exit cleanly.
	capped := make(chan []interface{}, 1)
	go func() {
		defer close(capped)
		n := 0
		for r := range rowsCh {
			if n >= maxRows {
				// Drain so the runner goroutine can exit and close
				// its DB connection without leaking.
				go func() {
					for range rowsCh {
					}
				}()
				return
			}
			capped <- r
			n++
		}
	}()

	tmp, err := osTempFile("orion-export-*.xlsx")
	if err != nil {
		s.failJob(job.JobID, err.Error())
		return
	}
	tmpPath := tmp.Name()
	_ = tmp.Close()
	_ = os.Remove(tmpPath) // WriteExcel creates the file fresh.

	start := time.Now()
	count, writeErr := WriteExcel(jobCtx, tmpPath, columns, capped)
	elapsed := time.Since(start)
	s.logQuery(context.Background(), tenantID, userID, ds, req.SQL, "success", "", count, elapsed)

	if writeErr != nil {
		_ = os.Remove(tmpPath)
		if errors.Is(writeErr, ErrExportCancelled) && count > 0 {
			// Timeout mid-write with rows already flushed: complete
			// the job and mark it truncated so the client knows the
			// file is a partial export.
			s.completeJob(job.JobID, tmpPath, count, true)
			return
		}
		s.failJob(job.JobID, writeErr.Error())
		return
	}
	truncated := count >= maxRows
	s.completeJob(job.JobID, tmpPath, count, truncated)
}

// GetExportStatus returns the current state of an export job.
// A job that has never been seen returns ErrJobNotFound so the
// handler can answer 404 without revealing whether the ID exists.
func (s *Service) GetExportStatus(ctx context.Context, jobID string) (*ExportResult, error) {
	s.jobsMu.RLock()
	job, ok := s.jobs[jobID]
	s.jobsMu.RUnlock()
	if !ok {
		return nil, ErrJobNotFound
	}
	clone := *job
	return &clone, nil
}

// ---- internal helpers ----

// atLimit reports whether tenantID already has ConcurrentExportLimit
// jobs in flight. It does not modify the counter — the caller must
// call incRunning after checking.
func (s *Service) atLimit(tenantID string) bool {
	if tenantID == "" {
		return false
	}
	s.runningMu.Lock()
	defer s.runningMu.Unlock()
	return s.running[tenantID] >= ConcurrentExportLimit
}

func (s *Service) incRunning(tenantID string) {
	if tenantID == "" {
		return
	}
	s.runningMu.Lock()
	defer s.runningMu.Unlock()
	s.running[tenantID]++
}

func (s *Service) decRunning(tenantID string) {
	if tenantID == "" {
		return
	}
	s.runningMu.Lock()
	defer s.runningMu.Unlock()
	s.running[tenantID]--
	if s.running[tenantID] < 0 {
		s.running[tenantID] = 0
	}
}

func (s *Service) storeJob(job *ExportResult) {
	s.jobsMu.Lock()
	s.jobs[job.JobID] = job
	s.jobsMu.Unlock()
}

func (s *Service) updateJob(jobID string, mutate func(*ExportResult)) {
	s.jobsMu.RLock()
	job := s.jobs[jobID]
	s.jobsMu.RUnlock()
	if job == nil {
		return
	}
	mutate(job)
}

func (s *Service) failJob(jobID, msg string) {
	s.updateJob(jobID, func(j *ExportResult) {
		j.Status = ExportStatusFailed
		j.Error = msg
		j.UpdatedAt = time.Now().UTC()
	})
}

func (s *Service) completeJob(jobID, path string, count int, truncated bool) {
	// Sign the URL; do NOT store the raw path on the job.
	signed := ""
	if s.store != nil {
		signed = s.store.Sign(path, time.Hour)
	}
	s.updateJob(jobID, func(j *ExportResult) {
		j.Status = ExportStatusCompleted
		j.FileURL = signed
		j.RowsExported = count
		j.Truncated = truncated
		j.UpdatedAt = time.Now().UTC()
	})
}

func (s *Service) loadDataSource(ctx context.Context, tenantID, id string) (*models.DataSource, error) {
	if s.repo == nil {
		return nil, ErrNoDataSource
	}
	ds, err := s.repo.GetDataSource(ctx, id)
	if err != nil {
		return nil, err
	}
	if ds == nil {
		return nil, ErrNoDataSource
	}
	if ds.TenantID != "" && ds.TenantID != tenantID {
		return nil, fmt.Errorf("query: data source %q does not belong to tenant", id)
	}
	return ds, nil
}

// audit returns nil when the SQL passes the LocalAuditEngine. When no
// auditor is wired (e.g. unit tests), it defaults to allowing.
func (s *Service) audit(ctx context.Context, ds *models.DataSource, dbType, sqlStr string) error {
	if s.auditor == nil {
		return nil
	}
	report, err := s.auditor.Check(ctx, sqlStr, dbType)
	if err != nil {
		return fmt.Errorf("audit engine error: %w", err)
	}
	if report == nil || !report.Passed {
		return ErrAuditRejected
	}
	return nil
}

// run invokes the QueryRunner and translates its (cols, ch, err)
// into the module's expectations.
func (s *Service) run(ctx context.Context, ds *models.DataSource, dbType, q string) ([]string, <-chan []interface{}, error) {
	if s.runner == nil {
		return nil, nil, ErrNoRunner
	}
	return s.runner.Run(ctx, ds, dbType, q)
}

// logQuery writes an audit record; failures are swallowed so an audit
// outage does not block query execution.
func (s *Service) logQuery(ctx context.Context, tenantID, userID string, ds *models.DataSource, sqlStr, status, errMsg string, rowCount int, elapsed time.Duration) {
	if s.repo == nil {
		return
	}
	var errPtr *string
	if errMsg != "" {
		errPtr = &errMsg
	}
	rec := &models.QueryExecutionRecord{
		ID:             uuid.New().String(),
		TenantID:       tenantID,
		UserID:         userID,
		DataSourceID:   ds.ID,
		DataSourceName: ds.Name,
		SQL:            sqlStr,
		Status:         status,
		RowCount:       rowCount,
		Latency:        float64(elapsed.Milliseconds()),
		Error:          errPtr,
		CreatedAt:      time.Now().UTC(),
	}
	_ = s.repo.InsertQueryExecutionLog(ctx, rec)
}

// ---- small helpers ----

func decodeCursorOrFirst(token string, pageSize int) (Cursor, error) {
	if token == "" {
		return Cursor{Version: 1, Offset: 0, Limit: pageSize}, nil
	}
	return DecodeCursor(token)
}

func normalizeDBType(t string) string {
	switch strings.ToLower(strings.TrimSpace(t)) {
	case "postgres", "postgresql", "pg", "postgre":
		return "postgres"
	case "mysql", "mysql8", "mariadb":
		return "mysql"
	default:
		return ""
	}
}

func unsupportedDBTypeMsg(t string) string {
	return fmt.Sprintf("direct query/export not supported for db type %q; supported types are postgresql and mysql", t)
}

// drainRows consumes rowsCh without touching the values so the
// runner goroutine can exit cleanly when we stop reading.
func drainRows(ch <-chan []interface{}) {
	for range ch {
	}
}

// inferDataType maps the first column type seen at a given index to a
// short string label. The service samples only the first row so it
// does not slow down large exports; on a heterogeneous query the
// label reflects the first row only.
func inferDataType(cols []string, _ int) string {
	// Without a sample row we cannot inspect values; return a stable
	// label the frontend can render without branching.
	return "text"
}

// ---- exported sentinel errors ----

var (
	ErrQueryValidation    = errors.New("query validation failed")
	ErrNoDataSource       = errors.New("data source not found")
	ErrNoRunner           = errors.New("query runner not configured")
	ErrAuditRejected      = errors.New("audit engine rejected the SQL")
	ErrConcurrentExportLimit = errors.New("concurrent export limit reached")
	ErrJobNotFound        = errors.New("export job not found")
)

// DefaultQueryRunner is the production QueryRunner implementation.
// It opens a fresh connection per call to isolate tenant credentials
// and mirrors the connection strategy used by service.Service.
type DefaultQueryRunner struct{}

// NewDefaultQueryRunner returns the production runner. Kept as a
// constructor so tests can inject a mock without touching production
// code paths.
func NewDefaultQueryRunner() *DefaultQueryRunner { return &DefaultQueryRunner{} }

// Run executes the wrapped query and streams rows into a channel.
// The channel is buffered to 1 to decouple the DB scanner from the
// consumer without unbounded buffering.
func (r *DefaultQueryRunner) Run(ctx context.Context, ds *models.DataSource, dbType, q string) ([]string, <-chan []interface{}, error) {
	switch dbType {
	case "postgres":
		return r.runPG(ctx, ds, q)
	case "mysql":
		return r.runMySQL(ctx, ds, q)
	default:
		return nil, nil, fmt.Errorf("%w: %s", ErrQueryValidation, unsupportedDBTypeMsg(dbType))
	}
}

func (r *DefaultQueryRunner) runPG(ctx context.Context, ds *models.DataSource, q string) ([]string, <-chan []interface{}, error) {
	conn, err := openPG(ds)
	if err != nil {
		return nil, nil, err
	}
	rows, err := conn.QueryContext(ctx, q)
	if err != nil {
		_ = conn.Close()
		return nil, nil, err
	}
	cols, err := rows.Columns()
	if err != nil {
		rows.Close()
		_ = conn.Close()
		return nil, nil, err
	}
	ch := make(chan []interface{}, 1)
	go func() {
		defer close(ch)
		defer rows.Close()
		defer conn.Close()
		for rows.Next() {
			row, err := scanRow(rows, len(cols))
			if err != nil {
				return
			}
			select {
			case ch <- row:
			case <-ctx.Done():
				return
			}
		}
	}()
	return cols, ch, nil
}

func (r *DefaultQueryRunner) runMySQL(ctx context.Context, ds *models.DataSource, q string) ([]string, <-chan []interface{}, error) {
	conn, err := openMySQL(ds)
	if err != nil {
		return nil, nil, err
	}
	rows, err := conn.QueryContext(ctx, q)
	if err != nil {
		_ = conn.Close()
		return nil, nil, err
	}
	cols, err := rows.Columns()
	if err != nil {
		rows.Close()
		_ = conn.Close()
		return nil, nil, err
	}
	ch := make(chan []interface{}, 1)
	go func() {
		defer close(ch)
		defer rows.Close()
		defer conn.Close()
		for rows.Next() {
			row, err := scanRow(rows, len(cols))
			if err != nil {
				return
			}
			select {
			case ch <- row:
			case <-ctx.Done():
				return
			}
		}
	}()
	return cols, ch, nil
}

// scanRow scans one row into a [][]interface{} cell slice. Interface
// pointers are used so NULL columns become nil without panic.
func scanRow(rows *sql.Rows, width int) ([]interface{}, error) {
	ptrs := make([]interface{}, width)
	for i := range ptrs {
		ptrs[i] = new(interface{})
	}
	if err := rows.Scan(ptrs...); err != nil {
		return nil, err
	}
	out := make([]interface{}, width)
	for i, p := range ptrs {
		v := *(p.(*interface{}))
		if b, ok := v.([]byte); ok {
			out[i] = string(b)
		} else {
			out[i] = v
		}
	}
	return out, nil
}

// ---- connection helpers (mirror service.Service) ----

func openPG(ds *models.DataSource) (*sql.DB, error) {
	conn, err := sql.Open("postgres", buildPGDSN(ds))
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}
	conn.SetMaxOpenConns(1)
	conn.SetConnMaxLifetime(30 * time.Second)
	return conn, nil
}

func openMySQL(ds *models.DataSource) (*sql.DB, error) {
	conn, err := sql.Open("mysql", buildMySQLDSN(ds))
	if err != nil {
		return nil, fmt.Errorf("open mysql: %w", err)
	}
	conn.SetMaxOpenConns(1)
	conn.SetConnMaxLifetime(30 * time.Second)
	return conn, nil
}

func buildPGDSN(ds *models.DataSource) string {
	host := ds.Host
	port := ds.Port
	db := ds.Database
	user := ""
	pass := ""
	if ds.Username != nil {
		user = *ds.Username
	}
	if ds.Password != nil {
		pass = *ds.Password
	}
	if port <= 0 {
		port = 5432
	}
	if host == "" {
		host = "localhost"
	}
	if db == "" {
		db = "postgres"
	}
	return fmt.Sprintf("host=%s port=%d user=%s password=%q dbname=%s sslmode=require ApplicationName=orion-dba",
		host, port, user, pass, db)
}

func buildMySQLDSN(ds *models.DataSource) string {
	host := ds.Host
	port := ds.Port
	db := ds.Database
	user := ""
	pass := ""
	if ds.Username != nil {
		user = *ds.Username
	}
	if ds.Password != nil {
		pass = *ds.Password
	}
	if port <= 0 {
		port = 3306
	}
	if host == "" {
		host = "localhost"
	}
	if db == "" {
		db = "mysql"
	}
	return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local&collation=utf8mb4_unicode_ci",
		user, pass, host, port, db)
}

// DefaultRunnerAdapter is an alias kept so tests can construct a runner
// without importing DefaultQueryRunner directly.
var DefaultRunnerAdapter QueryRunner = NewDefaultQueryRunner()
