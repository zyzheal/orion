package executor

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// TestOBCLogManifestPath_Joins verifies the OB clog manifest path helper joins
// the scratch dir and backup id into the expected filename (design D5).
func TestOBCLogManifestPath_Joins(t *testing.T) {
	got := OBCLogManifestPath("/scratch", "b-1")
	want := filepath.Join("/scratch", "obclog-b-1-manifest.json")
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestOBCLogScriptPath_Joins(t *testing.T) {
	got := OBCLogScriptPath("/scratch", "b-2")
	want := filepath.Join("/scratch", "obclog-restore-b-2.sh")
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

// TestNewOBCLogExecutor_DefaultBin verifies the executor defaults to the
// production oblogminer binary path.
func TestNewOBCLogExecutor_DefaultBin(t *testing.T) {
	e := NewOBCLogExecutor()
	if e == nil {
		t.Fatal("expected non-nil executor")
	}
	if e.OblogminerBin != DefaultBinPath("oblogminer") {
		t.Fatalf("expected %q, got %q", DefaultBinPath("oblogminer"), e.OblogminerBin)
	}
	if e.Dialect() != DialectOceanBase {
		t.Fatalf("expected DialectOceanBase, got %v", e.Dialect())
	}
}

// TestPrepareOBCLogRecoveryPlan_RequiresBackupID verifies the plan builder
// fails closed when the base backup id is missing.
func TestPrepareOBCLogRecoveryPlan_RequiresBackupID(t *testing.T) {
	_, err := PrepareOBCLogRecoveryPlan(context.Background(), OBCLogRecoveryOptions{}, nil)
	if err == nil {
		t.Fatal("expected error when backup id missing")
	}
	if !strings.Contains(err.Error(), "backup id") {
		t.Fatalf("unexpected error %v", err)
	}
}

// TestPrepareOBCLogRecoveryPlan_RequiresBackupPath verifies the plan builder
// fails closed when the base backup path is missing.
func TestPrepareOBCLogRecoveryPlan_RequiresBackupPath(t *testing.T) {
	_, err := PrepareOBCLogRecoveryPlan(context.Background(), OBCLogRecoveryOptions{
		BackupID: "b-1",
	}, nil)
	if err == nil {
		t.Fatal("expected error when backup path missing")
	}
	if !strings.Contains(err.Error(), "backup path") {
		t.Fatalf("unexpected error %v", err)
	}
}

// TestPrepareOBCLogRecoveryPlan_RequiresTargetTime verifies the plan builder
// fails closed when TargetTime is nil — OB clog PITR cannot be planned without
// a replay stop point.
func TestPrepareOBCLogRecoveryPlan_RequiresTargetTime(t *testing.T) {
	dir := t.TempDir()
	seg := filepath.Join(dir, "clog-1")
	if err := os.WriteFile(seg, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	_, err := PrepareOBCLogRecoveryPlan(context.Background(), OBCLogRecoveryOptions{
		BackupID:     "b-1",
		BackupPath:   "/var/backups/base.csv",
		ArchivePaths: []string{seg},
		ScratchDir:   t.TempDir(),
		TargetConn:   ConnInfo{TenantName: "sys"},
	}, nil)
	if err == nil {
		t.Fatal("expected error when target time missing")
	}
	if !strings.Contains(err.Error(), "target time") {
		t.Fatalf("unexpected error %v", err)
	}
}

// TestPrepareOBCLogRecoveryPlan_RequiresArchivePaths verifies the plan builder
// fails closed when no clog segments are supplied — nothing to replay.
func TestPrepareOBCLogRecoveryPlan_RequiresArchivePaths(t *testing.T) {
	tt := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)
	_, err := PrepareOBCLogRecoveryPlan(context.Background(), OBCLogRecoveryOptions{
		BackupID:   "b-1",
		BackupPath: "/var/backups/base.csv",
		TargetTime: &tt,
		ScratchDir: t.TempDir(),
		TargetConn: ConnInfo{TenantName: "sys"},
	}, nil)
	if err == nil {
		t.Fatal("expected error when archive paths missing")
	}
	if !strings.Contains(err.Error(), "archive paths") {
		t.Fatalf("unexpected error %v", err)
	}
}

// TestPrepareOBCLogRecoveryPlan_RequiresSysTenant verifies the plan builder
// fails closed when TargetConn.TenantName != "sys" — oblogminer reads archived
// clog only from the sys tenant (design D2).
func TestPrepareOBCLogRecoveryPlan_RequiresSysTenant(t *testing.T) {
	tt := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)
	dir := t.TempDir()
	seg := filepath.Join(dir, "clog-1")
	if err := os.WriteFile(seg, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	_, err := PrepareOBCLogRecoveryPlan(context.Background(), OBCLogRecoveryOptions{
		BackupID:     "b-1",
		BackupPath:   "/var/backups/base.csv",
		ArchivePaths: []string{seg},
		TargetTime:   &tt,
		ScratchDir:   t.TempDir(),
		TargetConn:   ConnInfo{TenantName: "tenant1"},
	}, nil)
	if err == nil {
		t.Fatal("expected error when tenant is not sys")
	}
	if !strings.Contains(err.Error(), "sys tenant") {
		t.Fatalf("unexpected error %v", err)
	}
}

// TestPrepareOBCLogRecoveryPlan_HashesAndEmitsArtifacts is the happy path:
// it stats + hashes each clog segment, records RPO/RTO, and writes the runbook
// (0o700) + manifest (0o600) with a non-empty ManifestSHA256.
func TestPrepareOBCLogRecoveryPlan_HashesAndEmitsArtifacts(t *testing.T) {
	scratch := t.TempDir()
	srcDir := t.TempDir()
	src1 := filepath.Join(srcDir, "clog-1")
	src2 := filepath.Join(srcDir, "clog-2")
	if err := os.WriteFile(src1, []byte("clog-segment-1"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(src2, []byte("clog-segment-2"), 0o600); err != nil {
		t.Fatal(err)
	}
	tt := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)

	plan, err := PrepareOBCLogRecoveryPlan(context.Background(), OBCLogRecoveryOptions{
		BackupID:     "b-ok",
		BackupPath:   "/var/backups/base.csv",
		ArchivePaths: []string{src1, src2},
		TargetTime:   &tt,
		ScratchDir:   scratch,
		TargetConn:   ConnInfo{Host: "ob1", Port: "2881", User: "root", TenantName: "sys"},
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if plan == nil {
		t.Fatal("expected non-nil plan")
	}
	if plan.BackupID != "b-ok" {
		t.Fatalf("backup id mismatch %q", plan.BackupID)
	}
	if len(plan.ArchiveFiles) != 2 {
		t.Fatalf("expected 2 archive files, got %d", len(plan.ArchiveFiles))
	}
	for _, af := range plan.ArchiveFiles {
		if !fileExists(af.Path) {
			t.Fatalf("archive missing: %s", af.Path)
		}
		if af.Size <= 0 {
			t.Fatalf("archive size not recorded for %s", af.Path)
		}
		if af.SHA256 == "" {
			t.Fatalf("archive sha missing for %s", af.Path)
		}
	}
	if plan.ManifestSHA256 == "" {
		t.Fatal("manifest sha256 must be set")
	}
	if plan.ScriptPath == "" || !fileExists(plan.ScriptPath) {
		t.Fatalf("script not written: %q", plan.ScriptPath)
	}
	if !strings.HasPrefix(plan.TargetTime.String(), tt.String()) {
		t.Fatalf("target time mismatch: %v", plan.TargetTime)
	}
	if plan.Host != "ob1" || plan.Port != "2881" || plan.User != "root" || plan.Tenant != "sys" {
		t.Fatalf("connection metadata mismatch: %+v", plan)
	}
	// The manifest itself must exist with the derived path.
	if !fileExists(OBCLogManifestPath(scratch, "b-ok")) {
		t.Fatalf("manifest not written at %s", OBCLogManifestPath(scratch, "b-ok"))
	}
}

// TestPrepareOBCLogRecoveryPlan_FilePermissions verifies the runbook is 0o700
// and the manifest 0o600 (design D5, G2 baseline).
func TestPrepareOBCLogRecoveryPlan_FilePermissions(t *testing.T) {
	scratch := t.TempDir()
	srcDir := t.TempDir()
	seg := filepath.Join(srcDir, "clog-1")
	if err := os.WriteFile(seg, []byte("data"), 0o600); err != nil {
		t.Fatal(err)
	}
	tt := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)
	plan, err := PrepareOBCLogRecoveryPlan(context.Background(), OBCLogRecoveryOptions{
		BackupID:     "b-perm",
		BackupPath:   "/var/backups/base.csv",
		ArchivePaths: []string{seg},
		TargetTime:   &tt,
		ScratchDir:   scratch,
		TargetConn:   ConnInfo{TenantName: "sys"},
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	sfi, err := os.Stat(plan.ScriptPath)
	if err != nil {
		t.Fatal(err)
	}
	if sfi.Mode().Perm() != 0o700 {
		t.Fatalf("expected script 0700, got %v", sfi.Mode().Perm())
	}
	mfi, err := os.Stat(plan.ManifestPath)
	if err != nil {
		t.Fatal(err)
	}
	if mfi.Mode().Perm() != 0o600 {
		t.Fatalf("expected manifest 0600, got %v", mfi.Mode().Perm())
	}
}

// TestPrepareOBCLogRecoveryPlan_EmptyArchivePathFails verifies an empty segment
// path in the middle of the list is a hard error (fail-closed).
func TestPrepareOBCLogRecoveryPlan_EmptyArchivePathFails(t *testing.T) {
	dir := t.TempDir()
	f1 := filepath.Join(dir, "clog-1")
	if err := os.WriteFile(f1, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	tt := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)
	_, err := PrepareOBCLogRecoveryPlan(context.Background(), OBCLogRecoveryOptions{
		BackupID:     "b-err",
		BackupPath:   "/var/backups/base.csv",
		ArchivePaths: []string{f1, ""},
		TargetTime:   &tt,
		ScratchDir:   t.TempDir(),
		TargetConn:   ConnInfo{TenantName: "sys"},
	}, nil)
	if err == nil {
		t.Fatal("expected error for empty archive path")
	}
	if !strings.Contains(err.Error(), "empty path") {
		t.Fatalf("unexpected error %v", err)
	}
}

// TestPrepareOBCLogRecoveryPlan_MissingArchiveFails verifies a missing clog
// segment is a hard error (fail-closed) rather than a silent skip.
func TestPrepareOBCLogRecoveryPlan_MissingArchiveFails(t *testing.T) {
	tt := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)
	_, err := PrepareOBCLogRecoveryPlan(context.Background(), OBCLogRecoveryOptions{
		BackupID:     "b-err",
		BackupPath:   "/var/backups/base.csv",
		ArchivePaths: []string{"/tmp/definitely-not-exists-clog-12345"},
		TargetTime:   &tt,
		ScratchDir:   t.TempDir(),
		TargetConn:   ConnInfo{TenantName: "sys"},
	}, nil)
	if err == nil {
		t.Fatal("expected error for missing archive file")
	}
}

// TestPrepareOBCLogRecoveryPlan_CancelsOnContextDone verifies a cancelled
// context aborts plan generation.
func TestPrepareOBCLogRecoveryPlan_CancelsOnContextDone(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	tt := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)
	_, err := PrepareOBCLogRecoveryPlan(ctx, OBCLogRecoveryOptions{
		BackupID:     "b-cancel",
		BackupPath:   "/var/backups/base.csv",
		ArchivePaths: []string{"/tmp/whatever"},
		TargetTime:   &tt,
		ScratchDir:   t.TempDir(),
		TargetConn:   ConnInfo{TenantName: "sys"},
	}, nil)
	if err == nil {
		t.Fatal("expected error when context already cancelled")
	}
}

// TestBuildOBCLogRunbook_StateChangingCommented verifies the runbook-first
// safety default (design D4): ALTER SYSTEM ARCHIVELOG, oblogminer replay, and
// ALTER SYSTEM RESTORE must all be emitted as `#` comments for DBA review.
func TestBuildOBCLogRunbook_StateChangingCommented(t *testing.T) {
	tt := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)
	s := buildOBCLogRunbook(&OBCLogRecoveryPlan{
		BackupID:     "b-1",
		BackupPath:   "/var/backups/base.csv",
		ArchiveDir:   "/var/lib/ob_archive_log",
		TargetTime:   &tt,
		ArchiveFiles: []OBCLogArchiveInfo{{Path: "/x/clog-1", SHA256: "abc", ModTime: tt.Add(-time.Hour)}},
		Host:         "ob1",
		Port:         "2881",
		User:         "root",
		Tenant:       "sys",
		GeneratedAt:  tt,
	})
	// All DB-mutating commands must be commented out.
	for _, cmd := range []string{"ALTER SYSTEM ARCHIVELOG", "oblogminer", "ALTER SYSTEM RESTORE"} {
		idx := strings.Index(s, cmd)
		if idx < 0 {
			t.Fatalf("missing %s in runbook", cmd)
		}
		line := extractLine(idx, s)
		trimmed := strings.TrimSpace(line)
		if !strings.HasPrefix(trimmed, "#") {
			t.Fatalf("command %s not commented: %q", cmd, line)
		}
	}
}

// TestBuildOBCLogRunbook_VerificationRunsByDefault verifies the idempotent,
// read-only steps (checksum verify, SHOW TENANT, SELECT 1) are NOT commented —
// they run by default (design D4).
func TestBuildOBCLogRunbook_VerificationRunsByDefault(t *testing.T) {
	s := buildOBCLogRunbook(&OBCLogRecoveryPlan{
		BackupID:     "b-1",
		BackupPath:   "/var/backups/base.csv",
		ArchiveDir:   "/var/lib/ob_archive_log",
		ArchiveFiles: []OBCLogArchiveInfo{{Path: "/x/clog-1", SHA256: "abc"}},
		Host:         "ob1",
		Port:         "2881",
		User:         "root",
		Tenant:       "sys",
	})
	for _, cmd := range []string{"sha256sum", "SHOW TENANT", "SELECT 1"} {
		idx := strings.Index(s, cmd)
		if idx < 0 {
			t.Fatalf("missing %s in runbook", cmd)
		}
		line := extractLine(idx, s)
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "#") {
			t.Fatalf("verification command %s should run by default, but is commented: %q", cmd, line)
		}
	}
}

// TestBuildOBCLogRunbook_PasswordNeverPlaintext verifies the sys password is
// only referenced via $OB_PASSWORD env, never written in plaintext anywhere in
// the runbook.
func TestBuildOBCLogRunbook_PasswordNeverPlaintext(t *testing.T) {
	s := buildOBCLogRunbook(&OBCLogRecoveryPlan{
		BackupID:     "b-1",
		BackupPath:   "/var/backups/base.csv",
		ArchiveDir:   "/var/lib/ob_archive_log",
		ArchiveFiles: []OBCLogArchiveInfo{{Path: "/x/clog-1", SHA256: "abc"}},
		Host:         "ob1",
		Port:         "2881",
		User:         "root",
		Tenant:       "sys",
	})
	if !strings.Contains(s, "OB_PASSWORD") {
		t.Fatal("runbook must reference OB_PASSWORD env")
	}
	if strings.Contains(s, "-p s3cret") || strings.Contains(s, "-ps3cret") || strings.Contains(s, "OB_PASSWORD=s3cret") {
		t.Fatal("runbook must never embed a plaintext password")
	}
}

// TestOceanBaseExecutor_Restore_PITRWiring verifies the G4 wiring: when
// TargetTime + ArchivePaths + sys TargetConn + BackupID are set,
// OceanBaseExecutor.Restore delegates to PrepareOBCLogRecoveryPlan and fills
// ScriptPath/ManifestPath/ArchReplayed/ArchSizes on the result.
func TestOceanBaseExecutor_Restore_PITRWiring(t *testing.T) {
	dir := t.TempDir()
	srcDir := t.TempDir()
	seg1 := filepath.Join(srcDir, "clog-1")
	seg2 := filepath.Join(srcDir, "clog-2")
	if err := os.WriteFile(seg1, []byte("a"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(seg2, []byte("b"), 0o600); err != nil {
		t.Fatal(err)
	}
	art := filepath.Join(dir, "restore.csv")
	if err := os.WriteFile(art, []byte("a,b\n1,2\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	tt := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)

	// Fake ob-loader-dumper so Restore reaches the PITR branch without a real
	// subprocess for the non-PITR --load path.
	fakeBin := filepath.Join(dir, "ob-loader-dumper")
	if err := os.WriteFile(fakeBin, []byte("#!/bin/sh\nexit 0\n"), 0o755); err != nil {
		t.Fatal(err)
	}

	e := &OceanBaseExecutor{ToolBin: fakeBin}
	res, err := e.Restore(context.Background(), RestoreOptions{
		BackupID:     "b-pitr",
		BackupPath:   art,
		TargetTime:   &tt,
		ArchivePaths: []string{seg1, seg2},
		ScratchDir:   dir,
		TargetConn:   ConnInfo{Host: "ob1", Port: "2881", DB: "app", User: "root", Password: "syspass", TenantName: "sys"},
	})
	if err != nil {
		t.Fatalf("restore failed: %v", err)
	}
	if res.ScriptPath == "" || !fileExists(res.ScriptPath) {
		t.Fatalf("script not emitted: %q", res.ScriptPath)
	}
	if res.ManifestPath == "" || !fileExists(res.ManifestPath) {
		t.Fatalf("manifest not emitted: %q", res.ManifestPath)
	}
	if res.ArchReplayed != 2 {
		t.Fatalf("expected 2 replayed archives, got %d", res.ArchReplayed)
	}
	if len(res.ArchSizes) != 2 {
		t.Fatalf("expected 2 arch sizes, got %d", len(res.ArchSizes))
	}
	if res.ArchSizes[0] != int64(len("a")) || res.ArchSizes[1] != int64(len("b")) {
		t.Fatalf("arch sizes mismatch: %v", res.ArchSizes)
	}
}

// TestOceanBaseExecutor_Restore_PITRRequiresBackupID verifies the PITR branch
// fails closed when BackupID is empty.
func TestOceanBaseExecutor_Restore_PITRRequiresBackupID(t *testing.T) {
	dir := t.TempDir()
	srcDir := t.TempDir()
	seg := filepath.Join(srcDir, "clog-1")
	if err := os.WriteFile(seg, []byte("a"), 0o600); err != nil {
		t.Fatal(err)
	}
	art := filepath.Join(dir, "restore.csv")
	if err := os.WriteFile(art, []byte("a,b\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	tt := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)

	fakeBin := filepath.Join(dir, "ob-loader-dumper")
	if err := os.WriteFile(fakeBin, []byte("#!/bin/sh\nexit 0\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	e := &OceanBaseExecutor{ToolBin: fakeBin}
	_, err := e.Restore(context.Background(), RestoreOptions{
		BackupPath:   art,
		TargetTime:   &tt,
		ArchivePaths: []string{seg},
		ScratchDir:   dir,
		TargetConn:   ConnInfo{TenantName: "sys"},
	})
	if err == nil {
		t.Fatal("expected error when backup id missing in PITR mode")
	}
	if !strings.Contains(err.Error(), "BackupID") {
		t.Fatalf("unexpected error %v", err)
	}
}

// TestOceanBaseExecutor_Restore_PITRRequiresSysTenant verifies the PITR branch
// fails closed when TargetConn.TenantName != "sys".
func TestOceanBaseExecutor_Restore_PITRRequiresSysTenant(t *testing.T) {
	dir := t.TempDir()
	srcDir := t.TempDir()
	seg := filepath.Join(srcDir, "clog-1")
	if err := os.WriteFile(seg, []byte("a"), 0o600); err != nil {
		t.Fatal(err)
	}
	art := filepath.Join(dir, "restore.csv")
	if err := os.WriteFile(art, []byte("a,b\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	tt := time.Date(2026, 8, 31, 12, 0, 0, 0, time.UTC)

	fakeBin := filepath.Join(dir, "ob-loader-dumper")
	if err := os.WriteFile(fakeBin, []byte("#!/bin/sh\nexit 0\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	e := &OceanBaseExecutor{ToolBin: fakeBin}
	_, err := e.Restore(context.Background(), RestoreOptions{
		BackupID:     "b-pitr",
		BackupPath:   art,
		TargetTime:   &tt,
		ArchivePaths: []string{seg},
		ScratchDir:   dir,
		TargetConn:   ConnInfo{TenantName: "tenant1"},
	})
	if err == nil {
		t.Fatal("expected error when tenant is not sys in PITR mode")
	}
	if !strings.Contains(err.Error(), "sys tenant") {
		t.Fatalf("unexpected error %v", err)
	}
}

// TestOceanBaseExecutor_Restore_NonPITRKeepsReplayArchives verifies the
// non-PITR path still walks ArchivePaths via replayArchives (stat + size) when
// no TargetTime is set.
func TestOceanBaseExecutor_Restore_NonPITRKeepsReplayArchives(t *testing.T) {
	dir := t.TempDir()
	srcDir := t.TempDir()
	seg := filepath.Join(srcDir, "clog-1")
	if err := os.WriteFile(seg, []byte("segment"), 0o600); err != nil {
		t.Fatal(err)
	}
	art := filepath.Join(dir, "restore.csv")
	if err := os.WriteFile(art, []byte("a,b\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	fakeBin := filepath.Join(dir, "ob-loader-dumper")
	if err := os.WriteFile(fakeBin, []byte("#!/bin/sh\nexit 0\n"), 0o755); err != nil {
		t.Fatal(err)
	}

	e := &OceanBaseExecutor{ToolBin: fakeBin}
	res, err := e.Restore(context.Background(), RestoreOptions{
		BackupPath:   art,
		ArchivePaths: []string{seg},
		TargetConn:   ConnInfo{Host: "h", Port: "2881", DB: "app", User: "u", TenantName: "tenant1"},
	})
	if err != nil {
		t.Fatalf("restore failed: %v", err)
	}
	if res.ArchReplayed != 1 {
		t.Fatalf("expected 1 replayed archive, got %d", res.ArchReplayed)
	}
	if len(res.ArchSizes) != 1 || res.ArchSizes[0] != int64(len("segment")) {
		t.Fatalf("arch sizes mismatch: %v", res.ArchSizes)
	}
	if res.ScriptPath != "" {
		t.Fatalf("non-PITR path should not emit a script, got %q", res.ScriptPath)
	}
}
