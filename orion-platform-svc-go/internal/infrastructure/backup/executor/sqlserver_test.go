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

// TestBuildSQLServerEnv verifies the password is routed through SQLCMD_PWD,
// never argv (G2 baseline: env-only credentials).
func TestBuildSQLServerEnv(t *testing.T) {
	env := buildSQLServerEnv(ConnInfo{Host: "h", Port: "1433", DB: "master", User: "u", Password: "p"})
	joined := strings.Join(env, " ")
	for _, want := range []string{
		"SQLCMD_PORT=1433", "SQLCMD_USER=u", "SQLCMD_PWD=p",
	} {
		if !strings.Contains(joined, want) {
			t.Errorf("expected %q in env", want)
		}
	}
}

// TestBuildSQLServerBackupArgs verifies the sqlcmd argument layout for a full
// database backup, including the quoted T-SQL batch and ON ERROR EXIT (-b).
func TestBuildSQLServerBackupArgs(t *testing.T) {
	got := buildSQLServerBackupArgs(BackupOptions{
		OutputPath: "/tmp/backups/sample.bak",
	}, ConnInfo{Host: "h", Port: "1433", DB: "SAMPLE", User: "u"})
	joined := strings.Join(got, " ")
	for _, want := range []string{
		"-S h,1433", "-U u", "-b",
		"BACKUP DATABASE [SAMPLE] TO DISK = '/tmp/backups/sample.bak' WITH INIT",
	} {
		if !strings.Contains(joined, want) {
			t.Errorf("expected %q in %s", want, joined)
		}
	}
}

