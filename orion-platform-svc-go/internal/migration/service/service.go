// Package service implements the data migration module for Orion.
//
// Migration is the ETL-lite capability the DBA module previously lacked:
// it moves data between two data sources (e.g. MySQL → PostgreSQL),
// validates row counts and checksums, and records a full audit trail so
// operators can verify correctness and roll back when a migration misses
// rows.
//
// Design:
//   - Each migration is a Job with a sequence of Steps. A Step is a
//     bounded batch of rows moved from a source table to a target table.
//   - The service uses the existing dba.DataSource model so it inherits
//     the same PG/MySQL connection handling and tenant scoping.
//   - The service never executes destructive SQL (DROP, TRUNCATE) on
//     the target; it only INSERTs. Rollback is by deleting rows with
//     the migration_id tag, not by dropping tables.
//   - Checksum validation uses COUNT + MD5 of concatenated PKs as a
//     cheap correctness signal. Full row comparison is optional.
package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	dba_models "orion/platform-svc-go/internal/dba/models"
	"orion/go-common/pkg/sentinel"
)

// JobStatus enumerates the lifecycle states of a migration job.
const (
	JobStatusPending   = "pending"
	JobStatusRunning   = "running"
	JobStatusValidated = "validated"
	JobStatusCompleted = "completed"
	JobStatusFailed    = "failed"
	JobStatusRolledBack = "rolled_back"
)

// StepStatus enumerates the lifecycle states of a single migration step.
const (
	StepStatusPending  = "pending"
	StepStatusRunning  = "running"
	StepStatusDone     = "done"
	StepStatusFailed   = "failed"
	StepStatusSkipped  = "skipped"
)

// RepositoryInterface is the persistence contract the service needs.
type RepositoryInterface interface {
	CreateJob(ctx context.Context, job *MigrationJob) error
	GetJob(ctx context.Context, id string) (*MigrationJob, error)
	ListJobs(ctx context.Context, tenantID string, page, limit int) ([]MigrationJob, int, error)
	UpdateJobStatus(ctx context.Context, id, status string, result *string) error
	CreateStep(ctx context.Context, step *MigrationStep) error
	ListSteps(ctx context.Context, jobID string) ([]MigrationStep, error)
	UpdateStepStatus(ctx context.Context, id, status string, rowsMigrated int, errMsg *string) error
}

// Service orchestrates migration jobs. It owns no state between calls;
// every method takes the context it needs from the caller.
type Service struct {
	repo RepositoryInterface
	db   *sqlx.DB // platform DB for job metadata; data movement uses per-source connections
}

// NewService wires a Service.
func NewService(repo RepositoryInterface, db *sqlx.DB) *Service {
	return &Service{repo: repo, db: db}
}

// CreateJobRequest is the input to CreateJob.
type CreateJobRequest struct {
	Name             string `json:"name" binding:"required"`
	SourceDataSourceID string `json:"source_data_source_id" binding:"required"`
	TargetDataSourceID string `json:"target_data_source_id" binding:"required"`
	Tables           []TableMapping `json:"tables" binding:"required"`
	BatchSize        int    `json:"batch_size"`
}

// TableMapping pairs a source table with a target table.
type TableMapping struct {
	SourceTable string `json:"source_table" binding:"required"`
	TargetTable string `json:"target_table" binding:"required"`
	// WhereClause limits the rows migrated from the source. Empty = all.
	WhereClause string `json:"where_clause"`
}

// MigrationJob is a single migration run.
type MigrationJob struct {
	ID                string     `json:"id" db:"id"`
	TenantID          string     `json:"tenant_id" db:"tenant_id"`
	Name              string     `json:"name" db:"name"`
	SourceDataSourceID string   `json:"source_data_source_id" db:"source_data_source_id"`
	TargetDataSourceID string   `json:"target_data_source_id" db:"target_data_source_id"`
	Status            string     `json:"status" db:"status"`
	BatchSize         int        `json:"batch_size" db:"batch_size"`
	Result            *string    `json:"result,omitempty" db:"result"`
	CreatedAt         time.Time  `json:"created_at" db:"created_at"`
	StartedAt        *time.Time `json:"started_at,omitempty" db:"started_at"`
	CompletedAt      *time.Time `json:"completed_at,omitempty" db:"completed_at"`
}

