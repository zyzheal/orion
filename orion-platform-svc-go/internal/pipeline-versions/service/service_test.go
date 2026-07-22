package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"orion/platform-svc-go/internal/pipeline-versions/models"
)

// --- mock repository ---

type mockRepo struct {
	versions            map[string]*models.Version
	createErr           error
	updateErr           error
	deleteErr           error
	getErr              error
	listErr             error
	publishedVersions   []models.Version
	publishedErr        error
	clearDefaultErr     error
	setStatusPublishedErr error
	setStatusDeprecatedErr error
}

func newMockRepo() *mockRepo {
	return &mockRepo{
		versions: make(map[string]*models.Version),
	}
}

func key(tenantID, id string) string { return tenantID + ":" + id }

func (m *mockRepo) CreateVersion(_ context.Context, v *models.Version) error {
	if m.createErr != nil {
		return m.createErr
	}
	v.ID = "v-" + v.Name + "-" + v.TenantID
	m.versions[key(v.TenantID, v.ID)] = v
	return nil
}

func (m *mockRepo) GetVersion(_ context.Context, tenantID, id string) (*models.Version, error) {
	if m.getErr != nil {
		return nil, m.getErr
	}
	v, ok := m.versions[key(tenantID, id)]
	if !ok {
		return nil, errors.New("not found")
	}
	return v, nil
}

func (m *mockRepo) ListVersions(_ context.Context, tenantID, pipelineID string, q *models.ListQuery) (*models.VersionListResult, error) {
	if m.listErr != nil {
		return nil, m.listErr
	}
	var result []models.Version
	for _, v := range m.versions {
		if v.TenantID == tenantID && v.PipelineID == pipelineID {
			result = append(result, *v)
		}
	}
	if q.Limit <= 0 || q.Limit > len(result) {
		q.Limit = len(result)
	}
	if q.Offset > len(result) {
		q.Offset = len(result)
	}
	return &models.VersionListResult{Data: result}, nil
}

func (m *mockRepo) UpdateVersion(_ context.Context, tenantID, id string, updates map[string]any) (*models.Version, error) {
	if m.updateErr != nil {
		return nil, m.updateErr
	}
	v, ok := m.versions[key(tenantID, id)]
	if !ok {
		return nil, errors.New("not found")
	}
	if name, ok := updates["name"]; ok {
		v.Name = name.(string)
	}
	if desc, ok := updates["description"]; ok {
		d := desc.(string)
		v.Description = &d
	}
	return v, nil
}

func (m *mockRepo) DeleteVersion(_ context.Context, tenantID, id string) (bool, error) {
	if m.deleteErr != nil {
		return false, m.deleteErr
	}
	_, ok := m.versions[key(tenantID, id)]
	if !ok {
		return false, nil
	}
	delete(m.versions, key(tenantID, id))
	return true, nil
}

func (m *mockRepo) ClearDefaultForPipeline(_ context.Context, tenantID, pipelineID string) error {
	if m.clearDefaultErr != nil {
		return m.clearDefaultErr
	}
	for _, v := range m.versions {
		if v.TenantID == tenantID && v.PipelineID == pipelineID {
			v.IsDefault = false
		}
	}
	return nil
}

func (m *mockRepo) SetStatusPublished(_ context.Context, tenantID, id string, publishedAt time.Time, isDefault bool) error {
	if m.setStatusPublishedErr != nil {
		return m.setStatusPublishedErr
	}
	v, ok := m.versions[key(tenantID, id)]
	if !ok {
		return errors.New("not found")
	}
	v.Status = models.StatusPublished
	v.PublishedAt = &publishedAt
	v.IsDefault = isDefault
	return nil
}

func (m *mockRepo) SetStatusDeprecated(_ context.Context, tenantID, id string) error {
	if m.setStatusDeprecatedErr != nil {
		return m.setStatusDeprecatedErr
	}
	v, ok := m.versions[key(tenantID, id)]
	if !ok {
		return errors.New("not found")
	}
	now := time.Now().UTC()
	v.Status = models.StatusDeprecated
	v.DeprecatedAt = &now
	return nil
}

func (m *mockRepo) ListPublishedVersions(_ context.Context, tenantID, pipelineID string) ([]models.Version, error) {
	if m.publishedErr != nil {
		return nil, m.publishedErr
	}
	return m.publishedVersions, nil
}

