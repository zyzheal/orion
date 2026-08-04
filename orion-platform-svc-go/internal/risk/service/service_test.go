package service

import (
	"context"
	"errors"
	"sort"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"orion/platform-svc-go/internal/risk/models"
)

// --- Mock repository ---

type mockRiskRepo struct {
	risks map[string]*models.Risk // key = tenantID:id
	err   error
}

func (m *mockRiskRepo) Create(_ context.Context, r *models.Risk) error {
	if m.err != nil {
		return m.err
	}
	if r.ID == "" {
		r.ID = "risk-1"
	}
	m.risks[m.key(r.TenantID, r.ID)] = r
	return nil
}
func (m *mockRiskRepo) GetByID(_ context.Context, tenantID, id string) (*models.Risk, error) {
	if m.err != nil {
		return nil, m.err
	}
	r, ok := m.risks[m.key(tenantID, id)]
	if !ok {
		return nil, errors.New("not found")
	}
	return r, nil
}
func (m *mockRiskRepo) List(_ context.Context, tenantID string) ([]models.Risk, error) {
	if m.err != nil {
		return nil, m.err
	}
	var out []models.Risk
	for k, r := range m.risks {
		if k[:len(tenantID)] == tenantID {
			out = append(out, *r)
		}
	}
	return out, nil
}
func (m *mockRiskRepo) Update(_ context.Context, tenantID, id string, _ map[string]interface{}) (*models.Risk, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.GetByID(context.Background(), tenantID, id)
}
func (m *mockRiskRepo) Delete(_ context.Context, tenantID, id string) error {
	if m.err != nil {
		return m.err
	}
	_, ok := m.risks[m.key(tenantID, id)]
	if !ok {
		return errors.New("not found")
	}
	delete(m.risks, m.key(tenantID, id))
	return nil
}
func (m *mockRiskRepo) key(t, i string) string { return t + ":" + i }

func makeService() *Service {
	return NewService(&mockRiskRepo{risks: map[string]*models.Risk{}})
}

// --- Tests: weighted score calculation ---

func TestCalculateWeightedScore_Empty(t *testing.T) {
	s := makeService()
	result, err := s.CalculateWeightedScore(context.Background(), nil, nil)
	require.NoError(t, err)
	assert.Equal(t, 0.0, result.Score)
	assert.Equal(t, "low", result.Level)
}

func TestCalculateWeightedScore_SingleFactor(t *testing.T) {
	s := makeService()
	factors := []models.RiskFactor{{Name: "A", Weight: 1.0, Value: 50}}
	result, err := s.CalculateWeightedScore(context.Background(), factors, nil)
	require.NoError(t, err)
	assert.Equal(t, 50.0, result.Score)
	assert.Equal(t, "medium", result.Level)
	assert.Len(t, result.FactorBreakdown, 1)
	assert.Equal(t, 50.0, result.FactorBreakdown[0].Contribution)
}

func TestCalculateWeightedScore_MultipleFactors(t *testing.T) {
	s := makeService()
	factors := []models.RiskFactor{
		{Name: "A", Weight: 0.5, Value: 60},
		{Name: "B", Weight: 0.5, Value: 40},
	}
	result, err := s.CalculateWeightedScore(context.Background(), factors, nil)
	require.NoError(t, err)
	// (0.5*60 + 0.5*40) / 1.0 = 50
	assert.Equal(t, 50.0, result.Score)
	assert.Equal(t, "medium", result.Level)
}

func TestCalculateWeightedScore_UnnormalizedWeights(t *testing.T) {
	s := makeService()
	factors := []models.RiskFactor{
		{Name: "A", Weight: 2, Value: 90},
		{Name: "B", Weight: 1, Value: 30},
	}
	result, err := s.CalculateWeightedScore(context.Background(), factors, nil)
	require.NoError(t, err)
	// (2*90 + 1*30) / (2+1) = 210 / 3 = 70
	assert.Equal(t, 70.0, result.Score)
	assert.Equal(t, "high", result.Level)
}

func TestCalculateWeightedScore_WithMitigation(t *testing.T) {
	s := makeService()
	factors := []models.RiskFactor{{Name: "A", Weight: 1.0, Value: 100}}
	mitigation := &models.MitigationPlan{Effectiveness: 0.5}
	result, err := s.CalculateWeightedScore(context.Background(), factors, mitigation)
	require.NoError(t, err)
	// 100 * (1 - 0.5) = 50
	assert.Equal(t, 50.0, result.Score)
	assert.Equal(t, "medium", result.Level)
}

// --- Tests: score -> level mapping ---

func TestMapWeightedScore_Low(t *testing.T) {
	// We test through the public API because mapWeightedScore is unexported.
	s := makeService()
	for _, v := range []float64{0, 10, 25} {
		result, err := s.CalculateWeightedScore(context.Background(), []models.RiskFactor{{Name: "X", Weight: 1, Value: v}}, nil)
		require.NoError(t, err)
		assert.Equal(t, "low", result.Level, "score %v should be low", v)
	}
}

