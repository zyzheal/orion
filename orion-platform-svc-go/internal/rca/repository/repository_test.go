package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"

	"orion/platform-svc-go/internal/rca/models"
)

// Repository tests drive the real repository over sqlmock so they pin the exact
// SQL text, the argument order, and the column mapping. That is where the RCA
// defects lived:
//
//   - UPDATE rca_analyses was keyed on id alone, so one tenant could overwrite
//     another tenant's analysis;
//   - GetAnalysis scanned root_causes and completed_at out of the same SELECT
//     list sqlx had no field to put them in, so the endpoint failed on every
//     request;
//   - GetFixSuggestionsByRootCauseID took a tenantID it never bound, on a table
//     that has no tenant column; and CreateTimelineEvent INSERTed a created_at
//     column that does not exist. Both are deleted.

var (
	tenant     = uuid.MustParse("11111111-1111-1111-1111-111111111111")
	analysisID = uuid.MustParse("22222222-2222-2222-2222-222222222222")
)

const cols = "id, tenant_id, incident_id, status, root_causes, confidence, triggered_by, started_at, completed_at"

// normalize collapses whitespace so an expected statement can be written on one
// line even though the repository formats some of them across several.
func normalize(s string) string {
	return strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(s, " "))
}

type sqlMismatch struct{ expected, actual string }

func (m *sqlMismatch) Error() string {
	return "sql mismatch:\n  expected: " + m.expected + "\n     actual: " + m.actual
}

