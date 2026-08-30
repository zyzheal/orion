package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"database/sql"

	_ "github.com/ClickHouse/clickhouse-go/v2"
	_ "github.com/go-sql-driver/mysql"
	_ "github.com/jackc/pgx/v5/stdlib"

	"go.uber.org/zap"

	dsm "orion/platform-svc-go/internal/datasource/models"
	dsr "orion/platform-svc-go/internal/datasource/repository"
	"orion/platform-svc-go/internal/otel"
	"orion/platform-svc-go/internal/shared/aesgcm"
)

// Default pool settings when caller doesn't specify.
const (
	defaultMaxOpenConns    = 10
	defaultMaxIdleConns    = 5
	defaultConnMaxLifetime = 30 * time.Minute
	defaultHealthInterval  = 30 * time.Second
)

// The three helpers below are thin wrappers over internal/shared/aesgcm. They
// exist so this module's call sites and tests stay untouched, but the algorithm
// lives in exactly one place: internal/database-devops must encrypt data source
// passwords with this same code, not with a second copy (ARCH-0.11).
func cryptoKey(secret string) []byte { return aesgcm.Key(secret) }

func encrypt(key []byte, plaintext string) (string, error) {
	return aesgcm.Encrypt(key, plaintext)
}

func decrypt(key []byte, ciphertext string) (string, error) {
	return aesgcm.Decrypt(key, ciphertext)
}

// --- managedDataSource ---

type managedDataSource struct {
	config *dsm.DataSource
	db     *sql.DB
	mu     sync.RWMutex
}

func (m *managedDataSource) close() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.db != nil {
		return m.db.Close()
	}
	return nil
}

// --- Service ---

type Service struct {
	repo   dsr.Interface
	logger *zap.Logger
	key    []byte

	mu      sync.RWMutex
	sources map[string]*managedDataSource
}

// New creates a Service.
// secretKey can be a 64-char hex key or an arbitrary string (SHA-256'd).
func New(repo dsr.Interface, secretKey string, logger *zap.Logger) *Service {
	if logger == nil {
		logger, _ = zap.NewProduction()
	}
	return &Service{
		repo:    repo,
		logger:  logger,
		key:     cryptoKey(secretKey),
		sources: make(map[string]*managedDataSource),
	}
}

// Register persists a datasource and establishes a connection.
func (s *Service) Register(ctx context.Context, ds *dsm.DataSource) error {
	ctx, span := otel.StartSpan(ctx, "datasource.Register",
		otel.AttrString("ds.name", ds.Name),
		otel.AttrString("ds.type", string(ds.Type)))
	defer span.End()

	if ds.Password != "" {
		enc, err := encrypt(s.key, ds.Password)
		if err != nil {
			otel.SetSpanError(span, err)
			return fmt.Errorf("encrypt password: %w", err)
		}
		ds.PasswordEnc = enc
		ds.Password = ""
	}

	if ds.MaxOpenConns <= 0 {
		ds.MaxOpenConns = defaultMaxOpenConns
	}
	if ds.MaxIdleConns <= 0 {
		ds.MaxIdleConns = defaultMaxIdleConns
	}
	if ds.ConnMaxLifetime <= 0 {
		ds.ConnMaxLifetime = defaultConnMaxLifetime
	}

	ds.Status = dsm.DSStatusInactive
	ds.CreatedAt = time.Now()
	ds.UpdatedAt = time.Now()

	if err := s.repo.Create(ctx, ds); err != nil {
		otel.SetSpanError(span, err)
		return fmt.Errorf("create datasource: %w", err)
	}

	if err := s.connect(ctx, ds); err != nil {
		ds.Status = dsm.DSStatusError
		ds.Error = err.Error()
		_ = s.repo.Update(ctx, ds)
		return fmt.Errorf("connect datasource: %w", err)
	}
	return nil
}

