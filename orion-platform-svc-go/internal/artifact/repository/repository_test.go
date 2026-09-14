package repository

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/artifact/models"
)

const (
	tenant     = "tenant-alpha"
	artifactID = "artifact-1"
)

func norm(s string) string {
	return strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(s, " "))
}

// newMock matches expected SQL on exact whitespace-normalised text.
//
// go-sqlmock's default QueryMatcherRegexp treats a $ in the expected text as an
// end-of-string anchor, so an expectation containing $1 could never match and a
// test would pass vacuously. Every expectation below pins placeholder numbers,
// so exact matching is required for the tests to mean anything.
func newMock(t *testing.T) (*Repository, sqlmock.Sqlmock) {
	t.Helper()
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		if norm(expected) == norm(actual) {
			return nil
		}
		return fmt.Errorf("sql mismatch:\n  expected: %s\n     actual: %s", norm(expected), norm(actual))
	})))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return NewRepository(sqlx.NewDb(raw, "postgres")), mock
}

// newCapturingMock behaves like newMock but records every statement text that
// reaches the driver, so a test can assert on what the database actually saw.
func newCapturingMock(t *testing.T, sink *string) (*Repository, sqlmock.Sqlmock) {
	t.Helper()
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		*sink = actual
		if norm(expected) == norm(actual) {
			return nil
		}
		return fmt.Errorf("sql mismatch:\n  expected: %s\n     actual: %s", norm(expected), norm(actual))
	})))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return NewRepository(sqlx.NewDb(raw, "postgres")), mock
}

// noPlaceholderReuse fails if a single $N appears twice in one statement.
//
// That is the failure mode of the old Update, which mixed a named-arg map with
// positional placeholders: sqlx reused the numbers, the driver saw
//
//	UPDATE artifacts SET status = $1 ... WHERE id=$1 AND tenant_id=$2
//
// so $1 held the status string, the WHERE clause could never match, 0 rows were
// affected and the caller got a nil error -- a silent no-op that answered 200.
func noPlaceholderReuse(t *testing.T, statement string) {
	t.Helper()
	seen := map[string]bool{}
	for _, p := range regexp.MustCompile(`\$\d+`).FindAllString(statement, -1) {
		if seen[p] {
			t.Fatalf("statement %q reuses %s", statement, p)
		}
		seen[p] = true
	}
}

func requireNoError(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// --- Update ---

const (
	updateStatement = "UPDATE artifacts SET metadata=$1, status=$2, updated_at=NOW() WHERE id=$3 AND tenant_id=$4 AND deleted_at IS NULL"
	metadataArg     = `{"arch":"amd64"}`
)

func TestUpdate_DriverInputReusesNoPlaceholder(t *testing.T) {
	// Assert on the statement the driver actually received, not on the expected
	// text pinned above, so a mutation cannot pass by editing both sides.
	captured := ""
	repo, mock := newCapturingMock(t, &captured)
	mock.ExpectExec(updateStatement).
		WithArgs(metadataArg, models.StatusAvailable, artifactID, tenant).
		WillReturnResult(sqlmock.NewResult(0, 1))

	requireNoError(t, repo.Update(context.Background(), tenant, artifactID, map[string]interface{}{
		"metadata": metadataArg,
		"status":   models.StatusAvailable,
	}))
	noPlaceholderReuse(t, captured)
	requireNoError(t, mock.ExpectationsWereMet())
}

func TestUpdate_RendersDistinctPositionalPlaceholders(t *testing.T) {
	noPlaceholderReuse(t, updateStatement)

	repo, mock := newMock(t)
	metadata := `{"arch":"amd64"}`
	mock.ExpectExec(updateStatement).
		WithArgs(metadata, models.StatusAvailable, artifactID, tenant).
		WillReturnResult(sqlmock.NewResult(0, 1))

	// The map order must not matter: Update sorts the column list.
	err := repo.Update(context.Background(), tenant, artifactID, map[string]interface{}{
		"status":   models.StatusAvailable,
		"metadata": metadata,
	})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	requireNoError(t, mock.ExpectationsWereMet())
}

func TestUpdate_RejectsColumnsOutsideTheWhitelist(t *testing.T) {
	repo, mock := newMock(t)
	err := repo.Update(context.Background(), tenant, artifactID, map[string]interface{}{
		"deleted_at": time.Now().UTC(),
	})
	if !errors.Is(err, sentinel.BadRequest) {
		t.Fatalf("expected sentinel.BadRequest, got %v", err)
	}
	requireNoError(t, mock.ExpectationsWereMet())
}

func TestUpdate_EmptyUpdateIsANoop(t *testing.T) {
	repo, mock := newMock(t)
	if err := repo.Update(context.Background(), tenant, artifactID, nil); err != nil {
		t.Fatalf("Update(nil): %v", err)
	}
	requireNoError(t, mock.ExpectationsWereMet())
}

func TestUpdate_NoMatchingRowReportsNotFound(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec("UPDATE artifacts SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3 AND deleted_at IS NULL").
		WithArgs("DEPRECATED", artifactID, tenant).
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := repo.Update(context.Background(), tenant, artifactID, map[string]interface{}{
		"status": "DEPRECATED",
	})
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("expected sentinel.NotFound for a foreign or missing id, got %v", err)
	}
	requireNoError(t, mock.ExpectationsWereMet())
}

