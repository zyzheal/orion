package service

import (
	"context"
	"errors"
	"testing"

	"orion/platform-svc-go/internal/data-classification/models"
)

// fakeClassificationRepo records calls and returns configurable results.
type fakeClassificationRepo struct {
	// stored rules keyed by id for CreateRule / ListRules / GetRule
	rules map[string]models.ClassificationRule
	// nextRuleID is incremented each time CreateRule is called
	nextRuleID int

	// classifyResources stores every resource passed to Classify
	classifyResources []*models.ClassifiedResource

	// getRule returns this error (nil = default by id lookup)
	getRuleErr error
	// deleteRuleErr returns this error (nil = default success if id found)
	deleteRuleErr error
	// classifyErr returns this error
	classifyErr error
	// getClassificationErr returns this error
	getClassificationErr error

	listRulesErr error
	createRuleErr error
}

func (f *fakeClassificationRepo) CreateRule(ctx context.Context, tenantID string, req *models.CreateRuleRequest) (*models.ClassificationRule, error) {
	if f.createRuleErr != nil {
		return nil, f.createRuleErr
	}
	f.nextRuleID++
	id := "rule-" + itoa(f.nextRuleID)
	rule := models.ClassificationRule{
		ID:           id,
		TenantID:     tenantID,
		Name:         req.Name,
		Description:  req.Description,
		Level:        req.Level,
		Pattern:      req.Pattern,
		ResourceType: req.ResourceType,
		Enabled:      true,
	}
	f.rules[id] = rule
	return &rule, nil
}

func (f *fakeClassificationRepo) ListRules(ctx context.Context, tenantID string) ([]models.ClassificationRule, error) {
	if f.listRulesErr != nil {
		return nil, f.listRulesErr
	}
	var out []models.ClassificationRule
	for _, r := range f.rules {
		if r.TenantID == tenantID {
			out = append(out, r)
		}
	}
	return out, nil
}

func (f *fakeClassificationRepo) GetRule(ctx context.Context, tenantID, id string) (*models.ClassificationRule, error) {
	if f.getRuleErr != nil {
		return nil, f.getRuleErr
	}
	r, ok := f.rules[id]
	if !ok {
		return nil, errors.New("not found")
	}
	if r.TenantID != tenantID {
		return nil, errors.New("not found")
	}
	return &r, nil
}

func (f *fakeClassificationRepo) DeleteRule(ctx context.Context, tenantID, id string) error {
	if f.deleteRuleErr != nil {
		return f.deleteRuleErr
	}
	r, ok := f.rules[id]
	if !ok || r.TenantID != tenantID {
		return errors.New("not found")
	}
	delete(f.rules, id)
	return nil
}

func (f *fakeClassificationRepo) Classify(ctx context.Context, tenantID string, resource *models.ClassifiedResource) error {
	if f.classifyErr != nil {
		return f.classifyErr
	}
	f.classifyResources = append(f.classifyResources, resource)
	return nil
}

func (f *fakeClassificationRepo) GetClassification(ctx context.Context, tenantID, resourceID string) (*models.ClassifiedResource, error) {
	if f.getClassificationErr != nil {
		return nil, f.getClassificationErr
	}
	// Return the last classification that matches
	for i := len(f.classifyResources) - 1; i >= 0; i-- {
		r := f.classifyResources[i]
		if r.ResourceID == resourceID && r.TenantID == tenantID {
			return r, nil
		}
	}
	return nil, errors.New("not found")
}

// Compile-time check that fakeClassificationRepo implements RepositoryInterface.
var _ RepositoryInterface = (*fakeClassificationRepo)(nil)

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	digits := []byte{}
	for n > 0 {
		digits = append([]byte{byte('0' + n%10)}, digits...)
		n /= 10
	}
	return string(digits)
}

// ---------------------------------------------------------------------------
// NewService
// ---------------------------------------------------------------------------

func TestService_NewService_WithNilRepo(t *testing.T) {
	s := NewService(nil)
	if s == nil {
		t.Fatal("NewService returned nil")
	}
}

func TestService_NewServiceForTesting(t *testing.T) {
	s := NewServiceForTesting(&fakeClassificationRepo{rules: map[string]models.ClassificationRule{}})
	if s == nil {
		t.Fatal("NewServiceForTesting returned nil")
	}
}

// ---------------------------------------------------------------------------
// CreateRule
// ---------------------------------------------------------------------------

