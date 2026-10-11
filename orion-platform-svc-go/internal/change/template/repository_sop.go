// SOP + Step repository methods (ADR-015 §4.1 中间层 + 底层).
// Split from repository.go for readability — same Repository interface.
package template

import (
	"context"
	"time"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

)

// Compile-time: *PostgresRepository satisfies Repository (already asserted).
// (kept here as a reminder; the assertion is in repository.go)

func (r *PostgresRepository) CreateSOP(ctx context.Context, tenantID string, req *CreateChangeSOPRequest, createdBy string) (*ChangeSOP, error) {
	if req == nil {
		return nil, errors.New("change/template: nil request")
	}
	authority := AuthorityPublic
	if req.Authority != "" {
		authority = req.Authority
	}
	sopType := TemplateTypeStandard
	if req.SOPType != "" {
		sopType = req.SOPType
	}
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	const q = `
		INSERT INTO change_sops
			(tenant_id, template_id, name, description, is_active, authority,
			 sop_type, team_uuid, created_by, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
		RETURNING id, tenant_id, template_id, name, description, is_active,
				  authority, sop_type, team_uuid, version, created_by,
				  created_at, updated_at`
	row := sopRow{}
	err := r.db.QueryRowxContext(ctx, q,
		tenantID, req.TemplateID, req.Name, nullString(req.Description),
		isActive, authority, sopType, nullString(req.TeamUUID), createdBy,
	).StructScan(&row)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrDuplicate
		}
		return nil, fmt.Errorf("change/template: create sop: %w", err)
	}
	return row.toModel(), nil
}

func (r *PostgresRepository) GetSOP(ctx context.Context, tenantID, id string) (*ChangeSOP, error) {
	const q = `
		SELECT id, tenant_id, template_id, name, description, is_active,
			   authority, sop_type, team_uuid, version, created_by,
			   created_at, updated_at
		FROM change_sops
		WHERE tenant_id = $1 AND id = $2`
	row := sopRow{}
	err := r.db.QueryRowxContext(ctx, q, tenantID, id).StructScan(&row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("change/template: get sop: %w", err)
	}
	return row.toModel(), nil
}

func (r *PostgresRepository) GetSOPDetail(ctx context.Context, tenantID, id string) (*SOPDetail, error) {
	sop, err := r.GetSOP(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	steps, err := r.ListSteps(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	return &SOPDetail{
		ChangeSOP: *sop,
		Steps:     steps,
	}, nil
}

func (r *PostgresRepository) ListSOPs(ctx context.Context, tenantID, templateID string, onlyActive bool) ([]*ChangeSOP, error) {
	q := `
		SELECT id, tenant_id, template_id, name, description, is_active,
			   authority, sop_type, team_uuid, version, created_by,
			   created_at, updated_at
		FROM change_sops
		WHERE tenant_id = $1`
	args := []any{tenantID}
	if templateID != "" {
		q += " AND template_id = $" + fmt.Sprintf("%d", len(args)+1)
		args = append(args, templateID)
	}
	if onlyActive {
		q += " AND is_active = TRUE"
	}
	q += " ORDER BY created_at DESC, id DESC"

	rows, err := r.db.QueryxContext(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("change/template: list sops: %w", err)
	}
	defer rows.Close()

	out := make([]*ChangeSOP, 0)
	for rows.Next() {
		row := sopRow{}
		if err := rows.StructScan(&row); err != nil {
			return nil, fmt.Errorf("change/template: list sops scan: %w", err)
		}
		out = append(out, row.toModel())
	}
	return out, rows.Err()
}

func (r *PostgresRepository) UpdateSOP(ctx context.Context, tenantID, id string, req *UpdateChangeSOPRequest) (*ChangeSOP, error) {
	if req == nil {
		return nil, errors.New("change/template: nil request")
	}
	setClauses := []string{
		"updated_at = NOW()",
		"version = version + 1", // optimistic lock increment
	}
	args := make([]any, 0, 8)
	argN := 1
	if req.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", argN))
		args = append(args, *req.Name)
		argN++
	}
	if req.Description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", argN))
		args = append(args, *req.Description)
		argN++
	}
	if req.IsActive != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_active = $%d", argN))
		args = append(args, *req.IsActive)
		argN++
	}
	if req.Authority != nil {
		setClauses = append(setClauses, fmt.Sprintf("authority = $%d", argN))
		args = append(args, *req.Authority)
		argN++
	}
	if req.SOPType != nil {
		setClauses = append(setClauses, fmt.Sprintf("sop_type = $%d", argN))
		args = append(args, *req.SOPType)
		argN++
	}
	if req.TeamUUID != nil {
		setClauses = append(setClauses, fmt.Sprintf("team_uuid = $%d", argN))
		args = append(args, *req.TeamUUID)
		argN++
	}

	where := fmt.Sprintf("WHERE tenant_id = $%d AND id = $%d", argN+1, argN+2)
	args = append(args, tenantID, id)
	if req.ExpectedVersion != nil {
		where += fmt.Sprintf(" AND version = $%d", argN+3)
		args = append(args, *req.ExpectedVersion)
	}

	q := fmt.Sprintf(
		`UPDATE change_sops SET %s
		 %s
		 RETURNING id, tenant_id, template_id, name, description, is_active,
				   authority, sop_type, team_uuid, version, created_by,
				   created_at, updated_at`,
		joinComma(setClauses), where,
	)

	row := sopRow{}
	err := r.db.QueryRowxContext(ctx, q, args...).StructScan(&row)
	if errors.Is(err, sql.ErrNoRows) {
		// Distinguish "row missing" from "version mismatch": if we passed
		// expectedVersion, the row exists but version differs. Probe once.
		if req.ExpectedVersion != nil {
			var exists int64
			_ = r.db.QueryRowxContext(ctx,
				`SELECT COUNT(*) FROM change_sops WHERE tenant_id = $1 AND id = $2`,
				tenantID, id,
			).Scan(&exists)
			if exists > 0 {
				return nil, ErrVersionMismatch
			}
		}
		return nil, ErrNotFound
	}
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrDuplicate
		}
		return nil, fmt.Errorf("change/template: update sop: %w", err)
	}
	return row.toModel(), nil
}

