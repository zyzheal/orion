package service

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/governance/audit/models"
	"orion/platform-svc-go/internal/governance/audit/repository"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("orion-audit-svc")

// ServiceError represents a business logic error with an error code.
type ServiceError struct {
	Message string
	Code    string
}

func (e *ServiceError) Error() string {
	return e.Message
}

// Error code constants matching the Node.js AuditServiceError codes.
const (
	ErrCodeNotFound     = "NOT_FOUND"
	ErrCodeInvalidInput = "INVALID_INPUT"
	ErrCodeInternal     = "INTERNAL"
)

// Service implements the audit business logic layer.
// It delegates data access to Repository and adds validation,
// hash chain computation, and chain verification.
type Service struct {
	repo *repository.Repository
}

// NewService creates a new Service instance.
func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// GetAuditLog retrieves a single audit log by ID. Returns NOT_FOUND if it does not exist.
func (s *Service) GetAuditLog(ctx context.Context, id string) (*models.AuditLog, error) {
	ctx, span := tracer.Start(ctx, "Service.GetAuditLog",
		trace.WithAttributes(attribute.String("audit.id", id)))
	defer span.End()

	log, err := s.repo.FindByID(ctx, id)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, &ServiceError{Message: fmt.Sprintf("database error: %v", err), Code: ErrCodeInternal}
	}
	if log == nil {
		return nil, &ServiceError{Message: fmt.Sprintf("Audit log not found: %s", id), Code: ErrCodeNotFound}
	}
	return log, nil
}

// ListAuditLogs returns a paginated, filtered list of audit logs.
// Matches the Node.js AuditService.listAuditLogs() logic.
func (s *Service) ListAuditLogs(ctx context.Context, opts models.ListAuditLogFilters) (*models.PaginatedResponse, error) {
	ctx, span := tracer.Start(ctx, "Service.ListAuditLogs",
		trace.WithAttributes(
			attribute.String("audit.tenant_id", opts.TenantID),
			attribute.Int("audit.limit", opts.Limit),
			attribute.Int("audit.offset", opts.Offset),
		))
	defer span.End()

	if opts.Limit <= 0 {
		opts.Limit = 20
	}
	if opts.Limit > 100 {
		opts.Limit = 100
	}
	if opts.Offset < 0 {
		opts.Offset = 0
	}

	logs, err := s.repo.FindAll(ctx, opts)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, &ServiceError{Message: fmt.Sprintf("database error: %v", err), Code: ErrCodeInternal}
	}

	total, err := s.repo.Count(ctx, models.ListAuditLogFilters{
		TenantID:     opts.TenantID,
		UserID:       opts.UserID,
		Action:       opts.Action,
		ResourceType: opts.ResourceType,
	})
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, &ServiceError{Message: fmt.Sprintf("database error: %v", err), Code: ErrCodeInternal}
	}

	page := (opts.Offset / opts.Limit) + 1
	totalPages := total / opts.Limit
	if total%opts.Limit > 0 {
		totalPages++
	}

	return &models.PaginatedResponse{
		Data:       logs,
		Total:      total,
		Page:       page,
		PageSize:   opts.Limit,
		TotalPages: totalPages,
	}, nil
}