func TestCreateRule_Success(t *testing.T) {
	fake := &fakeClassificationRepo{rules: map[string]models.ClassificationRule{}}
	s := NewServiceForTesting(fake)
	ctx := context.Background()

	req := &models.CreateRuleRequest{
		Name:         "ssn-rule",
		Description:  "match SSN",
		Level:        models.LevelRestricted,
		Pattern:      `\d{3}-\d{2}-\d{4}`,
		ResourceType: "document",
	}
	got, err := s.CreateRule(ctx, "t1", req)
	if err != nil {
		t.Fatalf("CreateRule returned error: %v", err)
	}
	if got == nil {
		t.Fatal("CreateRule returned nil rule")
	}
	if got.Name != "ssn-rule" {
		t.Fatalf("expected name ssn-rule, got %s", got.Name)
	}
	if got.Level != models.LevelRestricted {
		t.Fatalf("expected level restricted, got %s", got.Level)
	}
	if got.Enabled != true {
		t.Fatal("expected rule to be enabled")
	}
	if got.TenantID != "t1" {
		t.Fatalf("expected tenant t1, got %s", got.TenantID)
	}
}

func TestCreateRule_EmptyName(t *testing.T) {
	fake := &fakeClassificationRepo{rules: map[string]models.ClassificationRule{}}
	s := NewServiceForTesting(fake)
	ctx := context.Background()

	req := &models.CreateRuleRequest{
		Name:         "",
		Pattern:      `foo`,
		Level:        models.LevelPublic,
		ResourceType: "document",
	}
	_, err := s.CreateRule(ctx, "t1", req)
	if err == nil {
		t.Fatal("expected error for empty name")
	}
}

func TestCreateRule_EmptyPattern(t *testing.T) {
	fake := &fakeClassificationRepo{rules: map[string]models.ClassificationRule{}}
	s := NewServiceForTesting(fake)
	ctx := context.Background()

	req := &models.CreateRuleRequest{
		Name:         "test",
		Pattern:      "",
		Level:        models.LevelPublic,
		ResourceType: "document",
	}
	_, err := s.CreateRule(ctx, "t1", req)
	if err == nil {
		t.Fatal("expected error for empty pattern")
	}
}

func TestCreateRule_TenantIDPassedThrough(t *testing.T) {
	fake := &fakeClassificationRepo{rules: map[string]models.ClassificationRule{}}
	s := NewServiceForTesting(fake)
	ctx := context.Background()

	req := &models.CreateRuleRequest{
		Name:   "r",
		Pattern: `a`,
		Level:  models.LevelInternal,
	}
	got, err := s.CreateRule(ctx, "tenant-a", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.TenantID != "tenant-a" {
		t.Fatalf("expected tenantID tenant-a, got %s", got.TenantID)
	}
}

// ---------------------------------------------------------------------------
// ListRules
// ---------------------------------------------------------------------------

func TestListRules_WithRules(t *testing.T) {
	fake := &fakeClassificationRepo{rules: map[string]models.ClassificationRule{
		"r1": {ID: "r1", TenantID: "t1", Name: "rule1", Level: models.LevelPublic},
		"r2": {ID: "r2", TenantID: "t1", Name: "rule2", Level: models.LevelInternal},
		"r3": {ID: "r3", TenantID: "t2", Name: "rule3", Level: models.LevelPublic},
	}}
	s := NewServiceForTesting(fake)
	ctx := context.Background()

	items, err := s.ListRules(ctx, "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 rules for tenant t1, got %d", len(items))
	}
}

func TestListRules_Empty(t *testing.T) {
	fake := &fakeClassificationRepo{rules: map[string]models.ClassificationRule{}}
	s := NewServiceForTesting(fake)
	ctx := context.Background()

	items, err := s.ListRules(ctx, "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 0 {
		t.Fatalf("expected 0 rules, got %d", len(items))
	}
}

func TestListRules_TenantIsolation(t *testing.T) {
	fake := &fakeClassificationRepo{rules: map[string]models.ClassificationRule{
		"r1": {ID: "r1", TenantID: "t1", Name: "rule1"},
		"r2": {ID: "r2", TenantID: "t2", Name: "rule2"},
	}}
	s := NewServiceForTesting(fake)
	ctx := context.Background()

	items, err := s.ListRules(ctx, "t2")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 rule for t2, got %d", len(items))
	}
	if items[0].TenantID != "t2" {
		t.Fatalf("expected tenantID t2, got %s", items[0].TenantID)
	}
}

// ---------------------------------------------------------------------------
// GetRule
// ---------------------------------------------------------------------------

