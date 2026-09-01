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

// TestBuildOracleEnv verifies the password is routed through ORACLE_PWD, never
// argv (G2 baseline: env-only credentials).
func TestBuildOracleEnv(t *testing.T) {
	env := buildOracleEnv(ConnInfo{Host: "h", Port: "1521", DB: "orcl", User: "u", Password: "p"})
	joined := strings.Join(env, " ")
	for _, want := range []string{
		"ORACLE_HOST=h", "ORACLE_PORT=1521", "ORACLE_SERVICE=orcl", "ORACLE_USER=u", "ORACLE_PWD=p",
	} {
		if !strings.Contains(joined, want) {
			t.Errorf("expected %q in env", want)
		}
	}
}

// TestBuildOracleDumpArgs verifies the expdp argument layout, including that
// the artifact is addressed inside the Oracle DIRECTORY (= parent dir).
func TestBuildOracleDumpArgs(t *testing.T) {
	got := buildOracleDumpArgs(BackupOptions{
		OutputPath:    "/tmp/backups/app.dmp",
		Compression:   3,
		Tables:        []string{"users"},
		MaxRowsPerFile: 4,
	}, ConnInfo{Host: "h", Port: "1521", DB: "orcl", User: "u"})
	joined := strings.Join(got, " ")
	for _, want := range []string{
		"userid=u@h:1521/orcl",
		"directory=/tmp/backups",
		"dumpfile=app.dmp",
		"logfile=app.log",
		"parallel=4",
		"compression=ALL",
		"tables=users",
	} {
		if !strings.Contains(joined, want) {
			t.Errorf("expected %q in %s", want, joined)
		}
	}
}

func TestClampParallel(t *testing.T) {
	for _, c := range []struct {
		in, want int
	}{
		{0, 1}, {1, 1}, {4, 4}, {32, 32}, {99, 32},
	} {
		if got := clampParallel(c.in); got != c.want {
			t.Errorf("clampParallel(%d) = %d, want %d", c.in, got, c.want)
		}
	}
}

