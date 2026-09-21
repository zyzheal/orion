package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/artifact-ops/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

const (
	testTenant = "t1"

	// One line each, so they match the multi-line queries in the service under
	// sqlmock QueryMatcherEqual, which collapses whitespace runs to a space.
	minAgeSQL  = "SELECT MIN(created_at) FROM artifact_operations WHERE tenant_id=$1 AND artifact_id=$2"
	opCountSQL = "SELECT COUNT(*) FROM artifact_operations WHERE tenant_id=$1 AND artifact_id=$2"
)

// newMockDB wires sqlmock into a real sqlx.DB so the service's raw SQL is
// matched on text and args. ExpectationsWereMet runs in every test, and a
// query that no expectation covers is reported as an unexpected call.
func newMockDB(t *testing.T) (*sqlx.DB, sqlmock.Sqlmock) {
	t.Helper()
	mockDB, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	db := sqlx.NewDb(mockDB, "postgres")
	t.Cleanup(func() {
		_ = db.Close()
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unfulfilled sqlmock expectations: %v", err)
		}
	})
	return db, mock
}

func expectAge(mock sqlmock.Sqlmock, artifactID string, first time.Time) {
	mock.ExpectQuery(minAgeSQL).WithArgs(testTenant, artifactID).
		WillReturnRows(sqlmock.NewRows([]string{"min"}).AddRow(first))
}

// expectNullAge reproduces the one-row MIN that carries NULL when the artifact
// has no operation at all.
func expectNullAge(mock sqlmock.Sqlmock, artifactID string) {
	mock.ExpectQuery(minAgeSQL).WithArgs(testTenant, artifactID).
		WillReturnRows(sqlmock.NewRows([]string{"min"}).AddRow(nil))
}

func expectCount(mock sqlmock.Sqlmock, artifactID string, count int64) {
	mock.ExpectQuery(opCountSQL).WithArgs(testTenant, artifactID).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(count))
}

func retentionPolicy(id, rule string, enabled bool) *models.RetentionPolicy {
	return &models.RetentionPolicy{ID: id, TenantID: testTenant, Name: "default", Rule: rule, Enabled: enabled}
}

type fakeRepo struct {
	policies     []models.RetentionPolicy
	byID         map[string]*models.RetentionPolicy
	ids          []string
	reports      []models.ScanReport
	reportsErr   error
	listIDsErr   error
	deleteErr    error
	deleteFailID string
	deletedFor   []string
	deleteRows   int64
}

var _ RepositoryInterface = (*fakeRepo)(nil)

func (f *fakeRepo) ListPolicies(_ context.Context, _ string) ([]models.RetentionPolicy, error) {
	return f.policies, nil
}

func (f *fakeRepo) GetPolicyByID(_ context.Context, _, id string) (*models.RetentionPolicy, error) {
	p, ok := f.byID[id]
	if !ok || p == nil {
		return nil, errors.New("no rows in result set")
	}
	return p, nil
}

func (f *fakeRepo) GetScanReportsByArtifact(_ context.Context, _, _ string) ([]models.ScanReport, error) {
	if f.reportsErr != nil {
		return nil, f.reportsErr
	}
	return f.reports, nil
}

func (f *fakeRepo) ListArtifactIDs(_ context.Context, _ string) ([]string, error) {
	if f.listIDsErr != nil {
		return nil, f.listIDsErr
	}
	return f.ids, nil
}

func (f *fakeRepo) DeleteOperationsByArtifact(_ context.Context, _, artifactID string) (int64, error) {
	if f.deleteErr != nil && artifactID == f.deleteFailID {
		return 0, f.deleteErr
	}
	f.deletedFor = append(f.deletedFor, artifactID)
	return f.deleteRows, nil
}

func (f *fakeRepo) CreateOperation(context.Context, *models.ArtifactOperation) error { return nil }

func (f *fakeRepo) CreatePolicy(context.Context, *models.RetentionPolicy) error { return nil }

