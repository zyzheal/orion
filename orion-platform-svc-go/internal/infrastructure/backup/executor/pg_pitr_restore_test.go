package executor

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// writeFakeRestoreBin writes an executable no-op script that RunCommand can
// actually run, letting PGExecutor.Restore reach the PITR branch (which only
// executes after pg_restore succeeds).
func writeFakeRestoreBin(t *testing.T) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), "pg_restore")
	if err := os.WriteFile(p, []byte("#!/bin/sh\nexit 0\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	return p
}

// writeWALFiles creates n distinct archive segments with distinguishable sizes.
func writeWALFiles(t *testing.T, dir string, n int) []string {
	t.Helper()
	var paths []string
	for i := 0; i < n; i++ {
		p := filepath.Join(dir, "00000001000000000000000"+string(rune('1'+i)))
		content := strings.Repeat("wal-segment-"+string(rune('A'+i))+"\n", i+1)
		if err := os.WriteFile(p, []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
		paths = append(paths, p)
	}
	return paths
}

func TestPGExecutor_RestorePITR_GeneratesPlan(t *testing.T) {
	restoreBin := writeFakeRestoreBin(t)
	scratch := t.TempDir()
	walDir := t.TempDir()
	archives := writeWALFiles(t, walDir, 2)
	tt := time.Date(2026, 8, 31, 10, 0, 0, 0, time.UTC)

	e := &PGExecutor{RestoreBin: restoreBin}
	result, err := e.Restore(context.Background(), RestoreOptions{
		BackupID:     "b-pitr-1",
		BackupPath:   "/var/backups/base.dump",
		TargetConn:   ConnInfo{Host: "localhost", Port: "5432", DB: "test", User: "postgres"},
		Clean:        true,
		IfExists:     true,
		TargetTime:   &tt,
		ArchivePaths: archives,
		ScratchDir:   scratch,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Runbook + manifest artifacts must exist on disk.
	if result.ScriptPath == "" || !fileExists(result.ScriptPath) {
		t.Fatalf("runbook not written: %q", result.ScriptPath)
	}
	if result.ManifestPath == "" || !fileExists(result.ManifestPath) {
		t.Fatalf("manifest not written: %q", result.ManifestPath)
	}

	// Archive accounting reflects the plan, not placeholder work.
	if result.ArchReplayed != len(archives) {
		t.Fatalf("expected %d archives replayed, got %d", len(archives), result.ArchReplayed)
	}
	if len(result.ArchSizes) != len(archives) {
		t.Fatalf("expected %d sizes, got %d", len(archives), len(result.ArchSizes))
	}
	for i, p := range archives {
		fi, err := os.Stat(p)
		if err != nil {
			t.Fatal(err)
		}
		if result.ArchSizes[i] != fi.Size() {
			t.Fatalf("size %d mismatch: got %d want %d", i, result.ArchSizes[i], fi.Size())
		}
	}

	// Manifest JSON must parse and carry the expected fields.
	raw, err := os.ReadFile(result.ManifestPath)
	if err != nil {
		t.Fatal(err)
	}
	var manifest PGRecoveryPlan
	if err := json.Unmarshal(raw, &manifest); err != nil {
		t.Fatalf("manifest not valid json: %v", err)
	}
	if manifest.BackupID != "b-pitr-1" {
		t.Fatalf("manifest backup id mismatch: %q", manifest.BackupID)
	}
	if len(manifest.ArchiveFiles) != len(archives) {
		t.Fatalf("manifest archive count mismatch: %d", len(manifest.ArchiveFiles))
	}
	if manifest.ManifestSHA256 == "" {
		t.Fatal("manifest sha256 missing")
	}
	if manifest.TargetTime == nil || !manifest.TargetTime.Equal(tt) {
		t.Fatalf("manifest target time mismatch: %v", manifest.TargetTime)
	}

	// Runbook must embed the checksum verification steps for each segment.
	script, err := os.ReadFile(result.ScriptPath)
	if err != nil {
		t.Fatal(err)
	}
	s := string(script)
	for _, af := range manifest.ArchiveFiles {
		if !strings.Contains(s, af.SHA256) {
			t.Fatalf("runbook missing checksum for %s", af.Path)
		}
	}
}

func TestPGExecutor_RestorePITR_RequiresBackupID(t *testing.T) {
	restoreBin := writeFakeRestoreBin(t)
	walDir := t.TempDir()
	archives := writeWALFiles(t, walDir, 1)
	tt := time.Now()

	e := &PGExecutor{RestoreBin: restoreBin}
	_, err := e.Restore(context.Background(), RestoreOptions{
		BackupPath:   "/var/backups/base.dump",
		TargetConn:   ConnInfo{Host: "localhost", Port: "5432", DB: "test"},
		TargetTime:   &tt,
		ArchivePaths: archives,
		ScratchDir:   t.TempDir(),
	})
	if err == nil {
		t.Fatal("expected error when backup id missing in PITR mode")
	}
	if !strings.Contains(err.Error(), "BackupID") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestPGExecutor_RestorePITR_MissingRestoreBinFails(t *testing.T) {
	walDir := t.TempDir()
	archives := writeWALFiles(t, walDir, 1)
	tt := time.Now()

	// pg_restore itself fails (binary missing) before the PITR branch runs.
	e := &PGExecutor{RestoreBin: "/definitely/does/not/exist/pg_restore"}
	result, err := e.Restore(context.Background(), RestoreOptions{
		BackupID:     "b-pitr-missing",
		BackupPath:   "/var/backups/base.dump",
		TargetConn:   ConnInfo{Host: "localhost", Port: "5432", DB: "test"},
		TargetTime:   &tt,
		ArchivePaths: archives,
		ScratchDir:   t.TempDir(),
	})
	if err == nil {
		t.Fatal("expected error when pg_restore binary missing")
	}
	if result == nil || len(result.Errors) == 0 {
		t.Fatal("expected stderr captured in result errors")
	}
}

func TestPGExecutor_RestoreNonPITR_AccountsArchives(t *testing.T) {
	restoreBin := writeFakeRestoreBin(t)
	walDir := t.TempDir()
	archives := writeWALFiles(t, walDir, 2)

	// No TargetTime → non-PITR: fall back to replayArchives accounting.
	e := &PGExecutor{RestoreBin: restoreBin}
	result, err := e.Restore(context.Background(), RestoreOptions{
		BackupID:     "b-non-pitr",
		BackupPath:   "/var/backups/base.dump",
		TargetConn:   ConnInfo{Host: "localhost", Port: "5432", DB: "test"},
		ArchivePaths: archives,
		ScratchDir:   t.TempDir(),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.ArchReplayed != len(archives) {
		t.Fatalf("expected %d replayed, got %d", len(archives), result.ArchReplayed)
	}
	if len(result.ArchSizes) != len(archives) {
		t.Fatalf("expected %d sizes, got %d", len(archives), len(result.ArchSizes))
	}
	// Non-PITR must not emit plan artifacts.
	if result.ScriptPath != "" || result.ManifestPath != "" {
		t.Fatalf("non-PITR restore should not produce plan artifacts: %q %q", result.ScriptPath, result.ManifestPath)
	}
}
