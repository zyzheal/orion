// ============================================================
// Plan 39 — 多数据源管理
// ============================================================
// 优先级: P1
// 来源: 全量代码扫描发现 — 无统一数据源抽象层
// 本地证据:
//   - orion-go-common/pkg/database/db.go (90行): 只有单一 Postgres 连接
//   - orion-go-common/pkg/database/repository.go (128行): BaseRepository 绑定单一 DB
//   - 无多数据源管理模块 (MySQL, ClickHouse, ES, MongoDB)
//   - internal/finops/report-designer/datasource/: 有数据源概念但仅限报表
// 可借鉴: internal/secret/service/service.go (360行) — AES-256-GCM 加密 (用于密码存储)
// 技术约束: Go, database/sql, go-sqlmock for testing
// ============================================================

package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	_ "github.com/ClickHouse/clickhouse-go/v2" // ClickHouse driver
	_ "github.com/go-sql-driver/mysql"          // MySQL driver
	_ "github.com/jackc/pgx/v5/stdlib"          // Postgres driver
	_ "github.com/elastic/go-elasticsearch/v8"   // Elasticsearch
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.uber.org/zap"
)

// --- Types ---

type DataSourceType string

const (
	DSCPostgres      DataSourceType = "postgres"
	DSCMySQL         DataSourceType = "mysql"
	DSCClickHouse    DataSourceType = "clickhouse"
	DSCElasticsearch DataSourceType = "elasticsearch"
	DSCMongoDB       DataSourceType = "mongodb"
)

type DataSourceStatus string

const (
	DSStatusActive    DataSourceStatus = "active"
	DSStatusInactive  DataSourceStatus = "inactive"
	DSStatusError     DataSourceStatus = "error"
	DSStatusConnecting DataSourceStatus = "connecting"
)

type DataSource struct {
	ID          string           `json:"id"`
	Name        string           `json:"name"`
	Type        DataSourceType   `json:"type"`
	Host        string           `json:"host"`
	Port        int              `json:"port"`
	Database    string           `json:"database"`
	Username    string           `json:"username"`
	Password    string           `json:"-"`           // 不序列化, 加密存储
	PasswordEnc string           `json:"-"`           // 加密后的密码
	SSLMode     string           `json:"sslMode,omitempty"`
	// MongoDB 专用
	AuthSource  string           `json:"authSource,omitempty"`
	// 连接池配置
	MaxOpenConns int             `json:"maxOpenConns,omitempty"`
	MaxIdleConns int             `json:"maxIdleConns,omitempty"`
	ConnMaxLifetime time.Duration `json:"connMaxLifetime,omitempty"`
	// 元数据
	Status      DataSourceStatus `json:"status"`
	LastChecked time.Time        `json:"lastChecked,omitempty"`
	Error       string           `json:"error,omitempty"`
	Tags        map[string]string `json:"tags,omitempty"`
	CreatedAt   time.Time         `json:"createdAt"`
	UpdatedAt   time.Time         `json:"updatedAt"`
	TenantID    string            `json:"tenantId"`
}

type QueryResult struct {
	Columns    []string        `json:"columns"`
	Rows       []map[string]any `json:"rows"`
	RowCount   int             `json:"rowCount"`
	Affected   int64           `json:"affected,omitempty"`
	Took       time.Duration   `json:"took"`
}

type HealthStatus struct {
	DataSourceID string            `json:"dataSourceId"`
	Status       DataSourceStatus  `json:"status"`
	Latency      time.Duration     `json:"latency"`
	Error        string            `json:"error,omitempty"`
	CheckedAt    time.Time         `json:"checkedAt"`
}

// --- Managed Connection ---

type managedDataSource struct {
	config *DataSource
	db     *sql.DB      // SQL 类型数据源
	mongo  *mongo.Client // MongoDB
	mu     sync.RWMutex
}

func (m *managedDataSource) close() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.db != nil {
		return m.db.Close()
	}
	if m.mongo != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return m.mongo.Disconnect(ctx)
	}
	return nil
}

// --- Repository Interface ---

type RepositoryInterface interface {
	Create(ctx context.Context, ds *DataSource) error
	GetByID(ctx context.Context, id string) (*DataSource, error)
	List(ctx context.Context, tenantID string) ([]*DataSource, error)
	Update(ctx context.Context, ds *DataSource) error
	Delete(ctx context.Context, id string) error
}

// --- Secret Interface (复用 internal/secret) ---

type SecretService interface {
	Encrypt(plaintext string) (string, error)
	Decrypt(ciphertext string) (string, error)
}

// --- Service ---

type DataSourceManager struct {
	repo   RepositoryInterface
	secret SecretService
	logger *zap.Logger

	mu       sync.RWMutex
	sources  map[string]*managedDataSource // dsID → managed connection
	healthTicker *time.Ticker
}

func NewDataSourceManager(repo RepositoryInterface, secret SecretService, logger *zap.Logger) *DataSourceManager {
	mgr := &DataSourceManager{
		repo:    repo,
		secret:  secret,
		logger:  logger,
		sources: make(map[string]*managedDataSource),
	}
	return mgr
}

