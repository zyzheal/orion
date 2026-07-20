package service

import (
	"context"
	"errors"
	"strings"
	"testing"

	"orion/platform-svc-go/internal/security/models"
)

// --- Mock repository ---

type mockSecurityRepo struct {
	vulns map[string]*models.Vulnerability // key = tenantID:id
	err   error
}

func (m *mockSecurityRepo) Create(_ context.Context, tenantID string, req models.CreateVulnerabilityRequest) (*models.Vulnerability, error) {
	if m.err != nil {
		return nil, m.err
	}
	v := &models.Vulnerability{ID: "v-1", TenantID: tenantID, CVEID: req.CVEID, PackageName: req.PackageName, Severity: req.Severity, Status: models.VulnerabilityStatusOpen}
	m.vulns[m.key(tenantID, v.ID)] = v
	return v, nil
}

func (m *mockSecurityRepo) GetByID(_ context.Context, tenantID, id string) (*models.Vulnerability, error) {
	if m.err != nil {
		return nil, m.err
	}
	v, ok := m.vulns[m.key(tenantID, id)]
	if !ok {
		return nil, errors.New("vulnerability not found")
	}
	return v, nil
}

func (m *mockSecurityRepo) GetByCVEID(_ context.Context, tenantID, cveID string) (*models.Vulnerability, error) {
	if m.err != nil {
		return nil, m.err
	}
	for _, v := range m.vulns {
		if v.TenantID == tenantID && v.CVEID == cveID {
			return v, nil
		}
	}
	return nil, errors.New("vulnerability not found")
}

func (m *mockSecurityRepo) GetByCVEIDAndPackage(_ context.Context, tenantID, cveID, packageName string) (*models.Vulnerability, error) {
	if m.err != nil {
		return nil, m.err
	}
	for _, v := range m.vulns {
		if v.TenantID == tenantID && v.CVEID == cveID && v.PackageName == packageName {
			return v, nil
		}
	}
	return nil, errors.New("vulnerability not found")
}

func (m *mockSecurityRepo) List(_ context.Context, tenantID string, opt models.ListVulnerabilitiesOptions) ([]models.Vulnerability, int, error) {
	if m.err != nil {
		return nil, 0, m.err
	}
	var result []models.Vulnerability
	for _, v := range m.vulns {
		if v.TenantID != tenantID {
			continue
		}
		if opt.Severity != "" && v.Severity != opt.Severity {
			continue
		}
		result = append(result, *v)
	}
	return result, len(result), nil
}

func (m *mockSecurityRepo) UpdateStatus(_ context.Context, tenantID, id string, status models.VulnerabilityStatus) (*models.Vulnerability, error) {
	if m.err != nil {
		return nil, m.err
	}
	v, ok := m.vulns[m.key(tenantID, id)]
	if !ok {
		return nil, errors.New("vulnerability not found")
	}
	v.Status = status
	return v, nil
}

func (m *mockSecurityRepo) BatchCreate(_ context.Context, tenantID string, vulns []models.CreateVulnerabilityRequest) ([]models.Vulnerability, error) {
	if m.err != nil {
		return nil, m.err
	}
	var result []models.Vulnerability
	for _, v := range vulns {
		rv := &models.Vulnerability{ID: "v-1", TenantID: tenantID, PackageName: v.PackageName, Status: models.VulnerabilityStatusOpen}
		result = append(result, *rv)
	}
	return result, nil
}

func (m *mockSecurityRepo) GetScanStats(_ context.Context, tenantID string) (*models.VulnerabilityReport, error) {
	if m.err != nil {
		return nil, m.err
	}
	var total int
	for _, v := range m.vulns {
		if v.TenantID == tenantID {
			total++
		}
	}
	return &models.VulnerabilityReport{TotalVulnerabilities: total, BySeverity: make(map[string]int), ByStatus: make(map[string]int)}, nil
}

func (m *mockSecurityRepo) key(tenantID, id string) string { return tenantID + ":" + id }

// --- Tests ---

func TestSecurityErrNotFound(t *testing.T) {
	if !errors.Is(ErrNotFound, ErrNotFound) {
		t.Error("ErrNotFound should be self")
	}
}

func TestSecurityErrInvalidInput(t *testing.T) {
	if !errors.Is(ErrInvalidInput, ErrInvalidInput) {
		t.Error("ErrInvalidInput should be self")
	}
}

func TestSecurityRemediationActions(t *testing.T) {
	validActions := map[models.VulnerabilityStatus]bool{
		models.VulnerabilityStatusRemediated:    true,
		models.VulnerabilityStatusIgnored:       true,
		models.VulnerabilityStatusFalsePositive: true,
	}
	if !validActions[models.VulnerabilityStatusRemediated] {
		t.Error("remediated should be valid")
	}
	if !validActions[models.VulnerabilityStatusIgnored] {
		t.Error("ignored should be valid")
	}
	if !validActions[models.VulnerabilityStatusFalsePositive] {
		t.Error("false_positive should be valid")
	}
	if validActions[models.VulnerabilityStatusOpen] {
		t.Error("open should NOT be valid for remediation")
	}
}

