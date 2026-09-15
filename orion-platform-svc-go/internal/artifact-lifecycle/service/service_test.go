package service

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/artifact-lifecycle/models"
)

// AdvanceStage passes a map with exactly one key, stage. The repository adds
// updated_at and sets only the columns the caller named, so this test is what
// keeps the advance statement free of a stage_status slot: models.AdvanceStageRequest
// deliberately has no status field, and inventing stage_status from stage here
// would turn the route into a write that claims the caller sent data it did not.
func TestAdvanceStage_SendsOnlyTheStageKey(t *testing.T) {
	repo := &recordingRepo{}
	_, err := NewService(repo).AdvanceStage(context.Background(), "t-1", "lc-1",
		models.AdvanceStageRequest{Stage: "deploy"})
	if err != nil {
		t.Fatalf("AdvanceStage: %v", err)
	}
	if repo.updates == nil {
		t.Fatal("AdvanceStage did not call the repository Update")
	}
	if len(repo.updates) != 1 {
		t.Fatalf("expected exactly 1 update key, got %v", repo.updates)
	}
	if repo.updates["stage"] != "deploy" {
		t.Fatalf("expected stage=deploy, got %v", repo.updates)
	}
	for _, key := range []string{"stage_status", "status", "id", "tenant_id"} {
		if _, ok := repo.updates[key]; ok {
			t.Fatalf("AdvanceStage sent %q, which the request body cannot express", key)
		}
	}
}

// Before the repository wrapped sql.ErrNoRows, every error from GetByID reached
// this branch. A driver error answered as "not found" on
// PUT /artifact-lifecycle/:id/stage, which is the difference between a missing
// row and a missing database.
func TestAdvanceStage_DriverErrorIsReturnedAsIs(t *testing.T) {
	outage := errors.New("connection refused")
	lc, err := NewService(&recordingRepo{getByIDErr: outage}).AdvanceStage(context.Background(),
		"t-1", "lc-1", models.AdvanceStageRequest{Stage: "deploy"})
	if err == nil {
		t.Fatal("expected an error")
	}
	if lc != nil {
		t.Fatalf("expected a nil record with an error, got %+v", lc)
	}
	if !errors.Is(err, outage) {
		t.Fatalf("driver error was replaced: %v", err)
	}
	if errors.Is(err, sentinel.NotFound) {
		t.Fatal("a driver error must not look like a missing row")
	}
}

func TestAdvanceStage_MissingRowReturnsNotFound(t *testing.T) {
	lc, err := NewService(&recordingRepo{getByIDErr: sentinel.NotFound}).AdvanceStage(context.Background(),
		"t-1", "lc-1", models.AdvanceStageRequest{Stage: "deploy"})
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("expected sentinel.NotFound, got %v", err)
	}
	if lc != nil {
		t.Fatalf("expected a nil record with an error, got %+v", lc)
	}
}

func TestDelete_DriverErrorIsReturnedAsIs(t *testing.T) {
	outage := errors.New("connection refused")
	err := NewService(&recordingRepo{getByIDErr: outage}).Delete(context.Background(), "t-1", "lc-1")
	if !errors.Is(err, outage) {
		t.Fatalf("driver error was replaced: %v", err)
	}
	if errors.Is(err, sentinel.NotFound) {
		t.Fatal("a driver error must not look like a missing row")
	}
}

func TestDelete_MissingRowReturnsNotFound(t *testing.T) {
	err := NewService(&recordingRepo{getByIDErr: sentinel.NotFound}).Delete(context.Background(), "t-1", "lc-1")
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("expected sentinel.NotFound, got %v", err)
	}
}

func TestDelete_DoesNotDeleteWhenTheRowIsGone(t *testing.T) {
	repo := &recordingRepo{getByIDErr: sentinel.NotFound}
	if err := NewService(repo).Delete(context.Background(), "t-1", "lc-1"); err == nil {
		t.Fatal("expected sentinel.NotFound")
	}
	if repo.deleted {
		t.Fatal("Delete ran the DELETE for a row GetByID could not find")
	}
}

func TestArchive_DriverErrorIsReturnedAsIs(t *testing.T) {
	outage := errors.New("connection refused")
	lc, err := NewService(&recordingRepo{getByIDErr: outage}).Archive(context.Background(), "t-1", "lc-1")
	if err == nil {
		t.Fatal("expected an error")
	}
	if lc != nil {
		t.Fatalf("expected a nil record with an error, got %+v", lc)
	}
	if !errors.Is(err, outage) {
		t.Fatalf("driver error was replaced: %v", err)
	}
}

