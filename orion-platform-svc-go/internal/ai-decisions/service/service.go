package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ai-decisions/models"
	"orion/platform-svc-go/internal/ai-decisions/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

var (
	ErrDecisionNotFound = errors.New("decision not found")
)

func IsNotFound(err error) bool {
	return errors.Is(err, ErrDecisionNotFound)
}

// --- Decisions ---

// RecordDecision creates a new decision and seeds default traces.
func (s *Service) RecordDecision(ctx context.Context, tenantID, userID string, req *models.RecordDecisionRequest) (*models.AIDecision, error) {
	reasoningJSON, err := json.Marshal(req.Reasoning)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal reasoning: %w", err)
	}

	inputJSON, err := json.Marshal(req.Input)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal input: %w", err)
	}

	outputJSON, err := json.Marshal(req.Output)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal output: %w", err)
	}

	contextJSON := "{}"
	if req.Context != nil {
		b, err := json.Marshal(req.Context)
		if err == nil {
			contextJSON = string(b)
		}
	}

	now := time.Now().Unix()

	d := &models.AIDecision{
		TenantID:   tenantID,
		Type:       req.Type,
		Status:     models.DecisionStatusPending,
		Input:      string(inputJSON),
		Output:     string(outputJSON),
		Confidence: req.Confidence,
		Reasoning:  string(reasoningJSON),
		Context:    contextJSON,
		CreatedBy:  userID,
		CreatedAt:  now,
	}
	if req.ModelID != nil && *req.ModelID != "" {
		d.ModelID = sql.NullString{String: *req.ModelID, Valid: true}
	}
	if req.ModelVersion != nil && *req.ModelVersion != "" {
		d.ModelVersion = sql.NullString{String: *req.ModelVersion, Valid: true}
	}
	if req.ExpiresAt != nil {
		d.ExpiresAt = sql.NullInt64{Int64: *req.ExpiresAt, Valid: true}
	}

	if err := s.repo.CreateDecision(ctx, d); err != nil {
		return nil, fmt.Errorf("failed to create decision: %w", err)
	}

	// Seed default traces
	s.seedDefaultTraces(ctx, tenantID, d.ID, now)

	return s.repo.GetByID(ctx, d.ID, tenantID)
}

// GetDecision retrieves a decision by id.
func (s *Service) GetDecision(ctx context.Context, id string, tenantID string) (*models.AIDecision, error) {
	d, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrDecisionNotFound
		}
		return nil, err
	}
	return d, nil
}

// ListDecisions lists decisions with optional filters.
func (s *Service) ListDecisions(ctx context.Context, tenantID string, filter *models.ListQuery) ([]models.AIDecision, int64, error) {
	rFilter := &repository.ListFilter{}
	if filter.Type != "" {
		rFilter.Type = &filter.Type
	}
	if filter.Status != "" {
		rFilter.Status = &filter.Status
	}
	if filter.ModelID != "" {
		rFilter.ModelID = &filter.ModelID
	}
	if filter.StartDate != nil {
		rFilter.StartDate = filter.StartDate
	}
	if filter.EndDate != nil {
		rFilter.EndDate = filter.EndDate
	}
	if filter.Sort != "" {
		rFilter.Sort = &filter.Sort
	}
	if filter.Order != "" {
		rFilter.Order = &filter.Order
	}
	if filter.Limit != nil {
		rFilter.Limit = filter.Limit
	}
	if filter.Offset != nil {
		rFilter.Offset = filter.Offset
	}

	decisions, err := s.repo.List(ctx, tenantID, rFilter)
	if err != nil {
		return nil, 0, err
	}
	if decisions == nil {
		decisions = []models.AIDecision{}
	}

	total, err := s.repo.Count(ctx, tenantID, rFilter)
	if err != nil {
		return decisions, 0, err
	}
	return decisions, total, nil
}

// UpdateDecisionStatus updates the status of a decision.
func (s *Service) UpdateDecisionStatus(ctx context.Context, id, tenantID string, status models.DecisionStatus) (*models.AIDecision, error) {
	// Verify decision exists
	_, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrDecisionNotFound
		}
		return nil, err
	}

	var executedAt *int64
	if status == models.DecisionStatusExecuted {
		now := time.Now().Unix()
		executedAt = &now
	}

	return s.repo.UpdateDecisionStatus(ctx, id, tenantID, status, executedAt)
}

