package service

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"orion/platform-svc-go/internal/data-classification/models"
	"orion/platform-svc-go/internal/data-classification/repository"
)

// testRepo creates a fresh repository and service for each test.
func testRepo() (*repository.Repository, *Service) {
	repo := repository.NewRepository()
	return repo, NewService(repo)
}

// ---- CreateRule ----

func TestCreateRule_Success(t *testing.T) {
	_, svc := testRepo()
	req := &models.CreateRuleRequest{
		Name:         "PII Rule",
		Description:  "Detect PII patterns",
		Level:        models.LevelConfidential,
		Pattern:      "\\d{11}",
		ResourceType: "document",
	}
	rule, err := svc.CreateRule(context.Background(), "t1", req)
	require.NoError(t, err)
	require.NotNil(t, rule)
	assert.Equal(t, "t1", rule.TenantID)
	assert.Equal(t, models.LevelConfidential, rule.Level)
	assert.True(t, rule.Enabled)
	assert.NotEmpty(t, rule.ID)
	assert.NotEmpty(t, rule.CreatedAt)
	assert.NotEmpty(t, rule.UpdatedAt)
}

func TestCreateRule_EmptyName(t *testing.T) {
	_, svc := testRepo()
	req := &models.CreateRuleRequest{
		Name:         "",
		Level:        models.LevelConfidential,
		Pattern:      "test",
		ResourceType: "document",
	}
	_, err := svc.CreateRule(context.Background(), "t1", req)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "name is required")
}

func TestCreateRule_EmptyPattern(t *testing.T) {
	_, svc := testRepo()
	req := &models.CreateRuleRequest{
		Name:         "PII Rule",
		Level:        models.LevelConfidential,
		Pattern:      "",
		ResourceType: "document",
	}
	_, err := svc.CreateRule(context.Background(), "t1", req)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "pattern is required")
}

// ---- ListRules ----

func TestListRules_WithRules(t *testing.T) {
	repo, svc := testRepo()
	_, err := repo.CreateRule(context.Background(), "t1", &models.CreateRuleRequest{
		Name: "Rule1", Level: models.LevelInternal, Pattern: "pat1", ResourceType: "doc",
	})
	require.NoError(t, err)
	_, err = repo.CreateRule(context.Background(), "t1", &models.CreateRuleRequest{
		Name: "Rule2", Level: models.LevelRestricted, Pattern: "pat2", ResourceType: "doc",
	})
	require.NoError(t, err)
	// Rule in another tenant should not appear
	_, err = repo.CreateRule(context.Background(), "t2", &models.CreateRuleRequest{
		Name: "Rule3", Level: models.LevelPublic, Pattern: "pat3", ResourceType: "doc",
	})
	require.NoError(t, err)

	rules, err := svc.ListRules(context.Background(), "t1")
	require.NoError(t, err)
	assert.Len(t, rules, 2)
	names := make(map[string]bool)
	for _, r := range rules {
		names[r.Name] = true
	}
	assert.True(t, names["Rule1"])
	assert.True(t, names["Rule2"])
}

func TestListRules_Empty(t *testing.T) {
	_, svc := testRepo()
	rules, err := svc.ListRules(context.Background(), "t1")
	require.NoError(t, err)
	// Repository returns nil for empty (not a distinct slice)
	assert.Empty(t, rules)
}

// ---- GetRule ----

func TestGetRule_Success(t *testing.T) {
	repo, svc := testRepo()
	created, err := repo.CreateRule(context.Background(), "t1", &models.CreateRuleRequest{
		Name: "Target", Level: models.LevelRestricted, Pattern: "ssn", ResourceType: "form",
	})
	require.NoError(t, err)

	rule, err := svc.GetRule(context.Background(), "t1", created.ID)
	require.NoError(t, err)
	assert.Equal(t, created.ID, rule.ID)
	assert.Equal(t, models.LevelRestricted, rule.Level)
}

func TestGetRule_NotFound(t *testing.T) {
	_, svc := testRepo()
	_, err := svc.GetRule(context.Background(), "t1", "nonexistent")
	require.Error(t, err)
}

func TestGetRule_TenantIsolation(t *testing.T) {
	repo, svc := testRepo()
	created, err := repo.CreateRule(context.Background(), "t1", &models.CreateRuleRequest{
		Name: "Secret", Level: models.LevelCritical, Pattern: "key", ResourceType: "doc",
	})
	require.NoError(t, err)

	_, err = svc.GetRule(context.Background(), "t2", created.ID)
	require.Error(t, err)
}