func (f *fakeRepo) CreateScan(context.Context, *models.ArtifactScan) error { return nil }

func (f *fakeRepo) DeletePolicy(context.Context, string, string) error { return nil }

func (f *fakeRepo) GetArtifactStats(context.Context, string, string) (*models.ArtifactStats, error) {
	return nil, nil
}

func (f *fakeRepo) GetScanReportByID(context.Context, string, string) (*models.ScanReport, error) {
	return nil, errors.New("no rows in result set")
}

func (f *fakeRepo) ListOperationsByArtifact(context.Context, string, string, int, int) ([]models.ArtifactOperation, error) {
	return nil, nil
}

// ---------- DetectMalicious ----------

func TestDetectMalicious_FlaggedWhenAReportSaysMalicious(t *testing.T) {
	svc := NewService(&fakeRepo{reports: []models.ScanReport{
		{ArtifactID: "a1", Status: "clean"},
		{ArtifactID: "a1", Status: "malicious"},
	}}, nil)

	res, err := svc.DetectMalicious(context.Background(), testTenant, models.DetectMaliciousRequest{ArtifactID: "a1"})
	if err != nil {
		t.Fatalf("DetectMalicious returned error: %v", err)
	}
	if !res.Malicious {
		t.Fatalf("Malicious = false, want true; %+v", res)
	}
	if !res.Checked {
		t.Fatalf("Checked = false, want true; %+v", res)
	}
	if res.ReportsChecked != 2 {
		t.Errorf("ReportsChecked = %d, want 2", res.ReportsChecked)
	}
	if res.Reason != "1 of 2 scan reports flag status=malicious" {
		t.Errorf("Reason = %q", res.Reason)
	}
	if res.ArtifactID != "a1" {
		t.Errorf("ArtifactID = %q, want a1", res.ArtifactID)
	}
}

func TestDetectMalicious_NotMaliciousWhenAllReportsAreClean(t *testing.T) {
	svc := NewService(&fakeRepo{reports: []models.ScanReport{
		{ArtifactID: "a1", Status: "clean"},
		{ArtifactID: "a1", Status: "warning"},
	}}, nil)

	res, err := svc.DetectMalicious(context.Background(), testTenant, models.DetectMaliciousRequest{ArtifactID: "a1"})
	if err != nil {
		t.Fatalf("DetectMalicious returned error: %v", err)
	}
	if res.Malicious {
		t.Errorf("Malicious = true though no report flagged it")
	}
	if !res.Checked {
		t.Errorf("Checked = false though two reports were on record: %+v", res)
	}
	if res.ReportsChecked != 2 {
		t.Errorf("ReportsChecked = %d, want 2", res.ReportsChecked)
	}
	if res.Reason != "no malicious scan report among 2 reports on record" {
		t.Errorf("Reason = %q", res.Reason)
	}
}

// The stub before this fix returned Malicious false after reading no report at
// all, which any caller reads as a clean verdict. Checked has to separate
// "clean" from "nothing was checked".
func TestDetectMalicious_NoReportsIsUnknownNotClean(t *testing.T) {
	svc := NewService(&fakeRepo{reports: nil}, nil)

	res, err := svc.DetectMalicious(context.Background(), testTenant, models.DetectMaliciousRequest{ArtifactID: "a9"})
	if err != nil {
		t.Fatalf("DetectMalicious returned error: %v", err)
	}
	if res.Malicious {
		t.Errorf("Malicious = true with no evidence")
	}
	if res.Checked {
		t.Errorf("Checked = true with no evidence: %+v", res)
	}
	if res.ReportsChecked != 0 {
		t.Errorf("ReportsChecked = %d, want 0", res.ReportsChecked)
	}
	if !strings.Contains(res.Reason, "verdict unknown") {
		t.Errorf("Reason = %q, want a reason that names an unknown verdict", res.Reason)
	}
}