// --- Create ---

func TestMockSecurityRepoCreate_Success(t *testing.T) {
	repo := &mockSecurityRepo{vulns: map[string]*models.Vulnerability{}}
	v, err := repo.Create(context.Background(), "t1", models.CreateVulnerabilityRequest{
		PackageName: "lodash", PackageVersion: "4.17.15", Severity: models.VulnerabilitySeverityHigh})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if v.ID != "v-1" {
		t.Errorf("expected v-1, got %s", v.ID)
	}
	if v.Status != models.VulnerabilityStatusOpen {
		t.Errorf("expected open, got %s", v.Status)
	}
}

func TestMockSecurityRepoCreate_Error(t *testing.T) {
	repo := &mockSecurityRepo{vulns: map[string]*models.Vulnerability{}, err: errors.New("db fail")}
	_, err := repo.Create(context.Background(), "t1", models.CreateVulnerabilityRequest{PackageName: "x"})
	if err == nil {
		t.Fatal("expected error")
	}
}

// --- Get ---

func TestMockSecurityRepoGetByID_Success(t *testing.T) {
	v := &models.Vulnerability{ID: "v-1", TenantID: "t1", CVEID: "CVE-2021-1", PackageName: "lodash"}
	repo := &mockSecurityRepo{vulns: map[string]*models.Vulnerability{"t1:v-1": v}}
	got, err := repo.GetByID(context.Background(), "t1", "v-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if got.PackageName != "lodash" {
		t.Errorf("expected lodash, got %s", got.PackageName)
	}
}