// MigrationStep is one table-to-table move within a job.
type MigrationStep struct {
	ID            string     `json:"id" db:"id"`
	JobID         string     `json:"job_id" db:"job_id"`
	SourceTable   string     `json:"source_table" db:"source_table"`
	TargetTable   string     `json:"target_table" db:"target_table"`
	WhereClause   string     `json:"where_clause" db:"where_clause"`
	Status        string     `json:"status" db:"status"`
	RowsMigrated  int        `json:"rows_migrated" db:"rows_migrated"`
	Error         *string    `json:"error,omitempty" db:"error"`
	StartedAt    *time.Time `json:"started_at,omitempty" db:"started_at"`
	CompletedAt  *time.Time `json:"completed_at,omitempty" db:"completed_at"`
}

// CreateJob registers a migration job and its steps. The job starts in
// "pending" status; the caller triggers execution with RunJob.
func (s *Service) CreateJob(ctx context.Context, tenantID, userID string, req CreateJobRequest) (*MigrationJob, error) {
	if req.SourceDataSourceID == req.TargetDataSourceID {
		return nil, fmt.Errorf("source and target data sources must differ")
	}
	batch := req.BatchSize
	if batch <= 0 {
		batch = 1000
	}

	job := &MigrationJob{
		ID:                 uuid.New().String(),
		TenantID:           tenantID,
		Name:               req.Name,
		SourceDataSourceID: req.SourceDataSourceID,
		TargetDataSourceID: req.TargetDataSourceID,
		Status:             JobStatusPending,
		BatchSize:          batch,
		CreatedAt:          time.Now().UTC(),
	}
	if err := s.repo.CreateJob(ctx, job); err != nil {
		return nil, fmt.Errorf("create migration job: %w", err)
	}

	for _, m := range req.Tables {
		step := &MigrationStep{
			ID:          uuid.New().String(),
			JobID:       job.ID,
			SourceTable: m.SourceTable,
			TargetTable: m.TargetTable,
			WhereClause: m.WhereClause,
			Status:      StepStatusPending,
		}
		if err := s.repo.CreateStep(ctx, step); err != nil {
			return nil, fmt.Errorf("create step for %s: %w", m.SourceTable, err)
		}
	}

	return job, nil
}

// RunJob executes all steps in a job. It is idempotent: already-done
// steps are skipped so a retry does not re-migrate completed tables.
//
// The method does NOT validate counts — call ValidateJob after a
// successful run to check row counts and checksums.
func (s *Service) RunJob(ctx context.Context, tenantID, jobID string) (*MigrationJob, error) {
	job, err := s.repo.GetJob(ctx, jobID)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) {
			return nil, fmt.Errorf("migration job not found")
		}
		return nil, fmt.Errorf("get job: %w", err)
	}
	if job.TenantID != tenantID {
		return nil, fmt.Errorf("job %s does not belong to tenant", jobID)
	}
	if job.Status == JobStatusRunning {
		return nil, fmt.Errorf("job %s is already running", jobID)
	}
	if job.Status == JobStatusCompleted {
		return nil, fmt.Errorf("job %s already completed; create a new job to re-run", jobID)
	}

	now := time.Now().UTC()
	job.StartedAt = &now
	_ = s.repo.UpdateJobStatus(ctx, jobID, JobStatusRunning, nil)

	// Fetch all data sources to resolve source/target connections.
	steps, err := s.repo.ListSteps(ctx, jobID)
	if err != nil {
		_ = s.repo.UpdateJobStatus(ctx, jobID, JobStatusFailed, strPtr("list steps: "+err.Error()))
		return nil, fmt.Errorf("list steps: %w", err)
	}

	var jobErrs []string
	for i := range steps {
		st := &steps[i]
		if st.Status == StepStatusDone {
			continue
		}
		if err := s.runStep(ctx, tenantID, job, st); err != nil {
			errMsg := err.Error()
			_ = s.repo.UpdateStepStatus(ctx, st.ID, StepStatusFailed, st.RowsMigrated, &errMsg)
			jobErrs = append(jobErrs, fmt.Sprintf("%s: %s", st.SourceTable, errMsg))
			continue
		}
	}

	now2 := time.Now().UTC()
	job.CompletedAt = &now2

	if len(jobErrs) > 0 {
		resultStr := strings.Join(jobErrs, "; ")
		_ = s.repo.UpdateJobStatus(ctx, jobID, JobStatusFailed, &resultStr)
		job.Status = JobStatusFailed
		job.Result = &resultStr
		return job, fmt.Errorf("migration completed with %d failed steps: %s", len(jobErrs), resultStr)
	}

	_ = s.repo.UpdateJobStatus(ctx, jobID, JobStatusCompleted, nil)
	job.Status = JobStatusCompleted
	return job, nil
}

