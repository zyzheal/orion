package executor

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// TestBuildDB2Env verifies the password is routed through DB2_PWD, never argv
// (G2 baseline: env-only credentials).
func TestBuildDB2Env(t *testing.T) {
	env := buildDB2Env(ConnInfo{Host: "h", Port: "50000", DB: "SAMPLE", User: "u", Password: "p"})
	joined := strings.Join(env, " ")
	for _, want := range []string{
		"DB2_HOST=h", "DB2_PORT=50000", "DB2_DATABASE=SAMPLE", "DB2_USER=u", "DB2_PWD=p",
	} {
		if !strings.Contains(joined, want) {
			t.Errorf("expected %q in env", want)
		}
	}
}

// TestBuildDB2BackupArgs verifies the CLP argument layout: online full backup
// into the parent directory of the output path.
func TestBuildDB2BackupArgs(t *testing.T) {
	got := buildDB2BackupArgs(BackupOptions{
		OutputPath: "/tmp/backups/sample.bak",
		Compression: 2,
	}, ConnInfo{DB: "SAMPLE"})
	joined := strings.Join(got, " ")
	for _, want := range []string{
		"backup", "database", "SAMPLE", "to", "/tmp/backups", "online", "compress",
	} {
		if !strings.Contains(joined, want) {
			t.Errorf("expected %q in %s", want, joined)
		}
	}
}

func TestBuildDB2BackupArgsOffline(t *testing.T) {
	got := buildDB2BackupArgs(BackupOptions{OutputPath: "/tmp/backups/sample.bak", Type: "offline"}, ConnInfo{DB: "SAMPLE"})
	joined := strings.Join(got, " ")
	if strings.Contains(joined, "online") {
		t.Errorf("offline backup must not pass online, got %s", joined)
	}
}

// TestDB2Executor_Backup_NoPasswordInArgv runs Backup against a fake db2 that
// records argv and env, asserts the plaintext password only travels via
// DB2_PWD, and that SHA256 integrates on the produced artifact.
func TestDB2Executor_Backup_NoPasswordInArgv(t *testing.T) {
	dir := t.TempDir()
	argsFile := filepath.Join(dir, "args.txt")
	envFile := filepath.Join(dir, "env.txt")
	fakeBin := filepath.Join(dir, "db2")
	outPath := filepath.Join(dir, "sample.bak")
	script := fmt.Sprintf(`#!/bin/sh
printf '%%s\n' "$@" > %s
env | grep '^DB2_PWD=' > %s
printf '%%s' 'db2-backup-payload' > %s
`, argsFile, envFile, outPath)
	if err := os.WriteFile(fakeBin, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}

	e := &DB2Executor{DB2Bin: fakeBin}
	res, err := e.Backup(context.Background(), ConnInfo{DB: "SAMPLE", User: "u", Password: "s3cret"}, BackupOptions{
		OutputPath: outPath,
	})
	if err != nil {
		t.Fatalf("backup failed: %v", err)
	}

	rawArgs, _ := os.ReadFile(argsFile)
	args := strings.Join(strings.Fields(string(rawArgs)), " ")
	if strings.Contains(args, "s3cret") {
		t.Fatalf("password leaked into argv: %s", args)
	}
	rawEnv, _ := os.ReadFile(envFile)
	if !strings.Contains(string(rawEnv), "DB2_PWD=s3cret") {
		t.Fatalf("expected DB2_PWD in child env, got %q", string(rawEnv))
	}

	wantSum, _ := SHA256File(outPath)
	if res.ChecksumSHA256 != wantSum {
		t.Fatalf("checksum mismatch: got %q want %q", res.ChecksumSHA256, wantSum)
	}
	if res.SizeBytes == 0 {
		t.Fatal("expected non-zero size")
	}
}

func TestDB2Executor_Backup_EncryptionProducesNonPlainText(t *testing.T) {
	dir := t.TempDir()
	fakeBin := filepath.Join(dir, "db2")
	outPath := filepath.Join(dir, "sample.bak")
	script := fmt.Sprintf("#!/bin/sh\nprintf '%%s' 'db2-plaintext-payload' > %s\n", outPath)
	if err := os.WriteFile(fakeBin, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}

	key := []byte(strings.Repeat("k", 32))
	e := &DB2Executor{DB2Bin: fakeBin}
	res, err := e.Backup(context.Background(), ConnInfo{DB: "SAMPLE", User: "u"}, BackupOptions{
		OutputPath: outPath,
		EncryptKey: key,
	})
	if err != nil {
		t.Fatalf("backup failed: %v", err)
	}
	if !res.Encrypted {
		t.Fatal("expected Encrypted=true")
	}
	plain, _ := os.ReadFile(outPath)
	if string(plain) == "db2-plaintext-payload" {
		t.Fatal("artifact still contains plaintext; encryption did not run")
	}
	if err := DecryptFile(outPath, filepath.Join(dir, "dec"), key); err != nil {
		t.Fatalf("decrypt failed: %v", err)
	}
	dec, _ := os.ReadFile(filepath.Join(dir, "dec"))
	if string(dec) != "db2-plaintext-payload" {
		t.Fatalf("decrypted content mismatch: %q", string(dec))
	}
}

