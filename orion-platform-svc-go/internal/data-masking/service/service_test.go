package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"orion/platform-svc-go/internal/data-masking/models"
)

// --- mockRepository implements RepositoryInterface for testing ---

type mockRepository struct {
	createFn              func(ctx context.Context, rule *models.MaskingRule) error
	getByIDFn             func(ctx context.Context, tenantID, id string) (*models.MaskingRule, error)
	listFn                func(ctx context.Context, tenantID string) ([]models.MaskingRule, error)
	listByResourceTypeFn  func(ctx context.Context, tenantID, resourceType string) ([]models.MaskingRule, error)
	updateFn              func(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.MaskingRule, error)
	deleteFn              func(ctx context.Context, tenantID, id string) (bool, error)
}

func (m *mockRepository) Create(ctx context.Context, rule *models.MaskingRule) error {
	if m.createFn != nil {
		return m.createFn(ctx, rule)
	}
	return nil
}

func (m *mockRepository) GetByID(ctx context.Context, tenantID, id string) (*models.MaskingRule, error) {
	if m.getByIDFn != nil {
		return m.getByIDFn(ctx, tenantID, id)
	}
	return nil, ErrRuleNotFound
}

func (m *mockRepository) List(ctx context.Context, tenantID string) ([]models.MaskingRule, error) {
	if m.listFn != nil {
		return m.listFn(ctx, tenantID)
	}
	return []models.MaskingRule{}, nil
}

func (m *mockRepository) ListByResourceType(ctx context.Context, tenantID, resourceType string) ([]models.MaskingRule, error) {
	if m.listByResourceTypeFn != nil {
		return m.listByResourceTypeFn(ctx, tenantID, resourceType)
	}
	return []models.MaskingRule{}, nil
}

func (m *mockRepository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.MaskingRule, error) {
	if m.updateFn != nil {
		return m.updateFn(ctx, tenantID, id, updates)
	}
	return nil, ErrRuleNotFound
}

func (m *mockRepository) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	if m.deleteFn != nil {
		return m.deleteFn(ctx, tenantID, id)
	}
	return false, ErrRuleNotFound
}

// newTestService creates a service backed by a mock repo.
func newTestService() (*mockRepository, *Service) {
	repo := &mockRepository{}
	return repo, NewService(repo)
}

// ---- CreateRule ----

func TestCreateRule_Success(t *testing.T) {
	repo, svc := newTestService()
	captured := &models.MaskingRule{}
	repo.createFn = func(ctx context.Context, rule *models.MaskingRule) error {
		*captured = *rule
		return nil
	}

	rule := &models.MaskingRule{
		TenantID:     "t1",
		Name:         "SSN Mask",
		Strategy:     models.StrategyPartial,
		FieldPattern: "ssn",
		ResourceType: "employee",
		Enabled:      true,
	}
	err := svc.CreateRule(context.Background(), rule)
	require.NoError(t, err)
	assert.Equal(t, "t1", captured.TenantID)
	assert.Equal(t, "SSN Mask", captured.Name)
}

func TestCreateRule_RepoError(t *testing.T) {
	repo, svc := newTestService()
	repo.createFn = func(ctx context.Context, rule *models.MaskingRule) error {
		return context.DeadlineExceeded
	}
	err := svc.CreateRule(context.Background(), &models.MaskingRule{TenantID: "t1"})
	require.Error(t, err)
	assert.ErrorIs(t, err, context.DeadlineExceeded)
}

// ---- GetRule ----

func TestGetRule_Success(t *testing.T) {
	repo, svc := newTestService()
	expected := &models.MaskingRule{
		ID: "r1", TenantID: "t1", Name: "Email Mask",
		Strategy: models.StrategyFull, FieldPattern: "email",
		ResourceType: "user", Enabled: true,
	}
	repo.getByIDFn = func(ctx context.Context, tenantID, id string) (*models.MaskingRule, error) {
		return expected, nil
	}

	rule, err := svc.GetRule(context.Background(), "t1", "r1")
	require.NoError(t, err)
	assert.Equal(t, "r1", rule.ID)
	assert.Equal(t, models.StrategyFull, rule.Strategy)
}

func TestGetRule_NotFound(t *testing.T) {
	_, svc := newTestService()
	_, err := svc.GetRule(context.Background(), "t1", "missing")
	require.Error(t, err)
}

// ---- ListRules ----

