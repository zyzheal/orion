package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/inception/engine"
	"orion/platform-svc-go/internal/inception/models"
	"orion/platform-svc-go/internal/inception/repository"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
)

var (
	ErrBlacklisted              = errors.New("sql blocked by blacklist")
	ErrInvalidStatus            = errors.New("invalid status transition")
	ErrInceptionProjectNotFound = errors.New("project not found")
	ErrEngineNotConfigured      = errors.New("inception engine not configured for tenant")
	ErrEngineSubmit             = errors.New("inception engine submit failed")
)

// EngineClient is the narrow interface the Service uses to talk to the
// Inception engine. engine.Client implements this; tests can inject a fake.
type EngineClient interface {
	CheckSQL(ctx context.Context, req engine.TaskRequest) (*engine.Result, error)
	ExecuteSQL(ctx context.Context, req engine.TaskRequest) (*engine.Result, error)
	Health(ctx context.Context) error
}

// Service provides business logic for the inception SQL audit engine.
type Service struct {
	repo  *repository.Repository
	client EngineClient // may be nil when no engine is wired
}

// NewService creates a new Service. Passing nil for client leaves the
// Service in a local-only mode — audit records are persisted but no
// submission to a remote Inception engine is attempted.
func NewService(repo *repository.Repository, client EngineClient) *Service {
	return &Service{repo: repo, client: client}
}

// SetEngineClient swaps the engine client after construction. Useful for
// wiring code that resolves the tenant-specific engine at runtime.
func (s *Service) SetEngineClient(c EngineClient) { s.client = c }

// ---------------------------------------------------------------------------
// SQL Audit History
// ---------------------------------------------------------------------------

// CreateAudit validates and records a SQL audit entry. If the SQL matches a
// blacklist pattern, the audit is rejected immediately. When an engine
// client is wired, the audit is submitted to Inception — the returned
// record is updated with the engine's errors, warnings, affected-row
// count, and execution time. When no client is wired the record is
// persisted as "pending" and callers can follow up with SubmitToEngine.
func (s *Service) CreateAudit(ctx context.Context, tenantID string, req *models.CreateAuditRequest) (*models.SQLAuditHistory, error) {
	opType := strings.ToLower(strings.TrimSpace(req.OperationType))
	if opType == "" {
		opType = "audit"
	}
	validOps := map[string]bool{"audit": true, "parse": true, "execute": true, "validate": true}
	if !validOps[opType] {
		return nil, fmt.Errorf("invalid operation_type %q; allowed: audit, parse, execute, validate", opType)
	}

	blocked, reason, err := s.repo.IsBlacklisted(ctx, tenantID, req.SQLStatement)
	if err != nil {
		return nil, fmt.Errorf("blacklist check failed: %w", err)
	}
	if blocked {
		return nil, fmt.Errorf("%w: %s", ErrBlacklisted, reason)
	}

	a := &models.SQLAuditHistory{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		DBName:        req.DBName,
		SQLStatement:  req.SQLStatement,
		OperationType: opType,
		DryRun:        req.DryRun,
		Status:        "pending",
		Errors:        models.JSONArray{},
		Warnings:      models.JSONArray{},
	}
	if req.AuditedBy != "" {
		a.AuditedBy = &req.AuditedBy
	}
	if req.RequestID != "" {
		a.RequestID = &req.RequestID
	}

	if err := s.repo.CreateAudit(ctx, a); err != nil {
		return nil, fmt.Errorf("create audit failed: %w", err)
	}

	// If an engine is wired, submit immediately. Otherwise the record stays
	// pending so a later SubmitToEngine call can pick it up. When the
	// operation is "execute" the engine runs the SQL; other operations
	// (audit/parse/validate) only request an audit pass.
	if s.client != nil {
		status, errors, warnings, affected, execMs := s.submitToEngine(ctx, a, opType == "execute")
		if status != "" {
			newStatus := status
			if err := s.repo.UpdateAuditStatus(ctx, tenantID, a.ID, newStatus, errors, warnings, affected, execMs); err != nil {
				return nil, fmt.Errorf("persist audit engine result failed: %w", err)
			}
			a.Status = status
			a.Errors = errors
			a.Warnings = warnings
			if affected != nil {
				a.AffectedRows = affected
			}
			if execMs != nil {
				a.ExecTimeMs = execMs
			}
		}
	}
	return a, nil
}