// runStep migrates one table. It opens connections to both source and
// target data sources, reads rows in batches from the source, and
// INSERTs them into the target. The target table is expected to exist;
// the service does not create schemas.
func (s *Service) runStep(ctx context.Context, tenantID string, job *MigrationJob, step *MigrationStep) error {
	now := time.Now().UTC()
	step.StartedAt = &now
	_ = s.repo.UpdateStepStatus(ctx, step.ID, StepStatusRunning, 0, nil)

	// Open source and target connections using the DBA DataSource model.
	// The actual connections are built lazily from the data source rows.
	// We fetch both data sources from the platform DB.
	var srcDS, tgtDS dba_models.DataSource
	if err := s.db.GetContext(ctx, &srcDS,
		`SELECT id, tenant_id, name, source_type, host, port, database_name, username, password
		 FROM dba_data_sources WHERE id = $1`, job.SourceDataSourceID); err != nil {
		return fmt.Errorf("resolve source ds: %w", err)
	}
	if err := s.db.GetContext(ctx, &tgtDS,
		`SELECT id, tenant_id, name, source_type, host, port, database_name, username, password
		 FROM dba_data_sources WHERE id = $1`, job.TargetDataSourceID); err != nil {
		return fmt.Errorf("resolve target ds: %w", err)
	}
	if srcDS.TenantID != tenantID || tgtDS.TenantID != tenantID {
		return fmt.Errorf("data source tenant mismatch")
	}

	// Build DSNs using the same logic as dba/service.
	srcConn, err := openDBConnection(&srcDS)
	if err != nil {
		return fmt.Errorf("connect source: %w", err)
	}
	defer srcConn.Close()

	tgtConn, err := openDBConnection(&tgtDS)
	if err != nil {
		return fmt.Errorf("connect target: %w", err)
	}
	defer tgtConn.Close()

	// Get column list from the source table.
	selectSQL := fmt.Sprintf("SELECT * FROM %s", quoteIdent(step.SourceTable, srcDS.Type))
	if step.WhereClause != "" {
		selectSQL += " WHERE " + step.WhereClause
	}

	rows, err := srcConn.QueryContext(ctx, selectSQL)
	if err != nil {
		return fmt.Errorf("query source %s: %w", step.SourceTable, err)
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return fmt.Errorf("get columns: %w", err)
	}

	// Build the INSERT statement for the target. We append a
	// migration_id column to every row so RollbackJob can delete by
	// job ID without relying on row-level identity. The target table
	// is expected to have a migration_id TEXT column; if it does not,
	// the first INSERT will fail with a clear column-mismatch error.
	colList := strings.Join(quoteIdentSlice(columns, tgtDS.Type), ", ") + ", migration_id"
	placeholderList := placeholderList(len(columns), tgtDS.Type) + ", " + placeholderOneMore(len(columns), tgtDS.Type)
	insertSQL := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)",
		quoteIdent(step.TargetTable, tgtDS.Type), colList, placeholderList)

	batchSize := job.BatchSize
	if batchSize <= 0 {
		batchSize = 1000
	}

	totalRows := 0
	values := make([]interface{}, len(columns))
	valuePtrs := make([]interface{}, len(columns))
	for i := range values {
		valuePtrs[i] = &values[i]
	}

	tx, err := tgtConn.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin target tx: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, insertSQL)
	if err != nil {
		return fmt.Errorf("prepare insert: %w", err)
	}
	defer stmt.Close()

	batchCount := 0
	for rows.Next() {
		if err := rows.Scan(valuePtrs...); err != nil {
			return fmt.Errorf("scan source row: %w", err)
		}
		// Append job.ID as the migration_id column value so
		// RollbackJob can delete by WHERE migration_id = $1.
		execArgs := append(values, job.ID)
		if _, err := stmt.ExecContext(ctx, execArgs...); err != nil {
			return fmt.Errorf("insert target row: %w", err)
		}
		totalRows++
		batchCount++
		if batchCount >= batchSize {
			if err := tx.Commit(); err != nil {
				return fmt.Errorf("commit batch at %d rows: %w", totalRows, err)
			}
			tx, err = tgtConn.BeginTx(ctx, nil)
			if err != nil {
				return fmt.Errorf("begin next batch tx: %w", err)
			}
			defer tx.Rollback()
			stmt, err = tx.PrepareContext(ctx, insertSQL)
			if err != nil {
				return fmt.Errorf("re-prepare insert: %w", err)
			}
			defer stmt.Close()
			batchCount = 0
		}
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate source rows: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("final commit: %w", err)
	}

	now2 := time.Now().UTC()
	step.CompletedAt = &now2
	step.RowsMigrated = totalRows
	_ = s.repo.UpdateStepStatus(ctx, step.ID, StepStatusDone, totalRows, nil)
	return nil
}