func TestListRules_Success(t *testing.T) {
	repo, svc := newTestService()
	expected := []models.MaskingRule{
		{ID: "r1", TenantID: "t1", Name: "A"},
		{ID: "r2", TenantID: "t1", Name: "B"},
	}
	repo.listFn = func(ctx context.Context, tenantID string) ([]models.MaskingRule, error) {
		return expected, nil
	}

	rules, total, err := svc.ListRules(context.Background(), "t1")
	require.NoError(t, err)
	assert.Equal(t, 2, total)
	assert.Len(t, rules, 2)
}

func TestListRules_Empty(t *testing.T) {
	_, svc := newTestService()
	rules, total, err := svc.ListRules(context.Background(), "t1")
	require.NoError(t, err)
	assert.Equal(t, 0, total)
	assert.NotNil(t, rules)
}

func TestListRules_RepoError(t *testing.T) {
	repo, svc := newTestService()
	repo.listFn = func(ctx context.Context, tenantID string) ([]models.MaskingRule, error) {
		return nil, context.DeadlineExceeded
	}
	_, _, err := svc.ListRules(context.Background(), "t1")
	require.Error(t, err)
}

// ---- UpdateRule ----

func TestUpdateRule_Success(t *testing.T) {
	repo, svc := newTestService()
	updated := &models.MaskingRule{ID: "r1", Name: "Updated", Strategy: models.StrategyHash}
	repo.updateFn = func(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.MaskingRule, error) {
		return updated, nil
	}

	result, err := svc.UpdateRule(context.Background(), "t1", "r1", map[string]interface{}{"name": "Updated"})
	require.NoError(t, err)
	assert.Equal(t, "Updated", result.Name)
}

func TestUpdateRule_NotFound(t *testing.T) {
	_, svc := newTestService()
	_, err := svc.UpdateRule(context.Background(), "t1", "r1", map[string]interface{}{"name": "X"})
	require.Error(t, err)
}

// ---- DeleteRule ----

func TestDeleteRule_Found(t *testing.T) {
	repo, svc := newTestService()
	repo.deleteFn = func(ctx context.Context, tenantID, id string) (bool, error) {
		return true, nil
	}
	deleted, err := svc.DeleteRule(context.Background(), "t1", "r1")
	require.NoError(t, err)
	assert.True(t, deleted)
}

func TestDeleteRule_NotFound(t *testing.T) {
	repo, svc := newTestService()
	repo.deleteFn = func(ctx context.Context, tenantID, id string) (bool, error) {
		return false, nil
	}
	deleted, err := svc.DeleteRule(context.Background(), "t1", "r1")
	require.NoError(t, err)
	assert.False(t, deleted)
}

// ---- ApplyMask ----

func TestApplyMask_FullStrategy(t *testing.T) {
	repo, svc := newTestService()
	repo.listByResourceTypeFn = func(ctx context.Context, tenantID, rt string) ([]models.MaskingRule, error) {
		return []models.MaskingRule{
			{ID: "r1", Strategy: models.StrategyFull, FieldPattern: "email", Enabled: true},
		}, nil
	}
	req := &models.MaskRequest{
		Data:       map[string]interface{}{"email": "user@example.com"},
		ResourceType: "user",
	}
	result, err := svc.ApplyMask(context.Background(), "t1", req)
	require.NoError(t, err)
	// Full masking repeats first char of replacement (default "*") for each char of value
	assert.Equal(t, "****************", result.MaskedData["email"])
	assert.Contains(t, result.MaskedFields, "email")
}

func TestApplyMask_PartialStrategy(t *testing.T) {
	repo, svc := newTestService()
	repo.listByResourceTypeFn = func(ctx context.Context, tenantID, rt string) ([]models.MaskingRule, error) {
		return []models.MaskingRule{
			{ID: "r2", Strategy: models.StrategyPartial, FieldPattern: "phone", Enabled: true},
		}, nil
	}
	req := &models.MaskRequest{
		Data:       map[string]interface{}{"phone": "1234567890"},
		ResourceType: "user",
	}
	result, err := svc.ApplyMask(context.Background(), "t1", req)
	require.NoError(t, err)
	masked := result.MaskedData["phone"].(string)
	// Default: keep first 1 and last 1, mask middle
	assert.Equal(t, "1", masked[:1])
	assert.Equal(t, "0", masked[len(masked)-1:])
	assert.Contains(t, masked, "*")
}

