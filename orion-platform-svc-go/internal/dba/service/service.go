package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"

	"orion/platform-svc-go/internal/dba/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
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

// ExecuteOrder executes the SQL of an approved order against its target
// data source. It looks up the order by id, finds the data source matching
// order.Database, connects (PostgreSQL only), runs the SQL, records the
// execution in the audit log, and updates the order with the real result.
// On failure the order is marked "failed" with the error message.
func (s *Service) ExecuteOrder(ctx context.Context, tenantID, userID, id string) (*models.SqlOrder, error) {
	order, err := s.repo.GetOrder(ctx, id)
	if err != nil {
		if errors.Is(err, sentinel.NotFound) {
			return nil, fmt.Errorf("order not found")
		}
		return nil, fmt.Errorf("get order: %w", err)
	}
	if order == nil {
		return nil, fmt.Errorf("order not found")
	}

	// Find the data source matching this order's database name.
	sources, err := s.repo.ListDataSources(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list data sources: %w", err)
	}
	var ds *models.DataSource
	for i := range sources {
		if sources[i].Database == order.Database {
			ds = &sources[i]
			break
		}
	}
	if ds == nil {
		errMsg := fmt.Sprintf("no data source found for database %q", order.Database)
		_, _ = s.repo.UpdateOrderStatus(ctx, id, "failed", nil, &errMsg)
		return nil, fmt.Errorf("%s", errMsg)
	}

	// Only PostgreSQL and MySQL are supported for direct execution.
	dbType := normalizeDBType(ds.Type)
	if dbType == "" {
		errMsg := fmt.Sprintf("execution not supported for %s; supported types are postgresql and mysql", ds.Type)
		_, _ = s.repo.UpdateOrderStatus(ctx, id, "failed", nil, &errMsg)
		return nil, fmt.Errorf("%s", errMsg)
	}

	// Execute the SQL with a 60-second timeout.
	start := time.Now()
	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	normalized := strings.TrimSpace(strings.ToLower(order.SQL))
	result, execErr := executeSQLByType(ds, dbType, ctx, order.SQL, normalized)
	latency := float64(time.Since(start).Milliseconds())

	if execErr != nil {
		errMsg := execErr.Error()
		_ = s.repo.InsertQueryExecutionLog(ctx, newExecutionRecord(ctx, tenantID, userID, ds.ID, ds.Name, order.SQL, "error", errMsg, 0, &latency))
		_, _ = s.repo.UpdateOrderStatus(ctx, id, "failed", nil, &errMsg)
		return nil, fmt.Errorf("execute sql: %w", execErr)
	}

	_ = s.repo.InsertQueryExecutionLog(ctx, newExecutionRecord(ctx, tenantID, userID, ds.ID, ds.Name, order.SQL, "completed", "", result.RowCount, &latency))

	resultJSON, _ := json.Marshal(result)
	resultStr := string(resultJSON)
	return s.repo.UpdateOrderStatus(ctx, id, "completed", nil, &resultStr)
}

// ---- Data Sources ----

func (s *Service) ListDataSources(ctx context.Context, tenantID string) ([]models.DataSource, error) {
	return s.repo.ListDataSources(ctx, tenantID)
}

