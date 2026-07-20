package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/resilience-score/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// sentinel.NotFound is returned when a record does not exist.

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---------- History ----------

func (r *Repository) CreateHistory(ctx context.Context, tenantID string, h *models.ResilienceHistory) error {
	h.ID = uuid.New().String()
	h.TenantID = tenantID
	h.Timestamp = time.Now().Unix()
	if h.Details == "" {
		h.Details = "{}"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO resilience_score_history (id, tenant_id, timestamp, overall_score, level, component_scores, trigger, details) VALUES (:id, :tenant_id, :timestamp, :overall_score, :level, :component_scores, :trigger, :details)`,
		h)
	return err
}

func (r *Repository) ListHistory(ctx context.Context, tenantID string, q models.ListQuery) ([]models.ResilienceHistory, int, error) {
	q.SetDefaults()
	if q.Sort == "" {
		q.Sort = "timestamp"
	}
	if q.Order == "" {
		q.Order = "desc"
	}
	orderDir := "DESC"
	if q.Order == "asc" {
		orderDir = "ASC"
	}
	var items []models.ResilienceHistory
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM resilience_score_history WHERE tenant_id=$1 ORDER BY `+q.Sort+` `+orderDir+` LIMIT $2 OFFSET $3`,
		tenantID, q.Limit(), q.Offset())
	if err != nil {
		return nil, 0, err
	}
	var total int
	err = r.db.GetContext(ctx, &total, `SELECT count(*) FROM resilience_score_history WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) GetRecentHistory(ctx context.Context, tenantID string, limit int) ([]models.ResilienceHistory, error) {
	var items []models.ResilienceHistory
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM resilience_score_history WHERE tenant_id=$1 ORDER BY timestamp DESC LIMIT $2`,
		tenantID, limit)
	return items, err
}

// ---------- Recommendations ----------

func (r *Repository) CreateRecommendation(ctx context.Context, tenantID string, rec *models.ResilienceRecommendation) error {
	rec.ID = uuid.New().String()
	rec.TenantID = tenantID
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO resilience_recommendations (id, tenant_id, component, priority, title, description, current_score, potential_improvement, effort, impact, actions, references) VALUES (:id, :tenant_id, :component, :priority, :title, :description, :current_score, :potential_improvement, :effort, :impact, :actions, :references)`,
		rec)
	return err
}

func (r *Repository) ListRecommendations(ctx context.Context, tenantID string, q models.ListQuery, priority, component string) ([]models.ResilienceRecommendation, int, error) {
	q.SetDefaults()
	if q.Sort == "" {
		q.Sort = "priority"
	}
	if q.Order == "" {
		q.Order = "asc"
	}
	orderDir := "DESC"
	if q.Order == "asc" {
		orderDir = "ASC"
	}
	query := `SELECT * FROM resilience_recommendations WHERE tenant_id=$1`
	args := []any{tenantID}
	argIdx := 2
	if priority != "" {
		query += fmt.Sprintf(" AND priority=$%d", argIdx)
		args = append(args, priority)
		argIdx++
	}
	if component != "" {
		query += fmt.Sprintf(" AND component=$%d", argIdx)
		args = append(args, component)
		argIdx++
	}
	query += fmt.Sprintf(" ORDER BY "+q.Sort+" "+orderDir+" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, q.Limit(), q.Offset())
	var items []models.ResilienceRecommendation
	err := r.db.SelectContext(ctx, &items, query, args...)
	if err != nil {
		return nil, 0, err
	}
	countQuery := `SELECT count(*) FROM resilience_recommendations WHERE tenant_id=$1`
	countArgs := []any{tenantID}
	ci := 2
	if priority != "" {
		countQuery += fmt.Sprintf(" AND priority=$%d", ci)
		countArgs = append(countArgs, priority)
		ci++
	}
	if component != "" {
		countQuery += fmt.Sprintf(" AND component=$%d", ci)
		countArgs = append(countArgs, component)
	}
	var total int
	err = r.db.GetContext(ctx, &total, countQuery, countArgs...)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) DeleteRecommendations(ctx context.Context, tenantID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM resilience_recommendations WHERE tenant_id=$1`, tenantID)
	return err
}

// ---------- Benchmarks ----------