// ---- DeleteRule ----

func TestDeleteRule_Success(t *testing.T) {
	repo, svc := testRepo()
	created, err := repo.CreateRule(context.Background(), "t1", &models.CreateRuleRequest{
		Name: "Ephemeral", Level: models.LevelPublic, Pattern: "tmp", ResourceType: "log",
	})
	require.NoError(t, err)

	err = svc.DeleteRule(context.Background(), "t1", created.ID)
	require.NoError(t, err)

	_, err = svc.GetRule(context.Background(), "t1", created.ID)
	require.Error(t, err)
}

func TestDeleteRule_NotFound(t *testing.T) {
	_, svc := testRepo()
	err := svc.DeleteRule(context.Background(), "t1", "nonexistent")
	require.Error(t, err)
}

// ---- levelScore ----

func TestLevelScore_Scores(t *testing.T) {
	assert.Equal(t, 0, levelScore(models.LevelPublic))
	assert.Equal(t, 1, levelScore(models.LevelInternal))
	assert.Equal(t, 2, levelScore(models.LevelConfidential))
	assert.Equal(t, 3, levelScore(models.LevelRestricted))
	assert.Equal(t, 4, levelScore(models.LevelCritical))
}

func TestLevelScore_Default(t *testing.T) {
	assert.Equal(t, 0, levelScore(models.ClassificationLevel("")))
	assert.Equal(t, 0, levelScore(models.ClassificationLevel("unknown")))
}

// ---- Classify ----

func TestClassify_MatchesPattern(t *testing.T) {
	repo, svc := testRepo()
	// Create a rule that matches phone numbers (11 digits)
	_, err := repo.CreateRule(context.Background(), "t1", &models.CreateRuleRequest{
		Name: "Phone Rule", Level: models.LevelConfidential, Pattern: "\\d{11}", ResourceType: "form",
	})
	require.NoError(t, err)

	req := &models.ClassifyRequest{
		ResourceID:   "r1",
		ResourceType: "form",
		Content:      "Contact me at 12345678901",
	}
	resource, err := svc.Classify(context.Background(), "t1", req)
	require.NoError(t, err)
	assert.Equal(t, models.LevelConfidential, resource.Level)
	assert.NotEmpty(t, resource.RuleID)
	assert.Equal(t, "r1", resource.ResourceID)
	assert.Equal(t, "system", resource.ClassifiedBy)
}

func TestClassify_HighestLevelWins(t *testing.T) {
	repo, svc := testRepo()
	// Two rules match the same content; higher level should win
	_, err := repo.CreateRule(context.Background(), "t1", &models.CreateRuleRequest{
		Name: "Low", Level: models.LevelInternal, Pattern: "sensitive", ResourceType: "doc",
	})
	require.NoError(t, err)
	_, err = repo.CreateRule(context.Background(), "t1", &models.CreateRuleRequest{
		Name: "High", Level: models.LevelCritical, Pattern: "sensitive", ResourceType: "doc",
	})
	require.NoError(t, err)

	req := &models.ClassifyRequest{
		ResourceID:   "r2",
		ResourceType: "doc",
		Content:      "this is sensitive data",
	}
	resource, err := svc.Classify(context.Background(), "t1", req)
	require.NoError(t, err)
	assert.Equal(t, models.LevelCritical, resource.Level)
}

func TestClassify_DisabledRuleIgnored(t *testing.T) {
	repo, svc := testRepo()
	rule, err := repo.CreateRule(context.Background(), "t1", &models.CreateRuleRequest{
		Name: "Disabled", Level: models.LevelCritical, Pattern: "secret", ResourceType: "doc",
	})
	require.NoError(t, err)
	// Manually disable the rule
	rule.Enabled = false

	req := &models.ClassifyRequest{
		ResourceID:   "r3",
		ResourceType: "doc",
		Content:      "this is a secret",
	}
	resource, err := svc.Classify(context.Background(), "t1", req)
	require.NoError(t, err)
	// Should fall back to public (default) since the only rule is disabled
	assert.Equal(t, models.LevelPublic, resource.Level)
}