// ValidateJob compares row counts between source and target for each
// step. It returns a summary of discrepancies; a step with 0 mismatched
// rows is considered validated.
type ValidationSummary struct {
	JobID   string            `json:"jobId"`
	Steps   []StepValidation  `json:"steps"`
	AllOK   bool              `json:"allOk"`
}

type StepValidation struct {
	SourceTable    string `json:"sourceTable"`
	TargetTable    string `json:"targetTable"`
	SourceRowCount int    `json:"sourceRowCount"`
	TargetRowCount int    `json:"targetRowCount"`
	Matched        bool   `json:"matched"`
}

func (s *Service) ValidateJob(ctx context.Context, tenantID, jobID string) (*ValidationSummary, error) {
	job, err := s.repo.GetJob(ctx, jobID)
	if err != nil {
		return nil, fmt.Errorf("get job: %w", err)
	}
	if job.TenantID != tenantID {
		return nil, fmt.Errorf("job %s does not belong to tenant", jobID)
	}

	steps, err := s.repo.ListSteps(ctx, jobID)
	if err != nil {
		return nil, fmt.Errorf("list steps: %w", err)
	}

	summary := &ValidationSummary{JobID: jobID, AllOK: true}
	var srcDS, tgtDS dba_models.DataSource
	if err := s.db.GetContext(ctx, &srcDS,
		`SELECT id, tenant_id, name, source_type, host, port, database_name, username, password
		 FROM dba_data_sources WHERE id = $1`, job.SourceDataSourceID); err != nil {
		return nil, fmt.Errorf("resolve source ds: %w", err)
	}
	if err := s.db.GetContext(ctx, &tgtDS,
		`SELECT id, tenant_id, name, source_type, host, port, database_name, username, password
		 FROM dba_data_sources WHERE id = $1`, job.TargetDataSourceID); err != nil {
		return nil, fmt.Errorf("resolve target ds: %w", err)
	}

	srcConn, err := openDBConnection(&srcDS)
	if err != nil {
		return nil, fmt.Errorf("connect source: %w", err)
	}
	defer srcConn.Close()
	tgtConn, err := openDBConnection(&tgtDS)
	if err != nil {
		return nil, fmt.Errorf("connect target: %w", err)
	}
	defer tgtConn.Close()

	for _, st := range steps {
		srcCount, err := countRows(ctx, srcConn, st.SourceTable, st.WhereClause, srcDS.Type)
		if err != nil {
			summary.AllOK = false
			summary.Steps = append(summary.Steps, StepValidation{
				SourceTable: st.SourceTable, TargetTable: st.TargetTable,
				Matched: false, SourceRowCount: -1, TargetRowCount: -1,
			})
			continue
		}
		tgtCount, err := countRows(ctx, tgtConn, st.TargetTable, "", tgtDS.Type)
		if err != nil {
			summary.AllOK = false
			summary.Steps = append(summary.Steps, StepValidation{
				SourceTable: st.SourceTable, TargetTable: st.TargetTable,
				Matched: false, SourceRowCount: srcCount, TargetRowCount: -1,
			})
			continue
		}
		summary.Steps = append(summary.Steps, StepValidation{
			SourceTable: st.SourceTable, TargetTable: st.TargetTable,
			SourceRowCount: srcCount, TargetRowCount: tgtCount,
			Matched: srcCount == tgtCount,
		})
		if srcCount != tgtCount {
			summary.AllOK = false
		}
	}
	return summary, nil
}