// --- CRUD ---

// Register 注册新数据源
func (m *DataSourceManager) Register(ctx context.Context, ds *DataSource) error {
	// 加密密码
	if ds.Password != "" {
		encrypted, err := m.secret.Encrypt(ds.Password)
		if err != nil {
			return fmt.Errorf("encrypt password: %w", err)
		}
		ds.PasswordEnc = encrypted
		ds.Password = "" // 清除明文
	}

	// 默认连接池配置
	if ds.MaxOpenConns <= 0 {
		ds.MaxOpenConns = 10
	}
	if ds.MaxIdleConns <= 0 {
		ds.MaxIdleConns = 5
	}
	if ds.ConnMaxLifetime <= 0 {
		ds.ConnMaxLifetime = 30 * time.Minute
	}

	ds.Status = DSStatusInactive
	ds.CreatedAt = time.Now()
	ds.UpdatedAt = time.Now()

	// 持久化
	if err := m.repo.Create(ctx, ds); err != nil {
		return fmt.Errorf("create datasource: %w", err)
	}

	// 建立连接
	if err := m.connect(ctx, ds); err != nil {
		ds.Status = DSStatusError
		ds.Error = err.Error()
		_ = m.repo.Update(ctx, ds)
		return fmt.Errorf("connect datasource: %w", err)
	}

	return nil
}

// connect 建立数据库连接
func (m *DataSourceManager) connect(ctx context.Context, ds *DataSource) error {
	// 解密密码
	password, err := m.secret.Decrypt(ds.PasswordEnc)
	if err != nil {
		return fmt.Errorf("decrypt password: %w", err)
	}

	mds := &managedDataSource{config: ds}

	switch ds.Type {
	case DSCPostgres, DSCMySQL, DSCClickHouse:
		dsn := m.buildDSN(ds, password)
		db, err := sql.Open(string(ds.Type), dsn)
		if err != nil {
			return fmt.Errorf("open %s: %w", ds.Type, err)
		}
		db.SetMaxOpenConns(ds.MaxOpenConns)
		db.SetMaxIdleConns(ds.MaxIdleConns)
		db.SetConnMaxLifetime(ds.ConnMaxLifetime)

		// 测试连接
		if err := db.PingContext(ctx); err != nil {
			db.Close()
			return fmt.Errorf("ping %s: %w", ds.Type, err)
		}

		mds.db = db

	case DSCMongoDB:
		uri := fmt.Sprintf("mongodb://%s:%s@%s:%d/%s",
			ds.Username, password, ds.Host, ds.Port, ds.Database)
		if ds.AuthSource != "" {
			uri += "?authSource=" + ds.AuthSource
		}
		client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
		if err != nil {
			return fmt.Errorf("mongo connect: %w", err)
		}
		if err := client.Ping(ctx, nil); err != nil {
			_ = client.Disconnect(ctx)
			return fmt.Errorf("mongo ping: %w", err)
		}
		mds.mongo = client

	default:
		return fmt.Errorf("unsupported datasource type: %s", ds.Type)
	}

	ds.Status = DSStatusActive
	ds.LastChecked = time.Now()
	ds.Error = ""

	m.mu.Lock()
	m.sources[ds.ID] = mds
	m.mu.Unlock()

	return nil
}

// buildDSN 构建 SQL DSN
func (m *DataSourceManager) buildDSN(ds *DataSource, password string) string {
	switch ds.Type {
	case DSCPostgres:
		sslmode := ds.SSLMode
		if sslmode == "" {
			sslmode = "disable"
		}
		return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
			ds.Host, ds.Port, ds.Username, password, ds.Database, sslmode)
	case DSCMySQL:
		return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?parseTime=true",
			ds.Username, password, ds.Host, ds.Port, ds.Database)
	case DSCClickHouse:
		return fmt.Sprintf("clickhouse://%s:%s@%s:%d/%s",
			ds.Username, password, ds.Host, ds.Port, ds.Database)
	default:
		return ""
	}
}

// --- Query ---

// Query 执行 SQL 查询 (Postgres/MySQL/ClickHouse)
func (m *DataSourceManager) Query(ctx context.Context, dsID, query string, args ...any) (*QueryResult, error) {
	m.mu.RLock()
	mds, ok := m.sources[dsID]
	m.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("datasource not found or not connected: %s", dsID)
	}

	if mds.db == nil {
		return nil, fmt.Errorf("datasource %s is not SQL type", dsID)
	}

	start := time.Now()
	rows, err := mds.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()

	// 获取列信息
	cols, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("get columns: %w", err)
	}

	// 读取行数据
	result := &QueryResult{
		Columns: cols,
		Rows:    []map[string]any{},
	}

	for rows.Next() {
		values := make([]any, len(cols))
		valuePtrs := make([]any, len(cols))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, fmt.Errorf("scan row: %w", err)
		}

		rowMap := make(map[string]any, len(cols))
		for i, col := range cols {
			val := values[i]
			// 处理 []byte → string
			if b, ok := val.([]byte); ok {
				rowMap[col] = string(b)
			} else {
				rowMap[col] = val
			}
		}
		result.Rows = append(result.Rows, rowMap)
		result.RowCount++
	}

	result.Took = time.Since(start)
	return result, nil
}