func TestClassify_ResourceTypeMismatch(t *testing.T) {
	repo, svc := testRepo()
	_, err := repo.CreateRule(context.Background(), "t1", &models.CreateRuleRequest{
		Name: "WrongType", Level: models.LevelCritical, Pattern: "anything", ResourceType: "video",
	})
	require.NoError(t, err)

	req := &models.ClassifyRequest{
		ResourceID:   "r4",
		ResourceType: "document",
		Content:      "match anything",
	}
	resource, err := svc.Classify(context.Background(), "t1", req)
	require.NoError(t, err)
	assert.Equal(t, models.LevelPublic, resource.Level)
}

func TestClassify_NoMatch(t *testing.T) {
	_, svc := testRepo()
	req := &models.ClassifyRequest{
		ResourceID:   "r5",
		ResourceType: "form",
		Content:      "nothing to see here",
	}
	resource, err := svc.Classify(context.Background(), "t1", req)
	require.NoError(t, err)
	assert.Equal(t, models.LevelPublic, resource.Level)
}

// ---- GetClassification ----

func TestGetClassification_Success(t *testing.T) {
	repo, svc := testRepo()
	cr := &models.ClassifiedResource{
		ID:         "cr1",
		TenantID:   "t1",
		ResourceID: "r1",
		Level:      models.LevelConfidential,
	}
	err := repo.Classify(context.Background(), "t1", cr)
	require.NoError(t, err)

	result, err := svc.GetClassification(context.Background(), "t1", "cr1")
	require.NoError(t, err)
	assert.Equal(t, "cr1", result.ID)
	assert.Equal(t, models.LevelConfidential, result.Level)
}

func TestGetClassification_NotFound(t *testing.T) {
	_, svc := testRepo()
	_, err := svc.GetClassification(context.Background(), "t1", "nonexistent")
	require.Error(t, err)
}

func TestGetClassification_TenantIsolation(t *testing.T) {
	repo, svc := testRepo()
	cr := &models.ClassifiedResource{
		ID:         "cr2",
		TenantID:   "t1",
		ResourceID: "r2",
		Level:      models.LevelInternal,
	}
	err := repo.Classify(context.Background(), "t1", cr)
	require.NoError(t, err)

	_, err = svc.GetClassification(context.Background(), "t2", "cr2")
	require.Error(t, err)
}

// ---- Repository errors propagate ----

func TestService_RejectionFormats(t *testing.T) {
	// Verify that validation error messages are consistent
	_, svc := testRepo()

	_, err := svc.CreateRule(context.Background(), "t1", &models.CreateRuleRequest{
		Name: "", Level: models.LevelPublic, Pattern: "x", ResourceType: "doc",
	})
	require.Error(t, err)
	assert.True(t, strings.HasPrefix(err.Error(), "name"))

	_, err = svc.CreateRule(context.Background(), "t1", &models.CreateRuleRequest{
		Name: "ok", Level: models.LevelPublic, Pattern: "", ResourceType: "doc",
	})
	require.Error(t, err)
	assert.True(t, strings.HasPrefix(err.Error(), "pattern"))
}

func TestService_CreateAndGetRoundTrip(t *testing.T) {
	_, svc := testRepo()
	req := &models.CreateRuleRequest{
		Name: "RoundTrip", Description: "test", Level: models.LevelRestricted,
		Pattern: "credit", ResourceType: "payment",
	}
	created, err := svc.CreateRule(context.Background(), "t1", req)
	require.NoError(t, err)
	assert.Equal(t, "RoundTrip", created.Name)
	assert.Equal(t, "payment", created.ResourceType)

	retrieved, err := svc.GetRule(context.Background(), "t1", created.ID)
	require.NoError(t, err)
	assert.Equal(t, created.ID, retrieved.ID)
	assert.Equal(t, created.Level, retrieved.Level)
}

func TestService_ListOnlyReturnsTenantRules(t *testing.T) {
	_, svc := testRepo()
	_, err := svc.CreateRule(context.Background(), "t1", &models.CreateRuleRequest{
		Name: "A", Level: models.LevelPublic, Pattern: "a", ResourceType: "x",
	})
	require.NoError(t, err)
	_, err = svc.CreateRule(context.Background(), "t1", &models.CreateRuleRequest{
		Name: "B", Level: models.LevelInternal, Pattern: "b", ResourceType: "x",
	})
	require.NoError(t, err)
	_, err = svc.CreateRule(context.Background(), "t2", &models.CreateRuleRequest{
		Name: "C", Level: models.LevelConfidential, Pattern: "c", ResourceType: "x",
	})
	require.NoError(t, err)

	list, err := svc.ListRules(context.Background(), "t1")
	require.NoError(t, err)
	assert.Len(t, list, 2)
}