func TestMapWeightedScore_Medium(t *testing.T) {
	s := makeService()
	for _, v := range []float64{26, 40, 50} {
		result, err := s.CalculateWeightedScore(context.Background(), []models.RiskFactor{{Name: "X", Weight: 1, Value: v}}, nil)
		require.NoError(t, err)
		assert.Equal(t, "medium", result.Level, "score %v should be medium", v)
	}
}

func TestMapWeightedScore_High(t *testing.T) {
	s := makeService()
	for _, v := range []float64{51, 65, 75} {
		result, err := s.CalculateWeightedScore(context.Background(), []models.RiskFactor{{Name: "X", Weight: 1, Value: v}}, nil)
		require.NoError(t, err)
		assert.Equal(t, "high", result.Level, "score %v should be high", v)
	}
}

func TestMapWeightedScore_Critical(t *testing.T) {
	s := makeService()
	for _, v := range []float64{76, 88, 100, 200} {
		result, err := s.CalculateWeightedScore(context.Background(), []models.RiskFactor{{Name: "X", Weight: 1, Value: v}}, nil)
		require.NoError(t, err)
		assert.Equal(t, "critical", result.Level, "score %v should be critical", v)
	}
}

// --- Tests: trend aggregation ---

func TestGetRiskTrends_NoRisks(t *testing.T) {
	repo := &mockRiskRepo{risks: map[string]*models.Risk{}}
	s := NewService(repo)
	since := time.Now().Add(-1 * time.Hour)
	trends, err := s.GetRiskTrends(context.Background(), "t1", since)
	require.NoError(t, err)
	assert.Empty(t, trends)
}

func TestGetRiskTrends_WithHistory(t *testing.T) {
	repo := &mockRiskRepo{risks: map[string]*models.Risk{
		"t1:r1": {ID: "r1", TenantID: "t1", Name: "risk-a"},
	}}
	s := NewService(repo)
	// Manually record scores.
	now := time.Now()
	s.recordScore("t1", "risk-a", 30.0, now.Add(-2*time.Hour))
	s.recordScore("t1", "risk-a", 50.0, now.Add(-1*time.Hour))
	s.recordScore("t1", "risk-a", 70.0, now)

	since := now.Add(-3 * time.Hour)
	trends, err := s.GetRiskTrends(context.Background(), "t1", since)
	require.NoError(t, err)
	require.Len(t, trends, 1)
	tr := trends[0]
	assert.Equal(t, "r1", tr.RiskID)
	assert.Equal(t, float64(50), tr.AvgScore)
	assert.Equal(t, float64(30), tr.MinScore)
	assert.Equal(t, float64(70), tr.MaxScore)
	assert.Equal(t, float64(40), tr.ScoreDelta)
	assert.Equal(t, 3, tr.SampleCount)
	assert.Equal(t, "up", tr.TrendDirection)
}

func TestGetRiskTrends_FilterBySince(t *testing.T) {
	repo := &mockRiskRepo{risks: map[string]*models.Risk{
		"t1:r1": {ID: "r1", TenantID: "t1", Name: "risk-b"},
	}}
	s := NewService(repo)
	now := time.Now()
	s.recordScore("t1", "risk-b", 10.0, now.Add(-3*time.Hour))
	s.recordScore("t1", "risk-b", 20.0, now.Add(-1*time.Hour))

	since := now.Add(-2 * time.Hour)
	trends, err := s.GetRiskTrends(context.Background(), "t1", since)
	require.NoError(t, err)
	require.Len(t, trends, 1)
	assert.Equal(t, 1, trends[0].SampleCount)
	assert.Equal(t, "stable", trends[0].TrendDirection)
}

// --- Tests: correlation ---

func TestGetCorrelatedRisks_NoOverlap(t *testing.T) {
	repo := &mockRiskRepo{risks: map[string]*models.Risk{
		"t1:r1": {ID: "r1", TenantID: "t1", Name: "A", Value: "security,network"},
		"t1:r2": {ID: "r2", TenantID: "t1", Name: "B", Value: "storage,compute"},
	}}
	s := NewService(repo)
	pairs, err := s.GetCorrelatedRisks(context.Background(), "t1")
	require.NoError(t, err)
	assert.Empty(t, pairs)
}

func TestGetCorrelatedRisks_SingleTagOverlap(t *testing.T) {
	repo := &mockRiskRepo{risks: map[string]*models.Risk{
		"t1:r1": {ID: "r1", TenantID: "t1", Name: "A", Value: "security,network"},
		"t1:r2": {ID: "r2", TenantID: "t1", Name: "B", Value: "network,compute"},
	}}
	s := NewService(repo)
	pairs, err := s.GetCorrelatedRisks(context.Background(), "t1")
	require.NoError(t, err)
	require.Len(t, pairs, 1)
	assert.Contains(t, pairs[0].SharedTags, "network")
	assert.True(t, pairs[0].OverlapScore > 0)
}