// Execute 执行 SQL 写操作 (INSERT/UPDATE/DELETE)
func (m *DataSourceManager) Execute(ctx context.Context, dsID, query string, args ...any) (*QueryResult, error) {
	m.mu.RLock()
	mds, ok := m.sources[dsID]
	m.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("datasource not found or not connected: %s", dsID)
	}

	if mds.db == nil {
		return nil, fmt.Errorf("datasource %s is not SQL type", dsID)
	}

	start := time.Now()
	res, err := mds.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("execute: %w", err)
	}

	affected, _ := res.RowsAffected()
	return &QueryResult{
		Affected: affected,
		Took:     time.Since(start),
	}, nil
}

// --- Health Check ---

// HealthCheck 检查数据源健康状态
func (m *DataSourceManager) HealthCheck(ctx context.Context, dsID string) (*HealthStatus, error) {
	m.mu.RLock()
	mds, ok := m.sources[dsID]
	m.mu.RUnlock()

	status := &HealthStatus{
		DataSourceID: dsID,
		CheckedAt:    time.Now(),
	}

	if !ok {
		status.Status = DSStatusError
		status.Error = "datasource not found or not connected"
		return status, nil
	}

	start := time.Now()

	switch {
	case mds.db != nil:
		if err := mds.db.PingContext(ctx); err != nil {
			status.Status = DSStatusError
			status.Error = err.Error()
		} else {
			status.Status = DSStatusActive
		}

	case mds.mongo != nil:
		if err := mds.mongo.Ping(ctx, nil); err != nil {
			status.Status = DSStatusError
			status.Error = err.Error()
		} else {
			status.Status = DSStatusActive
		}

	default:
		status.Status = DSStatusError
		status.Error = "no active connection"
	}

	status.Latency = time.Since(start)
	return status, nil
}

// HealthCheckAll 检查所有数据源健康状态
func (m *DataSourceManager) HealthCheckAll(ctx context.Context) map[string]*HealthStatus {
	m.mu.RLock()
	ids := make([]string, 0, len(m.sources))
	for id := range m.sources {
		ids = append(ids, id)
	}
	m.mu.RUnlock()

	results := make(map[string]*HealthStatus, len(ids))
	for _, id := range ids {
		results[id], _ = m.HealthCheck(ctx, id)
	}
	return results
}

// StartHealthCheckLoop 启动定期健康检查
func (m *DataSourceManager) StartHealthCheckLoop(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = 30 * time.Second
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			results := m.HealthCheckAll(ctx)
			for dsID, status := range results {
				if status.Status == DSStatusError {
					m.logger.Warn("datasource health check failed",
						zap.String("ds", dsID),
						zap.String("error", status.Error))
				}
			}
		}
	}
}

// --- Lifecycle ---

// Unregister 注销数据源
func (m *DataSourceManager) Unregister(ctx context.Context, dsID string) error {
	m.mu.Lock()
	mds, ok := m.sources[dsID]
	if ok {
		delete(m.sources, dsID)
	}
	m.mu.Unlock()

	if mds != nil {
		if err := mds.close(); err != nil {
			return fmt.Errorf("close connection: %w", err)
		}
	}

	return m.repo.Delete(ctx, dsID)
}

// CloseAll 关闭所有数据源连接
func (m *DataSourceManager) CloseAll() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	var errs []string
	for id, mds := range m.sources {
		if err := mds.close(); err != nil {
			errs = append(errs, fmt.Sprintf("%s: %v", id, err))
		}
		delete(m.sources, id)
	}

	if len(errs) > 0 {
		return fmt.Errorf("close errors: %v", errs)
	}
	return nil
}

// --- Metadata ---

// List 返回所有数据源 (不含密码)
func (m *DataSourceManager) List(ctx context.Context, tenantID string) ([]*DataSource, error) {
	return m.repo.List(ctx, tenantID)
}

// Get 获取数据源信息
func (m *DataSourceManager) Get(ctx context.Context, dsID string) (*DataSource, error) {
	return m.repo.GetByID(ctx, dsID)
}

// TestConnection 测试连接 (不注册)
func (m *DataSourceManager) TestConnection(ctx context.Context, ds *DataSource) error {
	// 临时连接测试
	tempDS := *ds
	tempDS.ID = "test-" + ds.Name
	if err := m.connect(ctx, &tempDS); err != nil {
		return err
	}
	// 立即断开
	m.mu.Lock()
	delete(m.sources, tempDS.ID)
	m.mu.Unlock()
	return nil
}

// --- Serialization ---

// ToJSON 序列化查询结果为 JSON
func (r *QueryResult) ToJSON() (string, error) {
	data, err := json.Marshal(r)
	if err != nil {
		return "", fmt.Errorf("marshal result: %w", err)
	}
	return string(data), nil
}