func TestDetectMalicious_StatusMatchIgnoresCaseAndWhitespace(t *testing.T) {
	svc := NewService(&fakeRepo{reports: []models.ScanReport{{ArtifactID: "a1", Status: "  Malicious "}}}, nil)

	res, err := svc.DetectMalicious(context.Background(), testTenant, models.DetectMaliciousRequest{ArtifactID: "a1"})
	if err != nil {
		t.Fatalf("DetectMalicious returned error: %v", err)
	}
	if !res.Malicious {
		t.Fatalf("Malicious = false for a status that is malicious after trimming: %+v", res)
	}
	if res.Reason != "1 of 1 scan reports flag status=malicious" {
		t.Errorf("Reason = %q", res.Reason)
	}
}

func TestDetectMalicious_RepoErrorPropagates(t *testing.T) {
	svc := NewService(&fakeRepo{reportsErr: errors.New("conn refused")}, nil)

	_, err := svc.DetectMalicious(context.Background(), testTenant, models.DetectMaliciousRequest{ArtifactID: "a1"})
	if err == nil || !strings.Contains(err.Error(), "read scan reports") {
		t.Errorf("err = %v, want read scan reports", err)
	}
}

// ---------- EvaluateRetention ----------

func TestEvaluateRetention_ExpiredByAge(t *testing.T) {
	db, mock := newMockDB(t)
	svc := NewService(&fakeRepo{byID: map[string]*models.RetentionPolicy{
		"p1": retentionPolicy("p1", `{"maxAgeDays":30}`, true),
	}}, db)
	expectAge(mock, "a1", time.Now().Add(-40*24*time.Hour))

	res, err := svc.EvaluateRetention(context.Background(), testTenant, models.EvaluateRetentionRequest{PolicyID: "p1", ArtifactID: "a1"})
	if err != nil {
		t.Fatalf("EvaluateRetention returned error: %v", err)
	}
	if !res.Expired {
		t.Fatalf("Expired = false, want true; reason %q", res.Reason)
	}
	if !strings.Contains(res.Reason, "exceeds max 30 days") {
		t.Errorf("Reason = %q", res.Reason)
	}
	if res.PolicyID != "p1" || res.ArtifactID != "a1" {
		t.Errorf("PolicyID/ArtifactID = %q/%q, want p1/a1", res.PolicyID, res.ArtifactID)
	}
}

func TestEvaluateRetention_ExpiredByOperationCount(t *testing.T) {
	db, mock := newMockDB(t)
	svc := NewService(&fakeRepo{byID: map[string]*models.RetentionPolicy{
		"p1": retentionPolicy("p1", `{"maxCount":5}`, true),
	}}, db)
	expectCount(mock, "a1", 6)

	res, err := svc.EvaluateRetention(context.Background(), testTenant, models.EvaluateRetentionRequest{PolicyID: "p1", ArtifactID: "a1"})
	if err != nil {
		t.Fatalf("EvaluateRetention returned error: %v", err)
	}
	if !res.Expired {
		t.Fatalf("Expired = false, want true; reason %q", res.Reason)
	}
	if res.Reason != "operation count 6 exceeds max 5" {
		t.Errorf("Reason = %q", res.Reason)
	}
}

func TestEvaluateRetention_WithinWindow(t *testing.T) {
	db, mock := newMockDB(t)
	svc := NewService(&fakeRepo{byID: map[string]*models.RetentionPolicy{
		"p1": retentionPolicy("p1", `{"maxAgeDays":30,"maxCount":5}`, true),
	}}, db)
	expectAge(mock, "a1", time.Now().Add(-24*time.Hour))
	expectCount(mock, "a1", 2)

	res, err := svc.EvaluateRetention(context.Background(), testTenant, models.EvaluateRetentionRequest{PolicyID: "p1", ArtifactID: "a1"})
	if err != nil {
		t.Fatalf("EvaluateRetention returned error: %v", err)
	}
	if res.Expired {
		t.Errorf("Expired = true though the artifact is inside both limits: %q", res.Reason)
	}
	if res.Reason != "artifact within retention window" {
		t.Errorf("Reason = %q", res.Reason)
	}
}