func TestApplyMask_HashStrategy(t *testing.T) {
	repo, svc := newTestService()
	repo.listByResourceTypeFn = func(ctx context.Context, tenantID, rt string) ([]models.MaskingRule, error) {
		return []models.MaskingRule{
			{ID: "r3", Strategy: models.StrategyHash, FieldPattern: "password", Enabled: true},
		}, nil
	}
	req := &models.MaskRequest{
		Data:       map[string]interface{}{"password": "secret123"},
		ResourceType: "user",
	}
	result, err := svc.ApplyMask(context.Background(), "t1", req)
	require.NoError(t, err)
	hashed := result.MaskedData["password"].(string)
	// SHA-256 hex is 64 chars
	assert.Len(t, hashed, 64)
	// Verify it's the correct hash
	expect := sha256.Sum256([]byte("secret123"))
	assert.Equal(t, hex.EncodeToString(expect[:]), hashed)
}

func TestApplyMask_DisabledRuleSkipped(t *testing.T) {
	repo, svc := newTestService()
	repo.listByResourceTypeFn = func(ctx context.Context, tenantID, rt string) ([]models.MaskingRule, error) {
		return []models.MaskingRule{
			{ID: "r4", Strategy: models.StrategyFull, FieldPattern: "email", Enabled: false},
		}, nil
	}
	req := &models.MaskRequest{
		Data:       map[string]interface{}{"email": "test@example.com"},
		ResourceType: "user",
	}
	result, err := svc.ApplyMask(context.Background(), "t1", req)
	require.NoError(t, err)
	// Value should be unchanged
	assert.Equal(t, "test@example.com", result.MaskedData["email"])
	assert.Len(t, result.MaskedFields, 0)
}

func TestApplyMask_PatternMatching(t *testing.T) {
	repo, svc := newTestService()
	repo.listByResourceTypeFn = func(ctx context.Context, tenantID, rt string) ([]models.MaskingRule, error) {
		return []models.MaskingRule{
			{ID: "r5", Strategy: models.StrategyFull, FieldPattern: "*email*", Enabled: true},
		}, nil
	}
	req := &models.MaskRequest{
		Data: map[string]interface{}{
			"user_email":  "a@b.com",
			"phone":       "111",
			"backup_email": "c@d.com",
		},
		ResourceType: "user",
	}
	result, err := svc.ApplyMask(context.Background(), "t1", req)
	require.NoError(t, err)
	// Both email fields should be masked; phone untouched
	assert.NotEqual(t, "a@b.com", result.MaskedData["user_email"])
	assert.NotEqual(t, "c@d.com", result.MaskedData["backup_email"])
	assert.Equal(t, "111", result.MaskedData["phone"])
	assert.Contains(t, result.MaskedFields, "user_email")
	assert.Contains(t, result.MaskedFields, "backup_email")
}

// ---- maskValue / helper functions via ApplyMask ----

func TestMaskValue_UnknownStrategy(t *testing.T) {
	repo, svc := newTestService()
	repo.listByResourceTypeFn = func(ctx context.Context, tenantID, rt string) ([]models.MaskingRule, error) {
		return []models.MaskingRule{
			{ID: "r6", Strategy: models.MaskingStrategy("bogus"), FieldPattern: "x", Enabled: true},
		}, nil
	}
	req := &models.MaskRequest{
		Data:       map[string]interface{}{"x": "value"},
		ResourceType: "user",
	}
	result, err := svc.ApplyMask(context.Background(), "t1", req)
	require.NoError(t, err)
	// Unknown strategy -> error from maskValue -> field skipped (continue)
	assert.Equal(t, "value", result.MaskedData["x"])
}

// ---- matchFieldPattern ----

func TestMatchFieldPattern_WildcardAll(t *testing.T) {
	assert.True(t, matchFieldPattern("email", "*"))
	assert.True(t, matchFieldPattern("anything", "*"))
}

func TestMatchFieldPattern_EmptyPattern(t *testing.T) {
	assert.True(t, matchFieldPattern("email", ""))
}

func TestMatchFieldPattern_ExactMatch(t *testing.T) {
	assert.True(t, matchFieldPattern("email", "email"))
	assert.False(t, matchFieldPattern("email", "phone"))
}

func TestMatchFieldPattern_Contains(t *testing.T) {
	// *email* matches fields containing "email"
	assert.True(t, matchFieldPattern("user_email", "*email*"))
	assert.True(t, matchFieldPattern("email_address", "*email*"))
	assert.False(t, matchFieldPattern("phone", "*email*"))
}

func TestMatchFieldPattern_Suffix(t *testing.T) {
	// *email matches fields ending with "email"
	assert.True(t, matchFieldPattern("user_email", "*email"))
	assert.True(t, matchFieldPattern("email", "*email"))
	assert.False(t, matchFieldPattern("email_address", "*email"))
}

func TestMatchFieldPattern_Prefix(t *testing.T) {
	// email* matches fields starting with "email"
	assert.True(t, matchFieldPattern("email_primary", "email*"))
	assert.True(t, matchFieldPattern("email", "email*"))
	assert.False(t, matchFieldPattern("user_email", "email*"))
}