// --- helpers ---

func newTestService(repo *mockRepo) *Service {
	return &Service{repo: repo}
}

// --- Tests: CreateVersion ---

func TestCreateVersion_Success(t *testing.T) {
	repo := newMockRepo()
	svc := newTestService(repo)

	req := &models.CreateVersionRequest{
		Name:   "v1",
		Config: `{"key":"value"}`,
	}
	desc := "test description"
	req.Description = &desc

	// Pre-populate a published version so version number becomes v1.2.0
	now := time.Now()
	repo.publishedVersions = []models.Version{
		{ID: "pub-1", PipelineID: "pipe-1", VersionNum: "v1.1.0", Status: models.StatusPublished, PublishedAt: &now},
	}

	v, err := svc.CreateVersion(context.Background(), "tenant-1", "pipe-1", req, "user-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if v.Name != "v1" {
		t.Errorf("expected name=v1, got %s", v.Name)
	}
	if v.Status != models.StatusDraft {
		t.Errorf("expected status=draft, got %s", v.Status)
	}
	if v.VersionNum != "v1.2.0" {
		t.Errorf("expected version=v1.2.0, got %s", v.VersionNum)
	}
	if v.CreatedBy != "user-1" {
		t.Errorf("expected createdBy=user-1, got %s", v.CreatedBy)
	}
}

func TestCreateVersion_EmptyRequest(t *testing.T) {
	svc := newTestService(newMockRepo())

	_, err := svc.CreateVersion(context.Background(), "t1", "p1", nil, "u1")
	if err != ErrBadRequest {
		t.Errorf("expected ErrBadRequest, got %v", err)
	}
}

func TestCreateVersion_EmptyName(t *testing.T) {
	svc := newTestService(newMockRepo())

	_, err := svc.CreateVersion(context.Background(), "t1", "p1", &models.CreateVersionRequest{Name: "", Config: `{}`}, "u1")
	if err != ErrBadRequest {
		t.Errorf("expected ErrBadRequest, got %v", err)
	}
}

func TestCreateVersion_InvalidJSONConfig(t *testing.T) {
	svc := newTestService(newMockRepo())

	_, err := svc.CreateVersion(context.Background(), "t1", "p1", &models.CreateVersionRequest{Name: "v1", Config: "{invalid}"}, "u1")
	if err != ErrBadRequest {
		t.Errorf("expected ErrBadRequest, got %v", err)
	}
}

func TestCreateVersion_InvalidJSONTags(t *testing.T) {
	svc := newTestService(newMockRepo())

	tags := "{invalid}"
	_, err := svc.CreateVersion(context.Background(), "t1", "p1", &models.CreateVersionRequest{Name: "v1", Config: `{}`, Tags: &tags}, "u1")
	if err != ErrBadRequest {
		t.Errorf("expected ErrBadRequest, got %v", err)
	}
}

// --- Tests: GetVersion ---

func TestGetVersion_Success(t *testing.T) {
	repo := newMockRepo()
	repo.versions["t1:v-1"] = &models.Version{ID: "v-1", TenantID: "t1", PipelineID: "p1", Name: "v1"}
	svc := newTestService(repo)

	v, err := svc.GetVersion(context.Background(), "t1", "v-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if v.Name != "v1" {
		t.Errorf("expected name=v1, got %s", v.Name)
	}
}

