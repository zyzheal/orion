package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"orion/platform-svc-go/internal/config-mgmt-enhanced/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// The column lists mirror the db tags in models.go exactly. They are spelled out
// instead of SELECT * so a later migration adding a column cannot break every
// read in this file, and so a read cannot silently pull a column the model
// does not know about. config_drift_reports has an updated_at column that
// DriftReport does not, so it is deliberately absent from driftReportColumns.
const configMgmtColumns = "id, tenant_id, name, created_at, updated_at"

const changeRequestColumns = "id, tenant_id, config_key, config_group, environment, " +
	"change_type, old_value, new_value, reason, risk_level, requester, status, " +
	"execution_plan, rollback_plan, approvals, required_approvals, executed_at, " +
	"executed_by, approved_at, approved_by, rolled_back_at, rolled_back_by, " +
	"created_at, updated_at"

const changeHistoryColumns = "id, tenant_id, change_request_id, config_key, " +
	"config_group, environment, action, actor, old_value, new_value, notes, created_at"

const driftReportColumns = "id, tenant_id, config_group, drift_status, expected_config, " +
	"actual_config, drift_items, total_drifts, critical_drifts, " +
	"auto_remediation_enabled, remediation_log, detected_at, last_checked_at, created_at"

// Update whitelists. id, tenant_id and created_at are excluded from all three:
// these SET clauses used to be built by splicing whatever key the caller put in
// its map, which let a caller set id or tenant_id and rewrite a row's identity
// or move it into another tenant.
var configMgmtUpdateColumns = map[string]bool{
	"name":       true,
	"updated_at": true,
}

var changeRequestUpdateColumns = map[string]bool{
	"status":             true,
	"approvals":          true,
	"required_approvals": true,
	"approved_at":        true,
	"approved_by":        true,
	"executed_at":        true,
	"executed_by":        true,
	"rolled_back_at":     true,
	"rolled_back_by":     true,
	"updated_at":         true,
}

var driftReportUpdateColumns = map[string]bool{
	"config_group":             true,
	"drift_status":             true,
	"expected_config":          true,
	"actual_config":            true,
	"drift_items":              true,
	"total_drifts":             true,
	"critical_drifts":          true,
	"auto_remediation_enabled": true,
	"remediation_log":          true,
	"detected_at":              true,
	"last_checked_at":          true,
	"updated_at":               true,
}

// updateSet turns a caller map into a validated SET clause. Keys are sorted so
// the generated statement is deterministic: map iteration order changes on every
// run, which made the same request produce different SQL and hid argument-order
// bugs behind a nondeterministic query.
func updateSet(allowed map[string]bool, attrs map[string]interface{}) ([]string, []interface{}, error) {
	keys := make([]string, 0, len(attrs))
	for k := range attrs {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	set := make([]string, 0, len(keys))
	args := make([]interface{}, 0, len(keys))
	for i, k := range keys {
		if !allowed[k] {
			return nil, nil, fmt.Errorf("cannot update %q on this resource", k)
		}
		set = append(set, fmt.Sprintf("%s=$%d", k, i+1))
		args = append(args, attrs[k])
	}
	return set, args, nil
}

// rowsAffected surfaces the error the callers used to discard. Dropping it meant
// a failed RowsAffected read looked like "zero rows matched", so a live row was
// reported as not found and a delete reported as a no-op.
func rowsAffected(result sql.Result) (int64, error) {
	n, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}
	return n, nil
}

func (r *Repository) Create(ctx context.Context, entity *models.ConfigMgmt) error {
	entity.ID = uuid.New().String()
	now := time.Now().UTC()
	entity.CreatedAt = now
	entity.UpdatedAt = now
	_, err := r.db.ExecContext(ctx,
		"INSERT INTO config_mgmt (id, tenant_id, name, created_at, updated_at) VALUES ($1,$2,$3,$4,$5)",
		entity.ID, entity.TenantID, entity.Name, entity.CreatedAt, entity.UpdatedAt)
	return err
}