func (r *Repository) CreateBenchmark(ctx context.Context, tenantID string, b *models.ResilienceBenchmark) error {
	b.ID = uuid.New().String()
	b.TenantID = tenantID
	b.Timestamp = time.Now().Unix()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO resilience_benchmarks (id, tenant_id, name, timestamp, current_score, benchmark_score, comparison, analysis) VALUES (:id, :tenant_id, :name, :timestamp, :current_score, :benchmark_score, :comparison, :analysis)`,
		b)
	return err
}

func (r *Repository) ListBenchmarks(ctx context.Context, tenantID string, q models.ListQuery) ([]models.ResilienceBenchmark, int, error) {
	q.SetDefaults()
	if q.Sort == "" {
		q.Sort = "timestamp"
	}
	if q.Order == "" {
		q.Order = "desc"
	}
	orderDir := "DESC"
	if q.Order == "asc" {
		orderDir = "ASC"
	}
	var items []models.ResilienceBenchmark
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM resilience_benchmarks WHERE tenant_id=$1 ORDER BY `+q.Sort+` `+orderDir+` LIMIT $2 OFFSET $3`,
		tenantID, q.Limit(), q.Offset())
	if err != nil {
		return nil, 0, err
	}
	var total int
	err = r.db.GetContext(ctx, &total, `SELECT count(*) FROM resilience_benchmarks WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// ---------- Service scores (read-through) ----------

// UpsertServiceScore stores a service resilience snapshot.
func (r *Repository) UpsertServiceScore(ctx context.Context, tenantID string, s *models.ServiceResilienceScore) error {
	componentsJSON, err := json.Marshal(s.Components)
	if err != nil {
		return fmt.Errorf("failed to marshal components: %w", err)
	}
	depsJSON, err := json.Marshal(s.Dependencies)
	if err != nil {
		return fmt.Errorf("failed to marshal dependencies: %w", err)
	}
	incidentsJSON, err := json.Marshal(s.Incidents)
	if err != nil {
		return fmt.Errorf("failed to marshal incidents: %w", err)
	}
	_, err = r.db.NamedExecContext(ctx,
		`INSERT INTO resilience_service_scores (tenant_id, service_name, overall_score, level, components, dependencies, incidents, last_assessment) VALUES (:tenant_id, :serviceName, :overallScore, :level, :components, :dependencies, :incidents, :lastAssessment) ON CONFLICT (tenant_id, service_name) DO UPDATE SET overall_score=EXCLUDED.overall_score, level=EXCLUDED.level, components=EXCLUDED.components, dependencies=EXCLUDED.dependencies, incidents=EXCLUDED.incidents, last_assessment=EXCLUDED.last_assessment`,
		&serviceScoreRow{
			TenantID:       tenantID,
			ServiceName:    s.ServiceName,
			OverallScore:   s.OverallScore,
			Level:          s.Level,
			Components:     string(componentsJSON),
			Dependencies:   string(depsJSON),
			Incidents:      string(incidentsJSON),
			LastAssessment: s.LastAssessment,
		})
	return err
}

// ListServiceScores returns paginated service scores.
func (r *Repository) ListServiceScores(ctx context.Context, tenantID string, q models.ListQuery) ([]models.ServiceResilienceScore, int, error) {
	q.SetDefaults()
	sortCol := "overall_score"
	if q.Sort == "level" {
		sortCol = "level"
	}
	orderDir := "DESC"
	if q.Order == "asc" {
		orderDir = "ASC"
	}
	var rows []serviceScoreRow
	err := r.db.SelectContext(ctx, &rows,
		`SELECT * FROM resilience_service_scores WHERE tenant_id=$1 ORDER BY `+sortCol+` `+orderDir+` LIMIT $2 OFFSET $3`,
		tenantID, q.Limit(), q.Offset())
	if err != nil {
		return nil, 0, err
	}
	var total int
	err = r.db.GetContext(ctx, &total, `SELECT count(*) FROM resilience_service_scores WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, 0, err
	}
	scores := make([]models.ServiceResilienceScore, 0, len(rows))
	for _, row := range rows {
		s, err := row.toScore()
		if err != nil {
			continue
		}
		scores = append(scores, *s)
	}
	return scores, total, nil
}