// SubmitToEngine is the manual variant of CreateAudit's engine call. It is
// exported so operators can retry a previously-pending audit without
// recreating it.
func (s *Service) SubmitToEngine(ctx context.Context, tenantID, id string) (*models.SQLAuditHistory, error) {
	a, err := s.repo.GetAuditByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if s.client == nil {
		return nil, ErrEngineNotConfigured
	}
	status, errors, warnings, affected, execMs := s.submitToEngine(ctx, a, a.OperationType == "execute")
	if status == "" {
		// No engine call happened (engine client was nil at call time or the
		// audit already carried a terminal status). Return as-is.
		return a, nil
	}
	if err := s.repo.UpdateAuditStatus(ctx, tenantID, a.ID, status, errors, warnings, affected, execMs); err != nil {
		return nil, err
	}
	a.Status = status
	a.Errors = errors
	a.Warnings = warnings
	if affected != nil {
		a.AffectedRows = affected
	}
	if execMs != nil {
		a.ExecTimeMs = execMs
	}
	return a, nil
}

// submitToEngine calls the engine client and folds the result back into the
// audit's Status/Errors/Warnings/AffectedRows/ExecTimeMs fields. When the
// engine returns an error we still produce a valid status so the record
// ends up in a well-defined state rather than stuck at "pending".
func (s *Service) submitToEngine(ctx context.Context, a *models.SQLAuditHistory, execute bool) (string, models.JSONArray, models.JSONArray, *int, *int) {
	if s.client == nil {
		return "", models.JSONArray{}, models.JSONArray{}, nil, nil
	}
	if a.Status == "success" || a.Status == "failed" {
		return a.Status, a.Errors, a.Warnings, nil, nil
	}

	taskName := a.ID
	if a.RequestID != nil && *a.RequestID != "" {
		taskName = *a.RequestID
	}
	req := engine.TaskRequest{
		TaskName:     taskName,
		JobName:      fmt.Sprintf("%s-%s", a.TenantID, a.ID),
		DBName:       a.DBName,
		SQLStatement: a.SQLStatement,
		DryRun:       !execute,
	}

	var res *engine.Result
	var callErr error
	if execute {
		res, callErr = s.client.ExecuteSQL(ctx, req)
	} else {
		res, callErr = s.client.CheckSQL(ctx, req)
	}
	if callErr != nil {
		// Engine call failed. Persist as failed with the transport error so
		// operators can see what went wrong.
		errors := models.JSONArray{fmt.Sprintf("engine call failed: %v", callErr)}
		return "failed", errors, models.JSONArray{}, nil, nil
	}

	errors := models.JSONArray{}
	warnings := models.JSONArray{}
	for _, e := range res.Errors {
		errors = append(errors, e)
	}
	for _, w := range res.Warnings {
		warnings = append(warnings, w)
	}

	var affected *int
	var execMs *int
	if res.AffectedRows > 0 {
		affected = &res.AffectedRows
	}
	if res.DurationMS > 0 {
		execMs = int32ToPointer(int(res.DurationMS))
	}

	if res.Success && len(errors) == 0 {
		return "success", errors, warnings, affected, execMs
	}
	// Non-success or engine flagged errors — record as failed so the caller
	// can surface a definitive outcome.
	return "failed", errors, warnings, affected, execMs
}