// connect opens a live connection for the datasource.
func (s *Service) connect(ctx context.Context, ds *dsm.DataSource) error {
	password := ds.Password
	if password == "" && ds.PasswordEnc != "" {
		var err error
		password, err = decrypt(s.key, ds.PasswordEnc)
		if err != nil {
			return fmt.Errorf("decrypt password: %w", err)
		}
	}

	mds := &managedDataSource{config: ds}

	switch ds.Type {
	case dsm.DSCPostgres, dsm.DSCMySQL:
		dsn := buildDSN(ds, password)
		driverName := string(ds.Type)
		db, err := sql.Open(driverName, dsn)
		if err != nil {
			return fmt.Errorf("open %s: %w", ds.Type, err)
		}
		db.SetMaxOpenConns(ds.MaxOpenConns)
		db.SetMaxIdleConns(ds.MaxIdleConns)
		db.SetConnMaxLifetime(ds.ConnMaxLifetime)

		if err := db.PingContext(ctx); err != nil {
			db.Close()
			return fmt.Errorf("ping %s: %w", ds.Type, err)
		}
		mds.db = db

	case dsm.DSCClickHouse:
		dsn := buildDSN(ds, password)
		db, err := sql.Open("clickhouse", dsn)
		if err != nil {
			return fmt.Errorf("open clickhouse: %w", err)
		}
		db.SetMaxOpenConns(ds.MaxOpenConns)
		db.SetMaxIdleConns(ds.MaxIdleConns)
		db.SetConnMaxLifetime(ds.ConnMaxLifetime)

		if err := db.PingContext(ctx); err != nil {
			db.Close()
			return fmt.Errorf("ping clickhouse: %w", err)
		}
		mds.db = db

	case dsm.DSCElasticsearch:
		return fmt.Errorf("elasticsearch is not a SQL engine; use the global-search module for Elasticsearch queries")

	case dsm.DSCMongoDB:
		return fmt.Errorf("mongodb is not a SQL engine and cannot be connected via database/sql; use the mongo-go-driver directly")

	default:
		return fmt.Errorf("unsupported datasource type: %s", ds.Type)
	}

	ds.Status = dsm.DSStatusActive
	ds.LastChecked = time.Now()
	ds.Error = ""

	s.mu.Lock()
	s.sources[ds.ID] = mds
	s.mu.Unlock()
	return nil
}

func buildDSN(ds *dsm.DataSource, password string) string {
	switch ds.Type {
	case dsm.DSCPostgres:
		sslmode := ds.SSLMode
		if sslmode == "" {
			sslmode = "disable"
		}
		return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
			ds.Host, ds.Port, ds.Username, password, ds.Database, sslmode)
	case dsm.DSCMySQL:
		return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?parseTime=true",
			ds.Username, password, ds.Host, ds.Port, ds.Database)
	case dsm.DSCClickHouse:
		return fmt.Sprintf("clickhouse://%s:%s@%s:%d/%s",
			ds.Username, password, ds.Host, ds.Port, ds.Database)
	default:
		return ""
	}
}

// Query executes a read-only SQL query on the named datasource.
func (s *Service) Query(ctx context.Context, dsID, query string, args ...any) (*dsm.QueryResult, error) {
	ctx, span := otel.StartSpan(ctx, "datasource.Query",
		otel.AttrString("ds.id", dsID))
	defer span.End()

	mds := s.getDataSource(dsID)
	if mds == nil {
		return nil, fmt.Errorf("datasource not found: %s", dsID)
	}
	if mds.db == nil {
		return nil, fmt.Errorf("datasource %s is not SQL type", dsID)
	}

	start := time.Now()
	rows, err := mds.db.QueryContext(ctx, query, args...)
	if err != nil {
		otel.SetSpanError(span, err)
		return nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		otel.SetSpanError(span, err)
		return nil, fmt.Errorf("get columns: %w", err)
	}

	result := &dsm.QueryResult{Columns: cols, Rows: make([]map[string]any, 0)}
	for rows.Next() {
		vals := make([]any, len(cols))
		ptrs := make([]any, len(cols))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			otel.SetSpanError(span, err)
			return nil, fmt.Errorf("scan: %w", err)
		}
		row := make(map[string]any, len(cols))
		for i, c := range cols {
			if b, ok := vals[i].([]byte); ok {
				row[c] = string(b)
			} else {
				row[c] = vals[i]
			}
		}
		result.Rows = append(result.Rows, row)
		result.RowCount++
	}
	result.Took = time.Since(start)
	return result, nil
}

// Execute runs a write SQL statement.
func (s *Service) Execute(ctx context.Context, dsID, query string, args ...any) (*dsm.QueryResult, error) {
	ctx, span := otel.StartSpan(ctx, "datasource.Execute",
		otel.AttrString("ds.id", dsID))
	defer span.End()

	mds := s.getDataSource(dsID)
	if mds == nil {
		return nil, fmt.Errorf("datasource not found: %s", dsID)
	}
	if mds.db == nil {
		return nil, fmt.Errorf("datasource %s is not SQL type", dsID)
	}

	start := time.Now()
	res, err := mds.db.ExecContext(ctx, query, args...)
	if err != nil {
		otel.SetSpanError(span, err)
		return nil, fmt.Errorf("execute: %w", err)
	}
	affected, _ := res.RowsAffected()
	return &dsm.QueryResult{Affected: affected, Took: time.Since(start)}, nil
}