func TestGetRule_Success(t *testing.T) {
	fake := &fakeClassificationRepo{rules: map[string]models.ClassificationRule{
		"r1": {ID: "r1", TenantID: "t1", Name: "my-rule"},
	}}
	s := NewServiceForTesting(fake)
	ctx := context.Background()

	got, err := s.GetRule(ctx, "t1", "r1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got == nil {
		t.Fatal("expected non-nil rule")
	}
	if got.Name != "my-rule" {
		t.Fatalf("expected name my-rule, got %s", got.Name)
	}
}

func TestGetRule_NotFound(t *testing.T) {
	fake := &fakeClassificationRepo{rules: map[string]models.ClassificationRule{}}
	s := NewServiceForTesting(fake)
	ctx := context.Background()

	_, err := s.GetRule(ctx, "t1", "does-not-exist")
	if err == nil {
		t.Fatal("expected error for missing rule")
	}
}

func TestGetRule_TenantIsolation(t *testing.T) {
	fake := &fakeClassificationRepo{rules: map[string]models.ClassificationRule{
		"r1": {ID: "r1", TenantID: "t1", Name: "rule1"},
	}}
	s := NewServiceForTesting(fake)
	ctx := context.Background()

	_, err := s.GetRule(ctx, "t2", "r1")
	if err == nil {
		t.Fatal("expected error for tenant mismatch")
	}
}

// ---------------------------------------------------------------------------
// DeleteRule
// ---------------------------------------------------------------------------