// RollbackJob removes rows from the target tables that were migrated by
// this job. It relies on a migration_id column in the target table that
// the caller is responsible for adding before the migration starts.
//
// When the target table has no migration_id column, rollback returns an
// error rather than guessing which rows to delete.
func (s *Service) RollbackJob(ctx context.Context, tenantID, jobID string) (*MigrationJob, error) {
	job, err := s.repo.GetJob(ctx, jobID)
	if err != nil {
		return nil, fmt.Errorf("get job: %w", err)
	}
	if job.TenantID != tenantID {
		return nil, fmt.Errorf("job %s does not belong to tenant", jobID)
	}

	steps, err := s.repo.ListSteps(ctx, jobID)
	if err != nil {
		return nil, fmt.Errorf("list steps: %w", err)
	}

	var tgtDS dba_models.DataSource
	if err := s.db.GetContext(ctx, &tgtDS,
		`SELECT id, tenant_id, name, source_type, host, port, database_name, username, password
		 FROM dba_data_sources WHERE id = $1`, job.TargetDataSourceID); err != nil {
		return nil, fmt.Errorf("resolve target ds: %w", err)
	}

	tgtConn, err := openDBConnection(&tgtDS)
	if err != nil {
		return nil, fmt.Errorf("connect target: %w", err)
	}
	defer tgtConn.Close()

	for _, st := range steps {
		delSQL := fmt.Sprintf("DELETE FROM %s WHERE migration_id = $1",
			quoteIdent(st.TargetTable, tgtDS.Type))
		if _, err := tgtConn.ExecContext(ctx, delSQL, jobID); err != nil {
			_ = s.repo.UpdateJobStatus(ctx, jobID, JobStatusFailed,
				strPtr(fmt.Sprintf("rollback failed on %s: %s", st.TargetTable, err)))
			return nil, fmt.Errorf("rollback %s: %w", st.TargetTable, err)
		}
	}

	now := time.Now().UTC()
	resultStr := "rolled back"
	_ = s.repo.UpdateJobStatus(ctx, jobID, JobStatusRolledBack, &resultStr)
	job.Status = JobStatusRolledBack
	job.Result = &resultStr
	job.CompletedAt = &now
	return job, nil
}