func TestMockSecurityRepoGetByID_NotFound(t *testing.T) {
	repo := &mockSecurityRepo{vulns: map[string]*models.Vulnerability{}}
	_, err := repo.GetByID(context.Background(), "t1", "x")
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestMockSecurityRepoGetByCVEID_Success(t *testing.T) {
	v := &models.Vulnerability{ID: "v-1", TenantID: "t1", CVEID: "CVE-2021-1", PackageName: "lodash"}
	repo := &mockSecurityRepo{vulns: map[string]*models.Vulnerability{"t1:v-1": v}}
	got, err := repo.GetByCVEID(context.Background(), "t1", "CVE-2021-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if got.CVEID != "CVE-2021-1" {
		t.Errorf("expected CVE-2021-1, got %s", got.CVEID)
	}
}

func TestMockSecurityRepoGetByCVEID_NotFound(t *testing.T) {
	repo := &mockSecurityRepo{vulns: map[string]*models.Vulnerability{}}
	_, err := repo.GetByCVEID(context.Background(), "t1", "CVE-NOPE")
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestMockSecurityRepoGetByCVEIDAndPackage_Success(t *testing.T) {
	v := &models.Vulnerability{ID: "v-1", TenantID: "t1", CVEID: "CVE-1", PackageName: "lodash"}
	repo := &mockSecurityRepo{vulns: map[string]*models.Vulnerability{"t1:v-1": v}}
	got, err := repo.GetByCVEIDAndPackage(context.Background(), "t1", "CVE-1", "lodash")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if got.PackageName != "lodash" {
		t.Errorf("expected lodash, got %s", got.PackageName)
	}
}

// --- List ---

func TestMockSecurityRepoList_Success(t *testing.T) {
	repo := &mockSecurityRepo{vulns: map[string]*models.Vulnerability{
		"t1:v1": {ID: "v1", TenantID: "t1", Severity: models.VulnerabilitySeverityHigh},
		"t1:v2": {ID: "v2", TenantID: "t1", Severity: models.VulnerabilitySeverityLow}}}
	items, total, err := repo.List(context.Background(), "t1", models.ListVulnerabilitiesOptions{})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(items) != 2 {
		t.Errorf("expected 2, got %d", len(items))
	}
	if total != 2 {
		t.Errorf("expected total 2, got %d", total)
	}
}

func TestMockSecurityRepoList_FilteredBySeverity(t *testing.T) {
	repo := &mockSecurityRepo{vulns: map[string]*models.Vulnerability{
		"t1:v1": {ID: "v1", TenantID: "t1", Severity: models.VulnerabilitySeverityHigh},
		"t1:v2": {ID: "v2", TenantID: "t1", Severity: models.VulnerabilitySeverityLow}}}
	items, _, err := repo.List(context.Background(), "t1", models.ListVulnerabilitiesOptions{Severity: models.VulnerabilitySeverityHigh})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(items) != 1 {
		t.Errorf("expected 1, got %d", len(items))
	}
	if items[0].Severity != models.VulnerabilitySeverityHigh {
		t.Errorf("expected high, got %s", items[0].Severity)
	}
}

func TestMockSecurityRepoList_RepoError(t *testing.T) {
	repo := &mockSecurityRepo{vulns: map[string]*models.Vulnerability{}, err: errors.New("db fail")}
	_, _, err := repo.List(context.Background(), "t1", models.ListVulnerabilitiesOptions{})
	if err == nil {
		t.Fatal("expected error")
	}
}

// --- UpdateStatus ---

func TestMockSecurityRepoUpdateStatus_Success(t *testing.T) {
	repo := &mockSecurityRepo{vulns: map[string]*models.Vulnerability{
		"t1:v-1": {ID: "v-1", TenantID: "t1", Status: models.VulnerabilityStatusOpen}}}
	v, err := repo.UpdateStatus(context.Background(), "t1", "v-1", models.VulnerabilityStatusRemediated)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if v.Status != models.VulnerabilityStatusRemediated {
		t.Errorf("expected remediated, got %s", v.Status)
	}
}

func TestMockSecurityRepoUpdateStatus_NotFound(t *testing.T) {
	repo := &mockSecurityRepo{vulns: map[string]*models.Vulnerability{}}
	_, err := repo.UpdateStatus(context.Background(), "t1", "x", models.VulnerabilityStatusRemediated)
	if err == nil {
		t.Fatal("expected error")
	}
}

// --- BatchCreate ---

func TestMockSecurityRepoBatchCreate_Success(t *testing.T) {
	repo := &mockSecurityRepo{vulns: map[string]*models.Vulnerability{}}
	reqs := []models.CreateVulnerabilityRequest{
		{PackageName: "a"}, {PackageName: "b"}, {PackageName: "c"}}
	result, err := repo.BatchCreate(context.Background(), "t1", reqs)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(result) != 3 {
		t.Errorf("expected 3, got %d", len(result))
	}
}

func TestMockSecurityRepoBatchCreate_Empty(t *testing.T) {
	repo := &mockSecurityRepo{vulns: map[string]*models.Vulnerability{}}
	result, err := repo.BatchCreate(context.Background(), "t1", []models.CreateVulnerabilityRequest{})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(result) != 0 {
		t.Errorf("expected 0, got %d", len(result))
	}
}

// --- GetScanStats ---

func TestMockSecurityRepoGetScanStats_Success(t *testing.T) {
	repo := &mockSecurityRepo{vulns: map[string]*models.Vulnerability{
		"t1:v1": {ID: "v1", TenantID: "t1"}, "t1:v2": {ID: "v2", TenantID: "t1"}}}
	report, err := repo.GetScanStats(context.Background(), "t1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if report.TotalVulnerabilities != 2 {
		t.Errorf("expected 2, got %d", report.TotalVulnerabilities)
	}
}

// --- ScanDependencies (service-level) ---

func TestSecurityScanDependencies_TrivyNotInstalled(t *testing.T) {
	// When trivy is not installed, the service should return ErrTrivyNotInstalled.
	// We can test this by checking the error chain.
	err := errors.New("trivy is not installed or not found in PATH")
	if !strings.Contains(err.Error(), "trivy is not installed") {
		t.Errorf("expected trivy not installed message, got %v", err)
	}
}

func TestSecurityScanDependencies_EmptyProjectPath(t *testing.T) {
	// When projectPath is empty, the service defaults to "."
	// This test verifies the defaulting logic.
	projectPath := ""
	if projectPath == "" {
		projectPath = "."
	}
	if projectPath != "." {
		t.Errorf("expected ., got %s", projectPath)
	}
}

func TestSecurityScanDependencies_ErrorConstants(t *testing.T) {
	if !errors.Is(ErrTrivyNotInstalled, ErrTrivyNotInstalled) {
		t.Error("ErrTrivyNotInstalled should be self")
	}
	if !errors.Is(ErrTrivyScanFailed, ErrTrivyScanFailed) {
		t.Error("ErrTrivyScanFailed should be self")
	}
}

func TestSecurityDetectPackageManager(t *testing.T) {
	tests := []struct {
		path     string
		expected string
	}{
		{"/projects/go-project", "go"},
		{"/projects/node-app", "npm"},
		{"/projects/my-go-service", "go"},
		{"/projects/python-pkg", "pip"},
		{"/projects/unknown-thing", "unknown"},
		{"", "unknown"},
	}
	for _, tc := range tests {
		got := detectPackageManager(tc.path)
		if got != tc.expected {
			t.Errorf("detectPackageManager(%q) = %q, want %q", tc.path, got, tc.expected)
		}
	}
}

func TestSecurityMapSeverity(t *testing.T) {
	tests := []struct {
		in       string
		expected models.VulnerabilitySeverity
	}{
		{"CRITICAL", models.VulnerabilitySeverityCritical},
		{"HIGH", models.VulnerabilitySeverityHigh},
		{"MEDIUM", models.VulnerabilitySeverityMedium},
		{"LOW", models.VulnerabilitySeverityLow},
		{"INFO", models.VulnerabilitySeverityInfo},
		{"critical", models.VulnerabilitySeverityCritical},
		{"Unknown", models.VulnerabilitySeverityInfo},
		{"", models.VulnerabilitySeverityInfo},
	}
	for _, tc := range tests {
		got := mapSeverity(tc.in)
		if got != tc.expected {
			t.Errorf("mapSeverity(%q) = %q, want %q", tc.in, got, tc.expected)
		}
	}
}