// DeleteDecision removes a decision and its associated traces/feedback.
func (s *Service) DeleteDecision(ctx context.Context, id, tenantID string) (bool, error) {
	_, err := s.repo.GetByID(ctx, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, ErrDecisionNotFound
		}
		return false, err
	}
	if err := s.repo.DeleteTraces(ctx, id, tenantID); err != nil {
		return false, err
	}
	if err := s.repo.DeleteFeedbacks(ctx, id, tenantID); err != nil {
		return false, err
	}
	return s.repo.Delete(ctx, id, tenantID)
}

// --- Explanation ---

type ExplanationResult struct {
	Decision    *models.AIDecision `json:"decision"`
	Explanation string             `json:"explanation"`
}

// GetExplanation generates a human-readable explanation for a decision.
func (s *Service) GetExplanation(ctx context.Context, id, tenantID string) (*ExplanationResult, error) {
	d, err := s.GetDecision(ctx, id, tenantID)
	if err != nil {
		return nil, err
	}

	explanation := s.generateExplanation(d)
	return &ExplanationResult{
		Decision:    d,
		Explanation: explanation,
	}, nil
}

func (s *Service) generateExplanation(d *models.AIDecision) string {
	var reasoning models.DecisionReasoning
	_ = json.Unmarshal([]byte(d.Reasoning), &reasoning)

	var b stringsBuilder
	b.appendf("决策类型: %s\n", d.Type)
	b.appendf("置信度: %.1f%%\n", d.Confidence*100)
	b.appendf("\n决策摘要:\n%s\n", reasoning.Summary)

	b.append("\n影响因素:")
	for _, f := range reasoning.Factors {
		b.appendf("\n- %s (%s): 权重 %.2f, %s", f.Name, f.Category, f.Weight, f.Description)
	}

	b.append("\n\n备选方案:")
	for _, a := range reasoning.Alternatives {
		b.appendf("\n- %s: 评分 %.2f, %s", a.Option, a.Score, a.Reason)
	}

	b.append("\n\n约束条件:")
	for _, c := range reasoning.Constraints {
		b.appendf("\n- %s", c)
	}

	b.append("\n\n假设前提:")
	for _, a := range reasoning.Assumptions {
		b.appendf("\n- %s", a)
	}

	return b.string()
}

// --- Feedback ---

// SubmitFeedback adds feedback to a decision and updates its status.
func (s *Service) SubmitFeedback(ctx context.Context, tenantID, userID, decisionID string, req *models.SubmitFeedbackRequest) (*models.AIDecision, error) {
	// Verify decision exists
	_, err := s.repo.GetByID(ctx, decisionID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrDecisionNotFound
		}
		return nil, err
	}

	actualImpactJSON := ""
	if req.ActualImpact != nil {
		b, err := json.Marshal(req.ActualImpact)
		if err == nil {
			actualImpactJSON = string(b)
		}
	}

	fb := &models.DecisionFeedback{
		TenantID:   tenantID,
		DecisionID: decisionID,
		Type:       req.Type,
		CreatedBy:  userID,
		CreatedAt:  time.Now().Unix(),
		ActualImpact: sql.NullString{String: actualImpactJSON, Valid: actualImpactJSON != ""},
	}
	if req.Comment != nil {
		fb.Comment = sql.NullString{String: *req.Comment, Valid: true}
	}
	if req.Outcome != nil {
		fb.Outcome = sql.NullString{String: *req.Outcome, Valid: true}
	}

	if err := s.repo.CreateFeedback(ctx, fb); err != nil {
		return nil, fmt.Errorf("failed to create feedback: %w", err)
	}

	// Update decision status based on feedback
	var status models.DecisionStatus
	switch req.Type {
	case models.FeedbackTypePositive:
		status = models.DecisionStatusAccepted
	case models.FeedbackTypeNegative:
		status = models.DecisionStatusRejected
	default:
		status = models.DecisionStatusAccepted // default to accepted
	}

	d, err := s.GetDecision(ctx, decisionID, tenantID)
	if err != nil {
		return nil, err
	}
	_ = d // fetch current decision for validation
	return s.UpdateDecisionStatus(ctx, decisionID, tenantID, status)
}

func (*Service) getDecisionStatus(d *models.AIDecision) models.DecisionStatus {
	return d.Status
}

// --- Traces ---

// GetTraces retrieves all traces for a decision.
func (s *Service) GetTraces(ctx context.Context, decisionID, tenantID string) ([]models.DecisionTrace, error) {
	// Verify decision exists
	_, err := s.repo.GetByID(ctx, decisionID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrDecisionNotFound
		}
		return nil, err
	}
	traces, err := s.repo.GetTraces(ctx, decisionID, tenantID)
	if err != nil {
		return nil, err
	}
	if traces == nil {
		traces = []models.DecisionTrace{}
	}
	return traces, nil
}