// HealthCheck probes a single datasource.
func (s *Service) HealthCheck(ctx context.Context, dsID string) (*dsm.HealthStatus, error) {
	status := &dsm.HealthStatus{DataSourceID: dsID, CheckedAt: time.Now()}

	s.mu.RLock()
	mds, ok := s.sources[dsID]
	s.mu.RUnlock()
	if !ok {
		status.Status = dsm.DSStatusError
		status.Error = "datasource not found"
		return status, nil
	}

	start := time.Now()
	if mds.db != nil {
		if err := mds.db.PingContext(ctx); err != nil {
			status.Status = dsm.DSStatusError
			status.Error = err.Error()
		} else {
			status.Status = dsm.DSStatusActive
		}
	} else {
		status.Status = dsm.DSStatusError
		status.Error = "no active connection"
	}
	status.Latency = time.Since(start)
	return status, nil
}

// HealthCheckAll returns status for every managed datasource.
func (s *Service) HealthCheckAll(ctx context.Context) map[string]*dsm.HealthStatus {
	s.mu.RLock()
	ids := make([]string, 0, len(s.sources))
	for id := range s.sources {
		ids = append(ids, id)
	}
	s.mu.RUnlock()

	results := make(map[string]*dsm.HealthStatus, len(ids))
	for _, id := range ids {
		h, _ := s.HealthCheck(ctx, id)
		results[id] = h
	}
	return results
}

// StartHealthCheckLoop runs periodic health checks until ctx is cancelled.
func (s *Service) StartHealthCheckLoop(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = defaultHealthInterval
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			results := s.HealthCheckAll(ctx)
			for id, h := range results {
				if h.Status == dsm.DSStatusError {
					s.logger.Warn("datasource health check failed",
						zap.String("ds", id),
						zap.String("error", h.Error))
				}
			}
		}
	}
}

// Unregister closes and removes a datasource.
func (s *Service) Unregister(ctx context.Context, dsID string) error {
	s.mu.Lock()
	mds, ok := s.sources[dsID]
	if ok {
		delete(s.sources, dsID)
	}
	s.mu.Unlock()

	if mds != nil {
		if err := mds.close(); err != nil {
			return fmt.Errorf("close datasource %s: %w", dsID, err)
		}
	}
	return s.repo.Delete(ctx, dsID)
}

// CloseAll disconnects every managed datasource.
func (s *Service) CloseAll() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	var errs []string
	for id, mds := range s.sources {
		if err := mds.close(); err != nil {
			errs = append(errs, fmt.Sprintf("%s: %v", id, err))
		}
		delete(s.sources, id)
	}
	if len(errs) > 0 {
		return fmt.Errorf("close errors: %v", errs)
	}
	return nil
}

// List returns all datasources for a tenant (no passwords).
func (s *Service) List(ctx context.Context, tenantID string) ([]*dsm.DataSource, error) {
	return s.repo.List(ctx, tenantID)
}

// Get returns a single datasource by ID.
func (s *Service) Get(ctx context.Context, dsID string) (*dsm.DataSource, error) {
	return s.repo.GetByID(ctx, dsID)
}

// ResolvePassword looks up a datasource by ID and returns the decrypted password.
// This is used by the backup/restore executor wiring (ARCH-0.10b) to build
// connection info without exposing the encryption key or PasswordEnc field.
func (s *Service) ResolvePassword(ctx context.Context, dsID string) (string, error) {
	ds, err := s.repo.GetByID(ctx, dsID)
	if err != nil {
		return "", err
	}
	if ds == nil {
		return "", fmt.Errorf("datasource %s not found", dsID)
	}
	if ds.PasswordEnc == "" {
		return "", nil
	}
	return decrypt(s.key, ds.PasswordEnc)
}

// TestConnection opens a temporary connection to verify credentials.
func (s *Service) TestConnection(ctx context.Context, ds *dsm.DataSource) error {
	temp := *ds
	temp.ID = "test-" + ds.Name
	if err := s.connect(ctx, &temp); err != nil {
		return err
	}
	s.mu.Lock()
	mds, ok := s.sources[temp.ID]
	s.mu.Unlock()
	if ok && mds != nil {
		_ = mds.close()
	}
	s.mu.Lock()
	delete(s.sources, temp.ID)
	s.mu.Unlock()
	return nil
}

// Update refreshes a datasource record.
func (s *Service) Update(ctx context.Context, ds *dsm.DataSource) error {
	ds.UpdatedAt = time.Now()
	return s.repo.Update(ctx, ds)
}

func (s *Service) getDataSource(dsID string) *managedDataSource {
	s.mu.RLock()
	mds, ok := s.sources[dsID]
	s.mu.RUnlock()
	if !ok {
		return nil
	}
	return mds
}
