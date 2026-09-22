package service

import (
	"context"
	"fmt"
	"strings"

	"orion/platform-svc-go/internal/knowledge/models"
)

// CreateEvalSet creates a new eval set with all its cases in one call.
func (s *Service) CreateEvalSet(ctx context.Context, tenantID string, req models.CreateEvalSetRequest, userID string) (*models.EvalSet, error) {
	set := &models.EvalSet{
		TenantID:    tenantID,
		Name:        req.Name,
		Description: req.Description,
		Version:     1,
		IsActive:    true,
		CreatedBy:   userID,
	}
	if err := s.ragRepo.CreateEvalSet(ctx, set); err != nil {
		return nil, err
	}
	for _, c := range req.Cases {
		gold := c.GoldAnswer
		if gold == "" {
			gold = c.Query // fallback: self-serve as answer
		}
		goldSources := "[]"
		if len(c.GoldSources) > 0 {
			goldSources = "[" + strings.Join(c.GoldSources, ",") + "]"
		}
		caseModel := &models.EvalSetCase{
			SetID:       set.ID,
			TenantID:    tenantID,
			Query:       c.Query,
			GoldAnswer:  gold,
			GoldSources: goldSources,
			Tags:        c.Tags,
		}
		if err := s.ragRepo.AddEvalSetCase(ctx, caseModel); err != nil {
			return nil, err
		}
	}
	return s.ragRepo.GetEvalSet(ctx, tenantID, set.ID)
}

// GetEvalSet returns an eval set by ID.
func (s *Service) GetEvalSet(ctx context.Context, tenantID, id string) (*models.EvalSet, error) {
	return s.ragRepo.GetEvalSet(ctx, tenantID, id)
}

// ListEvalSets returns all eval sets for a tenant.
func (s *Service) ListEvalSets(ctx context.Context, tenantID string) ([]models.EvalSet, error) {
	return s.ragRepo.ListEvalSets(ctx, tenantID)
}

// DeleteEvalSet removes a set and its cases.
func (s *Service) DeleteEvalSet(ctx context.Context, tenantID, id string) error {
	return s.ragRepo.DeleteEvalSet(ctx, tenantID, id)
}

// ListEvalSetCases returns the cases of a set.
func (s *Service) ListEvalSetCases(ctx context.Context, tenantID, setID string) ([]models.EvalSetCase, error) {
	return s.ragRepo.ListEvalSetCases(ctx, tenantID, setID)
}

// RunEval executes an evaluation: for each case it runs retrieval and checks
// whether the gold answer (or a query-derived ground truth) is recovered.
func (s *Service) RunEval(ctx context.Context, tenantID string, req models.RunEvalRequest, userID string) (*models.EvalRun, error) {
	if _, err := s.ragRepo.GetEvalSet(ctx, tenantID, req.SetID); err != nil {
		return nil, fmt.Errorf("eval set not found: %w", err)
	}
	cases, err := s.ragRepo.ListEvalSetCases(ctx, tenantID, req.SetID)
	if err != nil {
		return nil, err
	}

	run := &models.EvalRun{
		SetID:     req.SetID,
		TenantID:  tenantID,
		Model:     req.Model,
		Status:    "running",
		CreatedBy: userID,
	}
	if err := s.ragRepo.CreateEvalRun(ctx, run); err != nil {
		return nil, err
	}

	topK := req.TopK
	if topK <= 0 {
		topK = 5
	}

	total := len(cases)
	pass := 0
	totalRecall := 0.0
	goldCases := 0
	measured := 0
	totalScore := 0.0
	for _, c := range cases {
		results, rerr := s.repo.Retrieve(ctx, tenantID, c.Query, "", &topK)
		if rerr != nil {
			continue
		}
		// Scoring: a case passes if gold answer content overlaps retrieved results
		// OR (no gold) if any result returned (query-based retrieval sanity).
		hit := false
		if len(results) > 0 {
			if c.GoldAnswer != "" {
				goldNorm := normalizeText(c.GoldAnswer)
				for _, r := range results {
					if goldNorm != "" && strings.Contains(normalizeText(r.Content), firstWords(goldNorm, 8)) {
						hit = true
						break
					}
				}
			} else {
				hit = true
			}
		}
		if hit {
			pass++
		}
		// A case that reached retrieval is what both averages divide by:
		// counting cases that errored would report a quality the retrieval
		// never produced.
		measured++
		if recall, ok := recallForCase(c.GoldSources, results); ok {
			totalRecall += recall
			goldCases++
		}
		totalScore += resultsScore(results)
	}

	// gold_cases records how many cases declared gold sources, so a 0.00
	// avg_recall means either a real miss or that nothing was measurable.
	report := fmt.Sprintf(`{"total":%d,"pass":%d,"fail":%d,"pass_rate":%.2f,"gold_cases":%d}`,
		total, pass, total-pass, safeRate(pass, total), goldCases)

	updates := map[string]interface{}{
		"status":      "completed",
		"pass_count":  pass,
		"total_count": total,
		"avg_recall":  safeRateRound(totalRecall, goldCases),
		"avg_score":   safeRateRound(totalScore, measured),
		"report":      report,
	}
	if err := s.ragRepo.UpdateEvalRun(ctx, run.ID, updates); err != nil {
		return nil, fmt.Errorf("record eval run result: %w", err)
	}

	return s.ragRepo.GetEvalRun(ctx, tenantID, run.ID)
}