func TestDeleteRule_Success(t *testing.T) {
	fake := &fakeClassificationRepo{rules: map[string]models.ClassificationRule{
		"r1": {ID: "r1", TenantID: "t1", Name: "rule1"},
	}}
	s := NewServiceForTesting(fake)
	ctx := context.Background()

	err := s.DeleteRule(ctx, "t1", "r1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Verify rule is gone
	items, _ := fake.ListRules(ctx, "t1")
	if len(items) != 0 {
		t.Fatalf("expected rule to be deleted, but found %d items", len(items))
	}
}

func TestDeleteRule_NotFound(t *testing.T) {
	fake := &fakeClassificationRepo{rules: map[string]models.ClassificationRule{}}
	s := NewServiceForTesting(fake)
	ctx := context.Background()

	err := s.DeleteRule(ctx, "t1", "nope")
	if err == nil {
		t.Fatal("expected error for missing rule")
	}
}

func TestDeleteRule_TenantIsolation(t *testing.T) {
	fake := &fakeClassificationRepo{rules: map[string]models.ClassificationRule{
		"r1": {ID: "r1", TenantID: "t1", Name: "rule1"},
	}}
	s := NewServiceForTesting(fake)
	ctx := context.Background()

	err := s.DeleteRule(ctx, "t2", "r1")
	if err == nil {
		t.Fatal("expected error for tenant mismatch")
	}
}

// ---------------------------------------------------------------------------
// Classify
// ---------------------------------------------------------------------------

func TestClassify_MatchesPattern(t *testing.T) {
	fake := &fakeClassificationRepo{rules: map[string]models.ClassificationRule{
		"r1": {
			ID:           "r1",
			TenantID:     "t1",
			Name:         "ssn",
			Level:        models.LevelConfidential,
			Pattern:      `\d{3}-\d{2}-\d{4}`,
			ResourceType: "document",
			Enabled:      true,
		},
	}}
	s := NewServiceForTesting(fake)
	ctx := context.Background()

	req := &models.ClassifyRequest{
		ResourceID:   "res-1",
		ResourceType: "document",
		Content:      "SSN is 123-45-6789",
	}
	got, err := s.Classify(ctx, "t1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got == nil {
		t.Fatal("expected non-nil resource")
	}
	if got.Level != models.LevelConfidential {
		t.Fatalf("expected level confidential, got %s", got.Level)
	}
	if got.RuleID != "r1" {
		t.Fatalf("expected ruleID r1, got %s", got.RuleID)
	}
	if got.ResourceID != "res-1" {
		t.Fatalf("expected resourceID res-1, got %s", got.ResourceID)
	}
	if got.ClassifiedBy != "system" {
		t.Fatalf("expected classifiedBy system, got %s", got.ClassifiedBy)
	}
	if got.ID == "" {
		t.Fatal("expected non-empty id")
	}
}

func TestClassify_HighestLevelWins(t *testing.T) {
	fake := &fakeClassificationRepo{rules: map[string]models.ClassificationRule{
		"r-public": {
			ID:           "r-public",
			TenantID:     "t1",
			Level:        models.LevelPublic,
			Pattern:      `.*`,
			ResourceType: "doc",
			Enabled:      true,
		},
		"r-restricted": {
			ID:           "r-restricted",
			TenantID:     "t1",
			Level:        models.LevelRestricted,
			Pattern:      `secret`,
			ResourceType: "doc",
			Enabled:      true,
		},
	}}
	s := NewServiceForTesting(fake)
	ctx := context.Background()

	req := &models.ClassifyRequest{
		ResourceID:   "res-1",
		ResourceType: "doc",
		Content:      "this is a secret word",
	}
	got, err := s.Classify(ctx, "t1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Level != models.LevelRestricted {
		t.Fatalf("expected restricted, got %s", got.Level)
	}
	if got.RuleID != "r-restricted" {
		t.Fatalf("expected ruleID r-restricted, got %s", got.RuleID)
	}
}

func TestClassify_DisabledRuleIgnored(t *testing.T) {
	fake := &fakeClassificationRepo{rules: map[string]models.ClassificationRule{
		"r-disabled": {
			ID:           "r-disabled",
			TenantID:     "t1",
			Level:        models.LevelCritical,
			Pattern:      `topsecret`,
			ResourceType: "doc",
			Enabled:      false,
		},
	}}
	s := NewServiceForTesting(fake)
	ctx := context.Background()

	req := &models.ClassifyRequest{
		ResourceID:   "res-1",
		ResourceType: "doc",
		Content:      "this is a topsecret string",
	}
	got, err := s.Classify(ctx, "t1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Disabled rule must not match; default is public
	if got.Level != models.LevelPublic {
		t.Fatalf("expected public (no match), got %s", got.Level)
	}
	if got.RuleID != "" {
		t.Fatalf("expected empty ruleID, got %s", got.RuleID)
	}
}

func TestClassify_ResourceTypeMismatch(t *testing.T) {
	fake := &fakeClassificationRepo{rules: map[string]models.ClassificationRule{
		"r1": {
			ID:           "r1",
			TenantID:     "t1",
			Level:        models.LevelRestricted,
			Pattern:      `secret`,
			ResourceType: "document",
			Enabled:      true,
		},
	}}
	s := NewServiceForTesting(fake)
	ctx := context.Background()

	req := &models.ClassifyRequest{
		ResourceID:   "res-1",
		ResourceType: "image", // mismatch
		Content:      "this is a secret",
	}
	got, err := s.Classify(ctx, "t1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Level != models.LevelPublic {
		t.Fatalf("expected public (type mismatch), got %s", got.Level)
	}
}

func TestClassify_NoMatch(t *testing.T) {
	fake := &fakeClassificationRepo{rules: map[string]models.ClassificationRule{
		"r1": {
			ID:           "r1",
			TenantID:     "t1",
			Level:        models.LevelCritical,
			Pattern:      `SSN-\d+`,
			ResourceType: "doc",
			Enabled:      true,
		},
	}}
	s := NewServiceForTesting(fake)
	ctx := context.Background()

	req := &models.ClassifyRequest{
		ResourceID:   "res-1",
		ResourceType: "doc",
		Content:      "hello world no patterns here",
	}
	got, err := s.Classify(ctx, "t1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Level != models.LevelPublic {
		t.Fatalf("expected public, got %s", got.Level)
	}
	if got.RuleID != "" {
		t.Fatalf("expected empty ruleID, got %s", got.RuleID)
	}
}

func TestClassify_PersistsResource(t *testing.T) {
	fake := &fakeClassificationRepo{rules: map[string]models.ClassificationRule{
		"r1": {
			ID:           "r1",
			TenantID:     "t1",
			Level:        models.LevelInternal,
			Pattern:      `foo`,
			ResourceType: "doc",
			Enabled:      true,
		},
	}}
	s := NewServiceForTesting(fake)
	ctx := context.Background()

	req := &models.ClassifyRequest{
		ResourceID:   "res-1",
		ResourceType: "doc",
		Content:      "foo bar",
	}
	_, err := s.Classify(ctx, "t1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(fake.classifyResources) != 1 {
		t.Fatalf("expected 1 classified resource, got %d", len(fake.classifyResources))
	}
	if fake.classifyResources[0].ResourceID != "res-1" {
		t.Fatalf("expected resourceID res-1, got %s", fake.classifyResources[0].ResourceID)
	}
}

// ---------------------------------------------------------------------------
// GetClassification
// ---------------------------------------------------------------------------

func TestGetClassification_Success(t *testing.T) {
	fake := &fakeClassificationRepo{rules: map[string]models.ClassificationRule{}}
	s := NewServiceForTesting(fake)
	ctx := context.Background()

	// Pre-seed via Classify
	fake.classifyResources = append(fake.classifyResources, &models.ClassifiedResource{
		ID:          "cr1",
		TenantID:    "t1",
		ResourceID:  "res-1",
		ResourceType: "doc",
		Level:       models.LevelRestricted,
		RuleID:      "r1",
		ClassifiedBy: "system",
	})

	got, err := s.GetClassification(ctx, "t1", "res-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got == nil {
		t.Fatal("expected non-nil classification")
	}
	if got.Level != models.LevelRestricted {
		t.Fatalf("expected level restricted, got %s", got.Level)
	}
}

func TestGetClassification_NotFound(t *testing.T) {
	fake := &fakeClassificationRepo{rules: map[string]models.ClassificationRule{}}
	s := NewServiceForTesting(fake)
	ctx := context.Background()

	_, err := s.GetClassification(ctx, "t1", "missing")
	if err == nil {
		t.Fatal("expected error for missing classification")
	}
}

func TestGetClassification_TenantIsolation(t *testing.T) {
	fake := &fakeClassificationRepo{rules: map[string]models.ClassificationRule{}}
	s := NewServiceForTesting(fake)
	ctx := context.Background()

	fake.classifyResources = append(fake.classifyResources, &models.ClassifiedResource{
		ID:         "cr1",
		TenantID:   "t1",
		ResourceID: "res-1",
		Level:      models.LevelInternal,
	})

	_, err := s.GetClassification(ctx, "t2", "res-1")
	if err == nil {
		t.Fatal("expected error for tenant mismatch")
	}
}

// ---------------------------------------------------------------------------
// Create-and-Get round-trip
// ---------------------------------------------------------------------------

func TestCreateAndGetRoundTrip(t *testing.T) {
	fake := &fakeClassificationRepo{rules: map[string]models.ClassificationRule{}}
	s := NewServiceForTesting(fake)
	ctx := context.Background()

	// Create a rule, then fetch it
	created, err := s.CreateRule(ctx, "t1", &models.CreateRuleRequest{
		Name:         "roundtrip",
		Description:  "test round trip",
		Level:        models.LevelConfidential,
		Pattern:      `\d+`,
		ResourceType: "num",
	})
	if err != nil {
		t.Fatalf("CreateRule error: %v", err)
	}
	if created == nil {
		t.Fatal("CreateRule returned nil")
	}

	fetched, err := s.GetRule(ctx, "t1", created.ID)
	if err != nil {
		t.Fatalf("GetRule error: %v", err)
	}
	if fetched.Name != created.Name {
		t.Fatalf("expected name %s, got %s", created.Name, fetched.Name)
	}
	if fetched.Level != created.Level {
		t.Fatalf("expected level %s, got %s", created.Level, fetched.Level)
	}
}

// ---------------------------------------------------------------------------
// Rejection formats (validation errors)
// ---------------------------------------------------------------------------

func TestService_RejectionFormats(t *testing.T) {
	fake := &fakeClassificationRepo{rules: map[string]models.ClassificationRule{}}
	s := NewServiceForTesting(fake)
	ctx := context.Background()

	// Empty name
	_, err := s.CreateRule(ctx, "t1", &models.CreateRuleRequest{Pattern: `a`, Level: models.LevelPublic})
	if err == nil {
		t.Fatal("expected error for empty name")
	}

	// Empty pattern
	_, err = s.CreateRule(ctx, "t1", &models.CreateRuleRequest{Name: "ok", Level: models.LevelPublic})
	if err == nil {
		t.Fatal("expected error for empty pattern")
	}
}

// ---------------------------------------------------------------------------
// List only returns tenant rules
// ---------------------------------------------------------------------------

func TestListOnlyReturnsTenantRules(t *testing.T) {
	fake := &fakeClassificationRepo{rules: map[string]models.ClassificationRule{
		"r1": {ID: "r1", TenantID: "t1", Name: "a"},
		"r2": {ID: "r2", TenantID: "t2", Name: "b"},
		"r3": {ID: "r3", TenantID: "t2", Name: "c"},
	}}
	s := NewServiceForTesting(fake)
	ctx := context.Background()

	items, err := s.ListRules(ctx, "t2")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 rules for t2, got %d", len(items))
	}
	for _, it := range items {
		if it.TenantID != "t2" {
			t.Fatalf("expected all items for t2, got %s", it.TenantID)
		}
	}
}
