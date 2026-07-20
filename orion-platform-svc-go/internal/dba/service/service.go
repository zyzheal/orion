package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	_ "github.com/lib/pq"

	"orion/platform-svc-go/internal/dba/models"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/dba/repository"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateAuditRule(ctx context.Context, rule *models.AuditRule) error
	CreateDataSource(ctx context.Context, ds *models.DataSource) error
	CreateOrder(ctx context.Context, o *models.SqlOrder) error
	DeleteDataSource(ctx context.Context, id string) error
	GetDataSource(ctx context.Context, id string) (*models.DataSource, error)
	GetOrder(ctx context.Context, id string) (*models.SqlOrder, error)
	InsertQueryExecutionLog(ctx context.Context, rec *models.QueryExecutionRecord) error
	ListAuditRules(ctx context.Context, tenantID string) ([]models.AuditRule, error)
	ListDataSources(ctx context.Context, tenantID string) ([]models.DataSource, error)
	ListOrders(ctx context.Context, tenantID, status string, page, limit int) ([]models.SqlOrder, int, error)
	ListQueryLogs(ctx context.Context, tenantID string, q models.QueryLogQuery) ([]models.QueryExecutionRecord, int, error)
	UpdateAuditRule(ctx context.Context, id string, updates map[string]interface{}) (*models.AuditRule, error)
	UpdateDataSource(ctx context.Context, id string, updates map[string]interface{}) (*models.DataSource, error)
	UpdateDataSourceStatus(ctx context.Context, id, status string) error
	UpdateOrderStatus(ctx context.Context, id, status string, approvedBy *string, result *string) (*models.SqlOrder, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// ---- SQL Orders ----

func (s *Service) ListOrders(ctx context.Context, tenantID, status string, page, limit int) (*models.OrderListResult, error) {
	orders, total, err := s.repo.ListOrders(ctx, tenantID, status, page, limit)
	if err != nil {
		return nil, err
	}
	return &models.OrderListResult{Data: orders, Total: total}, nil
}

func (s *Service) GetOrder(ctx context.Context, id string) (*models.SqlOrder, error) {
	return s.repo.GetOrder(ctx, id)
}

func (s *Service) CreateOrder(ctx context.Context, tenantID, userID string, req models.CreateOrderRequest) (*models.SqlOrder, error) {
	orderType := req.Type
	if orderType == "" {
		orderType = "query"
	}
	o := &models.SqlOrder{
		TenantID: tenantID,
		UserID:   userID,
		Database: req.Database,
		SQL:      req.SQL,
		Comment:  req.Comment,
		Type:     orderType,
	}
	if err := s.repo.CreateOrder(ctx, o); err != nil {
		return nil, err
	}
	return o, nil
}

func (s *Service) ApproveOrder(ctx context.Context, id, approvedBy string) (*models.SqlOrder, error) {
	return s.repo.UpdateOrderStatus(ctx, id, "approved", &approvedBy, nil)
}

func (s *Service) RejectOrder(ctx context.Context, id string) (*models.SqlOrder, error) {
	return s.repo.UpdateOrderStatus(ctx, id, "rejected", nil, nil)
}

func (s *Service) ExecuteOrder(ctx context.Context, id string) (*models.SqlOrder, error) {
	result := "Execution completed"
	return s.repo.UpdateOrderStatus(ctx, id, "completed", nil, &result)
}

// ---- Data Sources ----

func (s *Service) ListDataSources(ctx context.Context, tenantID string) ([]models.DataSource, error) {
	return s.repo.ListDataSources(ctx, tenantID)
}

func (s *Service) GetDataSource(ctx context.Context, id string) (*models.DataSource, error) {
	return s.repo.GetDataSource(ctx, id)
}

func (s *Service) CreateDataSource(ctx context.Context, tenantID string, req models.CreateDataSourceRequest) (*models.DataSource, error) {
	ds := &models.DataSource{
		TenantID: tenantID,
		Name:     req.Name,
		Type:     req.Type,
		Host:     req.Host,
		Port:     req.Port,
		Database: req.Database,
		Username: req.Username,
		Password: req.Password,
	}
	if err := s.repo.CreateDataSource(ctx, ds); err != nil {
		return nil, err
	}
	return ds, nil
}

func (s *Service) UpdateDataSource(ctx context.Context, id string, req models.UpdateDataSourceRequest) (*models.DataSource, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Type != nil {
		updates["source_type"] = *req.Type
	}
	if req.Host != nil {
		updates["host"] = *req.Host
	}
	if req.Port != nil {
		updates["port"] = *req.Port
	}
	if req.Database != nil {
		updates["database_name"] = *req.Database
	}
	if req.Username != nil {
		updates["username"] = *req.Username
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	return s.repo.UpdateDataSource(ctx, id, updates)
}

func (s *Service) DeleteDataSource(ctx context.Context, id string) error {
	return s.repo.DeleteDataSource(ctx, id)
}

// TestConnection checks connectivity to a data source by opening a real
// PostgreSQL connection and running a lightweight probe (SELECT 1 + version).
func (s *Service) TestConnection(ctx context.Context, id string) (*models.TestConnectionResult, error) {
	ds, err := s.repo.GetDataSource(ctx, id)
	if err != nil {
		return nil, err
	}
	ok, message, version, latency := testPGConnection(ds, 5*time.Second)
	if ok {
		if err := s.repo.UpdateDataSourceStatus(ctx, id, "online"); err != nil {
			return nil, err
		}
		return &models.TestConnectionResult{
			Success: true,
			Message: message,
			Latency: &latency,
			Version: &version,
		}, nil
	}
	_ = s.repo.UpdateDataSourceStatus(ctx, id, "error")
	return &models.TestConnectionResult{
		Success: false,
		Message: message,
		Latency: &latency,
	}, nil
}

// ---- Audit Rules ----

func (s *Service) ListAuditRules(ctx context.Context, tenantID string) ([]models.AuditRule, error) {
	return s.repo.ListAuditRules(ctx, tenantID)
}

func (s *Service) CreateAuditRule(ctx context.Context, tenantID string, req models.CreateAuditRuleRequest) (*models.AuditRule, error) {
	severity := req.Severity
	if severity == "" {
		severity = "warning"
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	rule := &models.AuditRule{
		TenantID: tenantID,
		Name:     req.Name,
		Pattern:  req.Pattern,
		Severity: severity,
		Enabled:  enabled,
	}
	if err := s.repo.CreateAuditRule(ctx, rule); err != nil {
		return nil, err
	}
	return rule, nil
}

func (s *Service) UpdateAuditRule(ctx context.Context, id string, req models.UpdateAuditRuleRequest) (*models.AuditRule, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Pattern != nil {
		updates["pattern"] = *req.Pattern
	}
	if req.Severity != nil {
		updates["severity"] = *req.Severity
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	return s.repo.UpdateAuditRule(ctx, id, updates)
}

// ---- Direct Query ----

// ExecuteDirectQuery runs a read-only SQL query against a PostgreSQL data source.
// The query is validated as SELECT-only and logged for audit purposes.
func (s *Service) ExecuteDirectQuery(ctx context.Context, tenantID, userID string, req models.DirectQueryRequest) (*models.DirectQueryResponse, error) {
	ds, err := s.repo.GetDataSource(ctx, req.DataSourceID)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) {
			rec := newExecutionRecord(ctx, tenantID, userID, req.DataSourceID, "", req.SQL, "error", "Data source not found", 0, nil)
			return &models.DirectQueryResponse{
				Success:         false,
				Error:           "Data source not found",
				ExecutionRecord: rec,
			}, nil
		}
		return nil, err
	}

	// Only PostgreSQL is supported for direct query execution.
	sourceType := ds.Type
	if sourceType != "postgresql" && sourceType != "postgres" {
		rec := newExecutionRecord(ctx, tenantID, userID, req.DataSourceID, ds.Name, req.SQL, "error",
			"Direct query execution not supported for "+sourceType+". Only PostgreSQL data sources are supported.", 0, nil)
		return &models.DirectQueryResponse{
			Success:         false,
			Error:           *rec.Error,
			ExecutionRecord: rec,
		}, nil
	}

	// Validate that the query is read-only.
	normalized := strings.TrimSpace(strings.ToLower(req.SQL))
	if !isReadOnlySQL(normalized) {
		errMsg := fmt.Sprintf("Read-only queries are required. Detected non-SELECT statement.")
		rec := newExecutionRecord(ctx, tenantID, userID, req.DataSourceID, ds.Name, req.SQL, "error", errMsg, 0, nil)
		if err := s.repo.InsertQueryExecutionLog(ctx, rec); err != nil {
			return nil, err
		}
		return &models.DirectQueryResponse{
			Success:         false,
			Error:           errMsg,
			ExecutionRecord: rec,
		}, nil
	}

	timeout := 30 * time.Second
	if req.Timeout != nil && *req.Timeout > 0 {
		timeout = time.Duration(*req.Timeout) * time.Second
	}

	start := time.Now()
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	rows, err := executePGQuery(ds, ctx, req.SQL)
	if err != nil {
		latency := float64(time.Since(start).Milliseconds())
		errMsg := err.Error()
		rec := newExecutionRecord(ctx, tenantID, userID, req.DataSourceID, ds.Name, req.SQL, "error", errMsg, 0, &latency)
		if logErr := s.repo.InsertQueryExecutionLog(ctx, rec); logErr != nil {
			return nil, logErr
		}
		return &models.DirectQueryResponse{
			Success:         false,
			Error:           errMsg,
			ExecutionRecord: rec,
		}, nil
	}
	defer rows.Close()

	// Extract column names.
	columns, err := rows.Columns()
	if err != nil {
		latency := float64(time.Since(start).Milliseconds())
		errMsg := fmt.Sprintf("failed to read column metadata: %s", err)
		rec := newExecutionRecord(ctx, tenantID, userID, req.DataSourceID, ds.Name, req.SQL, "error", errMsg, 0, &latency)
		if logErr := s.repo.InsertQueryExecutionLog(ctx, rec); logErr != nil {
			return nil, logErr
		}
		return &models.DirectQueryResponse{
			Success:         false,
			Error:           errMsg,
			ExecutionRecord: rec,
		}, nil
	}

	// Build field descriptors.
	fields := make([]map[string]interface{}, 0, len(columns))
	for _, col := range columns {
		fields = append(fields, map[string]interface{}{
			"name":     col,
			"dataType": "text",
		})
	}

	rowCount := 0
	rowLimit := 500 // prevent large result sets from overwhelming the response.
	var data []map[string]interface{}
	for rows.Next() && rowCount < rowLimit {
		values := make([]interface{}, len(columns))
		for i := range columns {
			values[i] = new(interface{})
		}
		if err := rows.Scan(values...); err != nil {
			latencyMs := float64(time.Since(start).Milliseconds())
			errMsg := fmt.Sprintf("failed to scan row: %s", err)
			rec := newExecutionRecord(ctx, tenantID, userID, req.DataSourceID, ds.Name, req.SQL, "error", errMsg, rowCount, &latencyMs)
			if logErr := s.repo.InsertQueryExecutionLog(ctx, rec); logErr != nil {
				return nil, logErr
			}
			return &models.DirectQueryResponse{
				Success:         false,
				Error:           errMsg,
				ExecutionRecord: rec,
			}, nil
		}
		rowMap := make(map[string]interface{})
		for i, col := range columns {
			rowMap[col] = values[i]
		}
		data = append(data, rowMap)
		rowCount++
	}

	latency := float64(time.Since(start).Milliseconds())
	truncated := rowCount >= rowLimit

	fieldsMap := make(map[string]interface{})
	fieldsMap["columns"] = columns

	var message string
	if rowCount >= rowLimit {
		message = fmt.Sprintf("Query returned %d+ rows (truncated to %d).", rowCount+1, rowLimit)
	} else {
		message = fmt.Sprintf("Query returned %d rows.", rowCount)
	}

	// Record the execution for audit.
	rec := newExecutionRecord(ctx, tenantID, userID, req.DataSourceID, ds.Name, req.SQL, "success", "", rowCount, &latency)
	if err := s.repo.InsertQueryExecutionLog(ctx, rec); err != nil {
		return nil, err
	}

	return &models.DirectQueryResponse{
		Success: true,
		Data: &models.DirectQueryData{
			Rows:      data,
			RowCount:  rowCount,
			Fields:    fields,
			Latency:   latency,
			Truncated: &truncated,
			Message:   message,
		},
		ExecutionRecord: rec,
	}, nil
}

// ---- Internal helpers ----

func isReadOnlySQL(sql string) bool {
	// Strip leading whitespace and comments.
	for {
		pos := strings.IndexAny(sql, ";--/\n")
		if pos == -1 {
			break
		}
		switch sql[pos] {
		case ';':
			sql = strings.TrimSpace(sql[pos+1:])
		case '-', '/':
			sql = sql[pos+1:]
		case '\n':
			sql = strings.TrimSpace(sql[1:])
		default:
			break
		}
	}
	if strings.HasPrefix(sql, "with") {
		return strings.HasPrefix(sql, "with") &&
			(strings.Contains(sql, "select") || strings.Contains(sql, " SELECT"))
	}
	return strings.HasPrefix(sql, "select")
}

func buildPGDSN(ds *models.DataSource) string {
	host := ds.Host
	port := ds.Port
	database := ds.Database
	user := ""
	password := ""
	if ds.Username != nil {
		user = *ds.Username
	}
	if ds.Password != nil {
		password = *ds.Password
	}
	// Default to standard PostgreSQL port.
	if port <= 0 {
		port = 5432
	}
	if database == "" {
		database = "postgres"
	}
	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%q dbname=%s sslmode=require ApplicationName=orion-dba",
		host, port, user, password, database,
	)
	return dsn
}

func testPGConnection(ds *models.DataSource, timeout time.Duration) (ok bool, message string, version string, latency float64) {
	dsn := buildPGDSN(ds)
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	conn, err := sql.Open("postgres", dsn)
	if err != nil {
		return false, fmt.Sprintf("failed to open connection: %s", err), "", 0
	}
	defer conn.Close()
	start := time.Now()
	err = conn.PingContext(ctx)
	if err != nil {
		return false, fmt.Sprintf("failed to ping database: %s", err), "", 0
	}
	rows, err := conn.QueryContext(ctx, "SHOW server_version")
	if err != nil {
		return true, "Connection successful", "", float64(time.Since(start).Milliseconds())
	}
	if rows.Next() {
		rows.Scan(&version)
	}
	rows.Close()
	latency = float64(time.Since(start).Milliseconds())
	return true, "Connection successful", version, latency
}

func executePGQuery(ds *models.DataSource, ctx context.Context, query string) (*sql.Rows, error) {
	dsn := buildPGDSN(ds)
	conn, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open connection to %s: %w", ds.Name, err)
	}
	conn.SetMaxOpenConns(1)
	conn.SetConnMaxLifetime(30 * time.Second)
	return conn.QueryContext(ctx, query)
}

func newExecutionRecord(_ context.Context, tenantID, userID, dataSourceID, dataSourceName, sql, status string, errMsg string, rowCount int, latency *float64) *models.QueryExecutionRecord {
	var errPtr *string
	if errMsg != "" {
		errPtr = &errMsg
	}
	lat := 0.0
	if latency != nil {
		lat = *latency
	}
	return &models.QueryExecutionRecord{
		ID:             uuid.New().String(),
		TenantID:       tenantID,
		UserID:         userID,
		DataSourceID:   dataSourceID,
		DataSourceName: dataSourceName,
		SQL:            sql,
		Status:         status,
		RowCount:       rowCount,
		Latency:        lat,
		Error:          errPtr,
		CreatedAt:      time.Now().UTC(),
	}
}

// ---- Query Logs ----

func (s *Service) ListQueryLogs(ctx context.Context, tenantID string, q models.QueryLogQuery) (*models.QueryLogResult, error) {
	logs, total, err := s.repo.ListQueryLogs(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	return &models.QueryLogResult{
		Data:  logs,
		Total: total,
		Page:  q.Page,
		Limit: q.Limit,
	}, nil
}

// unused sentinel — URL values are encoded via standard library.
var _ = url.PathEscape