// A MIN with no matching row yields NULL. Scanning that into a non-pointer
// time.Time errors, which left the no-operations branch unreachable and made
// the endpoint answer 500 instead of "age unknown".
func TestEvaluateRetention_NoOperationsIsNotExpired(t *testing.T) {
	db, mock := newMockDB(t)
	svc := NewService(&fakeRepo{byID: map[string]*models.RetentionPolicy{
		"p1": retentionPolicy("p1", `{"maxAgeDays":30}`, true),
	}}, db)
	expectNullAge(mock, "a1")

	res, err := svc.EvaluateRetention(context.Background(), testTenant, models.EvaluateRetentionRequest{PolicyID: "p1", ArtifactID: "a1"})
	if err != nil {
		t.Fatalf("EvaluateRetention returned error: %v", err)
	}
	if res.Expired {
		t.Errorf("Expired = true though no operation records the artifact's age")
	}
	if res.Reason != "no operations recorded for artifact" {
		t.Errorf("Reason = %q", res.Reason)
	}
}

func TestEvaluateRetention_PolicyNotEnabled(t *testing.T) {
	db, _ := newMockDB(t)
	svc := NewService(&fakeRepo{byID: map[string]*models.RetentionPolicy{
		"p1": retentionPolicy("p1", `{"maxAgeDays":30}`, false),
	}}, db)

	_, err := svc.EvaluateRetention(context.Background(), testTenant, models.EvaluateRetentionRequest{PolicyID: "p1", ArtifactID: "a1"})
	if err == nil || err.Error() != "retention policy is not enabled" {
		t.Errorf("err = %v, want retention policy is not enabled", err)
	}
}

func TestEvaluateRetention_PolicyNotFound(t *testing.T) {
	db, _ := newMockDB(t)
	svc := NewService(&fakeRepo{byID: map[string]*models.RetentionPolicy{}}, db)

	_, err := svc.EvaluateRetention(context.Background(), testTenant, models.EvaluateRetentionRequest{PolicyID: "p404", ArtifactID: "a1"})
	if err == nil || err.Error() != "retention policy not found" {
		t.Errorf("err = %v, want retention policy not found", err)
	}
}

func TestEvaluateRetention_RuleIsNotJSON(t *testing.T) {
	db, _ := newMockDB(t)
	svc := NewService(&fakeRepo{byID: map[string]*models.RetentionPolicy{
		"p1": retentionPolicy("p1", `{not json`, true),
	}}, db)

	_, err := svc.EvaluateRetention(context.Background(), testTenant, models.EvaluateRetentionRequest{PolicyID: "p1", ArtifactID: "a1"})
	if err == nil || !strings.Contains(err.Error(), "not valid JSON") {
		t.Errorf("err = %v, want not valid JSON", err)
	}
}

// No expectation is registered, so a query here would surface as an
// unexpected call and fail the test.
func TestEvaluateRetention_EmptyArtifactIDSkipsTheDatabase(t *testing.T) {
	db, _ := newMockDB(t)
	svc := NewService(&fakeRepo{byID: map[string]*models.RetentionPolicy{
		"p1": retentionPolicy("p1", `{"maxAgeDays":30}`, true),
	}}, db)

	res, err := svc.EvaluateRetention(context.Background(), testTenant, models.EvaluateRetentionRequest{PolicyID: "p1"})
	if err != nil {
		t.Fatalf("EvaluateRetention returned error: %v", err)
	}
	if res.Expired {
		t.Errorf("Expired = true though no artifact was named")
	}
	if res.Reason != "no artifact specified" {
		t.Errorf("Reason = %q", res.Reason)
	}
}

// ---------- GetRetentionReport ----------