// --- Stats ---

// GetStats aggregates decision statistics.
func (s *Service) GetStats(ctx context.Context, tenantID string, dateRange *models.DateRange) (*models.DecisionStats, error) {
	stats, err := s.repo.GetStats(ctx, tenantID, dateRange)
	if err != nil {
		return nil, fmt.Errorf("failed to get stats: %w", err)
	}
	return stats, nil
}

// --- Analysis ---

// AnalyzeDecisions performs batch analysis on decisions.
func (s *Service) AnalyzeDecisions(ctx context.Context, tenantID string, req *models.AnalyzeDecisionsRequest) (*models.AnalyzeDecisionsResult, error) {
	// Gather decisions
	var allDecisions []models.AIDecision
	if len(req.DecisionIds) > 0 {
		for _, id := range req.DecisionIds {
			d, err := s.repo.GetByID(ctx, id, tenantID)
			if err != nil {
				continue // skip missing
			}
			allDecisions = append(allDecisions, *d)
		}
	} else {
		// Build filter
		rFilter := &repository.ListFilter{Limit: ptrInt(1000)}
		if len(req.Types) > 0 {
			// Fetch all then filter (OR condition)
			decisions, err := s.repo.List(ctx, tenantID, rFilter)
			if err != nil {
				return nil, err
			}
			// Filter by types
			var filtered []models.AIDecision
			typeSet := make(map[string]bool)
			for _, t := range req.Types {
				typeSet[string(t)] = true
			}
			for _, d := range decisions {
				if typeSet[string(d.Type)] {
					filtered = append(filtered, d)
				}
			}
			allDecisions = filtered
		} else {
			decisions, err := s.repo.List(ctx, tenantID, rFilter)
			if err != nil {
				return nil, err
			}
			allDecisions = decisions
		}
	}

	// Apply date range filter
	if req.DateRange != nil {
		var filtered []models.AIDecision
		for _, d := range allDecisions {
			if d.CreatedAt >= req.DateRange.Start && d.CreatedAt <= req.DateRange.End {
				filtered = append(filtered, d)
			}
		}
		allDecisions = filtered
	}

	if allDecisions == nil {
		allDecisions = []models.AIDecision{}
	}

	insights := s.generateInsights(allDecisions, req.AnalysisType)
	recommendations := s.generateRecommendations(allDecisions)

	return &models.AnalyzeDecisionsResult{
		AnalysisType:    req.AnalysisType,
		Insights:        insights,
		Recommendations: recommendations,
	}, nil
}

func (s *Service) generateInsights(decisions []models.AIDecision, analysisType string) []models.AnalysisInsight {
	insights := []models.AnalysisInsight{}

	switch analysisType {
	case "pattern":
		typeCounts := make(map[string]int)
		for _, d := range decisions {
			typeCounts[string(d.Type)]++
		}
		topType := ""
		topCount := 0
		for t, c := range typeCounts {
			if c > topCount {
				topType = t
				topCount = c
			}
		}
		if topType != "" {
			significance := 0.0
			if len(decisions) > 0 {
				significance = float64(topCount) / float64(len(decisions))
			}
			insights = append(insights, models.AnalysisInsight{
				Type:         "pattern",
				Title:        "最常见决策类型",
				Description:  fmt.Sprintf("%s 类型的决策最常见，共 %d 次", topType, topCount),
				Significance: significance,
				Data:         map[string]interface{}{"type": topType, "count": topCount},
			})
		}

	case "trend":
		avgConfidence := 0.0
		if len(decisions) > 0 {
			var sum float64
			for _, d := range decisions {
				sum += d.Confidence
			}
			avgConfidence = sum / float64(len(decisions))
		}
		insights = append(insights, models.AnalysisInsight{
			Type:         "trend",
			Title:        "置信度趋势",
			Description:  fmt.Sprintf("平均置信度为 %.1f%%", avgConfidence*100),
			Significance: avgConfidence,
			Data:         map[string]interface{}{"avgConfidence": avgConfidence},
		})

	case "anomaly":
		var lowConfidence []string
		for _, d := range decisions {
			if d.Confidence < 0.5 {
				lowConfidence = append(lowConfidence, d.ID)
			}
		}
		if len(lowConfidence) > 0 {
			significance := 0.0
			if len(decisions) > 0 {
				significance = float64(len(lowConfidence)) / float64(len(decisions))
			}
			insights = append(insights, models.AnalysisInsight{
				Type:         "anomaly",
				Title:        "低置信度决策",
				Description:  fmt.Sprintf("发现 %d 个低置信度决策", len(lowConfidence)),
				Significance: significance,
				Data:         map[string]interface{}{"count": len(lowConfidence), "decisions": lowConfidence},
			})
		}

	case "correlation":
		// Correlation: analyze acceptance rate vs confidence
		acceptedHigh := 0
		acceptedLow := 0
		totalHigh := 0
		totalLow := 0
		for _, d := range decisions {
			if d.Confidence >= 0.5 {
				totalHigh++
				if d.Status == models.DecisionStatusAccepted {
					acceptedHigh++
				}
			} else {
				totalLow++
				if d.Status == models.DecisionStatusAccepted {
					acceptedLow++
				}
			}
		}
		insights = append(insights, models.AnalysisInsight{
			Type:  "correlation",
			Title: "置信度与接受率相关性",
			Description: fmt.Sprintf(
				"高置信度决策接受率 %.1f%%，低置信度决策接受率 %.1f%%",
				acceptRate(acceptedHigh, totalHigh)*100,
				acceptRate(acceptedLow, totalLow)*100,
			),
			Significance: 1.0,
			Data: map[string]interface{}{
				"highConfidenceAcceptanceRate": acceptRate(acceptedHigh, totalHigh),
				"lowConfidenceAcceptanceRate":  acceptRate(acceptedLow, totalLow),
			},
		})
	}

	if len(insights) == 0 {
		insights = []models.AnalysisInsight{
			{
				Type:        analysisType,
				Title:       "无显著洞察",
				Description: "当前数据不足以生成分析洞察",
				Data:        map[string]interface{}{},
			},
		}
	}

	return insights
}