func (r *PostgresRepository) DeleteSOP(ctx context.Context, tenantID, id string) (bool, error) {
	const q = `DELETE FROM change_sops WHERE tenant_id = $1 AND id = $2`
	res, err := r.db.ExecContext(ctx, q, tenantID, id)
	if err != nil {
		return false, fmt.Errorf("change/template: delete sop: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("change/template: delete sop rowsAffected: %v", err)
	}
	return n > 0, nil
}

// --- Step methods ---

func (r *PostgresRepository) CreateStep(ctx context.Context, tenantID string, req *CreateChangeSopStepRequest, createdBy string) (*ChangeSopStep, error) {
	if req == nil {
		return nil, errors.New("change/template: nil request")
	}
	fileIDsJSON, err := marshalFileIDs(req.FileIDs)
	if err != nil {
		return nil, fmt.Errorf("change/template: create step: %w", err)
	}

	const q = `
		INSERT INTO change_sop_steps
			(tenant_id, sop_id, code, name, content, plan_start_date,
			 start_time_window, end_time_window, worker, file_ids,
			 sort_order, created_by, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
		RETURNING id, tenant_id, sop_id, code, name, content, plan_start_date,
				  start_time_window, end_time_window, worker, file_ids,
				  sort_order, version, created_by, created_at, updated_at`
	row := stepRow{}
	err = r.db.QueryRowxContext(ctx, q,
		tenantID, req.SOPID, req.Code, req.Name, nullString(req.Content),
		nullTime(req.PlanStartDate), nullString(req.StartTimeWindow),
		nullString(req.EndTimeWindow), nullString(req.Worker), fileIDsJSON,
		req.SortOrder, createdBy,
	).StructScan(&row)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrDuplicate
		}
		return nil, fmt.Errorf("change/template: create step: %w", err)
	}
	fileIDs, _ := unmarshalFileIDs(row.FileIDs)
	return row.toModel(fileIDs), nil
}

func (r *PostgresRepository) GetStep(ctx context.Context, tenantID, id string) (*ChangeSopStep, error) {
	const q = `
		SELECT id, tenant_id, sop_id, code, name, content, plan_start_date,
			   start_time_window, end_time_window, worker, file_ids,
			   sort_order, version, created_by, created_at, updated_at
		FROM change_sop_steps
		WHERE tenant_id = $1 AND id = $2`
	row := stepRow{}
	err := r.db.QueryRowxContext(ctx, q, tenantID, id).StructScan(&row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("change/template: get step: %w", err)
	}
	fileIDs, _ := unmarshalFileIDs(row.FileIDs)
	return row.toModel(fileIDs), nil
}

func (r *PostgresRepository) ListSteps(ctx context.Context, tenantID, sopID string) ([]*ChangeSopStep, error) {
	const q = `
		SELECT id, tenant_id, sop_id, code, name, content, plan_start_date,
			   start_time_window, end_time_window, worker, file_ids,
			   sort_order, version, created_by, created_at, updated_at
		FROM change_sop_steps
		WHERE tenant_id = $1 AND sop_id = $2
		ORDER BY sort_order ASC, id ASC`
	rows, err := r.db.QueryxContext(ctx, q, tenantID, sopID)
	if err != nil {
		return nil, fmt.Errorf("change/template: list steps: %w", err)
	}
	defer rows.Close()

	out := make([]*ChangeSopStep, 0)
	for rows.Next() {
		row := stepRow{}
		if err := rows.StructScan(&row); err != nil {
			return nil, fmt.Errorf("change/template: list steps scan: %w", err)
		}
		fileIDs, _ := unmarshalFileIDs(row.FileIDs)
		out = append(out, row.toModel(fileIDs))
	}
	return out, rows.Err()
}

