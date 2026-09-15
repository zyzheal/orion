// Package main: wiring for the four DBA extension modules added
// during Phase 2 of the DBA platform completion:
//
//	internal/dba/approval   — multi-stage approval workflow (DAG)
//	internal/dba/query      — cursor-based pagination + Excel export
//	internal/dba/aireview   — LLM-assisted SQL semantic review
//	internal/dba/osc        — gh-ost-based Online Schema Change
//
// Each wire function follows the same repo -> service -> handler pattern
// used by the rest of wiring.go. Modules that fail to initialise are
// logged and skipped so one bad config does not crash the whole server.
package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"
	"time"

	// Blank imports so sql.Open recognizes "postgres" and "mysql".
	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	dba_models "orion/platform-svc-go/internal/dba/models"

	dba_advisor "orion/platform-svc-go/internal/dba/advisor"
	dba_aireview "orion/platform-svc-go/internal/dba/aireview"
	dba_approval "orion/platform-svc-go/internal/dba/approval"
	dba_explain "orion/platform-svc-go/internal/dba/explain"
	dba_osc "orion/platform-svc-go/internal/dba/osc"
	dba_query "orion/platform-svc-go/internal/dba/query"
	dba_repo "orion/platform-svc-go/internal/dba/repository"
	dba_slowquery "orion/platform-svc-go/internal/dba/slowquery"
	inception_engine "orion/platform-svc-go/internal/inception/engine"
)

// Handler package-level vars consumed by router.go.
var (
	dbaApprovalH  *dba_approval.Handler
	dbaQueryH     *dba_query.Handler
	dbaAirReviewH *dba_aireview.Handler
	dbaOscH       *dba_osc.Handler
	dbaSlowQueryH *dba_slowquery.Handler
	dbaExplainH   *dba_explain.Handler
	dbaAdvisorH   *dba_advisor.Handler
)

// Service package-level vars consumed by assistant provider closures
// (wireDomainModules runs before wireDbaExtensions, so the assistant
// closures must dereference these lazily with nil checks).
var (
	dbaSlowQuerySvc *dba_slowquery.Service
	dbaExplainSvc   *dba_explain.Service
	dbaAdvisorSvc   *dba_advisor.IndexAdvisorService
)

// wireDbaExtensions wires the four DBA extension modules. Called from
// initWiring after the base dbaH / inceptionH / migrationH are wired.
func wireDbaExtensions(db *database.DB, logger *zap.Logger) {
	wireDbaApproval(db, logger)
	wireDbaQuery(db, logger)
	wireDbaAirReview(db, logger)
	wireDbaOsc(db, logger)
	wireDbaSlowQuery(db, logger)
	wireDbaExplain(db, logger)
	wireDbaAdvisor(db, logger)
}

// wireDbaApproval wires the multi-stage approval module. The zero-value
// Config uses permissive defaults (any approver in a step can act,
// workflow auto-advances on step completion).
func wireDbaApproval(db *database.DB, logger *zap.Logger) {
	repo := dba_approval.NewRepository(db.DB)
	svc := dba_approval.NewService(repo, dba_approval.Defaults())
	dbaApprovalH = dba_approval.NewHandler(svc)
}

// wireDbaQuery wires the paginated query + Excel export module. The
// base dba.Repository satisfies the module's narrow Repository
// interface (InsertQueryExecutionLog + GetDataSource) so the audit
// log lands in the same table ExecuteDirectQuery writes to. The
// LocalAuditEngine is bridged via engineAuditAdapter so audit
// findings are surfaced to the caller as ErrAuditRejected. When
// NewService fails (invalid StoreDir, etc.) we log and skip — the
// base dbaH.ExecuteDirectQuery still works without pagination.
func wireDbaQuery(db *database.DB, logger *zap.Logger) {
	opts := dba_query.Options{
		Repo:     dba_repo.NewRepository(db.DB),
		StoreDir: os.Getenv("DBA_QUERY_EXPORT_DIR"),
		Secret:   []byte(os.Getenv("DBA_QUERY_SECRET")),
	}
	if len(opts.Secret) == 0 {
		// Dev-safe placeholder; production should override with a real
		// secret so HMAC-signed export URLs are tamper-evident.
		opts.Secret = []byte("orion-dev-default-signing-key")
	}
	localCfg := inception_engine.LocalConfig{Timeout: 60 * time.Second}
	opts.Auditor = &engineAuditAdapter{engine: inception_engine.NewLocalAuditEngine(localCfg)}
	opts.Runner = &sqlQueryRunner{}
	svc, err := dba_query.NewService(opts)
	if err != nil {
		logger.Warn("dba query module skipped", zap.Error(err))
		return
	}
	dbaQueryH = dba_query.NewHandler(svc)
}

