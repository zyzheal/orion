package service

import (
	"context"
	"testing"

	"go.uber.org/zap/zaptest"

	"orion/platform-svc-go/internal/schema-registry/models"
)

type fakeRepo struct {
	schemas  map[string]*models.Schema
	versions map[string][]*models.SchemaVersion
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		schemas:  make(map[string]*models.Schema),
		versions: make(map[string][]*models.SchemaVersion),
	}
}

func (r *fakeRepo) CreateSchema(_ context.Context, s *models.Schema) error {
	r.schemas[s.Namespace+":"+s.Name] = s
	return nil
}
func (r *fakeRepo) GetSchema(_ context.Context, ns, name string) (*models.Schema, error) {
	s, ok := r.schemas[ns+":"+name]
	if !ok {
		return nil, nil
	}
	return s, nil
}
func (r *fakeRepo) ListSchemas(_ context.Context, _ string) ([]*models.Schema, error) {
	out := make([]*models.Schema, 0, len(r.schemas))
	for _, s := range r.schemas {
		out = append(out, s)
	}
	return out, nil
}
func (r *fakeRepo) QuerySchemas(_ context.Context, q *models.QueryRequest) ([]*models.Schema, int, error) {
	out := make([]*models.Schema, 0, len(r.schemas))
	for _, s := range r.schemas {
		if q.Namespace != "" && s.Namespace != q.Namespace {
			continue
		}
		if q.Type != "" && s.Type != q.Type {
			continue
		}
		if q.Status != "" && s.Status != q.Status {
			continue
		}
		out = append(out, s)
	}
	return out, len(out), nil
}
func (r *fakeRepo) UpdateSchema(_ context.Context, s *models.Schema) error {
	r.schemas[s.Namespace+":"+s.Name] = s
	return nil
}
func (r *fakeRepo) DeleteSchema(_ context.Context, ns, name string) error {
	delete(r.schemas, ns+":"+name)
	return nil
}
func (r *fakeRepo) GetLatestVersion(_ context.Context, ns, name string) (int, error) {
	s, ok := r.schemas[ns+":"+name]
	if !ok {
		return 0, nil
	}
	return s.Version, nil
}
func (r *fakeRepo) AppendVersion(_ context.Context, ns, name string, v *models.SchemaVersion) error {
	r.versions[ns+":"+name] = append(r.versions[ns+":"+name], v)
	return nil
}
func (r *fakeRepo) GetVersionHistory(_ context.Context, ns, name string, limit int) ([]*models.SchemaVersion, error) {
	return r.versions[ns+":"+name], nil
}
func (r *fakeRepo) GetVersion(_ context.Context, ns, name string, _ int) (*models.SchemaVersion, error) {
	h, _ := r.GetVersionHistory(nil, ns, name, 0)
	for i := range h {
		if h[i].Version == 1 {
			return h[i], nil
		}
	}
	return nil, nil
}
func (r *fakeRepo) GetCompatibility(_ context.Context, ns, name string) (models.CompatibilityMode, error) {
	s, ok := r.schemas[ns+":"+name]
	if !ok {
		return "", nil
	}
	return s.Compatibility, nil
}

func makeBaseSchema() *models.Schema {
	return &models.Schema{
		Name: "user", Namespace: "app", Type: models.SchemaTypePostgreSQL,
		Version: 1, Status: models.SchemaActive, Compatibility: models.CompatibilityBackward,
		Fields: []models.SchemaField{
			{Name: "id", Type: "int8", PrimaryKey: true},
			{Name: "email", Type: "varchar(255)", Unique: true, Index: true},
			{Name: "name", Type: "varchar(128)", Nullable: true},
		},
	}
}

func TestEvolve_NoChange(t *testing.T) {
	svc := New(newFakeRepo(), zaptest.NewLogger(t))
	schema := makeBaseSchema()
	result := svc.Evolve(schema, schema.Fields, models.CompatibilityBackward)
	if result.Breaking {
		t.Error("no change should not be breaking")
	}
	if len(result.Changes) != 0 {
		t.Errorf("expected 0 changes, got %d", len(result.Changes))
	}
}

func TestEvolve_AddNullableField(t *testing.T) {
	svc := New(newFakeRepo(), zaptest.NewLogger(t))
	schema := makeBaseSchema()
	newFields := append(schema.Fields, models.SchemaField{Name: "phone", Type: "varchar(20)", Nullable: true})
	result := svc.Evolve(schema, newFields, models.CompatibilityBackward)
	if result.Breaking {
		t.Errorf("adding nullable field should be compatible, got worst=%s", result.WorstLevel)
	}
	if len(result.Changes) != 1 || result.Changes[0].Field != "phone" {
		t.Errorf("unexpected changes: %+v", result.Changes)
	}
}