// GetServiceScore returns a single service score.
func (r *Repository) GetServiceScore(ctx context.Context, tenantID, serviceName string) (*models.ServiceResilienceScore, error) {
	var row serviceScoreRow
	err := r.db.GetContext(ctx, &row,
		`SELECT * FROM resilience_service_scores WHERE tenant_id=$1 AND service_name=$2`,
		tenantID, serviceName)
	if err != nil {
		return nil, err
	}
	return row.toScore()
}

// ---------- Helper: row to score ----------

type serviceScoreRow struct {
	TenantID       string `db:"tenant_id"`
	ServiceName    string `db:"service_name"`
	OverallScore   int    `db:"overall_score"`
	Level          string `db:"level"`
	Components     string `db:"components"`
	Dependencies   string `db:"dependencies"`
	Incidents      string `db:"incidents"`
	LastAssessment string `db:"last_assessment"`
}

func (r *serviceScoreRow) toScore() (*models.ServiceResilienceScore, error) {
	var components []models.ComponentScoreResponse
	if r.Components != "" {
		if err := json.Unmarshal([]byte(r.Components), &components); err != nil {
			return nil, fmt.Errorf("failed to unmarshal components: %w", err)
		}
	}
	var deps []models.ServiceDependency
	if r.Dependencies != "" {
		if err := json.Unmarshal([]byte(r.Dependencies), &deps); err != nil {
			return nil, fmt.Errorf("failed to unmarshal dependencies: %w", err)
		}
	}
	var inc models.IncidentInfo
	if r.Incidents != "" {
		if err := json.Unmarshal([]byte(r.Incidents), &inc); err != nil {
			return nil, fmt.Errorf("failed to unmarshal incidents: %w", err)
		}
	}
	return &models.ServiceResilienceScore{
		ServiceName:    r.ServiceName,
		OverallScore:   r.OverallScore,
		Level:          r.Level,
		Components:     components,
		Dependencies:   deps,
		Incidents:      inc,
		LastAssessment: r.LastAssessment,
	}, nil
}

// ---------- Migration helper ----------

// EnsureRecommendations seeds the default recommendations if empty.
func (r *Repository) EnsureRecommendations(ctx context.Context, tenantID string) error {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT count(*) FROM resilience_recommendations WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	defaultRecs := []*models.ResilienceRecommendation{
		{
			Component:            models.ComponentRedundancy,
			Priority:             "high",
			Title:                "增加服务副本数",
			Description:          "关键服务副本数不足，建议增加到至少3个副本",
			CurrentScore:         65,
			PotentialImprovement: 15,
			Effort:               "low",
			Impact:               "high",
			Actions:              `["调整 deployment replicas","配置 HPA 策略","添加 Pod 反亲和性"]`,
			References:           `["Kubernetes 最佳实践"]`,
		},
		{
			Component:            models.ComponentMonitoring,
			Priority:             "medium",
			Title:                "完善监控指标",
			Description:          "添加更多业务指标监控",
			CurrentScore:         70,
			PotentialImprovement: 10,
			Effort:               "medium",
			Impact:               "medium",
			Actions:              `["添加自定义指标","配置告警规则","优化仪表盘"]`,
			References:           `["监控最佳实践"]`,
		},
		{
			Component:            models.ComponentTesting,
			Priority:             "high",
			Title:                "增加混沌测试",
			Description:          "定期执行混沌工程实验以提高系统韧性",
			CurrentScore:         55,
			PotentialImprovement: 20,
			Effort:               "medium",
			Impact:               "high",
			Actions:              `["配置 Chaos Mesh","制定实验计划","建立恢复机制"]`,
			References:           `["混沌工程指南"]`,
		},
	}
	for _, rec := range defaultRecs {
		if err := r.CreateRecommendation(ctx, tenantID, rec); err != nil {
			return err
		}
	}
	return nil
}

// GetBenchmark returns a single benchmark by ID.
func (r *Repository) GetBenchmark(ctx context.Context, tenantID, id string) (*models.ResilienceBenchmark, error) {
	var b models.ResilienceBenchmark
	err := r.db.GetContext(ctx, &b, `SELECT * FROM resilience_benchmarks WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &b, nil
}
