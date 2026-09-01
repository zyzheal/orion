package service

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"orion/platform-svc-go/internal/infrastructure/backup/models"
)

func TestParseArchiveSpec_NoArchiveBlock(t *testing.T) {
	plan := &models.BackupPlan{ID: "p1", TenantID: "t1", Enabled: true}
	spec, err := parseArchiveSpec(plan)
	if err != nil {
		t.Fatal(err)
	}
	if spec != nil {
		t.Fatalf("expected nil spec when no archive block, got %+v", spec)
	}
}

func TestParseArchiveSpec_WellFormed(t *testing.T) {
	dir := t.TempDir()
	cfg := map[string]interface{}{
		"archive": map[string]interface{}{
			"schedule":    "* * * * * *",
			"source_dir":  dir,
			"archive_type": "wal",
			"enabled":     true,
		},
	}
	b, _ := json.Marshal(cfg)
	plan := &models.BackupPlan{ID: "p1", TenantID: "t1", Enabled: true, StorageConfig: b}
	spec, err := parseArchiveSpec(plan)
	if err != nil {
		t.Fatal(err)
	}
	if spec == nil {
		t.Fatal("expected non-nil spec")
	}
	if spec.Schedule != "* * * * * *" || spec.ArchiveType != models.ArchiveTypeWAL || spec.SourceDir != dir {
		t.Fatalf("unexpected spec: %+v", spec)
	}
}

func TestParseArchiveSpec_MissingSchedule(t *testing.T) {
	dir := t.TempDir()
	cfg := map[string]interface{}{
		"archive": map[string]interface{}{
			"source_dir":  dir,
			"archive_type": "wal",
		},
	}
	b, _ := json.Marshal(cfg)
	plan := &models.BackupPlan{ID: "p1", Enabled: true, StorageConfig: b}
	_, err := parseArchiveSpec(plan)
	if err == nil {
		t.Fatal("expected error for missing schedule")
	}
}

func TestParseArchiveSpec_InvalidJSON(t *testing.T) {
	plan := &models.BackupPlan{ID: "p1", Enabled: true, StorageConfig: []byte("{not json")}
	_, err := parseArchiveSpec(plan)
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}
}

func TestParseArchiveSpec_MissingDir(t *testing.T) {
	cfg := map[string]interface{}{
		"archive": map[string]interface{}{
			"schedule":    "* * * * * *",
			"source_dir":  "/definitely/does/not/exist",
			"archive_type": "wal",
		},
	}
	b, _ := json.Marshal(cfg)
	plan := &models.BackupPlan{ID: "p1", Enabled: true, StorageConfig: b}
	_, err := parseArchiveSpec(plan)
	if err == nil {
		t.Fatal("expected error for missing source_dir")
	}
}

func TestParseArchiveSpec_DisabledReturnsNil(t *testing.T) {
	dir := t.TempDir()
	cfg := map[string]interface{}{
		"archive": map[string]interface{}{
			"schedule":    "* * * * * *",
			"source_dir":  dir,
			"archive_type": "wal",
			"enabled":     false,
		},
	}
	b, _ := json.Marshal(cfg)
	plan := &models.BackupPlan{ID: "p1", Enabled: true, StorageConfig: b}
	spec, err := parseArchiveSpec(plan)
	if err != nil {
		t.Fatal(err)
	}
	if spec != nil {
		t.Fatalf("expected nil for disabled, got %+v", spec)
	}
}

func TestInferArchiveType(t *testing.T) {
	cases := map[string]models.ArchiveType{
		"/var/lib/postgresql/15/main/pg_wal":         models.ArchiveTypeWAL,
		"/data/mysql-bin.000123":                       models.ArchiveTypeBinlog,
		"/data/mysql-data-binlog":                      models.ArchiveTypeBinlog,
		"/data/ob_clog/seg-1":                          models.ArchiveTypeClog,
		"/data/oceanbase/log":                          models.ArchiveTypeClog,
		"/var/data/unknown":                            "",
	}
	for in, want := range cases {
		if got := inferArchiveType(in); got != want {
			t.Errorf("inferArchiveType(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestParseArchiveSpec_UsesInferredType(t *testing.T) {
	dir := t.TempDir()
	cfg := map[string]interface{}{
		"archive": map[string]interface{}{
			"schedule":   "* * * * * *",
			"source_dir": dir,
			// archive_type intentionally omitted
		},
	}
	b, _ := json.Marshal(cfg)
	plan := &models.BackupPlan{ID: "p1", Enabled: true, StorageConfig: b}
	// inference depends on dir path content; when it's random we expect
	// an error (no inference possible).
	_, err := parseArchiveSpec(plan)
	if err == nil {
		t.Fatal("expected error when type cannot be inferred")
	}
	_ = filepath.Base(dir)
	_ = os.Getenv("PATH")
}

func TestLoadArchivesFromPlans_SkipsDisabled(t *testing.T) {
	s := NewArchiveScheduler(nil, nil)
	defer s.Stop()
	s.Start()
	plan := models.BackupPlan{ID: "p1", TenantID: "t1", Enabled: false}
	loaded, err := s.LoadArchivesFromPlans(context.Background(), "t1", []models.BackupPlan{plan})
	if err != nil {
		t.Fatal(err)
	}
	if loaded != 0 {
		t.Fatalf("expected 0 for disabled plan, got %d", loaded)
	}
}