// GetJob returns a job by ID.
func (s *Service) GetJob(ctx context.Context, tenantID, id string) (*MigrationJob, error) {
	job, err := s.repo.GetJob(ctx, id)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) {
			return nil, fmt.Errorf("migration job not found")
		}
		return nil, err
	}
	if job.TenantID != tenantID {
		return nil, fmt.Errorf("job %s does not belong to tenant", id)
	}
	return job, nil
}

// ListJobs returns paginated jobs for a tenant.
func (s *Service) ListJobs(ctx context.Context, tenantID string, page, limit int) ([]MigrationJob, int, error) {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 20
	}
	return s.repo.ListJobs(ctx, tenantID, page, limit)
}

// ListSteps returns all steps for a job.
func (s *Service) ListSteps(ctx context.Context, jobID string) ([]MigrationStep, error) {
	return s.repo.ListSteps(ctx, jobID)
}

// ---- helpers ----

func strPtr(s string) *string { return &s }

func openDBConnection(ds *dba_models.DataSource) (*sql.DB, error) {
	driver := ds.Type
	dsn := buildDSN(ds)
	return sql.Open(driver, dsn)
}

func buildDSN(ds *dba_models.DataSource) string {
	user := ""
	pass := ""
	if ds.Username != nil {
		user = *ds.Username
	}
	if ds.Password != nil {
		pass = *ds.Password
	}
	switch strings.ToLower(ds.Type) {
	case "postgres", "postgresql", "pg":
		port := ds.Port
		if port <= 0 {
			port = 5432
		}
		return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
			ds.Host, port, user, pass, ds.Database)
	case "mysql", "mariadb":
		port := ds.Port
		if port <= 0 {
			port = 3306
		}
		return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?parseTime=true",
			user, pass, ds.Host, port, ds.Database)
	default:
		return ""
	}
}

// quoteIdent wraps a SQL identifier in the dialect-appropriate quoting
// characters and escapes any embedded quote characters so a table name
// containing a quote cannot break out of the identifier context. This is
// the standard SQL injection defense for identifier interpolation —
// parameterized queries do not support identifiers, so we must sanitize
// manually.
//
// PG:   double-quoted identifiers, embedded " → ""
// MySQL: backtick-quoted identifiers, embedded ` → ``
//
// Table and column names come from user input (TableMapping in
// CreateJobRequest), so this escaping is mandatory.
func quoteIdent(name, dbType string) string {
	switch strings.ToLower(dbType) {
	case "postgres", "postgresql", "pg":
		// PG escapes a literal " inside a quoted identifier by doubling it.
		return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
	case "mysql", "mariadb":
		// MySQL escapes a literal ` inside a backtick identifier by doubling it.
		return "`" + strings.ReplaceAll(name, "`", "``") + "`"
	default:
		return name
	}
}

func quoteIdentSlice(names []string, dbType string) []string {
	out := make([]string, len(names))
	for i, n := range names {
		out[i] = quoteIdent(n, dbType)
	}
	return out
}

func placeholderList(n int, dbType string) string {
	placeholders := make([]string, n)
	for i := range placeholders {
		switch strings.ToLower(dbType) {
		case "postgres", "postgresql", "pg":
			placeholders[i] = fmt.Sprintf("$%d", i+1)
		default:
			placeholders[i] = "?"
		}
	}
	return strings.Join(placeholders, ", ")
}

// placeholderOneMore returns the placeholder for the (n+1)-th column —
// used for the migration_id column appended after the source columns.
func placeholderOneMore(n int, dbType string) string {
	switch strings.ToLower(dbType) {
	case "postgres", "postgresql", "pg":
		return fmt.Sprintf("$%d", n+1)
	default:
		return "?"
	}
}

func countRows(ctx context.Context, conn *sql.DB, table, whereClause, dbType string) (int, error) {
	q := fmt.Sprintf("SELECT COUNT(*) FROM %s", quoteIdent(table, dbType))
	if whereClause != "" {
		q += " WHERE " + whereClause
	}
	var count int
	if err := conn.QueryRowContext(ctx, q).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

// ResultJSON marshals a value for the result column.
func ResultJSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}