func TestDB2Executor_Backup_RequiresDBUser(t *testing.T) {
	e := NewDB2Executor()
	_, err := e.Backup(context.Background(), ConnInfo{Host: "h"}, BackupOptions{OutputPath: "/tmp/x.bak"})
	if err == nil || !strings.Contains(err.Error(), "database name is required") {
		t.Fatalf("expected database-required error, got %v", err)
	}
	_, err = e.Backup(context.Background(), ConnInfo{DB: "SAMPLE"}, BackupOptions{OutputPath: "/tmp/x.bak"})
	if err == nil || !strings.Contains(err.Error(), "user is required") {
		t.Fatalf("expected user-required error, got %v", err)
	}
}

// TestDB2Executor_RestorePITR_GeneratesRunbook verifies the Db2 recovery plan:
// state-changing commands (restore database / rollforward) are `#`-commented
// for DBA review, non-destructive verification runs, and archive accounting
// reflects the plan.
func TestDB2Executor_RestorePITR_GeneratesRunbook(t *testing.T) {
	dir := t.TempDir()
	art := filepath.Join(dir, "backup.bak")
	if err := os.WriteFile(art, []byte("a,b\n1,2\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	walDir := t.TempDir()
	archives := writeWALFiles(t, walDir, 2)
	tt := time.Date(2026, 8, 31, 10, 0, 0, 0, time.UTC)

	e := NewDB2Executor()
	result, err := e.Restore(context.Background(), RestoreOptions{
		BackupID:     "b-db2-1",
		BackupPath:   art,
		TargetConn:   ConnInfo{DB: "SAMPLE", User: "u"},
		TargetTime:   &tt,
		ArchivePaths: archives,
		ScratchDir:   dir,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.ScriptPath == "" || !fileExists(result.ScriptPath) {
		t.Fatalf("runbook not written: %q", result.ScriptPath)
	}
	script, err := os.ReadFile(result.ScriptPath)
	if err != nil {
		t.Fatal(err)
	}
	s := string(script)
	// Non-destructive verification runs by default.
	if !strings.Contains(s, "db2 list backup images for SAMPLE") {
		t.Errorf("expected list backup images, got:\n%s", s)
	}
	// State-changing commands must be commented out for DBA review.
	if !strings.Contains(s, "# db2 restore database SAMPLE") {
		t.Errorf("expected commented restore, got:\n%s", s)
	}
	if !strings.Contains(s, "# db2 rollforward database SAMPLE") {
		t.Errorf("expected commented rollforward, got:\n%s", s)
	}
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
}

func TestDB2Executor_RestorePITR_RequiresBackupID(t *testing.T) {
	dir := t.TempDir()
	archives := writeWALFiles(t, dir, 1)
	tt := time.Now()
	e := NewDB2Executor()
	_, err := e.Restore(context.Background(), RestoreOptions{
		BackupPath:   filepath.Join(dir, "b.bak"),
		TargetConn:   ConnInfo{DB: "SAMPLE", User: "u"},
		TargetTime:   &tt,
		ArchivePaths: archives,
		ScratchDir:   dir,
	})
	if err == nil || !strings.Contains(err.Error(), "BackupID") {
		t.Fatalf("expected BackupID error, got %v", err)
	}
}

func TestDB2Executor_RestoreNonPITR_AccountsArchives(t *testing.T) {
	dir := t.TempDir()
	archives := writeWALFiles(t, dir, 2)
	e := NewDB2Executor()
	result, err := e.Restore(context.Background(), RestoreOptions{
		BackupID:     "b-db2-n",
		BackupPath:   filepath.Join(dir, "b.bak"),
		TargetConn:   ConnInfo{DB: "SAMPLE", User: "u"},
		ArchivePaths: archives,
		ScratchDir:   dir,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.ArchReplayed != len(archives) {
		t.Fatalf("expected %d replayed, got %d", len(archives), result.ArchReplayed)
	}
	if result.ScriptPath != "" {
		t.Fatalf("non-PITR restore should not produce a runbook: %q", result.ScriptPath)
	}
}