func (r *Repository) GetByID(ctx context.Context, id, tenantID string) (*models.ConfigMgmt, error) {
	var entity models.ConfigMgmt
	err := r.db.GetContext(ctx, &entity,
		"SELECT "+configMgmtColumns+" FROM config_mgmt WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return &entity, nil
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.ConfigMgmt, error) {
	var entities []models.ConfigMgmt
	err := r.db.SelectContext(ctx, &entities,
		"SELECT "+configMgmtColumns+" FROM config_mgmt WHERE tenant_id=$1 ORDER BY created_at DESC", tenantID)
	if err != nil {
		return nil, err
	}
	return entities, nil
}

func (r *Repository) Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ConfigMgmt, error) {
	if len(attrs) == 0 {
		// A body with no fields is a no-op, not a missing row. Returning
		// sentinel.NotFound made PUT /config-mgmt/:id answer 404 for a record
		// that exists when the client sent {}.
		return r.GetByID(ctx, id, tenantID)
	}
	all := make(map[string]interface{}, len(attrs)+1)
	for k, v := range attrs {
		all[k] = v
	}
	// Copy first: writing updated_at into attrs mutated the caller's map, so a
	// reused map accumulated a stale timestamp on every call.
	all["updated_at"] = time.Now().UTC()
	set, args, err := updateSet(configMgmtUpdateColumns, all)
	if err != nil {
		return nil, err
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE config_mgmt SET %s WHERE id=$%d AND tenant_id=$%d",
		strings.Join(set, ", "), len(args)-1, len(args))
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, err := rowsAffected(result)
	if err != nil {
		return nil, err
	}
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetByID(ctx, id, tenantID)
}

func (r *Repository) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx, "DELETE FROM config_mgmt WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if err != nil {
		return false, err
	}
	n, err := rowsAffected(result)
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

// ==================== Change Request Repository ====================

func (r *Repository) CreateChangeRequest(ctx context.Context, cr *models.ChangeRequest) error {
	cr.ID = uuid.New().String()
	now := time.Now().UTC()
	cr.CreatedAt = now
	cr.UpdatedAt = now
	if cr.Approvals == "" {
		b, err := json.Marshal(cr.ApprovalsList)
		if err != nil {
			return err
		}
		cr.Approvals = string(b)
	}
	_, err := r.db.ExecContext(ctx,
		"INSERT INTO config_change_requests (id, tenant_id, config_key, config_group, environment, "+
			"change_type, old_value, new_value, reason, risk_level, requester, status, "+
			"execution_plan, rollback_plan, approvals, required_approvals, executed_at, "+
			"executed_by, approved_at, approved_by, rolled_back_at, rolled_back_by, created_at, updated_at) "+
			"VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)",
		cr.ID, cr.TenantID, cr.ConfigKey, cr.ConfigGroup, cr.Environment,
		cr.ChangeType, cr.OldValue, cr.NewValue, cr.Reason, cr.RiskLevel, cr.Requester, cr.Status,
		cr.ExecutionPlan, cr.RollbackPlan, cr.Approvals, cr.RequiredApprovals, cr.ExecutedAt,
		cr.ExecutedBy, cr.ApprovedAt, cr.ApprovedBy, cr.RolledBackAt, cr.RolledBackBy,
		cr.CreatedAt, cr.UpdatedAt)
	return err
}