// engineAuditAdapter bridges *LocalAuditEngine into the
// dba_query.AuditChecker interface. It only surfaces the Passed flag
// the query module reads; the full report stays internal to the engine.
type engineAuditAdapter struct {
	engine *inception_engine.LocalAuditEngine
}

func (a *engineAuditAdapter) Check(ctx context.Context, sqlStr, dbType string) (*dba_query.AuditCheckReport, error) {
	report, err := a.engine.Check(ctx, sqlStr, dbType)
	if err != nil {
		return nil, err
	}
	return &dba_query.AuditCheckReport{Passed: report.Passed}, nil
}

// wireDbaAirReview wires the AI SQL review module. The local audit
// engine is always constructed; the AI client is only created when
// AI_BASE_URL + AI_API_KEY are configured. Without them the reviewer
// still runs and returns local-only findings.
func wireDbaAirReview(db *database.DB, logger *zap.Logger) {
	localCfg := inception_engine.LocalConfig{Timeout: 60 * time.Second}
	localEngine := inception_engine.NewLocalAuditEngine(localCfg)

	var aiClient dba_aireview.AIReviewer
	if baseURL := os.Getenv("AI_BASE_URL"); baseURL != "" {
		if apiKey := os.Getenv("AI_API_KEY"); apiKey != "" {
			model := os.Getenv("AI_MODEL")
			if model == "" {
				model = "gpt-4"
			}
			aiClient = dba_aireview.NewAIClient(baseURL, apiKey, model)
		}
	}

	reviewer := dba_aireview.NewReviewer(localEngine, aiClient, logger)
	repo := dba_aireview.NewRepository(db.DB)
	svc := dba_aireview.NewService(reviewer, repo, logger)
	dbaAirReviewH = dba_aireview.NewHandler(svc)
}

// wireDbaOsc wires the Online Schema Change (gh-ost) module. The
// DataSourceProvider resolves source IDs to credentials; lookup
// failures are surfaced to the caller rather than crashing.
func wireDbaOsc(db *database.DB, logger *zap.Logger) {
	repo := dba_osc.NewRepository(db.DB)
	engine := dba_osc.NewGhOstEngine("", 0, logger)
	svc := dba_osc.NewService(engine, repo, dbaDataSourceProvider{db: db}, logger)
	dbaOscH = dba_osc.NewHandler(svc)
}

// wireDbaSlowQuery wires the slow query collection + analysis module.
// The base dba.Repository is reused as DataSourceLookup so credentials
// are resolved from the same table other DBA endpoints use. Collect
// requires pg_stat_statements (PG) or performance_schema
// (MySQL) on the target server; when those are missing the collector
// surfaces a descriptive error and the analyzer/TopN endpoints remain
// usable.
func wireDbaSlowQuery(db *database.DB, logger *zap.Logger) {
	repo := dba_slowquery.NewRepository(db.DB)
	dsRepo := dba_repo.NewRepository(db.DB)
	collector := dba_slowquery.NewCollector(repo, dsRepo)
	svc := dba_slowquery.NewService(repo, collector, logger)
	dbaSlowQuerySvc = svc
	dbaSlowQueryH = dba_slowquery.NewHandler(svc)
}

// wireDbaExplain wires the execution-plan analyzer module. It reuses
// the base dba.Repository as DataSourceLookup so credentials come
// from the same table other DBA endpoints use.
func wireDbaExplain(db *database.DB, logger *zap.Logger) {
	repo := dba_explain.NewRepository(db.DB)
	dsRepo := dba_repo.NewRepository(db.DB)
	fetcher := dba_explain.NewFetcher(dsRepo)
	svc := dba_explain.NewService(fetcher, repo, logger)
	dbaExplainSvc = svc
	dbaExplainH = dba_explain.NewHandler(svc)
}

