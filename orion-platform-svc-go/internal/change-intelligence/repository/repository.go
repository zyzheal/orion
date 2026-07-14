package repository

import (
	"context"
	"errors"
	"time"

	"orion/platform-svc-go/internal/change-intelligence/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("change intelligence record not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Analyses ---

func (r *Repository) CreateAnalysis(ctx context.Context, a *models.ChangeAnalysis) error {
	a.ID = uuid.New().String()
	a.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO change_intelligence_analyses
		 (id, tenant_id, change_id, service_name, risk_score, blast_radius, affected_services, recommendations, created_at, created_by)
		 VALUES (:id, :tenantId, :changeId, :serviceName, :riskScore, :blastRadius, :affectedServices, :recommendations, :createdAt, :createdBy)`,
		a)
	return err
}

func (r *Repository) GetAnalysisByID(ctx context.Context, id string, tenantID string) (*models.ChangeAnalysis, error) {
	var a models.ChangeAnalysis
	err := r.db.GetContext(ctx, &a,
		`SELECT * FROM change_intelligence_analyses WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *Repository) ListAnalyses(ctx context.Context, tenantID string) ([]models.ChangeAnalysis, error) {
	var analyses []models.ChangeAnalysis
	err := r.db.SelectContext(ctx, &analyses,
		`SELECT * FROM change_intelligence_analyses WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return analyses, err
}

// --- Blast Radius ---

func (r *Repository) SaveBlastRadius(ctx context.Context, analysisID string, items []models.BlastRadiusItem) error {
	for _, item := range items {
		id := uuid.New().String()
		now := time.Now().UTC()
		_, err := r.db.ExecContext(ctx,
			`INSERT INTO change_intelligence_blast_radius (id, analysis_id, service_id, service_name, impact_level, probability, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			id, analysisID, item.ServiceID, item.ServiceName, item.ImpactLevel, item.Probability, now)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) GetBlastRadiusByAnalysisID(ctx context.Context, analysisID string) ([]models.BlastRadiusItem, error) {
	var items []models.BlastRadiusItem
	err := r.db.SelectContext(ctx, &items,
		`SELECT service_id AS "serviceId", service_name AS "serviceName", impact_level AS "impactLevel", probability
		 FROM change_intelligence_blast_radius WHERE analysis_id=$1 ORDER BY probability DESC`, analysisID)
	return items, err
}

// --- Risk Factors ---

func (r *Repository) SaveRiskFactors(ctx context.Context, analysisID string, factors []models.RiskFactor) error {
	for _, factor := range factors {
		id := uuid.New().String()
		now := time.Now().UTC()
		_, err := r.db.ExecContext(ctx,
			`INSERT INTO change_intelligence_risk_factors (id, analysis_id, factor, score, description, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			id, analysisID, factor.Factor, factor.Score, factor.Description, now)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) GetRiskFactorsByAnalysisID(ctx context.Context, analysisID string) ([]models.RiskFactor, error) {
	var factors []models.RiskFactor
	err := r.db.SelectContext(ctx, &factors,
		`SELECT factor, score, description
		 FROM change_intelligence_risk_factors WHERE analysis_id=$1 ORDER BY score DESC`, analysisID)
	return factors, err
}