func newMock(t *testing.T) (*RCARespository, sqlmock.Sqlmock) {
	t.Helper()
	t.Helper()
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		if normalize(expected) == normalize(actual) {
			return nil
		}
		return &sqlMismatch{expected: normalize(expected), actual: normalize(actual)}
	})))
	if err != nil {
		t.Fatalf("sqlmock.New() error = %v", err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return NewRCARespository(sqlx.NewDb(raw, "postgres"), zap.NewNop()), mock
}

func rows9(owner uuid.UUID, incidentID string, rootCauses string, completedAt time.Time, valid bool) *sqlmock.Rows {
	rows := sqlmock.NewRows([]string{
		"id", "tenant_id", "incident_id", "status", "root_causes",
		"confidence", "triggered_by", "started_at", "completed_at",
	})
	var ca any
	if valid {
		ca = completedAt
	}
	return rows.AddRow(
		analysisID, owner, incidentID, "completed", rootCauses, 0.8, "u-1", time.Now().UTC(), ca,
	)
}

func TestCreateAnalysisBindsCallerTenant(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(`INSERT INTO rca_analyses (id, tenant_id, incident_id, status, root_causes, confidence, triggered_by, started_at, completed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`).
		WithArgs(sqlmock.AnyArg(), tenant, "inc-1", "running", "[]", 0.0, "u-1", sqlmock.AnyArg(), nil).
		WillReturnResult(sqlmock.NewResult(0, 1))

	got, err := repo.CreateAnalysis(context.Background(), tenant, "inc-1", "u-1")
	if err != nil {
		t.Fatalf("CreateAnalysis() error = %v", err)
	}
	if got.TenantID != tenant || got.TriggeredBy != "u-1" {
		t.Fatalf("CreateAnalysis() = %+v, want tenant %s / triggered_by u-1", got, tenant)
	}
	if got.Status != "running" || got.IncidentID != "inc-1" {
		t.Fatalf("CreateAnalysis() = %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// wantRootCauseJSON is the exact bytes UpdateAnalysis writes to root_causes for
// the fixture below. Pinning it proves the root causes really reach the column
// instead of being silently dropped as they were for the incident window.
func wantRootCauseJSON(t *testing.T) string {
	t.Helper()
	b, err := json.Marshal([]models.RootCause{{Category: "performance", Priority: 1}})
	if err != nil {
		t.Fatalf("marshal fixture: %v", err)
	}
	return string(b)
}

func TestUpdateAnalysisIsTenantScoped(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(`UPDATE rca_analyses SET status=$1, root_causes=$2, confidence=$3, completed_at=$4 WHERE id=$5 AND tenant_id=$6`).
		WithArgs("completed", wantRootCauseJSON(t), 0.5, sqlmock.AnyArg(), analysisID, tenant).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.UpdateAnalysis(context.Background(), tenant, analysisID, "completed", []models.RootCause{{Category: "performance", Priority: 1}}, 0.5)
	if err != nil {
		t.Fatalf("UpdateAnalysis() error = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestUpdateAnalysisRunningLeavesCompletedAtNull(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(`UPDATE rca_analyses SET status=$1, root_causes=$2, confidence=$3, completed_at=$4 WHERE id=$5 AND tenant_id=$6`).
		WithArgs("running", "[]", 0.0, nil, analysisID, tenant).
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.UpdateAnalysis(context.Background(), tenant, analysisID, "running", []models.RootCause{}, 0.0); err != nil {
		t.Fatalf("UpdateAnalysis() error = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestGetAnalysisIsTenantScopedAndMapsEveryColumn(t *testing.T) {
	repo, mock := newMock(t)
	done := time.Date(2026, 8, 26, 10, 0, 0, 0, time.UTC)
	mock.ExpectQuery(`SELECT `+cols+` FROM rca_analyses WHERE id = $1 AND tenant_id = $2`).
		WithArgs(analysisID, tenant).
		WillReturnRows(rows9(tenant, "inc-9", `[{"category":"data","evidence":["e1"]}]`, done, true))

	got, err := repo.GetAnalysis(context.Background(), tenant, analysisID)
	if err != nil {
		t.Fatalf("GetAnalysis() error = %v", err)
	}
	if got.TenantID != tenant || got.IncidentID != "inc-9" || got.TriggeredBy != "u-1" || got.Confidence != 0.8 {
		t.Fatalf("GetAnalysis() = %+v", got)
	}
	if got.CompletedAt == nil || !got.CompletedAt.Equal(done) {
		t.Fatalf("GetAnalysis() completed_at = %v, want %v", got.CompletedAt, done)
	}
	if got.StartedAt.IsZero() {
		t.Fatal("GetAnalysis() lost started_at")
	}
	if len(got.RootCauses) != 1 || got.RootCauses[0].Category != "data" || len(got.RootCauses[0].Evidence) != 1 {
		t.Fatalf("GetAnalysis() root_causes = %+v", got.RootCauses)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestGetAnalysisMapsNullRootCausesToEmpty(t *testing.T) {
	repo, mock := newMock(t)
	rows := sqlmock.NewRows([]string{"id", "tenant_id", "incident_id", "status", "root_causes", "confidence", "triggered_by", "started_at", "completed_at"}).
		AddRow(analysisID, tenant, "inc-9", "running", nil, 0.0, "u-1", time.Now(), nil)
	mock.ExpectQuery(`SELECT `+cols+` FROM rca_analyses WHERE id = $1 AND tenant_id = $2`).
		WithArgs(analysisID, tenant).
		WillReturnRows(rows)

	got, err := repo.GetAnalysis(context.Background(), tenant, analysisID)
	if err != nil {
		t.Fatalf("GetAnalysis() error = %v", err)
	}
	if len(got.RootCauses) != 0 {
		t.Fatalf("GetAnalysis() root_causes = %+v, want empty", got.RootCauses)
	}
	if got.CompletedAt != nil {
		t.Fatalf("GetAnalysis() completed_at = %v, want nil", got.CompletedAt)
	}
}

func TestGetAnalysisRejectsCorruptRootCauses(t *testing.T) {
	repo, mock := newMock(t)
	rows := sqlmock.NewRows([]string{"id", "tenant_id", "incident_id", "status", "root_causes", "confidence", "triggered_by", "started_at", "completed_at"}).
		AddRow(analysisID, tenant, "inc-9", "completed", `{"broken":`, 0.5, "u-1", time.Now(), nil)
	mock.ExpectQuery(`SELECT `+cols+` FROM rca_analyses WHERE id = $1 AND tenant_id = $2`).
		WithArgs(analysisID, tenant).
		WillReturnRows(rows)

	if _, err := repo.GetAnalysis(context.Background(), tenant, analysisID); err == nil {
		t.Fatal("GetAnalysis() accepted corrupt root_causes JSON")
	} else if !strings.Contains(err.Error(), "unmarshal root causes") {
		t.Fatalf("GetAnalysis() error = %v", err)
	}
}

func TestGetAnalysisReturnsNotFoundForOtherTenantRow(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(`SELECT `+cols+` FROM rca_analyses WHERE id = $1 AND tenant_id = $2`).
		WithArgs(analysisID, tenant).
		WillReturnError(sql.ErrNoRows)

	_, err := repo.GetAnalysis(context.Background(), tenant, analysisID)
	if err == nil || !strings.Contains(err.Error(), "not found") {
		t.Fatalf("GetAnalysis() error = %v, want not found", err)
	}
}

func TestQueryAnalysisHistoryIsTenantScoped(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(`SELECT COUNT(*) FROM rca_analyses WHERE tenant_id = $1`).
		WithArgs(tenant).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))
	mock.ExpectQuery(`SELECT `+cols+` FROM rca_analyses WHERE tenant_id = $1 ORDER BY started_at DESC LIMIT $2 OFFSET $3`).
		WithArgs(tenant, 50, 0).
		WillReturnRows(rows9(tenant, "inc-a", `[{"category":"data"}]`, time.Now(), true))

	resp, err := repo.QueryAnalysisHistory(context.Background(), tenant, "", 50, 0)
	if err != nil {
		t.Fatalf("QueryAnalysisHistory() error = %v", err)
	}
	if resp.Total != 2 || len(resp.Data) != 1 {
		t.Fatalf("QueryAnalysisHistory() = %+v", resp)
	}
	if resp.Data[0].TenantID != tenant || resp.Data[0].IncidentID != "inc-a" {
		t.Fatalf("history row = %+v", resp.Data[0])
	}
	if len(resp.Data[0].RootCauses) != 1 {
		t.Fatalf("history row lost root_causes: %+v", resp.Data[0])
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestQueryAnalysisHistoryFiltersByIncident(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(`SELECT COUNT(*) FROM rca_analyses WHERE tenant_id = $1 AND incident_id = $2`).
		WithArgs(tenant, "inc-a").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery(`SELECT `+cols+` FROM rca_analyses WHERE tenant_id = $1 AND incident_id = $2 ORDER BY started_at DESC LIMIT $3 OFFSET $4`).
		WithArgs(tenant, "inc-a", 50, 0).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "incident_id", "status", "root_causes", "confidence", "triggered_by", "started_at", "completed_at"}))

	resp, err := repo.QueryAnalysisHistory(context.Background(), tenant, "inc-a", 50, 0)
	if err != nil {
		t.Fatalf("QueryAnalysisHistory() error = %v", err)
	}
	if resp.Total != 0 || len(resp.Data) != 0 {
		t.Fatalf("QueryAnalysisHistory() = %+v", resp)
	}
}

func TestQueryAnalysisHistoryEmptyResultIsAnEmptySlice(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(`SELECT COUNT(*) FROM rca_analyses WHERE tenant_id = $1`).
		WithArgs(tenant).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery(`SELECT `+cols+` FROM rca_analyses WHERE tenant_id = $1 ORDER BY started_at DESC LIMIT $2 OFFSET $3`).
		WithArgs(tenant, 50, 0).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "incident_id", "status", "root_causes", "confidence", "triggered_by", "started_at", "completed_at"}))

	resp, err := repo.QueryAnalysisHistory(context.Background(), tenant, "", 50, 0)
	if err != nil {
		t.Fatalf("QueryAnalysisHistory() error = %v", err)
	}
	if resp.Data == nil {
		t.Fatal("QueryAnalysisHistory() returned a nil slice, want an empty one")
	}
}

func TestGetTimelineIsTenantScoped(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(`SELECT id, timestamp, type, source, message, severity FROM rca_timeline_events WHERE tenant_id = $1 AND incident_id = $2 ORDER BY timestamp ASC LIMIT $3`).
		WithArgs(tenant, "inc-a", 50).
		WillReturnRows(sqlmock.NewRows([]string{"id", "timestamp", "type", "source", "message", "severity"}).
			AddRow(uuid.MustParse("44444444-4444-4444-4444-444444444444"), time.Now(), "deploy", "ci", "rollback", "warning"))

	got, err := repo.GetTimeline(context.Background(), tenant, "inc-a", 50)
	if err != nil {
		t.Fatalf("GetTimeline() error = %v", err)
	}
	if len(got) != 1 || got[0].Type != "deploy" || got[0].Message != "rollback" {
		t.Fatalf("GetTimeline() = %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}