// --- Delete / GetByID ---

func TestSoftDelete_NoMatchingRowReportsNotFound(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec("UPDATE artifacts SET deleted_at=NOW() WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL").
		WithArgs(tenant, artifactID).
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := repo.SoftDelete(context.Background(), tenant, artifactID)
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("expected sentinel.NotFound, got %v", err)
	}
	requireNoError(t, mock.ExpectationsWereMet())
}

func TestSoftDelete_DeletesTheRow(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec("UPDATE artifacts SET deleted_at=NOW() WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL").
		WithArgs(tenant, artifactID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	requireNoError(t, repo.SoftDelete(context.Background(), tenant, artifactID))
	requireNoError(t, mock.ExpectationsWereMet())
}

func TestGetByID_NoRowsReportsNotFound(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery("SELECT "+artifactColumns+" FROM artifacts WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL").
		WithArgs(tenant, artifactID).
		WillReturnRows(sqlmock.NewRows([]string{}))

	_, err := repo.GetByID(context.Background(), tenant, artifactID)
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("expected sentinel.NotFound, got %v", err)
	}
}

func TestGetByID_DoesNotDecodeUnmappedColumns(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery("SELECT "+artifactColumns+" FROM artifacts WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL").
		WithArgs(tenant, artifactID).
		WillReturnRows(sqlmock.NewRows(strings.Split(artifactColumns, ", ")).
			AddRow(artifactID, tenant, "redis", "libs", "7.2", "CONTAINER_IMAGE", "AVAILABLE",
				int64(42), "abc", "def", "{}", "/s3/redis", "user-1",
				time.Now().UTC(), time.Now().UTC(), (*time.Time)(nil)))

	got, err := repo.GetByID(context.Background(), tenant, artifactID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if got.TenantID != tenant {
		t.Fatalf("TenantID = %q, want %q", got.TenantID, tenant)
	}
}

// --- Create ---

func TestCreate_DefaultsMetadataToEmptyJSON(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(`INSERT INTO artifacts
		(id, tenant_id, name, namespace, version, type, status, size_bytes,
		 checksum_sha256, checksum_sha512, metadata, storage_path,
		 created_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`).
		WithArgs(sqlmock.AnyArg(), tenant, "redis", "libs", "7.2", "CONTAINER_IMAGE",
			models.StatusAvailable, int64(42), sqlmock.AnyArg(), sqlmock.AnyArg(), "{}",
			"/s3/redis", "user-1", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	// metadata is a JSONB column: an empty string is rejected by Postgres, so a
	// POST without metadata must default to an empty object.
	m := &models.Artifact{TenantID: tenant, Name: "redis", Namespace: "libs", Version: "7.2",
		Type: "CONTAINER_IMAGE", Status: models.StatusAvailable,
		SizeBytes: 42, StoragePath: "/s3/redis", CreatedBy: "user-1"}
	requireNoError(t, repo.Create(context.Background(), m))
	if m.Metadata != "{}" {
		t.Fatalf("Metadata = %q, want {}", m.Metadata)
	}
	requireNoError(t, mock.ExpectationsWereMet())
}

// --- Tags ---

const addTagStatement = "INSERT INTO artifact_tags (id, tenant_id, artifact_id, tag, created_at) SELECT $1, $2, $3, $4, NOW() WHERE NOT EXISTS ( SELECT 1 FROM artifact_tags WHERE tenant_id=$2 AND artifact_id=$3 AND tag=$4 )"

func TestAddTags_BindsTenantAndSkipsDuplicates(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(addTagStatement).
		WithArgs(sqlmock.AnyArg(), tenant, artifactID, "latest").
		WillReturnResult(sqlmock.NewResult(0, 1))

	requireNoError(t, repo.AddTags(context.Background(), tenant, artifactID, []string{"latest"}))
	requireNoError(t, mock.ExpectationsWereMet())
}

func TestAddTags_SecondTagGetsItsOwnStatement(t *testing.T) {
	repo, mock := newMock(t)
	for _, tag := range []string{"v1", "v2"} {
		mock.ExpectExec(addTagStatement).
			WithArgs(sqlmock.AnyArg(), tenant, artifactID, tag).
			WillReturnResult(sqlmock.NewResult(0, 1))
	}
	requireNoError(t, repo.AddTags(context.Background(), tenant, artifactID, []string{"v1", "v2"}))
	requireNoError(t, mock.ExpectationsWereMet())
}

func TestRemoveTags_BoundsTenant(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec("DELETE FROM artifact_tags WHERE tenant_id=$1 AND artifact_id=$2 AND tag=$3").
		WithArgs(tenant, artifactID, "latest").
		WillReturnResult(sqlmock.NewResult(0, 1))
	requireNoError(t, repo.RemoveTags(context.Background(), tenant, artifactID, []string{"latest"}))
	requireNoError(t, mock.ExpectationsWereMet())
}

func TestGetTags_BoundsTenant(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery("SELECT tag FROM artifact_tags WHERE tenant_id=$1 AND artifact_id=$2 ORDER BY created_at DESC").
		WithArgs(tenant, artifactID).
		WillReturnRows(sqlmock.NewRows([]string{"tag"}).AddRow("latest").AddRow("v1"))

	tags, err := repo.GetTags(context.Background(), tenant, artifactID)
	if err != nil {
		t.Fatalf("GetTags: %v", err)
	}
	if len(tags) != 2 || tags[0] != "latest" {
		t.Fatalf("tags = %v", tags)
	}
	requireNoError(t, mock.ExpectationsWereMet())
}

// --- Downloads ---

func TestRecordDownload_BindsTenant(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec("INSERT INTO artifact_downloads (id, tenant_id, artifact_id, downloaded_by, downloaded_at, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6, $7)").
		WithArgs(sqlmock.AnyArg(), tenant, artifactID, "user-1", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	req := models.DownloadArtifactRequest{DownloadedBy: "user-1"}
	requireNoError(t, repo.RecordDownload(context.Background(), tenant, artifactID, req))
	requireNoError(t, mock.ExpectationsWereMet())
}

func TestGetDownloadHistory_BoundsTenant(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery("SELECT "+downloadColumns+" FROM artifact_downloads WHERE tenant_id=$1 AND artifact_id=$2 ORDER BY downloaded_at DESC LIMIT 100").
		WithArgs(tenant, artifactID).
		WillReturnRows(sqlmock.NewRows(strings.Split(downloadColumns, ", ")).
			AddRow("d-1", tenant, artifactID, "user-1", time.Now().UTC(), nil, nil))

	got, err := repo.GetDownloadHistory(context.Background(), tenant, artifactID)
	if err != nil {
		t.Fatalf("GetDownloadHistory: %v", err)
	}
	if len(got) != 1 || got[0].TenantID != tenant {
		t.Fatalf("history = %+v", got)
	}
	requireNoError(t, mock.ExpectationsWereMet())
}

// --- Search / List pagination ---

func TestList_CapsLimitAndClampsNegativeOffset(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery("SELECT "+artifactColumns+" FROM artifacts WHERE tenant_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $3 OFFSET $4").
		WithArgs(tenant, maxLimit, 0).
		WillReturnRows(sqlmock.NewRows([]string{}))

	_, err := repo.List(context.Background(), tenant, models.ListArtifactsQuery{Limit: 1000000, Offset: -7})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	requireNoError(t, mock.ExpectationsWereMet())
}

func TestList_DefaultsLimit(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery("SELECT "+artifactColumns+" FROM artifacts WHERE tenant_id=$1 AND deleted_at IS NULL AND namespace=$2 ORDER BY created_at DESC LIMIT $4 OFFSET $5").
		WithArgs(tenant, "libs", defaultLimit, 0).
		WillReturnRows(sqlmock.NewRows([]string{}))

	_, err := repo.List(context.Background(), tenant, models.ListArtifactsQuery{Namespace: "libs"})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	requireNoError(t, mock.ExpectationsWereMet())
}

func TestCount_UsesTheSameFilterPredicate(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery("SELECT COUNT(*) FROM artifacts WHERE tenant_id=$1 AND deleted_at IS NULL").
		WithArgs(tenant).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(9))

	n, err := repo.Count(context.Background(), tenant, models.ListArtifactsQuery{})
	if err != nil {
		t.Fatalf("Count: %v", err)
	}
	if n != 9 {
		t.Fatalf("Count = %d, want 9", n)
	}
}

func TestSearch_BoundsTenantAndCapsLimit(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery("SELECT "+artifactColumns+" FROM artifacts WHERE tenant_id=$1 AND deleted_at IS NULL AND (name ILIKE $2 OR namespace ILIKE $2 OR version ILIKE $2) ORDER BY created_at DESC LIMIT $3 OFFSET $4").
		WithArgs(tenant, "%widget%", maxLimit, 0).
		WillReturnRows(sqlmock.NewRows([]string{}))

	_, err := repo.Search(context.Background(), tenant, "widget", 1000000, -3)
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	requireNoError(t, mock.ExpectationsWereMet())
}

// --- Stats ---

func TestGetStats_ScansAggregatesIntoTheModel(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery("SELECT COUNT(*) AS total, COALESCE(SUM(size_bytes), 0) AS total_size_bytes FROM artifacts WHERE tenant_id=$1 AND deleted_at IS NULL").
		WithArgs(tenant).
		WillReturnRows(sqlmock.NewRows([]string{"total", "total_size_bytes"}).AddRow(3, int64(1024)))
	mock.ExpectQuery("SELECT type AS bucket, COUNT(*) AS count FROM artifacts WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY type").
		WithArgs(tenant).
		WillReturnRows(sqlmock.NewRows([]string{"bucket", "count"}).AddRow("CONTAINER_IMAGE", 2).AddRow("JAR", 1))
	mock.ExpectQuery("SELECT status AS bucket, COUNT(*) AS count FROM artifacts WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY status").
		WithArgs(tenant).
		WillReturnRows(sqlmock.NewRows([]string{"bucket", "count"}).AddRow("AVAILABLE", 3))

	stats, err := repo.GetStats(context.Background(), tenant)
	if err != nil {
		t.Fatalf("GetStats: %v", err)
	}
	if stats.Total != 3 || stats.TotalSize != 1024 {
		t.Fatalf("stats = %+v", stats)
	}
	if stats.ByType["CONTAINER_IMAGE"] != 2 || stats.ByType["JAR"] != 1 {
		t.Fatalf("ByType = %v", stats.ByType)
	}
	if stats.ByStatus["AVAILABLE"] != 3 {
		t.Fatalf("ByStatus = %v", stats.ByStatus)
	}
	requireNoError(t, mock.ExpectationsWereMet())
}

func TestGetTypeStats_ScansIntoTheModel(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery("SELECT type AS type, COUNT(*) AS count, COALESCE(SUM(size_bytes), 0) AS size FROM artifacts WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY type").
		WithArgs(tenant).
		WillReturnRows(sqlmock.NewRows([]string{"type", "count", "size"}).AddRow("JAR", 5, int64(2048)))

	got, err := repo.GetTypeStats(context.Background(), tenant)
	if err != nil {
		t.Fatalf("GetTypeStats: %v", err)
	}
	if len(got) != 1 || got[0].Type != "JAR" || got[0].Count != 5 || got[0].Size != 2048 {
		t.Fatalf("GetTypeStats = %+v", got)
	}
}

func TestGetNamespaces_ScansIntoTheModel(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery("SELECT namespace, COUNT(*) AS count FROM artifacts WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY namespace").
		WithArgs(tenant).
		WillReturnRows(sqlmock.NewRows([]string{"namespace", "count"}).AddRow("libs", 4))

	got, err := repo.GetNamespaces(context.Background(), tenant)
	if err != nil {
		t.Fatalf("GetNamespaces: %v", err)
	}
	if len(got) != 1 || got[0].Namespace != "libs" || got[0].Count != 4 {
		t.Fatalf("GetNamespaces = %+v", got)
	}
}

// --- Promotions ---

func TestGetPromotionHistory_BoundsTenant(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery("SELECT "+promotionColumns+" FROM artifact_promotions WHERE tenant_id=$1 AND artifact_id=$2 ORDER BY created_at DESC").
		WithArgs(tenant, artifactID).
		WillReturnRows(sqlmock.NewRows(strings.Split(promotionColumns, ", ")).
			AddRow("p-1", tenant, artifactID, "staging", "production", "user-1", nil, "sign-off", time.Now().UTC()))

	got, err := repo.GetPromotionHistory(context.Background(), tenant, artifactID)
	if err != nil {
		t.Fatalf("GetPromotionHistory: %v", err)
	}
	if len(got) != 1 || got[0].ToStage != "production" || got[0].TenantID != tenant {
		t.Fatalf("history = %+v", got)
	}
	requireNoError(t, mock.ExpectationsWereMet())
}

func TestGetCurrentStage_ReturnsEmptyWithoutAnError(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery("SELECT to_stage FROM artifact_promotions WHERE tenant_id=$1 AND artifact_id=$2 ORDER BY created_at DESC LIMIT 1").
		WithArgs(tenant, artifactID).
		WillReturnRows(sqlmock.NewRows([]string{"to_stage"}))

	stage, err := repo.GetCurrentStage(context.Background(), tenant, artifactID)
	if err != nil {
		t.Fatalf("GetCurrentStage: %v", err)
	}
	if stage != "" {
		t.Fatalf("stage = %q, want empty", stage)
	}
}

func TestCreatePromotion_BoundsTenant(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec("INSERT INTO artifact_promotions (id, tenant_id, artifact_id, from_stage, to_stage, promoted_by, approved_by, reason, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)").
		WithArgs(sqlmock.AnyArg(), tenant, artifactID, "staging", "production",
			"user-1", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	requireNoError(t, repo.CreatePromotion(context.Background(), &models.ArtifactPromotion{
		TenantID: tenant, ArtifactID: artifactID, FromStage: "staging", ToStage: "production", PromotedBy: "user-1",
	}))
	requireNoError(t, mock.ExpectationsWereMet())
}

// --- Structural guards ---

func TestNoArtifactStatementUsesSelectStar(t *testing.T) {
	src := mustRead(t, "repository.go")
	for _, frag := range sqlFragments(src) {
		if strings.Contains(frag, "SELECT *") {
			t.Fatalf("SELECT * in %s: sqlx runs in safe mode, so any column a migration adds "+
				"later aborts every read with 'missing destination name <col>'", norm(frag))
		}
	}
}

func TestNoArtifactStatementUsesOnConflict(t *testing.T) {
	src := mustRead(t, "repository.go")
	for _, frag := range sqlFragments(src) {
		if strings.Contains(frag, "ON CONFLICT") {
			t.Fatalf("ON CONFLICT in %s: artifact_tags has no unique constraint on "+
				"(artifact_id, tag), so Postgres rejects the statement", norm(frag))
		}
	}
}

// TestEveryArtifactStatementMentionsTenant fails if a statement touches one of
// the four artifact tables without binding tenant_id. Every table is shared by
// all tenants, so an unscoped read leaks one tenant another tenant's data.
func TestEveryArtifactStatementMentionsTenant(t *testing.T) {
	src := mustRead(t, "repository.go")
	tables := []string{"artifacts", "artifact_tags", "artifact_downloads", "artifact_promotions"}
	// listWhere renders the shared predicate, so the statements built from it bind
	// tenant_id through that helper instead of spelling it out. Pin it there.
	if !strings.Contains(src, `"tenant_id=$1"`) {
		t.Fatal("listWhere no longer binds tenant_id as $1")
	}
	for _, frag := range sqlFragments(src) {
		if strings.Contains(frag, "%") {
			continue // rendered by fmt.Sprintf from the helpers above
		}
		if !strings.Contains(frag, "tenant_id") {
			for _, table := range tables {
				if regexp.MustCompile(`\b` + table + `\b`).MatchString(frag) {
					t.Errorf("statement about %s does not bind tenant_id: %s", table, norm(frag))
				}
			}
		}
	}
}

// TestColumnConstantsExistInMigration pins the column lists against the DDL. If
// a column is renamed or dropped the scan fails at test time instead of at
// request time.
func TestColumnConstantsExistInMigration(t *testing.T) {
	var ddl strings.Builder
	for _, f := range []string{
		"012_create_artifact_tables.sql",
		"570_add_foreign_keys.sql",
		"572_add_audit_columns.sql",
	} {
		b, err := os.ReadFile(filepath.Join("..", "..", "..", "migrations", f))
		if err != nil {
			t.Skipf("migration unavailable: %v", err)
		}
		ddl.Write(b)
	}
	for _, cols := range []string{artifactColumns, downloadColumns, promotionColumns} {
		for _, col := range strings.Split(cols, ",") {
			col = strings.TrimSpace(col)
			if !strings.Contains(ddl.String(), col) {
				t.Errorf("column %q is selected but never created in the migrations", col)
			}
		}
	}
}

func sqlFragments(src string) []string {
	out := []string{}
	for _, frag := range regexp.MustCompile("`[^`]+`").FindAllString(src, -1) {
		out = append(out, strings.Trim(frag, "`"))
	}
	return out
}

func mustRead(t *testing.T, file string) string {
	t.Helper()
	b, err := os.ReadFile(file)
	if err != nil {
		t.Fatalf("reading %s: %v", file, err)
	}
	return string(b)
}