// wireDbaAdvisor wires the index-advisor module. It reuses the base
// dba.Repository as DataSourceLookup and pulls slow queries from the
// platform's own query_execution_records table (via advisor's
// PlatformSlowLookup) — pg_stat_statements is not required.
func wireDbaAdvisor(db *database.DB, logger *zap.Logger) {
	repo := dba_advisor.NewRepository(dba_repo.NewRepository(db.DB))
	slowLookup := dba_advisor.NewPlatformSlowLookup(db.DB)
	svc := dba_advisor.NewIndexAdvisorService(repo, slowLookup, logger)
	dbaAdvisorSvc = svc
	dbaAdvisorH = dba_advisor.NewHandler(svc)
}

// dbaDataSourceProvider implements osc.DataSourceProvider by looking
// up data source rows from the DB. When the query fails we return a
// clear error rather than panicking so the caller can surface the
// missing data source to the operator.
type dbaDataSourceProvider struct {
	db *database.DB
}

// GetDataSource implements osc.DataSourceProvider.
func (p dbaDataSourceProvider) GetDataSource(ctx context.Context, id string) (*dba_osc.DataSourceInfo, error) {
	if p.db == nil {
		return nil, context.Canceled
	}
	row := p.db.QueryRowContext(ctx,
		"SELECT id, tenant_id, type, host, port, user, password, database FROM data_sources WHERE id = $1",
		id,
	)
	var ds dba_osc.DataSourceInfo
	err := row.Scan(&ds.ID, &ds.TenantID, &ds.Type, &ds.Host, &ds.Port, &ds.User, &ds.Password, &ds.Database)
	if err != nil {
		return nil, err
	}
	return &ds, nil
}

// sqlQueryRunner opens a fresh sql.DB per call against the target
// DataSource so credentials never cross tenants. It satisfies the
// dba_query.QueryRunner contract; production could swap this for a
// pooled runner without touching the Service.
type sqlQueryRunner struct{}

// Run opens a connection to the given DataSource and streams rows
// into the returned channel. The channel is always closed on return.
func (r *sqlQueryRunner) Run(ctx context.Context, ds *dba_models.DataSource, dbType, query string) ([]string, <-chan []interface{}, error) {
	dsn, driver := buildDSN(ds, dbType)
	if dsn == "" {
		return nil, nil, fmt.Errorf("unsupported db type: %s", ds.Type)
	}
	conn, err := sql.Open(driver, dsn)
	if err != nil {
		return nil, nil, err
	}
	defer conn.Close()

	rows, err := conn.QueryContext(ctx, query)
	if err != nil {
		return nil, nil, err
	}
	cols, err := rows.Columns()
	if err != nil {
		rows.Close()
		return nil, nil, err
	}
	out := make(chan []interface{}, 8)
	go func() {
		defer close(out)
		defer rows.Close()
		for rows.Next() {
			rawCols, _ := rows.Columns()
			raw := make([]interface{}, len(rawCols))
			ptrs := make([]interface{}, len(rawCols))
			for i := range raw {
				ptrs[i] = &raw[i]
			}
			if err := rows.Scan(ptrs...); err != nil {
				return
			}
			select {
			case out <- raw:
			case <-ctx.Done():
				return
			}
		}
	}()
	return cols, out, nil
}

// buildDSN builds a driver + DSN string for a DataSource. Returns
// ("", "") for unsupported DB types so callers can reject early.
func buildDSN(ds *dba_models.DataSource, dbType string) (dsn, driver string) {
	switch normalizeDBType(ds.Type, dbType) {
	case "postgres":
		return fmt.Sprintf(
			"host=%s port=%d dbname=%s user=%s password=%s sslmode=disable",
			ds.Host, ds.Port, ds.Database, orEmpty(ds.Username), orEmpty(ds.Password),
		), "postgres"
	case "mysql":
		return fmt.Sprintf(
			"%s:%s@tcp(%s:%d)/%s?timeout=10s",
			orEmpty(ds.Username), orEmpty(ds.Password), ds.Host, ds.Port, ds.Database,
		), "mysql"
	default:
		return "", ""
	}
}

func normalizeDBType(raw, dbType string) string {
	s := strings.ToLower(strings.TrimSpace(raw))
	if s == "" {
		s = strings.ToLower(strings.TrimSpace(dbType))
	}
	switch s {
	case "postgres", "postgresql", "pg", "postgre":
		return "postgres"
	case "mysql":
		return "mysql"
	}
	return ""
}

func orEmpty(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