func (r *PostgresRepository) UpdateStep(ctx context.Context, tenantID, id string, req *UpdateChangeSopStepRequest) (*ChangeSopStep, error) {
	if req == nil {
		return nil, errors.New("change/template: nil request")
	}
	setClauses := []string{
		"updated_at = NOW()",
		"version = version + 1",
	}
	args := make([]any, 0, 10)
	argN := 1
	if req.Code != nil {
		setClauses = append(setClauses, fmt.Sprintf("code = $%d", argN))
		args = append(args, *req.Code)
		argN++
	}
	if req.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", argN))
		args = append(args, *req.Name)
		argN++
	}
	if req.Content != nil {
		setClauses = append(setClauses, fmt.Sprintf("content = $%d", argN))
		args = append(args, *req.Content)
		argN++
	}
	if req.PlanStartDate != nil {
		setClauses = append(setClauses, fmt.Sprintf("plan_start_date = $%d", argN))
		args = append(args, *req.PlanStartDate)
		argN++
	}
	if req.StartTimeWindow != nil {
		setClauses = append(setClauses, fmt.Sprintf("start_time_window = $%d", argN))
		args = append(args, *req.StartTimeWindow)
		argN++
	}
	if req.EndTimeWindow != nil {
		setClauses = append(setClauses, fmt.Sprintf("end_time_window = $%d", argN))
		args = append(args, *req.EndTimeWindow)
		argN++
	}
	if req.Worker != nil {
		setClauses = append(setClauses, fmt.Sprintf("worker = $%d", argN))
		args = append(args, *req.Worker)
		argN++
	}
	if req.FileIDs != nil {
		b, err := marshalFileIDs(req.FileIDs)
		if err != nil {
			return nil, fmt.Errorf("change/template: update step: %w", err)
		}
		setClauses = append(setClauses, fmt.Sprintf("file_ids = $%d", argN))
		args = append(args, b)
		argN++
	}
	if req.SortOrder != nil {
		setClauses = append(setClauses, fmt.Sprintf("sort_order = $%d", argN))
		args = append(args, *req.SortOrder)
		argN++
	}

	where := fmt.Sprintf("WHERE tenant_id = $%d AND id = $%d", argN+1, argN+2)
	args = append(args, tenantID, id)
	if req.ExpectedVersion != nil {
		where += fmt.Sprintf(" AND version = $%d", argN+3)
		args = append(args, *req.ExpectedVersion)
	}

	q := fmt.Sprintf(
		`UPDATE change_sop_steps SET %s
		 %s
		 RETURNING id, tenant_id, sop_id, code, name, content, plan_start_date,
				   start_time_window, end_time_window, worker, file_ids,
				   sort_order, version, created_by, created_at, updated_at`,
		joinComma(setClauses), where,
	)

	row := stepRow{}
	err := r.db.QueryRowxContext(ctx, q, args...).StructScan(&row)
	if errors.Is(err, sql.ErrNoRows) {
		if req.ExpectedVersion != nil {
			var exists int64
			_ = r.db.QueryRowxContext(ctx,
				`SELECT COUNT(*) FROM change_sop_steps WHERE tenant_id = $1 AND id = $2`,
				tenantID, id,
			).Scan(&exists)
			if exists > 0 {
				return nil, ErrVersionMismatch
			}
		}
		return nil, ErrNotFound
	}
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrDuplicate
		}
		return nil, fmt.Errorf("change/template: update step: %w", err)
	}
	fileIDs, _ := unmarshalFileIDs(row.FileIDs)
	return row.toModel(fileIDs), nil
}

func (r *PostgresRepository) DeleteStep(ctx context.Context, tenantID, id string) (bool, error) {
	const q = `DELETE FROM change_sop_steps WHERE tenant_id = $1 AND id = $2`
	res, err := r.db.ExecContext(ctx, q, tenantID, id)
	if err != nil {
		return false, fmt.Errorf("change/template: delete step: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("change/template: delete step rowsAffected: %v", err)
	}
	return n > 0, nil
}

// --- JSONB helpers ---

func marshalFileIDs(ids []string) ([]byte, error) {
	if ids == nil {
		return []byte("[]"), nil
	}
	return json.Marshal(ids)
}

func unmarshalFileIDs(b []byte) ([]string, error) {
	if len(b) == 0 {
		return nil, nil
	}
	var out []string
	if err := json.Unmarshal(b, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// nullTime returns nil when t is nil, otherwise t.
func nullTime(t *time.Time) *time.Time { return t }