func (s *Service) GetDataSource(ctx context.Context, tenantID, id string) (*models.DataSource, error) {
	ds, err := s.repo.GetDataSource(ctx, id)
	if err != nil {
		return nil, err
	}
	if ds.TenantID != "" && ds.TenantID != tenantID {
		return nil, fmt.Errorf("data source %q does not belong to tenant", id)
	}
	return ds, nil
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

func (s *Service) UpdateDataSource(ctx context.Context, tenantID, id string, req models.UpdateDataSourceRequest) (*models.DataSource, error) {
	if _, err := s.GetDataSource(ctx, tenantID, id); err != nil {
		return nil, err
	}
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

func (s *Service) DeleteDataSource(ctx context.Context, tenantID, id string) error {
	if _, err := s.GetDataSource(ctx, tenantID, id); err != nil {
		return err
	}
	return s.repo.DeleteDataSource(ctx, id)
}

// TestConnection checks connectivity to a data source by opening a real
// PostgreSQL connection and running a lightweight probe (SELECT 1 + version).
func (s *Service) TestConnection(ctx context.Context, tenantID, id string) (*models.TestConnectionResult, error) {
	ds, err := s.GetDataSource(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	ok, message, version, latency := testConnectionByType(ds, normalizeDBType(ds.Type), 5*time.Second)
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
	if ds.TenantID != "" && ds.TenantID != tenantID {
		return nil, fmt.Errorf("data source %q does not belong to tenant", req.DataSourceID)
	}

	// Only PostgreSQL and MySQL are supported for direct query execution.
	dbType := normalizeDBType(ds.Type)
	if dbType == "" {
		rec := newExecutionRecord(ctx, tenantID, userID, req.DataSourceID, ds.Name, req.SQL, "error",
			"Direct query execution not supported for "+ds.Type+". Supported types are postgresql and mysql.", 0, nil)
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

	rows, err := executeSQLQueryByType(ds, dbType, ctx, req.SQL)
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

// isReadOnlySQL returns true when the SQL statement is a safe
// read-only query. The check is deliberately strict — a single false
// negative is a write-via-read bug, so we err on the side of rejecting:
//
//   - Only "SELECT ..." or "WITH ... SELECT ..." allowed.
//   - No embedded semicolons (would allow statement stacking).
//   - No write side-effect keywords anywhere in the body (CREATE,
//     ALTER, DROP, INSERT, UPDATE, DELETE, TRUNCATE, GRANT, REVOKE,
//     SET, CALL, EXEC, EXECUTE, VACUUM, ANALYZE, REFRESH, LISTEN,
//     NOTIFY, LOAD, etc.).
//   - No string-literal escape tricks: we strip comments BEFORE
//     checking prefixes.
//
// This does not replace Postgres' read-only transactions; use one of
// those for defense in depth. This gate just catches obvious
// non-read-only input early.
func isReadOnlySQL(sql string) bool {
	// Reject multiple statements outright — a semicolon is the only
	// reliable separator, and we cannot safely interpret stacked
	// statements without a real parser.
	if strings.Contains(sql, ";") {
		return false
	}
	// Strip single-line and multi-line comments so a caller cannot
	// hide a keyword behind "-- DROP ..." or "/* DROP */".
	s := stripSQLComments(sql)
	s = strings.ToLower(strings.TrimSpace(s))

	if s == "" {
		return false
	}
	// Must start with select or with.
	if !strings.HasPrefix(s, "select") && !strings.HasPrefix(s, "with") {
		return false
	}
	// Reject any write side-effect keyword anywhere in the body.
	// This is intentionally a superset of what a read-only transaction
	// would refuse — we catch it at the API boundary.
	for _, bad := range blockedSQLKeywords {
		if containsSQLKeyword(s, bad) {
			return false
		}
	}
	return true
}

// blockedSQLKeywords is the set of SQL verbs that mutate state or
// escape the read-only boundary. Kept as a slice so adding a new
// keyword is a one-line change.
var blockedSQLKeywords = []string{
	"create", "alter", "drop", "truncate", "insert", "update", "delete",
	"grant", "revoke", "call", "exec", "execute", "set", "reset",
	"vacuum", "analyze", "refresh", "listen", "notify", "load",
	"copy", "fetch", "prepare", "deallocate", "comment",
}

// containsSQLKeyword returns true when keyword appears as a
// word-boundary token in sql. Using regexp so "update_time" does NOT
// match "update" and "table" does NOT match "set".
func containsSQLKeyword(sql, keyword string) bool {
	re := regexp.MustCompile(`(^|\W)` + regexp.QuoteMeta(keyword) + `(\W|$)`)
	return re.MatchString(sql)
}

// stripSQLComments removes -- single-line and /* */ block comments
// (because a DB parser would ignore them), and replaces string
// literals with '' (because their contents never execute as SQL).
// The result is what the parser actually evaluates — the keyword
// scan below runs on this stripped text so a caller cannot hide
// "DROP" in a comment or a string.
func stripSQLComments(sql string) string {
	var out strings.Builder
	for i := 0; i < len(sql); {
		// String literal: replace with '' so its contents do not
		// trigger the keyword scan. Handles SQL-style '' escape.
		if sql[i] == '\'' {
			end := i + 1
			for end < len(sql) {
				if sql[end] == '\'' {
					if end+1 < len(sql) && sql[end+1] == '\'' {
						end += 2
						continue
					}
					break
				}
				end++
			}
			out.WriteString("''")
			if end < len(sql) {
				i = end + 1
			} else {
				break
			}
			continue
		}
		// Single-line comment: skip to end of line.
		if i+1 < len(sql) && sql[i] == '-' && sql[i+1] == '-' {
			j := strings.IndexByte(sql[i:], '\n')
			if j < 0 {
				break
			}
			i += j + 1
			continue
		}
		// Block comment: skip to closing */.
		if i+1 < len(sql) && sql[i] == '/' && sql[i+1] == '*' {
			end := strings.Index(sql[i+2:], "*/")
			if end < 0 {
				break
			}
			i += 2 + end + 2
			continue
		}
		out.WriteByte(sql[i])
		i++
	}
	return out.String()
}

// normalizeDBType maps any user-supplied DataSource.Type string onto a
// canonical engine key used for connection dispatch. Recognised keys:
//   "postgres", "mysql".
// Unknown or empty types return "" so callers can fall through to an
// "unsupported" error branch instead of guessing.
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

// executeSQLByType dispatches an arbitrary SQL execution to the correct
// driver based on the data source type. PostgreSQL and MySQL share the
// same caller-facing sqlExecResult shape so the JSON returned to the UI
// is identical regardless of backend.
func executeSQLByType(ds *models.DataSource, dbType string, ctx context.Context, sqlStr, normalized string) (*sqlExecResult, error) {
	switch dbType {
	case "postgres":
		return executePGSQL(ds, ctx, sqlStr, normalized)
	case "mysql":
		return executeMySQLSQL(ds, ctx, sqlStr, normalized)
	default:
		return nil, fmt.Errorf("unsupported db type: %s", dbType)
	}
}

// executeSQLQueryByType opens a read-only connection to the appropriate
// engine and returns the *sql.Rows for the caller to iterate.
func executeSQLQueryByType(ds *models.DataSource, dbType string, ctx context.Context, sqlStr string) (*sql.Rows, error) {
	switch dbType {
	case "postgres":
		return executePGQuery(ds, ctx, sqlStr)
	case "mysql":
		return executeMySQLQuery(ds, ctx, sqlStr)
	default:
		return nil, fmt.Errorf("unsupported db type: %s", dbType)
	}
}

// testConnectionByType probes connectivity to whichever engine the data
// source is configured for. It returns the same (ok, message, version,
// latency) tuple the callers have always used.
func testConnectionByType(ds *models.DataSource, dbType string, timeout time.Duration) (bool, string, string, float64) {
	switch dbType {
	case "postgres":
		return testPGConnection(ds, timeout)
	case "mysql":
		return testMySQLConnection(ds, timeout)
	default:
		// Preserve the legacy behaviour for unknown/empty types: try
		// PostgreSQL so that untyped data sources still work.
		return testPGConnection(ds, timeout)
	}
}

func buildMySQLDSN(ds *models.DataSource) string {
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
	// Default to standard MySQL port.
	if port <= 0 {
		port = 3306
	}
	if host == "" {
		host = "localhost"
	}
	if database == "" {
		database = "mysql"
	}
	dsn := fmt.Sprintf(
		"%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local&collation=utf8mb4_unicode_ci",
		user, password, host, port, database,
	)
	return dsn
}

func testMySQLConnection(ds *models.DataSource, timeout time.Duration) (ok bool, message string, version string, latency float64) {
	dsn := buildMySQLDSN(ds)
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	conn, err := sql.Open("mysql", dsn)
	if err != nil {
		return false, fmt.Sprintf("failed to open connection: %s", err), "", 0
	}
	defer conn.Close()
	start := time.Now()
	err = conn.PingContext(ctx)
	if err != nil {
		return false, fmt.Sprintf("failed to ping database: %s", err), "", 0
	}
	rows, err := conn.QueryContext(ctx, "SELECT VERSION()")
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

func executeMySQLQuery(ds *models.DataSource, ctx context.Context, query string) (*sql.Rows, error) {
	dsn := buildMySQLDSN(ds)
	conn, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open connection to %s: %w", ds.Name, err)
	}
	conn.SetMaxOpenConns(1)
	conn.SetConnMaxLifetime(30 * time.Second)
	return conn.QueryContext(ctx, query)
}

// executeMySQLSQL executes an arbitrary SQL statement against a MySQL
// data source with the same read-only detection logic used for PG.
// MySQL uses `LIMIT n` (same as PG's basic form), backticks for
// identifier quoting (vs PG double-quotes), and
// `SHOW DATABASES`/`INFORMATION_SCHEMA.TABLES` for introspection. The
// driver's `parseTime=True` option keeps DATETIME values as time.Time.
func executeMySQLSQL(ds *models.DataSource, ctx context.Context, sqlStr, normalized string) (*sqlExecResult, error) {
	dsn := buildMySQLDSN(ds)
	conn, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open connection to %s: %w", ds.Name, err)
	}
	conn.SetMaxOpenConns(1)
	conn.SetConnMaxLifetime(30 * time.Second)
	defer conn.Close()

	if isReadOnlySQL(normalized) {
		rows, err := conn.QueryContext(ctx, sqlStr)
		if err != nil {
			return nil, err
		}
		defer rows.Close()

		columns, _ := rows.Columns()
		result := &sqlExecResult{
			Columns: columns,
			Rows:    []map[string]interface{}{},
		}

		for rows.Next() {
			values := make([]interface{}, len(columns))
			valuePtrs := make([]interface{}, len(columns))
			for i := range values {
				valuePtrs[i] = &values[i]
			}
			if err := rows.Scan(valuePtrs...); err != nil {
				return nil, fmt.Errorf("scan row: %w", err)
			}
			row := make(map[string]interface{}, len(columns))
			for i, col := range columns {
				// MySQL driver returns []byte for most non-numeric types
				// and time.Time for DATETIME/TIMESTAMP columns.
				switch v := values[i].(type) {
				case []byte:
					row[col] = string(v)
				case time.Time:
					row[col] = v.Format(time.RFC3339)
				default:
					row[col] = v
				}
			}
			result.Rows = append(result.Rows, row)
		}
		result.RowCount = len(result.Rows)
		return result, nil
	}

	res, err := conn.ExecContext(ctx, sqlStr)
	if err != nil {
		return nil, err
	}
	affected, _ := res.RowsAffected()
	return &sqlExecResult{
		RowsAffected: affected,
		RowCount:     int(affected),
	}, nil
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

// sqlExecResult holds the outcome of a SQL execution. For read-only statements
// it carries columns and rows; for DML/DDL it carries the affected-row count.
type sqlExecResult struct {
	Columns      []string                 `json:"columns,omitempty"`
	Rows         []map[string]interface{} `json:"rows,omitempty"`
	RowCount     int                      `json:"row_count"`
	RowsAffected int64                    `json:"rows_affected,omitempty"`
}

// executePGSQL executes an arbitrary SQL statement against a PostgreSQL
// data source. Read-only statements (SELECT/SHOW/DESCRIBE/EXPLAIN) go
// through QueryContext so the caller gets rows back; everything else uses
// ExecContext and returns the affected-row count. The connection is
// opened fresh per call (no pool reuse) because the data source may have
// arbitrary credentials and we must not leak them across tenants.
func executePGSQL(ds *models.DataSource, ctx context.Context, sqlStr, normalized string) (*sqlExecResult, error) {
	dsn := buildPGDSN(ds)
	conn, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open connection to %s: %w", ds.Name, err)
	}
	conn.SetMaxOpenConns(1)
	conn.SetConnMaxLifetime(30 * time.Second)
	defer conn.Close()

	if isReadOnlySQL(normalized) {
		rows, err := conn.QueryContext(ctx, sqlStr)
		if err != nil {
			return nil, err
		}
		defer rows.Close()

		columns, _ := rows.Columns()
		result := &sqlExecResult{
			Columns: columns,
			Rows:    []map[string]interface{}{},
		}

		for rows.Next() {
			values := make([]interface{}, len(columns))
			valuePtrs := make([]interface{}, len(columns))
			for i := range values {
				valuePtrs[i] = &values[i]
			}
			if err := rows.Scan(valuePtrs...); err != nil {
				return nil, fmt.Errorf("scan row: %w", err)
			}
			row := make(map[string]interface{}, len(columns))
			for i, col := range columns {
				if b, ok := values[i].([]byte); ok {
					row[col] = string(b)
				} else {
					row[col] = values[i]
				}
			}
			result.Rows = append(result.Rows, row)
		}
		result.RowCount = len(result.Rows)
		return result, nil
	}

	res, err := conn.ExecContext(ctx, sqlStr)
	if err != nil {
		return nil, err
	}
	affected, _ := res.RowsAffected()
	return &sqlExecResult{
		RowsAffected: affected,
		RowCount:     int(affected),
	}, nil
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