// TestSQLServerExecutor_Backup_NoPasswordInArgv runs Backup against a fake
// sqlcmd that records argv and env, asserts the plaintext password only
// travels via SQLCMD_PWD, and that SHA256 integrates on the artifact.
func TestSQLServerExecutor_Backup_NoPasswordInArgv(t *testing.T) {
	dir := t.TempDir()
	argsFile := filepath.Join(dir, "args.txt")
	envFile := filepath.Join(dir, "env.txt")
	fakeBin := filepath.Join(dir, "sqlcmd")
	outPath := filepath.Join(dir, "sample.bak")
	script := fmt.Sprintf(`#!/bin/sh
printf '%%s\n' "$@" > %s
env | grep '^SQLCMD_PWD=' > %s
printf '%%s' 'sqlserver-backup-payload' > %s
`, argsFile, envFile, outPath)
	if err := os.WriteFile(fakeBin, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}

	e := &SQLServerExecutor{SQLCmdBin: fakeBin}
	res, err := e.Backup(context.Background(), ConnInfo{Host: "h", Port: "1433", DB: "SAMPLE", User: "u", Password: "s3cret"}, BackupOptions{
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
	if !strings.Contains(string(rawEnv), "SQLCMD_PWD=s3cret") {
		t.Fatalf("expected SQLCMD_PWD in child env, got %q", string(rawEnv))
	}

	wantSum, _ := SHA256File(outPath)
	if res.ChecksumSHA256 != wantSum {
		t.Fatalf("checksum mismatch: got %q want %q", res.ChecksumSHA256, wantSum)
	}
	if res.SizeBytes == 0 {
		t.Fatal("expected non-zero size")
	}
}

func TestSQLServerExecutor_Backup_EncryptionProducesNonPlainText(t *testing.T) {
	dir := t.TempDir()
	fakeBin := filepath.Join(dir, "sqlcmd")
	outPath := filepath.Join(dir, "sample.bak")
	script := fmt.Sprintf("#!/bin/sh\nprintf '%%s' 'sqlserver-plaintext-payload' > %s\n", outPath)
	if err := os.WriteFile(fakeBin, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}

	key := []byte(strings.Repeat("k", 32))
	e := &SQLServerExecutor{SQLCmdBin: fakeBin}
	res, err := e.Backup(context.Background(), ConnInfo{Host: "h", DB: "SAMPLE", User: "u"}, BackupOptions{
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
	if string(plain) == "sqlserver-plaintext-payload" {
		t.Fatal("artifact still contains plaintext; encryption did not run")
	}
	if err := DecryptFile(outPath, filepath.Join(dir, "dec"), key); err != nil {
		t.Fatalf("decrypt failed: %v", err)
	}
	dec, _ := os.ReadFile(filepath.Join(dir, "dec"))
	if string(dec) != "sqlserver-plaintext-payload" {
		t.Fatalf("decrypted content mismatch: %q", string(dec))
	}
}

func TestSQLServerExecutor_Backup_RequiresHostDB(t *testing.T) {
	e := NewSQLServerExecutor()
	_, err := e.Backup(context.Background(), ConnInfo{DB: "SAMPLE", User: "u"}, BackupOptions{OutputPath: "/tmp/x.bak"})
	if err == nil || !strings.Contains(err.Error(), "host is required") {
		t.Fatalf("expected host-required error, got %v", err)
	}
	_, err = e.Backup(context.Background(), ConnInfo{Host: "h", User: "u"}, BackupOptions{OutputPath: "/tmp/x.bak"})
	if err == nil || !strings.Contains(err.Error(), "database name is required") {
		t.Fatalf("expected database-required error, got %v", err)
	}
}

// TestSQLServerExecutor_RestorePITR_GeneratesRunbook verifies the SQL Server
// recovery plan: state-changing commands (RESTORE DATABASE/LOG) are
// `#`-commented for DBA review, non-destructive verification runs, and
// archive accounting reflects the plan.
func TestSQLServerExecutor_RestorePITR_GeneratesRunbook(t *testing.T) {
	dir := t.TempDir()
	art := filepath.Join(dir, "backup.bak")
	if err := os.WriteFile(art, []byte("a,b\n1,2\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	walDir := t.TempDir()
	archives := writeWALFiles(t, walDir, 2)
	tt := time.Date(2026, 8, 31, 10, 0, 0, 0, time.UTC)

	e := NewSQLServerExecutor()
	result, err := e.Restore(context.Background(), RestoreOptions{
		BackupID:     "b-sql-1",
		BackupPath:   art,
		TargetConn:   ConnInfo{Host: "h", Port: "1433", DB: "SAMPLE", User: "u"},
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
	if !strings.Contains(s, "RESTORE HEADERONLY") {
		t.Errorf("expected RESTORE HEADERONLY, got:\n%s", s)
	}
	if !strings.Contains(s, "RESTORE FILELISTONLY") {
		t.Errorf("expected RESTORE FILELISTONLY, got:\n%s", s)
	}
	// State-changing commands must be commented out for DBA review.
	if !strings.Contains(s, "# sqlcmd -S h -Q \"RESTORE DATABASE [SAMPLE]") {
		t.Errorf("expected commented RESTORE DATABASE, got:\n%s", s)
	}
	if !strings.Contains(s, "# sqlcmd -S h -Q \"RESTORE LOG [SAMPLE]") {
		t.Errorf("expected commented RESTORE LOG, got:\n%s", s)
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

func TestSQLServerExecutor_RestorePITR_RequiresBackupID(t *testing.T) {
	dir := t.TempDir()
	archives := writeWALFiles(t, dir, 1)
	tt := time.Now()
	e := NewSQLServerExecutor()
	_, err := e.Restore(context.Background(), RestoreOptions{
		BackupPath:   filepath.Join(dir, "b.bak"),
		TargetConn:   ConnInfo{Host: "h", DB: "SAMPLE", User: "u"},
		TargetTime:   &tt,
		ArchivePaths: archives,
		ScratchDir:   dir,
	})
	if err == nil || !strings.Contains(err.Error(), "BackupID") {
		t.Fatalf("expected BackupID error, got %v", err)
	}
}

func TestSQLServerExecutor_RestoreNonPITR_AccountsArchives(t *testing.T) {
	dir := t.TempDir()
	archives := writeWALFiles(t, dir, 2)
	e := NewSQLServerExecutor()
	result, err := e.Restore(context.Background(), RestoreOptions{
		BackupID:     "b-sql-n",
		BackupPath:   filepath.Join(dir, "b.bak"),
		TargetConn:   ConnInfo{Host: "h", DB: "SAMPLE", User: "u"},
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