// int32ToPointer is a helper since the audit's ExecTimeMs field is *int and
// the engine reports DurationMS as int64. It clamps large values to fit
// int32 so the field's type contract stays honest.
func int32ToPointer(v int) *int {
	if v > 2147483647 {
		v = 2147483647
	}
	if v < -2147483648 {
		v = -2147483648
	}
	return &v
}

// SetDefaultEngineClient wires an engine client built from host/port/env
// for callers that do not have their own client manager.
func (s *Service) SetDefaultEngineClient(baseURL, apiKey string, timeout time.Duration) {
	s.client = engine.New(engine.Config{
		BaseURL: baseURL,
		APIKey:  apiKey,
		Timeout: timeout,
	})
}

// ListAudits returns paginated audit history.
func (s *Service) ListAudits(ctx context.Context, tenantID string, offset, limit int) ([]models.SQLAuditHistory, error) {
	return s.repo.ListAudits(ctx, tenantID, offset, limit)
}

// ListAuditsByStatus returns paginated audit history filtered by status.
func (s *Service) ListAuditsByStatus(ctx context.Context, tenantID, status string, offset, limit int) ([]models.SQLAuditHistory, error) {
	validStatuses := map[string]bool{"pending": true, "success": true, "failed": true}
	if !validStatuses[status] {
		return nil, fmt.Errorf("%w: %s", ErrInvalidStatus, status)
	}
	return s.repo.ListAuditsByStatus(ctx, tenantID, status, offset, limit)
}

// GetAuditByID returns a single audit record.
func (s *Service) GetAuditByID(ctx context.Context, tenantID, id string) (*models.SQLAuditHistory, error) {
	a, err := s.repo.GetAuditByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("%w: audit %s", sentinel.NotFound, id)
	}
	return a, nil
}

// UpdateAuditStatus updates the status and execution results of an audit.
func (s *Service) UpdateAuditStatus(ctx context.Context, tenantID, id, status string, errors, warnings models.JSONArray, affectedRows, execTimeMs *int) error {
	validStatuses := map[string]bool{"pending": true, "success": true, "failed": true}
	if !validStatuses[status] {
		return fmt.Errorf("%w: %s", ErrInvalidStatus, status)
	}
	return s.repo.UpdateAuditStatus(ctx, tenantID, id, status, errors, warnings, affectedRows, execTimeMs)
}

// CountAudits returns total audit count for a tenant.
func (s *Service) CountAudits(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountAudits(ctx, tenantID)
}

// DeleteAudit removes an audit record.
func (s *Service) DeleteAudit(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteAudit(ctx, tenantID, id)
}

// ---------------------------------------------------------------------------
// SQL Blacklist
// ---------------------------------------------------------------------------

// CreateBlacklist adds a new blacklist pattern.
func (s *Service) CreateBlacklist(ctx context.Context, tenantID string, req *models.CreateBlacklistRequest) (*models.SQLBlacklist, error) {
	severity := strings.ToLower(strings.TrimSpace(req.Severity))
	if severity == "" {
		severity = "high"
	}
	validSeverities := map[string]bool{"low": true, "medium": true, "high": true, "critical": true}
	if !validSeverities[severity] {
		return nil, fmt.Errorf("invalid severity %q; allowed: low, medium, high, critical", severity)
	}

	b := &models.SQLBlacklist{
		ID:       uuid.New().String(),
		TenantID: &tenantID,
		Pattern:  req.Pattern,
		Severity: severity,
		Enabled:  true,
	}
	if req.Description != "" {
		b.Description = &req.Description
	}
	if req.CreatedBy != "" {
		b.CreatedBy = &req.CreatedBy
	}

	if err := s.repo.CreateBlacklist(ctx, b); err != nil {
		return nil, fmt.Errorf("create blacklist entry failed: %w", err)
	}
	return b, nil
}

// ListBlacklists returns paginated blacklist entries.
func (s *Service) ListBlacklists(ctx context.Context, tenantID string, offset, limit int) ([]models.SQLBlacklist, error) {
	return s.repo.ListBlacklists(ctx, tenantID, offset, limit)
}