func TestGetCorrelatedRisks_FullOverlap(t *testing.T) {
	repo := &mockRiskRepo{risks: map[string]*models.Risk{
		"t1:r1": {ID: "r1", TenantID: "t1", Name: "A", Value: "security"},
		"t1:r2": {ID: "r2", TenantID: "t1", Name: "B", Value: "security"},
	}}
	s := NewService(repo)
	pairs, err := s.GetCorrelatedRisks(context.Background(), "t1")
	require.NoError(t, err)
	require.Len(t, pairs, 1)
	assert.Equal(t, 1.0, pairs[0].OverlapScore)
}

func TestGetCorrelatedRisks_SortedByOverlap(t *testing.T) {
	repo := &mockRiskRepo{risks: map[string]*models.Risk{
		"t1:r1": {ID: "r1", TenantID: "t1", Name: "A", Value: "a,b,c,d"},
		"t1:r2": {ID: "r2", TenantID: "t1", Name: "B", Value: "a"},
		"t1:r3": {ID: "r3", TenantID: "t1", Name: "C", Value: "a,b"},
	}}
	s := NewService(repo)
	pairs, err := s.GetCorrelatedRisks(context.Background(), "t1")
	require.NoError(t, err)
	// Pairs: (A,B)=1/4=0.25, (A,C)=2/4=0.5, (B,C)=1/2=0.5
	// Sorted descending -> 0.5, 0.5, 0.25
	assert.GreaterOrEqual(t, pairs[0].OverlapScore, pairs[len(pairs)-1].OverlapScore)
}

func TestGetCorrelatedRisks_SingleTagValues(t *testing.T) {
	repo := &mockRiskRepo{risks: map[string]*models.Risk{
		"t1:r1": {ID: "r1", TenantID: "t1", Name: "A", Value: "infra"},
		"t1:r2": {ID: "r2", TenantID: "t1", Name: "B", Value: "infra"},
	}}
	s := NewService(repo)
	pairs, err := s.GetCorrelatedRisks(context.Background(), "t1")
	require.NoError(t, err)
	require.Len(t, pairs, 1)
	assert.Contains(t, pairs[0].SharedTags, "infra")
}

func TestGetCorrelatedRisks_ListError(t *testing.T) {
	repo := &mockRiskRepo{risks: map[string]*models.Risk{}, err: errors.New("db down")}
	s := NewService(repo)
	_, err := s.GetCorrelatedRisks(context.Background(), "t1")
	assert.Error(t, err)
}

// --- Tests: level mapping boundary (via existing calculateScore still works) ---

func TestCalculateScore_Existing(t *testing.T) {
	s := makeService()
	req := models.RiskScoreRequest{Severity: 3, Probability: 3, Impact: 3}
	result, err := s.CalculateScore(context.Background(), req)
	require.NoError(t, err)
	assert.Equal(t, 27.0, result.Score)
	assert.Equal(t, "medium", result.Level)
}

// --- Tests: weightedScoreResult structure ---

func TestWeightedScoreResult_MitigationIncluded(t *testing.T) {
	s := makeService()
	mitigation := &models.MitigationPlan{Action: "patch", Owner: "alice", Effectiveness: 0.3}
	result, err := s.CalculateWeightedScore(context.Background(), []models.RiskFactor{{Name: "X", Weight: 1, Value: 100}}, mitigation)
	require.NoError(t, err)
	assert.Equal(t, 70.0, result.Score)
	assert.Equal(t, "patch", result.Mitigation.Action)
	assert.Equal(t, "alice", result.Mitigation.Owner)
}

// --- Tests: helper functions ---

func TestParseTags_Comma(t *testing.T) {
	tags := parseTags("security, network, storage")
	assert.Equal(t, []string{"security", "network", "storage"}, tags)
}

func TestParseTags_Space(t *testing.T) {
	tags := parseTags("security network storage")
	assert.Equal(t, []string{"security", "network", "storage"}, tags)
}

func TestParseTags_Empty(t *testing.T) {
	tags := parseTags("")
	assert.Nil(t, tags)
}

func TestTagIntersectionAndUnion(t *testing.T) {
	shared, unionSet := tagIntersectionAndUnion([]string{"a", "b"}, []string{"b", "c"})
	sort.Strings(shared)
	sort.Strings(unionSet)
	assert.Equal(t, []string{"b"}, shared)
	assert.Equal(t, []string{"a", "b", "c"}, unionSet)
}

func TestRoundFloat(t *testing.T) {
	assert.Equal(t, 3.14, roundFloat(3.14159, 2))
	assert.Equal(t, 1.0, roundFloat(1.0, 0))
}