// The stub before this fix returned an empty RetentionReport, so the counts
// were always zero no matter how many artifacts were outside their window.
func TestGetRetentionReport_CountsExpiredAndActive(t *testing.T) {
	db, mock := newMockDB(t)
	svc := NewService(&fakeRepo{
		byID: map[string]*models.RetentionPolicy{
			"p1": retentionPolicy("p1", `{"maxAgeDays":30}`, true),
		},
		ids: []string{"a1", "a2", "a3"},
	}, db)
	expectAge(mock, "a1", time.Now().Add(-40*24*time.Hour))
	expectAge(mock, "a2", time.Now().Add(-24*time.Hour))
	expectAge(mock, "a3", time.Now().Add(-48*time.Hour))

	report, err := svc.GetRetentionReport(context.Background(), testTenant, models.RetentionReportRequest{PolicyID: "p1"})
	if err != nil {
		t.Fatalf("GetRetentionReport returned error: %v", err)
	}
	if report.TotalChecked != 3 {
		t.Errorf("TotalChecked = %d, want 3", report.TotalChecked)
	}
	if report.Expired != 1 {
		t.Errorf("Expired = %d, want 1", report.Expired)
	}
	if report.Active != 2 {
		t.Errorf("Active = %d, want 2", report.Active)
	}
	if report.PoliciesApplied != 1 {
		t.Errorf("PoliciesApplied = %d, want 1", report.PoliciesApplied)
	}
	if report.PolicyID != "p1" {
		t.Errorf("PolicyID = %q, want p1", report.PolicyID)
	}
	if report.ExpiredArtifacts == nil || len(report.ExpiredArtifacts) != 1 || report.ExpiredArtifacts[0] != "a1" {
		t.Errorf("ExpiredArtifacts = %v, want [a1]", report.ExpiredArtifacts)
	}
	if report.Expired+report.Active != report.TotalChecked {
		t.Errorf("Expired+Active = %d, TotalChecked = %d", report.Expired+report.Active, report.TotalChecked)
	}
}

func TestGetRetentionReport_WithoutPolicyIDJudgetsAgainstEveryEnabledPolicy(t *testing.T) {
	db, mock := newMockDB(t)
	svc := NewService(&fakeRepo{
		policies: []models.RetentionPolicy{
			*retentionPolicy("p1", `{"maxAgeDays":9999}`, true),
			*retentionPolicy("p2", `{"maxCount":1}`, true),
		},
		ids: []string{"a1"},
	}, db)
	expectAge(mock, "a1", time.Now().Add(-24*time.Hour))
	expectCount(mock, "a1", 7)

	report, err := svc.GetRetentionReport(context.Background(), testTenant, models.RetentionReportRequest{})
	if err != nil {
		t.Fatalf("GetRetentionReport returned error: %v", err)
	}
	if report.Expired != 1 {
		t.Errorf("Expired = %d, want 1: only the maxCount policy expires a1", report.Expired)
	}
	if report.Active != 0 {
		t.Errorf("Active = %d, want 0", report.Active)
	}
	if report.PoliciesApplied != 2 {
		t.Errorf("PoliciesApplied = %d, want 2", report.PoliciesApplied)
	}
	if report.PolicyID != "" {
		t.Errorf("PolicyID = %q, want empty", report.PolicyID)
	}
}

func TestGetRetentionReport_DisabledPolicyDoesNotCount(t *testing.T) {
	db, _ := newMockDB(t)
	svc := NewService(&fakeRepo{
		policies: []models.RetentionPolicy{*retentionPolicy("p1", `{"maxAgeDays":1}`, false)},
		ids:      []string{"a1"},
	}, db)

	report, err := svc.GetRetentionReport(context.Background(), testTenant, models.RetentionReportRequest{})
	if err != nil {
		t.Fatalf("GetRetentionReport returned error: %v", err)
	}
	if report.PoliciesApplied != 0 || report.TotalChecked != 0 || report.Expired != 0 || report.Active != 0 {
		t.Errorf("report = %+v, want every counter zero", report)
	}
	if !strings.Contains(report.Message, "no enabled retention policy") {
		t.Errorf("Message = %q", report.Message)
	}
	if report.ExpiredArtifacts == nil {
		t.Errorf("ExpiredArtifacts is nil, want an empty slice so JSON emits []")
	}
}

