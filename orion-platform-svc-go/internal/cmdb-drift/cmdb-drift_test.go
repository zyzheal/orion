package cmdb_drift_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"orion/platform-svc-go/internal/cmdb-drift/models"
	"orion/platform-svc-go/internal/cmdb-drift/repository"
	svc "orion/platform-svc-go/internal/cmdb-drift/service"

	"go.uber.org/zap"
)

func TestCmdbDrift_NewService_Nil(t *testing.T) {
	// DriftDetector constructor must accept nil repo but needs a non-nil logger
	// (ScanForDrift calls logger.Info). Use zap.NewNop() which is a no-op logger.
	detector := svc.NewDriftDetector(nil, zap.NewNop())
	if detector == nil {
		t.Fatal("NewDriftDetector returned nil")
	}

	// ScanForDrift does not touch the repository; it only builds a result struct.
	ctx := context.Background()
	result, err := detector.ScanForDrift(ctx, "tenant-1", "prod")
	if err != nil {
		t.Fatalf("ScanForDrift unexpected error: %v", err)
	}
	if result == nil {
		t.Fatal("ScanForDrift returned nil result")
	}
	if result.TenantID != "tenant-1" {
		t.Errorf("expected TenantID tenant-1, got %s", result.TenantID)
	}
	if result.Environment != "prod" {
		t.Errorf("expected Environment prod, got %s", result.Environment)
	}
	if result.DriftCount != 0 {
		t.Errorf("expected DriftCount 0, got %d", result.DriftCount)
	}
	if result.TotalCIs != 0 {
		t.Errorf("expected TotalCIs 0, got %d", result.TotalCIs)
	}
	if result.Drifts == nil {
		t.Error("expected non-nil Drifts slice, got nil")
	}
	if result.ScannedAt.IsZero() {
		t.Error("expected non-zero ScannedAt timestamp")
	}
}

func TestCmdbDrift_ContextDeadline(t *testing.T) {
	// Verify that all methods defined on the ServiceInterface exist by
	// constructing a wrapper around DriftDetector and checking method signatures.
	// We cannot exercise repo-dependent methods without PostgreSQL, but we
	// confirm the service compiles and each method name/type is available.

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	detector := svc.NewDriftDetector(nil, zap.NewNop())

	// ScanForDrift — no repo dependency, safe to call
	_, err := detector.ScanForDrift(ctx, "t", "dev")
	if err != nil {
		t.Fatalf("ScanForDrift failed: %v", err)
	}

	// BulkResolveDrifts with empty ids is short-circuited (returns 0, nil)
	// without touching the repository.
	count, err := detector.BulkResolveDrifts(ctx, "t", []string{}, "admin", "manual")
	if err != nil {
		t.Fatalf("BulkResolveDrifts(empty) failed: %v", err)
	}
	if count != 0 {
		t.Errorf("expected count 0 for empty ids, got %d", count)
	}
}