// Create decides duplicate-vs-fresh by testing the repository error against
// sentinel.NotFound. Both branches are pinned here because the else branch is
// the one that created POST /artifact-lifecycle before the repository wrapped
// sql.ErrNoRows.
func TestCreate_ExistingLifecycleIsErrAlreadyExists(t *testing.T) {
	repo := &recordingRepo{existing: &models.ArtifactLifecycle{ID: "lc-1"}}
	lc, err := NewService(repo).Create(context.Background(), "t-1", models.CreateArtifactLifecycleRequest{
		ArtifactID: "art-1", Stage: "build", Status: "success",
	})
	if !errors.Is(err, ErrAlreadyExists) {
		t.Fatalf("expected ErrAlreadyExists, got %v", err)
	}
	if lc != nil {
		t.Fatalf("expected a nil record with an error, got %+v", lc)
	}
	if repo.created {
		t.Fatal("Create inserted a second lifecycle for the same artifact")
	}
}

func TestCreate_NoExistingLifecycleInserts(t *testing.T) {
	repo := &recordingRepo{getByArtifactIDErr: sentinel.NotFound}
	lc, err := NewService(repo).Create(context.Background(), "t-1", models.CreateArtifactLifecycleRequest{
		ArtifactID: "art-1", Stage: "build", Status: "success",
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if !repo.created {
		t.Fatal("Create did not insert")
	}
	if lc == nil || lc.ArtifactID != "art-1" || lc.Stage != "build" || lc.Status != "success" {
		t.Fatalf("got %+v", lc)
	}
	if lc.TenantID != "t-1" {
		t.Fatalf("tenant was not threaded through: %+v", lc)
	}
}

func TestCreate_DriverErrorIsReturnedAsIs(t *testing.T) {
	outage := errors.New("connection refused")
	lc, err := NewService(&recordingRepo{getByArtifactIDErr: outage}).Create(context.Background(),
		"t-1", models.CreateArtifactLifecycleRequest{ArtifactID: "art-1", Stage: "build", Status: "success"})
	if !errors.Is(err, outage) {
		t.Fatalf("driver error was replaced: %v", err)
	}
	if lc != nil {
		t.Fatalf("expected a nil record with an error, got %+v", lc)
	}
}

type recordingRepo struct {
	existing           *models.ArtifactLifecycle
	getByArtifactIDErr error
	getByIDErr         error
	updates            map[string]interface{}
	created            bool
	deleted            bool
}

func (r *recordingRepo) Archive(ctx context.Context, tenantID, id string) error { return nil }

func (r *recordingRepo) Count(ctx context.Context, tenantID string) (int, error) { return 0, nil }

func (r *recordingRepo) Create(ctx context.Context, lc *models.ArtifactLifecycle) error {
	r.created = true
	return nil
}

func (r *recordingRepo) Delete(ctx context.Context, tenantID, id string) error {
	r.deleted = true
	return nil
}

func (r *recordingRepo) GetByArtifactID(ctx context.Context, tenantID, artifactID string) (*models.ArtifactLifecycle, error) {
	if r.getByArtifactIDErr != nil {
		return nil, r.getByArtifactIDErr
	}
	if r.existing != nil {
		return r.existing, nil
	}
	return nil, sentinel.NotFound
}

func (r *recordingRepo) GetByID(ctx context.Context, tenantID, id string) (*models.ArtifactLifecycle, error) {
	if r.getByIDErr != nil {
		return nil, r.getByIDErr
	}
	return r.existing, nil
}

func (r *recordingRepo) GetStageHistory(ctx context.Context, tenantID, id string) ([]models.ArtifactLifecycle, error) {
	return nil, nil
}

func (r *recordingRepo) List(ctx context.Context, tenantID string, limit, offset int) ([]models.ArtifactLifecycle, error) {
	return nil, nil
}

func (r *recordingRepo) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	r.updates = updates
	return nil
}

var _ RepositoryInterface = (*recordingRepo)(nil)

// TestSource_NoTautologicalDisjunction guards the removal of IsNotFound, whose
// body was `errors.Is(err, sentinel.NotFound) || errors.Is(err, sentinel.NotFound)`
// -- both operands the same expression, so the whole function was identical to
// its left side and had no callers. Put the same expression twice in a
// disjunction again and this test says so.
func TestSource_NoTautologicalDisjunction(t *testing.T) {
	b, err := os.ReadFile("service.go")
	if err != nil {
		t.Fatalf("read service.go: %v", err)
	}
	if lines := scanLines(string(b)); len(lines) > 0 {
		t.Fatalf("service.go repeats one disjunct twice on line(s) %v", lines)
	}

	// Positive controls, in the shapes a body can take. The first version of this
	// detector only recognised a leading "return " or "if " at the start of a
	// line, so the one-line form of the same function escaped it and the mutation
	// survived.
	for _, body := range []string{
		"return errors.Is(err, sentinel.NotFound) || errors.Is(err, sentinel.NotFound)",
		"\tif errors.Is(err, sentinel.NotFound) || errors.Is(err, sentinel.NotFound) {",
		"func IsNotFound(err error) bool { return errors.Is(err, sentinel.NotFound) || errors.Is(err, sentinel.NotFound) }",
		"if errors.Is(err, sentinel.NotFound) || errors.Is(err, sentinel.NotFound) { return sentinel.NotFound }",
	} {
		if lines := scanLines(body); len(lines) != 1 {
			t.Fatalf("detector missed %q, got %v", body, lines)
		}
	}

	// Negative controls. Two genuinely different disjuncts, plus foo.bar || bar,
	// where bar is a field of foo rather than a second expression.
	for _, body := range []string{
		"if errors.Is(err, sentinel.NotFound) || errors.Is(err, sql.ErrNoRows) { return nil, err }",
		"x := errors.Is(err, sentinel.NotFound) || errors.Is(err, sql.ErrNoRows)",
		"done := foo.bar || bar",
		"done := foo.Bar() || Bar()",
	} {
		if lines := scanLines(body); len(lines) != 0 {
			t.Fatalf("detector flagged the non-tautology %q, got %v", body, lines)
		}
	}
}

// scanLines reports the lines where both operands of a || disjunction are the
// same expression. Each operand is recovered by walking out from the || until a
// delimiter or a top-level operator, so the detector does not depend on how the
// body is written: a bare return, an if, or the whole signature on one line.
func scanLines(src string) []int {
	out := []int{}
	for idx, line := range strings.Split(src, "\n") {
		for i := 0; ; {
			at := strings.Index(line[i:], "||")
			if at < 0 {
				break
			}
			pos := i + at
			i = pos + 2
			if leftOperand(line[:pos]) == rightOperand(line[pos+2:]) {
				out = append(out, idx)
			}
		}
	}
	return out
}

// identChar reports whether b can sit inside a Go expression: identifier
// characters, dots, delimiters and quotes. Anything else terminates an operand
// at the top level, which is what separates "return X" into "return" and "X".
func identChar(b byte) bool {
	if b >= 'a' && b <= 'z' || b >= 'A' && b <= 'Z' || b >= '0' && b <= '9' {
		return true
	}
	switch b {
	case '_', '.', '(', ')', '[', ']', '{', '}', '"', '\'', '`', '$':
		return true
	}
	return false
}

// leftOperand walks leftOperandText right-to-left from just before the ||.
func leftOperand(s string) string {
	s = strings.TrimRight(s, " \t")
	if s == "" {
		return ""
	}
	depth := 0
	start := len(s)
	for j := len(s) - 1; j >= 0; j-- {
		c := s[j]
		switch {
		case c == ')' || c == ']' || c == '}':
			depth++
		case c == '(' || c == '[' || c == '{':
			if depth == 0 {
				return strings.TrimSpace(s[j+1:])
			}
			depth--
		case depth == 0 && !identChar(c):
			return strings.TrimSpace(s[j+1:])
		}
		start = j
	}
	return strings.TrimSpace(s[start:])
}

// rightOperand walks rightOperandText left-to-right from just after the ||.
func rightOperand(s string) string {
	s = strings.TrimLeft(s, " \t")
	if s == "" {
		return ""
	}
	depth := 0
	end := 0
	for j := 0; j < len(s); j++ {
		c := s[j]
		switch {
		case c == '(' || c == '[' || c == '{':
			depth++
		case c == ')' || c == ']' || c == '}':
			if depth == 0 {
				return strings.TrimSpace(s[:j])
			}
			depth--
		case depth == 0 && !identChar(c):
			return strings.TrimSpace(s[:j])
		}
		end = j + 1
	}
	return strings.TrimSpace(s[:end])
}