// GetBlacklistByID returns a single blacklist entry.
func (s *Service) GetBlacklistByID(ctx context.Context, id string) (*models.SQLBlacklist, error) {
	b, err := s.repo.GetBlacklistByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: blacklist %s", sentinel.NotFound, id)
	}
	return b, nil
}

// UpdateBlacklist updates a blacklist entry.
func (s *Service) UpdateBlacklist(ctx context.Context, id string, req *models.UpdateBlacklistRequest) error {
	if req.Severity != nil {
		validSeverities := map[string]bool{"low": true, "medium": true, "high": true, "critical": true}
		if !validSeverities[*req.Severity] {
			return fmt.Errorf("invalid severity %q", *req.Severity)
		}
	}
	return s.repo.UpdateBlacklist(ctx, id, req.Pattern, req.Description, req.Severity, req.Enabled)
}

// CountBlacklists returns total blacklist count for a tenant.
func (s *Service) CountBlacklists(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountBlacklists(ctx, tenantID)
}

// DeleteBlacklist removes a blacklist entry.
func (s *Service) DeleteBlacklist(ctx context.Context, id string) error {
	return s.repo.DeleteBlacklist(ctx, id)
}

// ---------------------------------------------------------------------------
// Inception Config
// ---------------------------------------------------------------------------

// UpsertConfig creates or updates the inception config for a tenant.
func (s *Service) UpsertConfig(ctx context.Context, tenantID string, req *models.CreateConfigRequest) (*models.InceptionConfig, error) {
	port := req.Port
	if port == 0 {
		port = 6669
	}
	timeoutMs := req.TimeoutMs
	if timeoutMs == 0 {
		timeoutMs = 30000
	}

	c := &models.InceptionConfig{
		ID:                uuid.New().String(),
		TenantID:          tenantID,
		Host:              req.Host,
		Port:              port,
		User:              req.User,
		EncryptedPassword: &req.Password,
		TimeoutMs:         timeoutMs,
		Enabled:           true,
	}
	if req.DefaultDB != "" {
		c.DefaultDB = &req.DefaultDB
	}

	if err := s.repo.UpsertConfig(ctx, c); err != nil {
		return nil, fmt.Errorf("upsert config failed: %w", err)
	}
	return c, nil
}

// GetConfigByTenant returns the inception config for a tenant.
func (s *Service) GetConfigByTenant(ctx context.Context, tenantID string) (*models.InceptionConfig, error) {
	c, err := s.repo.GetConfigByTenant(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("%w: config for tenant %s", sentinel.NotFound, tenantID)
	}
	return c, nil
}

// ListConfigs returns paginated inception configs.
func (s *Service) ListConfigs(ctx context.Context, offset, limit int) ([]models.InceptionConfig, error) {
	return s.repo.ListConfigs(ctx, offset, limit)
}

// UpdateConfig updates an inception config.
func (s *Service) UpdateConfig(ctx context.Context, tenantID string, req *models.UpdateConfigRequest) error {
	return s.repo.UpdateConfig(ctx, tenantID, req.Host, req.User, req.Password, req.DefaultDB, req.Port, req.TimeoutMs, req.Enabled)
}

// CountConfigs returns total config count.
func (s *Service) CountConfigs(ctx context.Context) (int, error) {
	return s.repo.CountConfigs(ctx)
}

// DeleteConfig removes an inception config.
func (s *Service) DeleteConfig(ctx context.Context, tenantID string) error {
	return s.repo.DeleteConfig(ctx, tenantID)
}

// ---------------------------------------------------------------------------
// Audit Reports
// ---------------------------------------------------------------------------

