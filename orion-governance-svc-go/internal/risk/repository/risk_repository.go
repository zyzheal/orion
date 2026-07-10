package repository

import (
	"context"
	"database/sql"

	"orion/governance-svc-go/internal/risk/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository provides data access for all risk-related tables.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ============================================================
// risk_items CRUD
// ============================================================

// Create inserts a new risk item.
func (r *Repository) Create(ctx context.Context, d *models.RiskItem) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO risk_items (id, tenant_id, name, risk_type, level, description, mitigation, status, assignee, metadata, tags, due_date)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		d.ID, d.TenantID, d.Name, d.RiskType, d.Level, d.Description, d.Mitigation, d.Status,
		d.Assignee, d.Metadata, d.Tags, d.DueDate,
	)
	return err
}

// List returns a paginated list of risk items for a tenant.
func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.RiskItem, error) {
	var items []models.RiskItem
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM risk_items WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit,
	)
	return items, err
}

// GetByID returns a single risk item by id and tenant.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.RiskItem, error) {
	var d models.RiskItem
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM risk_items WHERE id=$1 AND tenant_id=$2`, id, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// Update modifies an existing risk item.
func (r *Repository) Update(ctx context.Context, d *models.RiskItem) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE risk_items SET name=$1, risk_type=$2, level=$3, description=$4, mitigation=$5,
		 status=$6, assignee=$7, metadata=$8, tags=$9, due_date=$10, updated_at=NOW()
		 WHERE id=$11 AND tenant_id=$12`,
		d.Name, d.RiskType, d.Level, d.Description, d.Mitigation,
		d.Status, d.Assignee, d.Metadata, d.Tags, d.DueDate,
		d.ID, d.TenantID,
	)
	return err
}

// Delete removes a risk item.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM risk_items WHERE id=$1 AND tenant_id=$2`, id, tenantID,
	)
	return err
}

// Count returns the total number of risk items for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM risk_items WHERE tenant_id=$1`, tenantID,
	)
	return count, err
}

// ============================================================
// risk_assessments CRUD
// ============================================================

// CreateAssessment inserts a new risk assessment record.
func (r *Repository) CreateAssessment(ctx context.Context, a *models.RiskAssessment) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO risk_assessments (id, tenant_id, name, target_type, target_id, risk_score, risk_level, factors, recommendations, status, metadata)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		a.ID, a.TenantID, a.Name, a.TargetType, a.TargetID,
		a.RiskScore, a.RiskLevel, a.Factors, a.Recommendations, a.Status, a.Metadata,
	)
	return err
}

// GetAssessmentByID returns a single assessment by id and tenant.
func (r *Repository) GetAssessmentByID(ctx context.Context, tenantID, id string) (*models.RiskAssessment, error) {
	var a models.RiskAssessment
	err := r.db.GetContext(ctx, &a,
		`SELECT * FROM risk_assessments WHERE id=$1 AND tenant_id=$2`, id, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// ListAssessments returns a paginated list of assessments for a tenant.
func (r *Repository) ListAssessments(ctx context.Context, tenantID string, offset, limit int) ([]models.RiskAssessment, error) {
	var items []models.RiskAssessment
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM risk_assessments WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit,
	)
	return items, err
}

// FindAssessmentsByTarget returns assessments matching target type and id.
func (r *Repository) FindAssessmentsByTarget(ctx context.Context, targetType, targetID string) ([]models.RiskAssessment, error) {
	var items []models.RiskAssessment
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM risk_assessments WHERE target_type=$1 AND target_id=$2 ORDER BY created_at DESC`,
		targetType, targetID,
	)
	return items, err
}

// FindAssessmentsByLevel returns assessments matching a risk level.
func (r *Repository) FindAssessmentsByLevel(ctx context.Context, riskLevel, tenantID string) ([]models.RiskAssessment, error) {
	var items []models.RiskAssessment
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM risk_assessments WHERE risk_level=$1 AND tenant_id=$2 ORDER BY created_at DESC`,
		riskLevel, tenantID,
	)
	return items, err
}