// CreateAuditLog validates input, computes the SHA256 hash chain, and persists
// a new audit log entry. Matches the Node.js AuditService.createAuditLog() logic:
//   - Validates tenant_id, action, resource_type are present
//   - Fetches the latest hash for the tenant (prev_hash)
//   - Computes hash = SHA256(json(payload) + prevHash)
//   - Inserts the entry
func (s *Service) CreateAuditLog(ctx context.Context, tenantID string, req *models.CreateAuditRequest) (*models.AuditLog, error) {
	ctx, span := tracer.Start(ctx, "Service.CreateAuditLog",
		trace.WithAttributes(
			attribute.String("audit.tenant_id", tenantID),
			attribute.String("audit.action", req.Action),
			attribute.String("audit.resource_type", req.ResourceType),
		))
	defer span.End()

	if tenantID == "" {
		return nil, &ServiceError{Message: "Tenant ID required", Code: ErrCodeInvalidInput}
	}
	if req.Action == "" {
		return nil, &ServiceError{Message: "Action required", Code: ErrCodeInvalidInput}
	}
	if req.ResourceType == "" {
		return nil, &ServiceError{Message: "Resource type required", Code: ErrCodeInvalidInput}
	}

	// Fetch the latest hash for this tenant to use as prev_hash
	prevHash, err := s.repo.GetLatestHash(ctx, tenantID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, &ServiceError{Message: fmt.Sprintf("database error: %v", err), Code: ErrCodeInternal}
	}

	now := time.Now().UTC()
	entryID := uuid.New().String()

	// Build the audit log entry
	entry := &models.AuditLog{
		ID:           entryID,
		TenantID:     tenantID,
		ActorID:      req.ActorID,
		Action:       req.Action,
		ResourceType: req.ResourceType,
		IPAddress:    toNullStr(req.IPAddress),
		UserAgent:    toNullStr(req.UserAgent),
		CreatedAt:    now,
	}

	if req.ResourceID != "" {
		entry.ResourceID = sql.NullString{String: req.ResourceID, Valid: true}
	}
	if req.RequestMethod != "" {
		entry.RequestMethod = sql.NullString{String: req.RequestMethod, Valid: true}
	}
	if req.RequestPath != "" {
		entry.RequestPath = sql.NullString{String: req.RequestPath, Valid: true}
	}
	if req.RequestBody != nil {
		entry.RequestBody = models.JSONB(req.RequestBody)
	}
	if req.ResponseCode != 0 {
		entry.ResponseCode = sql.NullInt32{Int32: int32(req.ResponseCode), Valid: true}
	}
	if req.ResponseBody != nil {
		entry.ResponseBody = models.JSONB(req.ResponseBody)
	}
	if prevHash != "" {
		entry.PrevHash = sql.NullString{String: prevHash, Valid: true}
	}

	// Compute hash: SHA256(JSON(payload) + prevHash) — matches Node.js logic
	hash := computeEntryHash(entry, prevHash)
	entry.Hash = hash

	if err := s.repo.Create(ctx, entry); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, &ServiceError{Message: fmt.Sprintf("database error: %v", err), Code: ErrCodeInternal}
	}

	span.AddEvent("audit_log_created", trace.WithAttributes(
		attribute.String("audit.id", entryID),
	))
	return entry, nil
}

// Delete removes an audit log entry scoped to a tenant.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	ctx, span := tracer.Start(ctx, "Service.Delete",
		trace.WithAttributes(
			attribute.String("audit.tenant_id", tenantID),
			attribute.String("audit.id", id),
		))
	defer span.End()

	err := s.repo.Delete(ctx, tenantID, id)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return &ServiceError{Message: fmt.Sprintf("database error: %v", err), Code: ErrCodeInternal}
	}
	return nil
}

// Count returns the total number of audit logs for a tenant.
func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	ctx, span := tracer.Start(ctx, "Service.Count",
		trace.WithAttributes(attribute.String("audit.tenant_id", tenantID)))
	defer span.End()

	count, err := s.repo.Count(ctx, models.ListAuditLogFilters{TenantID: tenantID})
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return 0, &ServiceError{Message: fmt.Sprintf("database error: %v", err), Code: ErrCodeInternal}
	}
	return count, nil
}