func (r *Repository) GetChangeRequest(ctx context.Context, id, tenantID string) (*models.ChangeRequest, error) {
	var cr models.ChangeRequest
	err := r.db.GetContext(ctx, &cr,
		"SELECT "+changeRequestColumns+" FROM config_change_requests WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.deserializeApprovals(&cr)
}

func (r *Repository) ListChangeRequests(ctx context.Context, tenantID string, filter *models.ChangeHistoryFilter) ([]models.ChangeRequest, error) {
	query := "SELECT " + changeRequestColumns + " FROM config_change_requests WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argCount := 1
	if filter != nil {
		if filter.Status != "" {
			argCount++
			args = append(args, string(filter.Status))
			query += fmt.Sprintf(" AND status=$%d", argCount)
		}
		if filter.ConfigKey != "" {
			argCount++
			args = append(args, filter.ConfigKey)
			query += fmt.Sprintf(" AND config_key=$%d", argCount)
		}
		if filter.ConfigGroup != "" {
			argCount++
			args = append(args, filter.ConfigGroup)
			query += fmt.Sprintf(" AND config_group=$%d", argCount)
		}
		if filter.Environment != "" {
			argCount++
			args = append(args, filter.Environment)
			query += fmt.Sprintf(" AND environment=$%d", argCount)
		}
		if filter.Requester != "" {
			argCount++
			args = append(args, filter.Requester)
			query += fmt.Sprintf(" AND requester=$%d", argCount)
		}
		if filter.RiskLevel != "" {
			argCount++
			args = append(args, string(filter.RiskLevel))
			query += fmt.Sprintf(" AND risk_level=$%d", argCount)
		}
	}
	query += " ORDER BY created_at DESC"
	var crs []models.ChangeRequest
	err := r.db.SelectContext(ctx, &crs, query, args...)
	if err != nil {
		return nil, err
	}
	return crs, nil
}

func (r *Repository) UpdateChangeRequest(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ChangeRequest, error) {
	if len(attrs) == 0 {
		return r.GetChangeRequest(ctx, id, tenantID)
	}
	all := make(map[string]interface{}, len(attrs)+1)
	for k, v := range attrs {
		all[k] = v
	}
	all["updated_at"] = time.Now().UTC()
	set, args, err := updateSet(changeRequestUpdateColumns, all)
	if err != nil {
		return nil, err
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE config_change_requests SET %s WHERE id=$%d AND tenant_id=$%d",
		strings.Join(set, ", "), len(args)-1, len(args))
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, err := rowsAffected(result)
	if err != nil {
		return nil, err
	}
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetChangeRequest(ctx, id, tenantID)
}

func (r *Repository) DeleteChangeRequest(ctx context.Context, id, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx, "DELETE FROM config_change_requests WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if err != nil {
		return false, err
	}
	n, err := rowsAffected(result)
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

func (r *Repository) deserializeApprovals(cr *models.ChangeRequest) (*models.ChangeRequest, error) {
	cr.ApprovalsList = nil
	if cr.Approvals == "" || cr.Approvals == "[]" {
		return cr, nil
	}
	var list []models.ApprovalRecord
	if err := json.Unmarshal([]byte(cr.Approvals), &list); err != nil {
		// The error used to be swallowed, so a corrupt approvals column read as
		// "this change request has no approvals" and an approval count of zero
		// authorised the transition.
		return nil, fmt.Errorf("approvals for change request %s: %w", cr.ID, err)
	}
	cr.ApprovalsList = list
	return cr, nil
}

// ==================== Change History Repository ====================

func (r *Repository) GetChangeHistory(ctx context.Context, changeRequestID, tenantID string) ([]models.ChangeHistory, error) {
	var histories []models.ChangeHistory
	err := r.db.SelectContext(ctx, &histories,
		"SELECT "+changeHistoryColumns+" FROM config_change_history WHERE change_request_id=$1 AND tenant_id=$2 ORDER BY created_at ASC",
		changeRequestID, tenantID)
	if err != nil {
		return nil, err
	}
	if histories == nil {
		histories = []models.ChangeHistory{}
	}
	return histories, nil
}

func (r *Repository) AddChangeHistory(ctx context.Context, h *models.ChangeHistory) error {
	h.ID = uuid.New().String()
	now := time.Now().UTC()
	h.CreatedAt = now
	_, err := r.db.ExecContext(ctx,
		"INSERT INTO config_change_history (id, tenant_id, change_request_id, config_key, "+
			"config_group, environment, action, actor, old_value, new_value, notes, created_at) "+
			"VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
		h.ID, h.TenantID, h.ChangeRequestID, h.ConfigKey, h.ConfigGroup, h.Environment,
		h.Action, h.Actor, h.OldValue, h.NewValue, h.Notes, h.CreatedAt)
	return err
}

// ==================== Drift Report Repository ====================

func (r *Repository) CreateDriftReport(ctx context.Context, dr *models.DriftReport) error {
	dr.ID = uuid.New().String()
	now := time.Now().UTC()
	dr.DetectedAt = now
	dr.LastCheckedAt = now
	dr.CreatedAt = now
	// A string the caller already supplied is left alone. Writing "[]" over it
	// unconditionally discarded a caller's drift items and remediation log at
	// insert time, and the log's marshal error was swallowed, so a marshal
	// failure persisted "[]" as if the log were genuinely empty.
	if dr.DriftItems == "" {
		if dr.DriftItemsList != nil {
			b, err := json.Marshal(dr.DriftItemsList)
			if err != nil {
				return err
			}
			dr.DriftItems = string(b)
		} else {
			dr.DriftItems = "[]"
		}
	}
	if dr.RemediationLog == "" {
		if dr.RemediationLogList != nil {
			b, err := json.Marshal(dr.RemediationLogList)
			if err != nil {
				return err
			}
			dr.RemediationLog = string(b)
		} else {
			dr.RemediationLog = "[]"
		}
	}
	_, err := r.db.ExecContext(ctx,
		"INSERT INTO config_drift_reports (id, tenant_id, config_group, drift_status, "+
			"expected_config, actual_config, drift_items, total_drifts, critical_drifts, "+
			"auto_remediation_enabled, remediation_log, detected_at, last_checked_at, created_at) "+
			"VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
		dr.ID, dr.TenantID, dr.ConfigGroup, dr.DriftStatus, dr.ExpectedConfig, dr.ActualConfig,
		dr.DriftItems, dr.TotalDrifts, dr.CriticalDrifts, dr.AutoRemediationEnabled,
		dr.RemediationLog, dr.DetectedAt, dr.LastCheckedAt, dr.CreatedAt)
	return err
}

func (r *Repository) GetDriftReport(ctx context.Context, id, tenantID string) (*models.DriftReport, error) {
	var dr models.DriftReport
	err := r.db.GetContext(ctx, &dr,
		"SELECT "+driftReportColumns+" FROM config_drift_reports WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.deserializeDriftReport(&dr)
}

func (r *Repository) UpdateDriftReport(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.DriftReport, error) {
	if len(attrs) == 0 {
		return r.GetDriftReport(ctx, id, tenantID)
	}
	all := make(map[string]interface{}, len(attrs)+1)
	for k, v := range attrs {
		all[k] = v
	}
	all["updated_at"] = time.Now().UTC()
	set, args, err := updateSet(driftReportUpdateColumns, all)
	if err != nil {
		return nil, err
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE config_drift_reports SET %s WHERE id=$%d AND tenant_id=$%d",
		strings.Join(set, ", "), len(args)-1, len(args))
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, err := rowsAffected(result)
	if err != nil {
		return nil, err
	}
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetDriftReport(ctx, id, tenantID)
}

func (r *Repository) deserializeDriftReport(dr *models.DriftReport) (*models.DriftReport, error) {
	dr.DriftItemsList = nil
	if dr.DriftItems != "" && dr.DriftItems != "[]" {
		var list []models.DriftItem
		if err := json.Unmarshal([]byte(dr.DriftItems), &list); err != nil {
			// Same silent-loss shape as deserializeApprovals: a corrupt column
			// read as an empty drift list, which is indistinguishable from "in
			// sync" to a client.
			return nil, fmt.Errorf("drift_items for drift report %s: %w", dr.ID, err)
		}
		dr.DriftItemsList = list
	}
	dr.RemediationLogList = nil
	if dr.RemediationLog != "" && dr.RemediationLog != "[]" {
		var list []models.RemediationEntry
		if err := json.Unmarshal([]byte(dr.RemediationLog), &list); err != nil {
			return nil, fmt.Errorf("remediation_log for drift report %s: %w", dr.ID, err)
		}
		dr.RemediationLogList = list
	}
	if dr.ExpectedConfig != "" {
		var m map[string]interface{}
		if err := json.Unmarshal([]byte(dr.ExpectedConfig), &m); err != nil {
			return nil, fmt.Errorf("expected_config for drift report %s: %w", dr.ID, err)
		}
		dr.ExpectedConfigData = m
	}
	if dr.ActualConfig != "" {
		var m map[string]interface{}
		if err := json.Unmarshal([]byte(dr.ActualConfig), &m); err != nil {
			return nil, fmt.Errorf("actual_config for drift report %s: %w", dr.ID, err)
		}
		dr.ActualConfigData = m
	}
	return dr, nil
}