func TestEvolve_AddNotNullNoDefault(t *testing.T) {
	svc := New(newFakeRepo(), zaptest.NewLogger(t))
	schema := makeBaseSchema()
	newFields := append(schema.Fields, models.SchemaField{Name: "ssn", Type: "varchar(11)"})
	result := svc.Evolve(schema, newFields, models.CompatibilityBackward)
	if !result.Breaking {
		t.Error("adding not-null field without default should be breaking")
	}
}

func TestEvolve_RemoveField(t *testing.T) {
	svc := New(newFakeRepo(), zaptest.NewLogger(t))
	schema := makeBaseSchema()
	// Remove "email" field.
	newFields := []models.SchemaField{{Name: "id", Type: "int8", PrimaryKey: true}, {Name: "name", Type: "varchar(128)"}}
	result := svc.Evolve(schema, newFields, models.CompatibilityBackward)
	if !result.Breaking {
		t.Error("removing field should be breaking in backward mode")
	}
	if result.WorstLevel != models.BreakingCritical {
		t.Errorf("expected critical, got %s", result.WorstLevel)
	}
}

func TestEvolve_TypeChange(t *testing.T) {
	svc := New(newFakeRepo(), zaptest.NewLogger(t))
	schema := makeBaseSchema()
	newFields := make([]models.SchemaField, len(schema.Fields))
	copy(newFields, schema.Fields)
	newFields[1].Type = "text"
	result := svc.Evolve(schema, newFields, models.CompatibilityBackward)
	found := false
	for _, c := range result.Changes {
		if c.Type == models.ChangeAlterField && c.Severity == models.BreakingCritical {
			found = true
		}
	}
	if !found {
		t.Error("expected critical type change")
	}
}

func TestEvolve_NullableToNotNull(t *testing.T) {
	svc := New(newFakeRepo(), zaptest.NewLogger(t))
	schema := makeBaseSchema()
	newFields := make([]models.SchemaField, len(schema.Fields))
	copy(newFields, schema.Fields)
	newFields[2].Nullable = false
	result := svc.Evolve(schema, newFields, models.CompatibilityBackward)
	if !result.Breaking {
		t.Error("nullable->not-null should be breaking")
	}
	if result.WorstLevel != models.BreakingMinor {
		t.Errorf("expected minor, got %s", result.WorstLevel)
	}
}

func TestEvolve_NotNullToNullable(t *testing.T) {
	svc := New(newFakeRepo(), zaptest.NewLogger(t))
	schema := makeBaseSchema()
	newFields := schema.Fields
	newFields[0].Nullable = true
	result := svc.Evolve(schema, newFields, models.CompatibilityBackward)
	if result.Breaking {
		t.Errorf("not-null->nullable should be compatible, got %s", result.WorstLevel)
	}
}

func TestEvolve_ForwardModeRemove(t *testing.T) {
	svc := New(newFakeRepo(), zaptest.NewLogger(t))
	schema := makeBaseSchema()
	newFields := []models.SchemaField{{Name: "id", Type: "int8", PrimaryKey: true}}
	result := svc.Evolve(schema, newFields, models.CompatibilityForward)
	if result.WorstLevel != models.BreakingMinor {
		t.Errorf("expected minor in forward mode, got %s", result.WorstLevel)
	}
}

func TestRegister_NewSchema(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	svc := New(repo, zaptest.NewLogger(t))

	req := &models.RegisterRequest{
		Name: "order", Namespace: "commerce", Type: models.SchemaTypePostgreSQL,
		Owner: "alice",
		Fields: []models.SchemaField{
			{Name: "id", Type: "int8", PrimaryKey: true},
			{Name: "total", Type: "numeric(12,2)"},
		},
		Compatibility: models.CompatibilityBackward,
	}
	resp, err := svc.Register(ctx, req)
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}
	if resp.Version != 1 {
		t.Errorf("expected version 1, got %d", resp.Version)
	}
	if resp.Schema.Name != "order" {
		t.Errorf("unexpected name: %s", resp.Schema.Name)
	}
}