func TestGetRetentionReport_DisabledExplicitPolicyErrors(t *testing.T) {
	db, _ := newMockDB(t)
	svc := NewService(&fakeRepo{byID: map[string]*models.RetentionPolicy{
		"p1": retentionPolicy("p1", `{"maxAgeDays":30}`, false),
	}}, db)

	_, err := svc.GetRetentionReport(context.Background(), testTenant, models.RetentionReportRequest{PolicyID: "p1"})
	if err == nil || err.Error() != "retention policy is not enabled" {
		t.Errorf("err = %v, want retention policy is not enabled", err)
	}
}

func TestGetRetentionReport_ListFailurePropagates(t *testing.T) {
	db, _ := newMockDB(t)
	svc := NewService(&fakeRepo{
		byID:       map[string]*models.RetentionPolicy{"p1": retentionPolicy("p1", `{"maxAgeDays":30}`, true)},
		listIDsErr: errors.New("select failed"),
	}, db)

	_, err := svc.GetRetentionReport(context.Background(), testTenant, models.RetentionReportRequest{PolicyID: "p1"})
	if err == nil || !strings.Contains(err.Error(), "list artifacts") {
		t.Errorf("err = %v, want list artifacts", err)
	}
}

func TestGetRetentionReport_QueryFailurePropagates(t *testing.T) {
	db, mock := newMockDB(t)
	svc := NewService(&fakeRepo{
		byID: map[string]*models.RetentionPolicy{"p1": retentionPolicy("p1", `{"maxAgeDays":30}`, true)},
		ids:  []string{"a1"},
	}, db)
	mock.ExpectQuery(minAgeSQL).WithArgs(testTenant, "a1").WillReturnError(errors.New("scan failed"))

	_, err := svc.GetRetentionReport(context.Background(), testTenant, models.RetentionReportRequest{PolicyID: "p1"})
	if err == nil || !strings.Contains(err.Error(), "read artifact creation date") {
		t.Errorf("err = %v, want read artifact creation date", err)
	}
}

// ---------- Cleanup ----------

// The stub before this fix reported success without reading a policy or
// touching a row.
func TestCleanup_DeletesOnlyExpiredArtifacts(t *testing.T) {
	db, mock := newMockDB(t)
	repo := &fakeRepo{
		policies:   []models.RetentionPolicy{*retentionPolicy("p1", `{"maxAgeDays":30}`, true)},
		ids:        []string{"a1", "a2"},
		deleteRows: 7,
	}
	svc := NewService(repo, db)
	expectAge(mock, "a1", time.Now().Add(-40*24*time.Hour))
	expectAge(mock, "a2", time.Now().Add(-24*time.Hour))

	got, err := svc.Cleanup(context.Background(), testTenant)
	if err != nil {
		t.Fatalf("Cleanup returned error: %v", err)
	}
	// 7 on purpose, not 5: a stub that hardcoded a small number would have
	// passed an assertion that happened to match it.
	if got["deleted"] != int64(7) {
		t.Errorf("deleted = %v, want 7", got["deleted"])
	}
	if got["policies_checked"] != 1 {
		t.Errorf("policies_checked = %v, want 1", got["policies_checked"])
	}
	if len(repo.deletedFor) != 1 || repo.deletedFor[0] != "a1" {
		t.Errorf("deletedFor = %v, want [a1]", repo.deletedFor)
	}
	artifacts, ok := got["artifacts"].([]string)
	if !ok || len(artifacts) != 1 || artifacts[0] != "a1" {
		t.Errorf("artifacts = %v, want [a1]", got["artifacts"])
	}
	msg, ok := got["message"].(string)
	if !ok || !strings.Contains(msg, "1 retention-expired") {
		t.Errorf("message = %v, want it to name 1 retention-expired artifact", got["message"])
	}
}