// ListEvalRuns returns evaluation runs, optionally filtered by set.
func (s *Service) ListEvalRuns(ctx context.Context, tenantID, setID string, limit int) ([]models.EvalRun, error) {
	return s.ragRepo.ListEvalRuns(ctx, tenantID, setID, limit)
}

// CompareRuns compares two evaluation runs and reports metric deltas.
func (s *Service) CompareRuns(ctx context.Context, tenantID string, req models.CompareRunsRequest) (*models.EvalRunComparison, error) {
	base, err := s.ragRepo.GetEvalRun(ctx, tenantID, req.BaseRunID)
	if err != nil {
		return nil, err
	}
	head, err := s.ragRepo.GetEvalRun(ctx, tenantID, req.HeadRunID)
	if err != nil {
		return nil, err
	}
	baseRate := safeRate(base.PassCount, base.TotalCount)
	headRate := safeRate(head.PassCount, head.TotalCount)
	regression := headRate < baseRate || head.AvgScore < base.AvgScore
	return &models.EvalRunComparison{
		Base: base,
		Head: head,
		Delta: models.EvalRunDelta{
			PassRateDelta:  round2(headRate - baseRate),
			AvgRecallDelta: round2(head.AvgRecall - base.AvgRecall),
			AvgScoreDelta:  round2(head.AvgScore - base.AvgScore),
			Regression:     regression,
		},
	}, nil
}

func resultsScore(results []models.RAGRetrieveResult) float64 {
	// minimal scoring: average similarity of retrieved results
	if len(results) == 0 {
		return 0
	}
	sum := 0.0
	for _, r := range results {
		sum += r.Similarity
	}
	return sum / float64(len(results))
}

func normalizeText(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

func firstWords(s string, n int) string {
	parts := strings.Fields(s)
	if len(parts) > n {
		parts = parts[:n]
	}
	return strings.Join(parts, " ")
}

func safeRate(pass, total int) float64 {
	if total == 0 {
		return 0
	}
	return float64(pass) / float64(total)
}

func safeRateRound(n float64, total int) float64 {
	return round2(n / float64(maxInt(total, 1)))
}

func round2(v float64) float64 {
	return float64(int(v*100)) / 100
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// recallForCase measures how much of the case's declared gold sources the
// retrieval returned: |retrieved intersect expected| / |expected|. The second
// return is false when the case declares no gold sources, in which case recall
// is not measurable and the case must not sit in the denominator.
func recallForCase(goldSources string, results []models.RAGRetrieveResult) (float64, bool) {
	expected := parseGoldSources(goldSources)
	if len(expected) == 0 {
		return 0, false
	}
	found := make(map[string]struct{}, len(results))
	for _, r := range results {
		if r.ID != "" {
			found[r.ID] = struct{}{}
		}
	}
	hits := 0
	for _, id := range expected {
		if _, ok := found[id]; ok {
			hits++
		}
	}
	return float64(hits) / float64(len(expected)), true
}

// parseGoldSources decodes the gold_sources column. CreateEvalSet writes it as
// a bare comma list inside brackets (doc-1,doc-2), not JSON, so json.Unmarshal
// would reject it; trim the quotes so the JSON shape works too.
func parseGoldSources(raw string) []string {
	s := strings.TrimSpace(raw)
	s = strings.Trim(s, "[]")
	if s == "" {
		return nil
	}
	var out []string
	for _, part := range strings.Split(s, ",") {
		p := strings.Trim(strings.TrimSpace(part), "\"'")
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