func TestRegister_EvolveCompatible(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	svc := New(repo, zaptest.NewLogger(t))

	first := &models.RegisterRequest{
		Name: "user", Namespace: "app", Type: models.SchemaTypePostgreSQL,
		Owner: "alice",
		Fields: []models.SchemaField{
			{Name: "id", Type: "int8", PrimaryKey: true},
			{Name: "name", Type: "varchar(128)", Nullable: true},
		},
	}
	_, err := svc.Register(ctx, first)
	if err != nil {
		t.Fatalf("first register: %v", err)
	}

	second := &models.RegisterRequest{
		Name: "user", Namespace: "app", Type: models.SchemaTypePostgreSQL,
		Owner: "bob",
		Fields: []models.SchemaField{
			{Name: "id", Type: "int8", PrimaryKey: true},
			{Name: "name", Type: "varchar(128)", Nullable: true},
			{Name: "phone", Type: "varchar(20)", Nullable: true},
		},
	}
	resp, err := svc.Register(ctx, second)
	if err != nil {
		t.Fatalf("evolve register: %v", err)
	}
	if resp.Version != 2 {
		t.Errorf("expected version 2, got %d", resp.Version)
	}
}

func TestRegister_EvolveBreaking(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	svc := New(repo, zaptest.NewLogger(t))

	first := &models.RegisterRequest{
		Name: "product", Namespace: "shop", Type: models.SchemaTypePostgreSQL,
		Owner: "alice",
		Fields: []models.SchemaField{
			{Name: "id", Type: "int8", PrimaryKey: true},
			{Name: "sku", Type: "varchar(32)"},
		},
	}
	_, _ = svc.Register(ctx, first)

	second := &models.RegisterRequest{
		Name: "product", Namespace: "shop", Type: models.SchemaTypePostgreSQL,
		Owner: "bob",
		Fields: []models.SchemaField{
			{Name: "id", Type: "int8", PrimaryKey: true},
		},
	}
	_, err := svc.Register(ctx, second)
	if err == nil {
		t.Error("expected breaking change error")
	}
}

func TestLookup_NotFound(t *testing.T) {
	ctx := context.Background()
	svc := New(newFakeRepo(), zaptest.NewLogger(t))
	_, err := svc.Lookup(ctx, "ns", "missing")
	if err == nil {
		t.Error("expected error for missing schema")
	}
}

func TestLookup_Found(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	svc := New(repo, zaptest.NewLogger(t))
	req := &models.RegisterRequest{
		Name: "x", Namespace: "n", Type: models.SchemaTypeJSON,
		Owner: "o", Fields: []models.SchemaField{{Name: "id", Type: "int", PrimaryKey: true}},
	}
	_, _ = svc.Register(ctx, req)
	s, err := svc.Lookup(ctx, "n", "x")
	if err != nil {
		t.Fatalf("Lookup: %v", err)
	}
	if s.Name != "x" {
		t.Errorf("unexpected name: %s", s.Name)
	}
}

func TestList_Filters(t *testing.T) {
	ctx := context.Background()
	repo := newFakeRepo()
	svc := New(repo, zaptest.NewLogger(t))

	svc.Register(ctx, &models.RegisterRequest{Name: "a", Namespace: "ns", Type: models.SchemaTypePostgreSQL,
		Owner: "o", Fields: []models.SchemaField{{Name: "id", Type: "int", PrimaryKey: true}}})
	svc.Register(ctx, &models.RegisterRequest{Name: "b", Namespace: "ns", Type: models.SchemaTypeAvro,
		Owner: "o", Fields: []models.SchemaField{{Name: "id", Type: "long", PrimaryKey: true}}})

	resp, err := svc.List(ctx, &models.QueryRequest{Namespace: "ns", Type: models.SchemaTypePostgreSQL})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if resp.Total != 1 {
		t.Errorf("expected 1, got %d", resp.Total)
	}
}

func TestValidateFields_RequiresPK(t *testing.T) {
	svc := New(newFakeRepo(), zaptest.NewLogger(t))
	errors := svc.ValidateFields([]models.SchemaField{{Name: "a", Type: "int"}})
	if len(errors) == 0 {
		t.Error("expected validation error for missing PK")
	}
}

func TestValidateFields_DuplicateName(t *testing.T) {
	svc := New(newFakeRepo(), zaptest.NewLogger(t))
	errors := svc.ValidateFields([]models.SchemaField{
		{Name: "id", Type: "int", PrimaryKey: true},
		{Name: "id", Type: "text"},
	})
	if len(errors) == 0 {
		t.Error("expected duplicate name error")
	}
}
