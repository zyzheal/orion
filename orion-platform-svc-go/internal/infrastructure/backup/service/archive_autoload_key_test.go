package service

import (
	"encoding/base64"
	"encoding/json"
	"testing"

	"orion/platform-svc-go/internal/infrastructure/backup/models"
)

// TestParseArchiveSpec_ArchiveKeyOverridesPlanKey verifies the precedence:
// archive.encryption_key (base64) takes priority over plan.encryption_key.
func TestParseArchiveSpec_ArchiveKeyOverridesPlanKey(t *testing.T) {
	dir := t.TempDir()
	archiveKey := []byte("01234567890123456789012345678901")
	planKey := []byte("99999999999999999999999999999999")
	cfg := map[string]interface{}{
		"archive": map[string]interface{}{
			"schedule":       "* * * * * *",
			"source_dir":     dir,
			"archive_type":   "wal",
			"encryption_key": base64.StdEncoding.EncodeToString(archiveKey),
		},
	}
	b, _ := json.Marshal(cfg)
	plan := &models.BackupPlan{
		ID: "p1", Enabled: true, StorageConfig: b,
		EncryptionKey: strPtr(string(planKey)),
	}
	spec, err := parseArchiveSpec(plan)
	if err != nil {
		t.Fatal(err)
	}
	if spec == nil {
		t.Fatal("expected non-nil spec")
	}
	if string(spec.EncryptionKey) != string(archiveKey) {
		t.Fatalf("expected archive key, got %q", string(spec.EncryptionKey))
	}
}

// TestParseArchiveSpec_PlanKeyFallback verifies the archive block falls
// back to the plan key when no archive key is set.
func TestParseArchiveSpec_PlanKeyFallback(t *testing.T) {
	dir := t.TempDir()
	planKey := []byte("99999999999999999999999999999999")
	cfg := map[string]interface{}{
		"archive": map[string]interface{}{
			"schedule":     "* * * * * *",
			"source_dir":   dir,
			"archive_type": "wal",
		},
	}
	b, _ := json.Marshal(cfg)
	plan := &models.BackupPlan{
		ID: "p1", Enabled: true, StorageConfig: b,
		EncryptionKey: strPtr(string(planKey)),
	}
	spec, err := parseArchiveSpec(plan)
	if err != nil {
		t.Fatal(err)
	}
	if spec == nil || string(spec.EncryptionKey) != string(planKey) {
		t.Fatalf("expected plan key fallback, got %v", spec)
	}
}

// TestParseArchiveSpec_InvalidBase64KeyFails verifies the error path for
// a malformed archive key.
func TestParseArchiveSpec_InvalidBase64KeyFails(t *testing.T) {
	dir := t.TempDir()
	cfg := map[string]interface{}{
		"archive": map[string]interface{}{
			"schedule":       "* * * * * *",
			"source_dir":     dir,
			"archive_type":   "wal",
			"encryption_key": "!!!not-base64!!!",
		},
	}
	b, _ := json.Marshal(cfg)
	plan := &models.BackupPlan{ID: "p1", Enabled: true, StorageConfig: b}
	_, err := parseArchiveSpec(plan)
	if err == nil {
		t.Fatal("expected error for invalid base64 key")
	}
}

// TestParseArchiveSpec_WrongLengthKeyFails verifies the 32-byte check.
func TestParseArchiveSpec_WrongLengthKeyFails(t *testing.T) {
	dir := t.TempDir()
	shortKey := []byte("only-16-bytes!!!!")
	cfg := map[string]interface{}{
		"archive": map[string]interface{}{
			"schedule":       "* * * * * *",
			"source_dir":     dir,
			"archive_type":   "wal",
			"encryption_key": base64.StdEncoding.EncodeToString(shortKey),
		},
	}
	b, _ := json.Marshal(cfg)
	plan := &models.BackupPlan{ID: "p1", Enabled: true, StorageConfig: b}
	_, err := parseArchiveSpec(plan)
	if err == nil {
		t.Fatal("expected error for 16-byte key")
	}
}

// TestParseArchiveSpec_NoKeyProducesUnencryptedArchive verifies the
// no-key path leaves EncryptionKey as nil.
func TestParseArchiveSpec_NoKeyProducesUnencryptedArchive(t *testing.T) {
	dir := t.TempDir()
	cfg := map[string]interface{}{
		"archive": map[string]interface{}{
			"schedule":     "* * * * * *",
			"source_dir":   dir,
			"archive_type": "wal",
		},
	}
	b, _ := json.Marshal(cfg)
	plan := &models.BackupPlan{ID: "p1", Enabled: true, StorageConfig: b}
	spec, err := parseArchiveSpec(plan)
	if err != nil {
		t.Fatal(err)
	}
	if spec == nil {
		t.Fatal("expected non-nil spec")
	}
	if spec.EncryptionKey != nil {
		t.Fatalf("expected nil key, got %q", string(spec.EncryptionKey))
	}
}