// deleteRows is high on purpose: a stub that reports success would show 0.
func TestCleanup_NothingExpiredDeletesNothing(t *testing.T) {
	db, mock := newMockDB(t)
	repo := &fakeRepo{
		policies:   []models.RetentionPolicy{*retentionPolicy("p1", `{"maxAgeDays":30}`, true)},
		ids:        []string{"a1"},
		deleteRows: 99,
	}
	svc := NewService(repo, db)
	expectAge(mock, "a1", time.Now().Add(-24*time.Hour))

	got, err := svc.Cleanup(context.Background(), testTenant)
	if err != nil {
		t.Fatalf("Cleanup returned error: %v", err)
	}
	if got["deleted"] != int64(0) {
		t.Errorf("deleted = %v, want 0", got["deleted"])
	}
	if len(repo.deletedFor) != 0 {
		t.Errorf("deletedFor = %v, want nothing", repo.deletedFor)
	}
	artifacts, ok := got["artifacts"].([]string)
	if !ok || len(artifacts) != 0 {
		t.Errorf("artifacts = %v, want empty", got["artifacts"])
	}
}

func TestCleanup_NoEnabledPolicyReportsNothingInsteadOfSuccess(t *testing.T) {
	db, _ := newMockDB(t)
	repo := &fakeRepo{policies: []models.RetentionPolicy{}}
	svc := NewService(repo, db)

	got, err := svc.Cleanup(context.Background(), testTenant)
	if err != nil {
		t.Fatalf("Cleanup returned error: %v", err)
	}
	if got["deleted"] != int64(0) {
		t.Errorf("deleted = %v, want 0", got["deleted"])
	}
	if got["policies_checked"] != 0 {
		t.Errorf("policies_checked = %v, want 0", got["policies_checked"])
	}
	msg, ok := got["message"].(string)
	if !ok || !strings.Contains(msg, "no enabled retention policy") {
		t.Errorf("message = %v, want no enabled retention policy", got["message"])
	}
	if len(repo.deletedFor) != 0 {
		t.Errorf("deletedFor = %v, want nothing", repo.deletedFor)
	}
}

func TestCleanup_DeleteFailurePropagates(t *testing.T) {
	db, mock := newMockDB(t)
	repo := &fakeRepo{
		policies:     []models.RetentionPolicy{*retentionPolicy("p1", `{"maxAgeDays":30}`, true)},
		ids:          []string{"a1"},
		deleteErr:    errors.New("foreign key"),
		deleteFailID: "a1",
	}
	svc := NewService(repo, db)
	expectAge(mock, "a1", time.Now().Add(-40*24*time.Hour))

	got, err := svc.Cleanup(context.Background(), testTenant)
	if err == nil || !strings.Contains(err.Error(), "delete operation records for a1") {
		t.Errorf("err = %v, want delete operation records for a1", err)
	}
	if got != nil {
		t.Errorf("Cleanup returned %v after a failed delete; the route must not answer success", got)
	}
}

func TestCleanup_MalformedRuleFailsClosed(t *testing.T) {
	db, _ := newMockDB(t)
	repo := &fakeRepo{policies: []models.RetentionPolicy{*retentionPolicy("p1", `{not json`, true)}}
	svc := NewService(repo, db)

	_, err := svc.Cleanup(context.Background(), testTenant)
	if err == nil || !strings.Contains(err.Error(), "not valid JSON") {
		t.Errorf("err = %v, want not valid JSON", err)
	}
	if len(repo.deletedFor) != 0 {
		t.Errorf("deletedFor = %v, want nothing: a bad rule must not delete", repo.deletedFor)
	}
}