// UpdateAssessment updates an existing assessment.
func (r *Repository) UpdateAssessment(ctx context.Context, a *models.RiskAssessment) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE risk_assessments SET name=$1, target_type=$2, target_id=$3, risk_score=$4,
		 risk_level=$5, factors=$6, recommendations=$7, status=$8, metadata=$9, updated_at=NOW()
		 WHERE id=$10 AND tenant_id=$11`,
		a.Name, a.TargetType, a.TargetID, a.RiskScore, a.RiskLevel,
		a.Factors, a.Recommendations, a.Status, a.Metadata,
		a.ID, a.TenantID,
	)
	return err
}

// ============================================================
// risk_reports CRUD
// ============================================================

// CreateReport inserts a new risk report.
func (r *Repository) CreateReport(ctx context.Context, rpt *models.RiskReport) error {
	id := rpt.ID
	if id == "" {
		id = uuid.New().String()
		rpt.ID = id
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO risk_reports (id, tenant_id, assessment_id, risk_score, risk_level, can_deploy, critical_risk_count, summary, details, recommendations, generated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		rpt.ID, rpt.TenantID, rpt.AssessmentID, rpt.RiskScore, rpt.RiskLevel,
		rpt.CanDeploy, rpt.CriticalRiskCount, rpt.Summary, rpt.Details, rpt.Recommendations, rpt.GeneratedAt,
	)
	return err
}

// GetReportByID returns a single report by id.
func (r *Repository) GetReportByID(ctx context.Context, id string) (*models.RiskReport, error) {
	var rpt models.RiskReport
	err := r.db.GetContext(ctx, &rpt,
		`SELECT * FROM risk_reports WHERE id=$1`, id,
	)
	if err != nil {
		return nil, err
	}
	return &rpt, nil
}

// ListReports returns a paginated list of reports for a tenant.
func (r *Repository) ListReports(ctx context.Context, tenantID string, offset, limit int) ([]models.RiskReport, error) {
	var items []models.RiskReport
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM risk_reports WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit,
	)
	return items, err
}

// FindReportByAssessment returns the most recent report for a given assessment.
func (r *Repository) FindReportByAssessment(ctx context.Context, assessmentID string) (*models.RiskReport, error) {
	var rpt models.RiskReport
	err := r.db.GetContext(ctx, &rpt,
		`SELECT * FROM risk_reports WHERE assessment_id=$1 ORDER BY created_at DESC LIMIT 1`,
		assessmentID,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &rpt, nil
}

// FindDeployableReports returns reports where can_deploy=true for a tenant.
func (r *Repository) FindDeployableReports(ctx context.Context, tenantID string) ([]models.RiskReport, error) {
	var items []models.RiskReport
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM risk_reports WHERE tenant_id=$1 AND can_deploy=true ORDER BY risk_score ASC, created_at DESC`,
		tenantID,
	)
	return items, err
}

// ============================================================
// risk_predictions CRUD
// ============================================================

// CreatePrediction inserts a new prediction cache entry.
func (r *Repository) CreatePrediction(ctx context.Context, p *models.RiskPrediction) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO risk_predictions (id, tenant_id, target_type, target_id, risk_score, risk_level, confidence, model_version, features, shap_values, top_risk_factors, metadata, expires_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
		p.ID, p.TenantID, p.TargetType, p.TargetID,
		p.RiskScore, p.RiskLevel, p.Confidence, p.ModelVersion,
		p.Features, p.ShapValues, p.TopRiskFactors, p.Metadata, p.ExpiresAt,
	)
	return err
}

// FindPredictionByTarget returns the most recent non-expired prediction for a target.
func (r *Repository) FindPredictionByTarget(ctx context.Context, targetType, targetID string) (*models.RiskPrediction, error) {
	var p models.RiskPrediction
	err := r.db.GetContext(ctx, &p,
		`SELECT * FROM risk_predictions
		 WHERE target_type=$1 AND target_id=$2 AND (expires_at IS NULL OR expires_at > NOW())
		 ORDER BY created_at DESC LIMIT 1`,
		targetType, targetID,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

// FindPredictionsByTenant returns predictions for a tenant.
func (r *Repository) FindPredictionsByTenant(ctx context.Context, tenantID string, limit int) ([]models.RiskPrediction, error) {
	var items []models.RiskPrediction
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM risk_predictions WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2`,
		tenantID, limit,
	)
	return items, err
}

// FindHighRiskPredictions returns non-expired critical/high predictions.
func (r *Repository) FindHighRiskPredictions(ctx context.Context, limit int) ([]models.RiskPrediction, error) {
	var items []models.RiskPrediction
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM risk_predictions
		 WHERE risk_level IN ('critical','high') AND (expires_at IS NULL OR expires_at > NOW())
		 ORDER BY risk_score DESC LIMIT $1`,
		limit,
	)
	return items, err
}

// ClearExpiredPredictions deletes all expired prediction entries.
func (r *Repository) ClearExpiredPredictions(ctx context.Context) (int64, error) {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM risk_predictions WHERE expires_at IS NOT NULL AND expires_at < NOW()`,
	)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// PredictionStats holds aggregate statistics over predictions.
type PredictionStats struct {
	TotalPredictions int                `db:"total"`
	AvgScore         float64            `db:"avg_score"`
	ByLevel          map[string]int     `json:"by_level"`
}

// GetPredictionStats returns aggregate stats over non-expired predictions.
func (r *Repository) GetPredictionStats(ctx context.Context) (*PredictionStats, error) {
	var total int
	var avgScore sql.NullFloat64
	var critCount, highCount, medCount, lowCount int

	err := r.db.QueryRowContext(ctx,
		`SELECT
			COUNT(*) AS total,
			AVG(risk_score) AS avg_score,
			COUNT(*) FILTER (WHERE risk_level='critical') AS crit,
			COUNT(*) FILTER (WHERE risk_level='high')    AS high,
			COUNT(*) FILTER (WHERE risk_level='medium')  AS med,
			COUNT(*) FILTER (WHERE risk_level='low')     AS low
		 FROM risk_predictions
		 WHERE expires_at IS NULL OR expires_at > NOW()`,
	).Scan(&total, &avgScore, &critCount, &highCount, &medCount, &lowCount)
	if err != nil {
		return nil, err
	}

	avg := 0.0
	if avgScore.Valid {
		avg = avgScore.Float64
	}

	return &PredictionStats{
		TotalPredictions: total,
		AvgScore:         avg,
		ByLevel: map[string]int{
			"critical": critCount,
			"high":     highCount,
			"medium":   medCount,
			"low":      lowCount,
		},
	}, nil
}