func (s *Service) generateRecommendations(decisions []models.AIDecision) []string {
	recommendations := []string{}

	rejectedCount := 0
	for _, d := range decisions {
		if d.Status == models.DecisionStatusRejected {
			rejectedCount++
		}
	}
	if len(decisions) > 0 {
		rejectedRate := float64(rejectedCount) / float64(len(decisions))
		if rejectedRate > 0.3 {
			recommendations = append(recommendations, "决策拒绝率较高，建议检查模型训练数据或调整决策阈值")
		}
	}

	var sum float64
	for _, d := range decisions {
		sum += d.Confidence
	}
	avgConfidence := 0.0
	if len(decisions) > 0 {
		avgConfidence = sum / float64(len(decisions))
	}
	if avgConfidence < 0.7 {
		recommendations = append(recommendations, "平均置信度较低，建议优化模型或增加特征")
	}

	if len(recommendations) == 0 {
		recommendations = append(recommendations, "决策系统运行正常，继续保持监控")
	}

	return recommendations
}

// --- Helpers ---

// seedDefaultTraces creates the default 4-step execution trace.
func (s *Service) seedDefaultTraces(ctx context.Context, tenantID, decisionID string, baseTime int64) {
	traces := []*models.DecisionTrace{
		{
			TenantID:    tenantID,
			DecisionID:  decisionID,
			Step:        1,
			Action:      "data_collection",
			Description: "收集决策所需的数据",
			Input:       "{}",
			Output:      "{}",
			Duration:    50,
			Timestamp:   baseTime,
		},
		{
			TenantID:    tenantID,
			DecisionID:  decisionID,
			Step:        2,
			Action:      "feature_extraction",
			Description: "提取特征",
			Input:       "{}",
			Output:      "{}",
			Duration:    30,
			Timestamp:   baseTime + 1,
		},
		{
			TenantID:    tenantID,
			DecisionID:  decisionID,
			Step:        3,
			Action:      "model_inference",
			Description: "模型推理",
			Input:       "{}",
			Output:      "{}",
			Duration:    100,
			Timestamp:   baseTime + 1,
		},
		{
			TenantID:    tenantID,
			DecisionID:  decisionID,
			Step:        4,
			Action:      "result_generation",
			Description: "生成决策结果",
			Input:       "{}",
			Output:      "{}",
			Duration:    20,
			Timestamp:   baseTime + 2,
		},
	}
	_ = s.repo.CreateTraces(ctx, traces)
}

func ptrInt(v int) *int {
	return &v
}

func acceptRate(accepted, total int) float64 {
	if total == 0 {
		return 0
	}
	return float64(accepted) / float64(total)
}

// stringsBuilder is a simple string accumulator.
type stringsBuilder struct {
	buf string
}

func (b *stringsBuilder) append(s string) {
	b.buf += s
}

func (b *stringsBuilder) appendf(format string, args ...interface{}) {
	b.buf += fmt.Sprintf(format, args...)
}

func (b *stringsBuilder) string() string {
	return b.buf
}