func TestGetVersion_NotFound(t *testing.T) {
	svc := newTestService(newMockRepo())

	_, err := svc.GetVersion(context.Background(), "t1", "nonexistent")
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

// --- Tests: ListVersions ---

func TestListVersions_Success(t *testing.T) {
	repo := newMockRepo()
	repo.versions["t1:v-1"] = &models.Version{ID: "v-1", TenantID: "t1", PipelineID: "p1", Name: "v1"}
	repo.versions["t1:v-2"] = &models.Version{ID: "v-2", TenantID: "t1", PipelineID: "p1", Name: "v2"}
	repo.versions["t1:v-3"] = &models.Version{ID: "v-3", TenantID: "t1", PipelineID: "p2", Name: "other"}
	svc := newTestService(repo)

	q := &models.ListQuery{Limit: 20}
	result, err := svc.ListVersions(context.Background(), "t1", "p1", q)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(result.Data) != 2 {
		t.Errorf("expected 2 versions, got %d", len(result.Data))
	}
}

func TestListVersions_DefaultLimit(t *testing.T) {
	svc := newTestService(newMockRepo())
	q := &models.ListQuery{Limit: 0}
	// Should not panic or error with default limit
	_, err := svc.ListVersions(context.Background(), "t1", "p1", q)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

// --- Tests: UpdateVersion ---

func TestUpdateVersion_Success(t *testing.T) {
	repo := newMockRepo()
	repo.versions["t1:v-1"] = &models.Version{ID: "v-1", TenantID: "t1", PipelineID: "p1", Name: "v1", Status: models.StatusDraft}
	svc := newTestService(repo)

	newName := "v1-updated"
	v, err := svc.UpdateVersion(context.Background(), "t1", "v-1", &models.UpdateVersionRequest{Name: &newName})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if v.Name != "v1-updated" {
		t.Errorf("expected name=v1-updated, got %s", v.Name)
	}
}

func TestUpdateVersion_NilRequest(t *testing.T) {
	svc := newTestService(newMockRepo())

	_, err := svc.UpdateVersion(context.Background(), "t1", "v-1", nil)
	if err != ErrBadRequest {
		t.Errorf("expected ErrBadRequest, got %v", err)
	}
}

func TestUpdateVersion_NotFound(t *testing.T) {
	svc := newTestService(newMockRepo())

	name := "new"
	_, err := svc.UpdateVersion(context.Background(), "t1", "nonexistent", &models.UpdateVersionRequest{Name: &name})
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestUpdateVersion_PublishedLocked(t *testing.T) {
	repo := newMockRepo()
	repo.versions["t1:v-1"] = &models.Version{ID: "v-1", TenantID: "t1", PipelineID: "p1", Name: "v1", Status: models.StatusPublished}
	svc := newTestService(repo)

	name := "new"
	_, err := svc.UpdateVersion(context.Background(), "t1", "v-1", &models.UpdateVersionRequest{Name: &name})
	if err != ErrLocked {
		t.Errorf("expected ErrLocked, got %v", err)
	}
}

func TestUpdateVersion_InvalidConfigJSON(t *testing.T) {
	repo := newMockRepo()
	repo.versions["t1:v-1"] = &models.Version{ID: "v-1", TenantID: "t1", PipelineID: "p1", Name: "v1", Status: models.StatusDraft}
	svc := newTestService(repo)

	badConfig := "{invalid}"
	_, err := svc.UpdateVersion(context.Background(), "t1", "v-1", &models.UpdateVersionRequest{Config: &badConfig})
	if err != ErrBadRequest {
		t.Errorf("expected ErrBadRequest, got %v", err)
	}
}

// --- Tests: DeleteVersion ---

func TestDeleteVersion_Success(t *testing.T) {
	repo := newMockRepo()
	repo.versions["t1:v-1"] = &models.Version{ID: "v-1", TenantID: "t1"}
	svc := newTestService(repo)

	err := svc.DeleteVersion(context.Background(), "t1", "v-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestDeleteVersion_NotFound(t *testing.T) {
	svc := newTestService(newMockRepo())

	err := svc.DeleteVersion(context.Background(), "t1", "nonexistent")
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

// --- Tests: PublishVersion ---

func TestPublishVersion_Success(t *testing.T) {
	repo := newMockRepo()
	repo.versions["t1:v-1"] = &models.Version{ID: "v-1", TenantID: "t1", PipelineID: "p1", Name: "v1", Status: models.StatusDraft}
	svc := newTestService(repo)

	makeDefault := true
	v, err := svc.PublishVersion(context.Background(), "t1", "v-1", &models.PublishVersionRequest{MakeDefault: &makeDefault})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if v.Status != models.StatusPublished {
		t.Errorf("expected status=published, got %s", v.Status)
	}
	if !v.IsDefault {
		t.Error("expected isDefault=true")
	}
}

func TestPublishVersion_NotFound(t *testing.T) {
	svc := newTestService(newMockRepo())

	_, err := svc.PublishVersion(context.Background(), "t1", "nonexistent", nil)
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestPublishVersion_AlreadyPublished(t *testing.T) {
	repo := newMockRepo()
	repo.versions["t1:v-1"] = &models.Version{ID: "v-1", TenantID: "t1", PipelineID: "p1", Name: "v1", Status: models.StatusPublished}
	svc := newTestService(repo)

	_, err := svc.PublishVersion(context.Background(), "t1", "v-1", nil)
	if err != ErrAlreadyPublished {
		t.Errorf("expected ErrAlreadyPublished, got %v", err)
	}
}

// --- Tests: DeprecateVersion ---

func TestDeprecateVersion_Success(t *testing.T) {
	repo := newMockRepo()
	repo.versions["t1:v-1"] = &models.Version{ID: "v-1", TenantID: "t1", PipelineID: "p1", Name: "v1", Status: models.StatusPublished}
	svc := newTestService(repo)

	v, err := svc.DeprecateVersion(context.Background(), "t1", "v-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if v.Status != models.StatusDeprecated {
		t.Errorf("expected status=deprecated, got %s", v.Status)
	}
}

func TestDeprecateVersion_NotFound(t *testing.T) {
	svc := newTestService(newMockRepo())

	_, err := svc.DeprecateVersion(context.Background(), "t1", "nonexistent")
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

// --- Tests: RollbackVersion ---

func TestRollbackVersion_ByTargetID(t *testing.T) {
	repo := newMockRepo()
	repo.versions["t1:target-v"] = &models.Version{ID: "target-v", TenantID: "t1", Name: "target", Status: models.StatusPublished}
	svc := newTestService(repo)

	targetID := "target-v"
	v, err := svc.RollbackVersion(context.Background(), "t1", "p1", &models.RollbackVersionRequest{
		Reason:          "rollback reason",
		TargetVersionID: &targetID,
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if v.ID != "target-v" {
		t.Errorf("expected target-v, got %s", v.ID)
	}
}

func TestRollbackVersion_NoTarget(t *testing.T) {
	svc := newTestService(newMockRepo())

	_, err := svc.RollbackVersion(context.Background(), "t1", "p1", &models.RollbackVersionRequest{Reason: "reason"})
	if err != ErrNoRollbackTarget {
		t.Errorf("expected ErrNoRollbackTarget, got %v", err)
	}
}

func TestRollbackVersion_EmptyReason(t *testing.T) {
	svc := newTestService(newMockRepo())

	_, err := svc.RollbackVersion(context.Background(), "t1", "p1", &models.RollbackVersionRequest{Reason: ""})
	if err != ErrBadRequest {
		t.Errorf("expected ErrBadRequest, got %v", err)
	}
}

func TestRollbackVersion_NilRequest(t *testing.T) {
	svc := newTestService(newMockRepo())

	_, err := svc.RollbackVersion(context.Background(), "t1", "p1", nil)
	if err != ErrBadRequest {
		t.Errorf("expected ErrBadRequest, got %v", err)
	}
}

func TestRollbackVersion_SecondToLastPublished(t *testing.T) {
	repo := newMockRepo()
	now := time.Now()
	yesterday := now.Add(-24 * time.Hour)
	repo.publishedVersions = []models.Version{
		{ID: "latest", VersionNum: "v1.2.0", Status: models.StatusPublished, PublishedAt: &now},
		{ID: "previous", VersionNum: "v1.1.0", Status: models.StatusPublished, PublishedAt: &yesterday},
	}
	svc := newTestService(repo)

	v, err := svc.RollbackVersion(context.Background(), "t1", "p1", &models.RollbackVersionRequest{Reason: "rollback"})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if v.ID != "previous" {
		t.Errorf("expected previous version, got %s", v.ID)
	}
}

// --- Tests: CompareVersions ---

func TestCompareVersions_Success(t *testing.T) {
	repo := newMockRepo()
	repo.versions["t1:from"] = &models.Version{ID: "from", TenantID: "t1", Name: "from", Config: `{"key":"old"}`}
	repo.versions["t1:to"] = &models.Version{ID: "to", TenantID: "t1", Name: "to", Config: `{"key":"new"}`}
	svc := newTestService(repo)

	result, err := svc.CompareVersions(context.Background(), "t1", &models.CompareVersionsRequest{
		FromVersionID: "from",
		ToVersionID:   "to",
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(result.Diff) == 0 {
		t.Error("expected non-empty diff")
	}
	if len(result.Fields) == 0 {
		t.Error("expected non-empty fields")
	}
	if result.From.Name != "from" || result.To.Name != "to" {
		t.Errorf("expected from=from, to=to, got from=%s to=%s", result.From.Name, result.To.Name)
	}
}

func TestCompareVersions_EmptyRequest(t *testing.T) {
	svc := newTestService(newMockRepo())

	_, err := svc.CompareVersions(context.Background(), "t1", nil)
	if err != ErrBadRequest {
		t.Errorf("expected ErrBadRequest, got %v", err)
	}
}

func TestCompareVersions_MissingIDs(t *testing.T) {
	svc := newTestService(newMockRepo())

	_, err := svc.CompareVersions(context.Background(), "t1", &models.CompareVersionsRequest{})
	if err != ErrBadRequest {
		t.Errorf("expected ErrBadRequest, got %v", err)
	}
}

func TestCompareVersions_FromNotFound(t *testing.T) {
	repo := newMockRepo()
	repo.versions["t1:to"] = &models.Version{ID: "to", TenantID: "t1", Name: "to"}
	svc := newTestService(repo)

	_, err := svc.CompareVersions(context.Background(), "t1", &models.CompareVersionsRequest{
		FromVersionID: "nonexistent",
		ToVersionID:   "to",
	})
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestCompareVersions_ToNotFound(t *testing.T) {
	repo := newMockRepo()
	repo.versions["t1:from"] = &models.Version{ID: "from", TenantID: "t1", Name: "from"}
	svc := newTestService(repo)

	_, err := svc.CompareVersions(context.Background(), "t1", &models.CompareVersionsRequest{
		FromVersionID: "from",
		ToVersionID:   "nonexistent",
	})
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

// --- Tests: helper functions ---

func TestIsNotFound(t *testing.T) {
	if !IsNotFound(ErrNotFound) {
		t.Error("expected IsNotFound(ErrNotFound)=true")
	}
	if IsNotFound(ErrBadRequest) {
		t.Error("expected IsNotFound(ErrBadRequest)=false")
	}
	if IsNotFound(nil) {
		t.Error("expected IsNotFound(nil)=false")
	}
}

func TestIsBadRequest(t *testing.T) {
	if !IsBadRequest(ErrBadRequest) {
		t.Error("expected IsBadRequest(ErrBadRequest)=true")
	}
	if IsBadRequest(ErrNotFound) {
		t.Error("expected IsBadRequest(ErrNotFound)=false")
	}
}

func TestIsLocked(t *testing.T) {
	if !IsLocked(ErrLocked) {
		t.Error("expected IsLocked(ErrLocked)=true")
	}
	if IsLocked(ErrNotFound) {
		t.Error("expected IsLocked(ErrNotFound)=false")
	}
}

func Test_calculateDiff(t *testing.T) {
	t.Run("included config", func(t *testing.T) {
		diff := calculateDiff(`{"a":1}`, `{"a":2}`, true)
		if len(diff) == 0 {
			t.Error("expected non-empty diff")
		}
	})

	t.Run("excluded config", func(t *testing.T) {
		diff := calculateDiff(`{"a":1}`, `{"a":2}`, false)
		if len(diff) != 0 {
			t.Errorf("expected empty diff, got %d", len(diff))
		}
	})

	t.Run("identical configs", func(t *testing.T) {
		diff := calculateDiff(`{"a":1}`, `{"a":1}`, true)
		if len(diff) != 0 {
			t.Errorf("expected empty diff for identical, got %d", len(diff))
		}
	})

	t.Run("invalid JSON handled gracefully", func(t *testing.T) {
		diff := calculateDiff(`{invalid}`, `{"a":1}`, true)
		// Should not panic, should produce diff
		_ = diff
	})
}

func Test_jsonMarshal(t *testing.T) {
	s := jsonMarshal(map[string]any{"key": "value"})
	if s == "" {
		t.Error("expected non-empty JSON string")
	}
}

func Test_buildDiffKeys(t *testing.T) {
	keys := buildDiffKeys(map[string]any{"a": 1, "b": 2})
	if len(keys) != 2 {
		t.Errorf("expected 2 keys, got %d", len(keys))
	}
}