// VerifyChain verifies the hash chain integrity for a tenant.
// Walks all entries from oldest to newest, recomputing hashes and checking
// prev_hash continuity. Returns the first break point if found.
func (s *Service) VerifyChain(ctx context.Context, tenantID string) (*models.ChainVerificationResult, error) {
	ctx, span := tracer.Start(ctx, "Service.VerifyChain",
		trace.WithAttributes(attribute.String("audit.tenant_id", tenantID)))
	defer span.End()

	result, err := s.repo.VerifyChain(ctx, tenantID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, &ServiceError{Message: fmt.Sprintf("verification error: %v", err), Code: ErrCodeInternal}
	}

	span.AddEvent("chain_verification_completed", trace.WithAttributes(
		attribute.Bool("audit.chain_valid", result.Valid),
		attribute.Int("audit.total_verified", result.TotalVerified),
	))
	return result, nil
}

// GetActions returns the distinct action values for a tenant (for filter dropdowns).
func (s *Service) GetActions(ctx context.Context, tenantID string) ([]string, error) {
	ctx, span := tracer.Start(ctx, "Service.GetActions",
		trace.WithAttributes(attribute.String("audit.tenant_id", tenantID)))
	defer span.End()

	actions, err := s.repo.GetActions(ctx, tenantID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, &ServiceError{Message: fmt.Sprintf("database error: %v", err), Code: ErrCodeInternal}
	}
	return actions, nil
}

// GetResourceTypes returns the distinct resource_type values for a tenant (for filter dropdowns).
func (s *Service) GetResourceTypes(ctx context.Context, tenantID string) ([]string, error) {
	ctx, span := tracer.Start(ctx, "Service.GetResourceTypes",
		trace.WithAttributes(attribute.String("audit.tenant_id", tenantID)))
	defer span.End()

	types, err := s.repo.GetResourceTypes(ctx, tenantID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, &ServiceError{Message: fmt.Sprintf("database error: %v", err), Code: ErrCodeInternal}
	}
	return types, nil
}

// Update modifies non-hash-chain fields of an existing audit log entry.
// The entry must exist; if not found, returns NOT_FOUND.
func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateAuditRequest) (*models.AuditLog, error) {
	ctx, span := tracer.Start(ctx, "Service.Update",
		trace.WithAttributes(
			attribute.String("audit.tenant_id", tenantID),
			attribute.String("audit.id", id),
		))
	defer span.End()

	if err := s.repo.Update(ctx, tenantID, id, req); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, &ServiceError{Message: fmt.Sprintf("database error: %v", err), Code: ErrCodeInternal}
	}

	updated, err := s.repo.FindByID(ctx, id)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, &ServiceError{Message: fmt.Sprintf("database error: %v", err), Code: ErrCodeInternal}
	}
	if updated == nil {
		return nil, &ServiceError{Message: fmt.Sprintf("Audit log not found: %s", id), Code: ErrCodeNotFound}
	}
	return updated, nil
}

// computeEntryHash computes SHA256(JSON.stringify(payload) + prevHash),
// exactly matching the Node.js AuditRepository.create() hash logic.
func computeEntryHash(a *models.AuditLog, prevHash string) string {
	payload := map[string]interface{}{
		"tenant_id":      a.TenantID,
		"user_id":        a.ActorID,
		"action":         a.Action,
		"resource_type":  a.ResourceType,
		"resource_id":    nullStrValue(a.ResourceID),
		"request_method": nullStrValue(a.RequestMethod),
		"request_path":   nullStrValue(a.RequestPath),
		"request_body":   a.RequestBody,
		"response_code":  nullIntValue(a.ResponseCode),
		"response_body":  a.ResponseBody,
		"ip_address":     nullStrValue(a.IPAddress),
		"user_agent":     nullStrValue(a.UserAgent),
		"timestamp":      a.CreatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
	}
	data, _ := json.Marshal(payload)
	h := sha256.Sum256(append(data, []byte(prevHash)...))
	return fmt.Sprintf("%x", h)
}

// --- helper functions ---

func toNullStr(s string) sql.NullString {
	if s == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: s, Valid: true}
}

func nullStrValue(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return ""
}

func nullIntValue(ni sql.NullInt32) interface{} {
	if ni.Valid {
		return ni.Int32
	}
	return nil
}