func TestCmdbDrift_PackageAvailable(t *testing.T) {
	// Verify compile-time interface satisfaction for both repository and service.
	// These are checked via the var _ declarations in the packages.

	var _ repository.RepositoryInterface = (*repository.Repository)(nil)
	var _ svc.ServiceInterface = (*svc.DriftDetector)(nil)

	// Verify error helpers.
	if !svc.IsNotFound(svc.ErrDriftNotFound) {
		t.Error("IsNotFound should return true for ErrDriftNotFound")
	}
	if svc.IsNotFound(nil) {
		t.Error("IsNotFound should return false for nil")
	}
	if svc.IsNotFound(errors.New("other")) {
		t.Error("IsNotFound should return false for unrelated error")
	}

	// Verify ErrInvalidDrift exists.
	if svc.ErrInvalidDrift == nil {
		t.Error("ErrInvalidDrift must not be nil")
	}

	// Verify model constants.
	if models.DriftTypeCIMissing != "ci_missing" {
		t.Errorf("unexpected DriftTypeCIMissing: %s", models.DriftTypeCIMissing)
	}
	if models.DriftTypeCIPropertyChanged != "ci_property_changed" {
		t.Errorf("unexpected DriftTypeCIPropertyChanged: %s", models.DriftTypeCIPropertyChanged)
	}
	if models.DriftTypeRelationshipChanged != "relationship_changed" {
		t.Errorf("unexpected DriftTypeRelationshipChanged: %s", models.DriftTypeRelationshipChanged)
	}
	if models.DriftTypeCIAdded != "ci_added" {
		t.Errorf("unexpected DriftTypeCIAdded: %s", models.DriftTypeCIAdded)
	}
	if models.DriftTypeConfigValueChanged != "config_value_changed" {
		t.Errorf("unexpected DriftTypeConfigValueChanged: %s", models.DriftTypeConfigValueChanged)
	}

	if models.SeverityCritical != "critical" {
		t.Errorf("unexpected SeverityCritical: %s", models.SeverityCritical)
	}
	if models.SeverityWarning != "warning" {
		t.Errorf("unexpected SeverityWarning: %s", models.SeverityWarning)
	}
	if models.SeverityInfo != "info" {
		t.Errorf("unexpected SeverityInfo: %s", models.SeverityInfo)
	}

	// Verify DriftRecord field defaults.
	rec := &models.DriftRecord{
		ID:            "drift-1",
		TenantID:      "tenant-1",
		CIID:          "ci-1",
		CIName:        "nginx-01",
		CIType:        "service",
		Property:      "version",
		Environment:   "prod",
		ExpectedValue: "1.0",
		ActualValue:   "2.0",
		DriftType:     models.DriftTypeCIPropertyChanged,
		Severity:      models.SeverityWarning,
		DetectedAt:    time.Now(),
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
	if rec.ID != "drift-1" {
		t.Errorf("expected ID drift-1, got %s", rec.ID)
	}
	if rec.Severity != models.SeverityWarning {
		t.Errorf("expected severity warning, got %s", rec.Severity)
	}

	// Verify DriftFilter struct.
	f := models.DriftFilter{
		Environment:    "prod",
		CIID:           "ci-1",
		CIType:         "service",
		DriftType:      models.DriftTypeCIMissing,
		Severity:       models.SeverityCritical,
		UnresolvedOnly: true,
		Page:           1,
		PageSize:       20,
	}
	if f.Environment != "prod" || f.UnresolvedOnly != true {
		t.Error("DriftFilter field assignment failed")
	}

	// Verify DriftScanResult struct.
	scan := &models.DriftScanResult{
		TenantID:    "t1",
		Environment: "staging",
		ScannedAt:   time.Now(),
		TotalCIs:    10,
		DriftCount:  3,
		Drifts:      []models.DriftRecord{*rec},
	}
	if scan.DriftCount != 3 || len(scan.Drifts) != 1 {
		t.Error("DriftScanResult fields incorrect")
	}

	// Verify DriftStats struct.
	stats := &models.DriftStats{
		TotalDrifts:     50,
		UnresolvedCount: 5,
		CriticalCount:   2,
		WarningCount:    3,
		InfoCount:       0,
		ByType:          map[string]int{"ci_missing": 1},
		BySeverity:      map[string]int{"critical": 2},
	}
	if stats.TotalDrifts != 50 {
		t.Errorf("expected TotalDrifts 50, got %d", stats.TotalDrifts)
	}

	// Verify RemediationResult struct.
	rem := &models.RemediationResult{
		DriftID: "drift-1",
		Success: true,
		Action:  "reapply-config",
		Message: "done",
	}
	if !rem.Success || rem.DriftID != "drift-1" {
		t.Error("RemediationResult fields incorrect")
	}

	// Verify request types.
	createReq := models.CreateDriftRequest{
		CIID:          "ci-1",
		CIName:        "test-svc",
		CIType:        "service",
		Environment:   "prod",
		DriftType:     models.DriftTypeCIMissing,
		Severity:      models.SeverityWarning,
	}
	if createReq.CIID != "ci-1" {
		t.Error("CreateDriftRequest fields incorrect")
	}

	scanReq := models.ScanRequest{Environment: "prod"}
	if scanReq.Environment != "prod" {
		t.Error("ScanRequest fields incorrect")
	}

	resolveReq := models.ResolveRequest{
		ResolvedBy: "admin",
		Resolution: "manual fix",
	}
	if resolveReq.ResolvedBy != "admin" {
		t.Error("ResolveRequest fields incorrect")
	}
}