// TestOracleExecutor_Backup_NoPasswordInArgv runs Backup against a fake expdp
// that records argv and env, asserts the plaintext password only travels via
// ORACLE_PWD, and that SHA256/encryption integrate on the produced artifact.
func TestOracleExecutor_Backup_NoPasswordInArgv(t *testing.T) {
	dir := t.TempDir()
	argsFile := filepath.Join(dir, "args.txt")
	envFile := filepath.Join(dir, "env.txt")
	fakeBin := filepath.Join(dir, "expdp")
	outPath := filepath.Join(dir, "app.dmp")
	script := fmt.Sprintf(`#!/bin/sh
printf '%%s\n' "$@" > %s
env | grep '^ORACLE_PWD=' > %s
printf '%%s' 'oracle-backup-payload' > %s
`, argsFile, envFile, outPath)
	if err := os.WriteFile(fakeBin, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}

	e := &OracleExecutor{ExpdpBin: fakeBin}
	res, err := e.Backup(context.Background(), ConnInfo{Host: "h", Port: "1521", DB: "orcl", User: "u", Password: "s3cret"}, BackupOptions{
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
	if !strings.Contains(string(rawEnv), "ORACLE_PWD=s3cret") {
		t.Fatalf("expected ORACLE_PWD in child env, got %q", string(rawEnv))
	}

	// SHA256 must match the payload bytes actually produced.
	wantSum, _ := SHA256File(outPath)
	if res.ChecksumSHA256 != wantSum {
		t.Fatalf("checksum mismatch: got %q want %q", res.ChecksumSHA256, wantSum)
	}
	if res.SizeBytes == 0 {
		t.Fatal("expected non-zero size")
	}
}

func TestOracleExecutor_Backup_EncryptionProducesNonPlainText(t *testing.T) {
	dir := t.TempDir()
	fakeBin := filepath.Join(dir, "expdp")
	outPath := filepath.Join(dir, "app.dmp")
	script := fmt.Sprintf("#!/bin/sh\nprintf '%%s' 'oracle-plaintext-payload' > %s\n", outPath)
	if err := os.WriteFile(fakeBin, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}

	key := []byte(strings.Repeat("k", 32))
	e := &OracleExecutor{ExpdpBin: fakeBin}
	res, err := e.Backup(context.Background(), ConnInfo{Host: "h", Port: "1521", DB: "orcl", User: "u"}, BackupOptions{
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
	if string(plain) == "oracle-plaintext-payload" {
		t.Fatal("artifact still contains plaintext; encryption did not run")
	}
	if err := DecryptFile(outPath, filepath.Join(dir, "dec"), key); err != nil {
		t.Fatalf("decrypt failed: %v", err)
	}
	dec, _ := os.ReadFile(filepath.Join(dir, "dec"))
	if string(dec) != "oracle-plaintext-payload" {
		t.Fatalf("decrypted content mismatch: %q", string(dec))
	}
}

func TestOracleExecutor_Backup_RequiresHostPort(t *testing.T) {
	e := NewOracleExecutor()
	_, err := e.Backup(context.Background(), ConnInfo{User: "u", DB: "orcl"}, BackupOptions{OutputPath: "/tmp/x.dmp"})
	if err == nil || !strings.Contains(err.Error(), "host and port") {
		t.Fatalf("expected host/port error, got %v", err)
	}
}

// TestOracleExecutor_RestorePITR_GeneratesRunbook verifies the RMAN recovery
// plan: state-changing commands are `#`-commented, non-destructive steps run,
// and the archive accounting reflects the plan.
func TestOracleExecutor_RestorePITR_GeneratesRunbook(t *testing.T) {
	dir := t.TempDir()
	art := filepath.Join(dir, "backup.dmp")
	if err := os.WriteFile(art, []byte("a,b\n1,2\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	walDir := t.TempDir()
	archives := writeWALFiles(t, walDir, 2)
	tt := time.Date(2026, 8, 31, 10, 0, 0, 0, time.UTC)

	e := NewOracleExecutor()
	result, err := e.Restore(context.Background(), RestoreOptions{
		BackupID:     "b-orc-1",
		BackupPath:   art,
		TargetConn:   ConnInfo{Host: "h", Port: "1521", DB: "orcl", User: "u"},
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
	if !strings.Contains(s, "rman nocatalog target /") {
		t.Errorf("expected non-destructive rman target, got:\n%s", s)
	}
	// State-changing commands must be commented out for DBA review.
	if !strings.Contains(s, "#   restore database;") {
		t.Errorf("expected commented restore, got:\n%s", s)
	}
	if !strings.Contains(s, "#   recover database;") {
		t.Errorf("expected commented recover, got:\n%s", s)
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

func TestOracleExecutor_RestorePITR_RequiresBackupID(t *testing.T) {
	dir := t.TempDir()
	archives := writeWALFiles(t, dir, 1)
	tt := time.Now()
	e := NewOracleExecutor()
	_, err := e.Restore(context.Background(), RestoreOptions{
		BackupPath:   filepath.Join(dir, "b.dmp"),
		TargetConn:   ConnInfo{Host: "h", Port: "1521", DB: "orcl", User: "u"},
		TargetTime:   &tt,
		ArchivePaths: archives,
		ScratchDir:   dir,
	})
	if err == nil || !strings.Contains(err.Error(), "BackupID") {
		t.Fatalf("expected BackupID error, got %v", err)
	}
}

func TestOracleExecutor_RestoreNonPITR_AccountsArchives(t *testing.T) {
	dir := t.TempDir()
	archives := writeWALFiles(t, dir, 2)
	e := NewOracleExecutor()
	result, err := e.Restore(context.Background(), RestoreOptions{
		BackupID:     "b-orc-n",
		BackupPath:   filepath.Join(dir, "b.dmp"),
		TargetConn:   ConnInfo{Host: "h", Port: "1521", DB: "orcl", User: "u"},
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