// ---- IsNotFound ----

func TestIsNotFound(t *testing.T) {
	assert.True(t, IsNotFound(ErrRuleNotFound))
	assert.False(t, IsNotFound(nil))
	assert.False(t, IsNotFound(context.DeadlineExceeded))
}

// ---- Internal helper: maskFull ----

func TestApplyMask_FullStrategyCustomReplacement(t *testing.T) {
	repo, svc := newTestService()
	repo.listByResourceTypeFn = func(ctx context.Context, tenantID, rt string) ([]models.MaskingRule, error) {
		return []models.MaskingRule{
			{ID: "r7", Strategy: models.StrategyFull, FieldPattern: "token", Replacement: "X", Enabled: true},
		}, nil
	}
	req := &models.MaskRequest{
		Data:       map[string]interface{}{"token": "abc"},
		ResourceType: "user",
	}
	result, err := svc.ApplyMask(context.Background(), "t1", req)
	require.NoError(t, err)
	// "X" -> repeat "X" for each char of "abc" = "XXX"
	assert.Equal(t, "XXX", result.MaskedData["token"])
}

// ---- ApplyMask with repo error ----

func TestApplyMask_RepoError(t *testing.T) {
	repo, svc := newTestService()
	repo.listByResourceTypeFn = func(ctx context.Context, tenantID, rt string) ([]models.MaskingRule, error) {
		return nil, context.DeadlineExceeded
	}
	req := &models.MaskRequest{
		Data:       map[string]interface{}{"x": "1"},
		ResourceType: "user",
	}
	_, err := svc.ApplyMask(context.Background(), "t1", req)
	require.Error(t, err)
}

// ---- ApplyMask with non-string field value (should be skipped) ----

func TestApplyMask_NonStringFieldSkipped(t *testing.T) {
	repo, svc := newTestService()
	repo.listByResourceTypeFn = func(ctx context.Context, tenantID, rt string) ([]models.MaskingRule, error) {
		return []models.MaskingRule{
			{ID: "r8", Strategy: models.StrategyFull, FieldPattern: "*", Enabled: true},
		}, nil
	}
	req := &models.MaskRequest{
		Data: map[string]interface{}{
			"name":    "Alice",
			"age":     30,
			"active":  true,
		},
		ResourceType: "user",
	}
	result, err := svc.ApplyMask(context.Background(), "t1", req)
	require.NoError(t, err)
	// Only the string "name" should be masked; int/bool untouched
	assert.NotEqual(t, "Alice", result.MaskedData["name"])
	assert.Equal(t, 30, result.MaskedData["age"])
	assert.Equal(t, true, result.MaskedData["active"])
	assert.Len(t, result.MaskedFields, 1)
}

// ---- Regex strategy via ApplyMask ----

func TestApplyMask_RegexStrategy(t *testing.T) {
	repo, svc := newTestService()
	repo.listByResourceTypeFn = func(ctx context.Context, tenantID, rt string) ([]models.MaskingRule, error) {
		return []models.MaskingRule{
			{ID: "r9", Strategy: models.StrategyRegex, FieldPattern: "card", Enabled: true},
		}, nil
	}
	req := &models.MaskRequest{
		Data: map[string]interface{}{
			"card": "4111-1111-1111-1111",
		},
		ResourceType: "user",
	}
	result, err := svc.ApplyMask(context.Background(), "t1", req)
	require.NoError(t, err)
	// Regex strategy with no custom replacement -> falls through to maskFull
	// (the service uses maskRegex(value, replacement) where replacement comes from rule.Replacement which is "")
	// maskRegex with empty pattern calls maskFull
	assert.NotEqual(t, "4111-1111-1111-1111", result.MaskedData["card"])
}

// ---- Edge cases: short value partial masking ----

func TestApplyMask_PartialShortValue(t *testing.T) {
	repo, svc := newTestService()
	repo.listByResourceTypeFn = func(ctx context.Context, tenantID, rt string) ([]models.MaskingRule, error) {
		return []models.MaskingRule{
			{ID: "r10", Strategy: models.StrategyPartial, FieldPattern: "code", Enabled: true},
		}, nil
	}
	req := &models.MaskRequest{
		Data:       map[string]interface{}{"code": "ab"},
		ResourceType: "user",
	}
	result, err := svc.ApplyMask(context.Background(), "t1", req)
	require.NoError(t, err)
	// value len <= 2 -> maskFull -> "**"
	assert.Equal(t, "**", result.MaskedData["code"])
}
