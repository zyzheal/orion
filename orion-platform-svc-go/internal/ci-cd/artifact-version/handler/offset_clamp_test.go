package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"

	"orion/platform-svc-go/internal/ci-cd/artifact-version/repository"
	"orion/platform-svc-go/internal/ci-cd/artifact-version/service"
)

// ListVersions read `offset` straight from the query string and forwarded it to
// the repository, which clamps `limit <= 0 || limit > 100` to 50 but never
// offset and binds it into `OFFSET $n`. `?offset=-40` reached Postgres as a
// negative OFFSET, which Postgres rejects with an error instead of data — a GET
// turned into a 500. The bound arguments are pinned with WithArgs so the test
// fails on the value actually handed to the database.
func TestListVersions_NegativeOffsetIsClamped(t *testing.T) {
	h, mock := newVersionHandler(t)
	mock.ExpectQuery(`COUNT`).WillReturnRows(sqlmock.NewRows([]string{"n"}).AddRow(0))
	mock.ExpectQuery(`FROM artifact_versions WHERE`).
		WithArgs("tenant-1", 50, 0).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))
	c, w := versionCtx("/?offset=-40")
	h.ListVersions(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("offset was not clamped before binding: %v", err)
	}
}

// A valid offset must pass through untouched: the clamp is a floor, not a cap.
func TestListVersions_ValidOffsetUnchanged(t *testing.T) {
	h, mock := newVersionHandler(t)
	mock.ExpectQuery(`COUNT`).WillReturnRows(sqlmock.NewRows([]string{"n"}).AddRow(0))
	mock.ExpectQuery(`FROM artifact_versions WHERE`).
		WithArgs("tenant-1", 25, 60).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))
	c, w := versionCtx("/?offset=60&limit=25")
	h.ListVersions(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", w.Code, w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("a valid offset must be forwarded unchanged: %v", err)
	}
}

func newVersionHandler(t *testing.T) (*ArtifactVersionHandler, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	repo := repository.NewArtifactVersionRepository(sqlx.NewDb(db, "postgres"))
	return NewArtifactVersionHandler(service.NewArtifactVersionServiceWithRepo(repo, zap.NewNop())), mock
}

func versionCtx(path string) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenantId", "tenant-1")
	c.Request = httptest.NewRequest(http.MethodGet, path, nil)
	return c, w
}