// CreateReport creates a new audit report record.
func (s *Service) CreateReport(ctx context.Context, tenantID string, req *models.CreateReportRequest) (*models.AuditReport, error) {
	format := strings.ToLower(strings.TrimSpace(req.Format))
	if format == "" {
		format = "json"
	}
	validFormats := map[string]bool{"json": true, "csv": true, "pdf": true}
	if !validFormats[format] {
		return nil, fmt.Errorf("invalid format %q; allowed: json, csv, pdf", format)
	}

	rpt := &models.AuditReport{
		ID:         uuid.New().String(),
		TenantID:   tenantID,
		ReportName: req.ReportName,
		Format:     format,
		Status:     "generating",
		Filters:    models.JSONB{},
	}
	if req.GeneratedBy != "" {
		rpt.GeneratedBy = &req.GeneratedBy
	}

	if err := s.repo.CreateReport(ctx, rpt); err != nil {
		return nil, fmt.Errorf("create report failed: %w", err)
	}
	return rpt, nil
}

// ListReports returns paginated audit reports.
func (s *Service) ListReports(ctx context.Context, tenantID string, offset, limit int) ([]models.AuditReport, error) {
	return s.repo.ListReports(ctx, tenantID, offset, limit)
}

// GetReportByID returns a single audit report.
func (s *Service) GetReportByID(ctx context.Context, tenantID, id string) (*models.AuditReport, error) {
	rpt, err := s.repo.GetReportByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("%w: report %s", sentinel.NotFound, id)
	}
	return rpt, nil
}

// UpdateReportStatus updates the status and file path of a report.
func (s *Service) UpdateReportStatus(ctx context.Context, tenantID, id, status string, filePath *string) error {
	validStatuses := map[string]bool{"generating": true, "ready": true, "failed": true}
	if !validStatuses[status] {
		return fmt.Errorf("%w: %s", ErrInvalidStatus, status)
	}
	return s.repo.UpdateReportStatus(ctx, tenantID, id, status, filePath)
}

// CountReports returns total report count for a tenant.
func (s *Service) CountReports(ctx context.Context, tenantID string) (int, error) {
	return s.repo.CountReports(ctx, tenantID)
}

// DeleteReport removes an audit report.
func (s *Service) DeleteReport(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteReport(ctx, tenantID, id)
}

// PurgeExpiredReports deletes expired reports. Returns number of deleted rows.
func (s *Service) PurgeExpiredReports(ctx context.Context) (int64, error) {
	return s.repo.PurgeExpiredReports(ctx)
}

// ---------------------------------------------------------------------------
// Engine / Status helpers
// ---------------------------------------------------------------------------

// Health returns the engine health status. When no engine client is wired
// the service reports "unreachable" — callers can treat that as a
// configuration gap rather than a live failure.
func (s *Service) Health(ctx context.Context) (string, error) {
	if s.client == nil {
		return "not_configured", nil
	}
	if err := s.client.Health(ctx); err != nil {
		return "unreachable", err
	}
	return "ok", nil
}

// Status returns the inception engine configuration status for a tenant.
// It only reports the configuration state; use Health for a live check.
func (s *Service) Status(ctx context.Context, tenantID string) (enabled bool, message string, err error) {
	cfg, err := s.GetConfigByTenant(ctx, tenantID)
	if err != nil {
		return false, "Inception not configured", nil
	}
	if cfg.Enabled {
		return true, "Inception configured and enabled", nil
	}
	return false, "Inception configured but disabled", nil
}

// ListDatabases returns distinct database names from the audit history for a tenant.
func (s *Service) ListDatabases(ctx context.Context, tenantID string) ([]string, error) {
	audits, err := s.repo.ListAudits(ctx, tenantID, 0, 10000)
	if err != nil {
		return nil, fmt.Errorf("list databases failed: %w", err)
	}
	seen := make(map[string]bool)
	var dbs []string
	for _, a := range audits {
		if a.DBName != "" && !seen[a.DBName] {
			seen[a.DBName] = true
			dbs = append(dbs, a.DBName)
		}
	}
	return dbs, nil
}
