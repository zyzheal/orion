package executor

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestBuildPGDumpArgs verifies the argument layout pg_dump expects so a
// future parameter change fails loudly rather than corrupting a backup.
func TestBuildPGDumpArgs(t *testing.T) {
	got := buildPGDumpArgs(BackupOptions{
		Format:      "custom",
		Compression: 6,
		Databases:   []string{"app"},
		Tables:      []string{"users"},
		Exclude:     []string{"logs"},
		OutputPath:  "/tmp/app.dump",
		ExtraArgs:   []string{"--maintenance-private"},
	})
	joined := strings.Join(got, " ")
	for _, want := range []string{
		"--format=custom",
		"--compress=6",
		"--no-owner",
		"--no-privileges",
		"--dbname=app",
		"--table=users",
		"--exclude-table=logs",
		"--maintenance-private",
		"/tmp/app.dump",
	} {
		if !strings.Contains(joined, want) {
			t.Errorf("expected %q in %s", want, joined)
		}
	}
}

func TestBuildPGDumpArgs_Defaults(t *testing.T) {
	got := buildPGDumpArgs(BackupOptions{
		OutputPath: "/tmp/x.dump",
		Compression: -1, // should clamp to 0
	})
	joined := strings.Join(got, " ")
	if !strings.Contains(joined, "--format=custom") {
		t.Errorf("expected default custom format, got %s", joined)
	}
	if !strings.Contains(joined, "--compress=0") {
		t.Errorf("expected clamped compress=0, got %s", joined)
	}
}

func TestBuildPGDumpArgs_HighCompressionClamped(t *testing.T) {
	got := buildPGDumpArgs(BackupOptions{Compression: 99, OutputPath: "/tmp/x"})
	if !strings.Contains(strings.Join(got, " "), "--compress=9") {
		t.Error("compression should clamp to 9")
	}
}

// TestBuildPGEnv ensures PGPASSWORD and related vars land in env so the tool
// can authenticate without --password in argv.
func TestBuildPGEnv(t *testing.T) {
	env := buildPGEnv(ConnInfo{Host: "h", Port: "5432", User: "u", Password: "p", SSLMode: "verify-full"})
	joined := strings.Join(env, " ")
	for _, want := range []string{
		"PGHOST=h", "PGPORT=5432", "PGUSER=u", "PGPASSWORD=p", "PGSSLMODE=verify-full",
	} {
		if !strings.Contains(joined, want) {
			t.Errorf("expected %q in env", want)
		}
	}
}

// TestBuildMySQLEnv ensures the password is routed through MYSQL_PWD, not
// passed as an argv flag (which would be visible in ps).
func TestBuildMySQLEnv(t *testing.T) {
	env := buildMySQLEnv(ConnInfo{Host: "h", User: "u", Password: "p"})
	joined := strings.Join(env, " ")
	if !strings.Contains(joined, "MYSQL_PWD=p") {
		t.Errorf("expected MYSQL_PWD in env, got %s", joined)
	}
}

func TestMySQLExecutor_Backup_Args(t *testing.T) {
	// Capture the argv the executor passes to mysqldump by running it with a
	// fake binary that records args to a file AND creates a placeholder at
	// the --result-file path so FileSize/SHA256 in the executor succeed.
	dir := t.TempDir()
	argsFile := filepath.Join(dir, "args.txt")
	fakeBin := filepath.Join(dir, "mysqldump")
	// Extract the path after --result-file= and touch it; also record all args.
	script := `#!/bin/sh
printf '%s\n' "$@" > ` + argsFile + `
for a in "$@"; do
  case "$a" in
    --result-file=*) out="${a#--result-file=}"; printf '%s' 'dummy' > "$out";;
  esac
done
`
	if err := os.WriteFile(fakeBin, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}

	e := &MySQLExecutor{DumpBin: fakeBin}
	outPath := filepath.Join(dir, "backup.sql")
	if _, err := e.Backup(context.Background(), ConnInfo{Host: "h", Port: "3306", User: "u", Password: "p"}, BackupOptions{
		Databases:  []string{"app"},
		OutputPath: outPath,
	}); err != nil {
		t.Fatalf("backup failed: %v", err)
	}

	args, _ := os.ReadFile(argsFile)
	joined := strings.Join(strings.Fields(string(args)), " ")
	for _, want := range []string{
		"--single-transaction", "--routines", "--triggers", "--events",
		"--set-gtid-purged=OFF", "--hex-blob", "--databases", "app", "-h", "h", "-P", "3306", "-u", "u",
		"--result-file=" + outPath,
	} {
		if !strings.Contains(joined, want) {
			t.Errorf("expected %q in %s", want, joined)
		}
	}
}

func TestPGExecutor_Backup_EncryptionProducesNonPlainText(t *testing.T) {
	dir := t.TempDir()
	argsFile := filepath.Join(dir, "args.txt")
	fakeBin := filepath.Join(dir, "pg_dump")
	// The fake pg_dump writes a known plaintext file so we can verify
	// encryption actually transforms the bytes. pg_dump receives multiple
	// args; the output file is the last positional argument.
	script := "#!/bin/sh\nlast=\"${@: -1}\"\nprintf '%s' \"secret-bytes-for-encryption\" > \"$last\"\n"
	if err := os.WriteFile(fakeBin, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}

	e := &PGExecutor{DumpBin: fakeBin}
	outPath := filepath.Join(dir, "backup.dump")
	key := []byte(strings.Repeat("k", 32))
	res, err := e.Backup(context.Background(), ConnInfo{Host: "h"}, BackupOptions{
		OutputPath: outPath,
		EncryptKey: key,
	})
	if err != nil {
		t.Fatalf("backup with encryption failed: %v", err)
	}
	if !res.Encrypted {
		t.Fatal("expected Encrypted=true")
	}

	// Verify the final artifact is not the plaintext we injected.
	plain, _ := os.ReadFile(outPath)
	if string(plain) == "secret-bytes-for-encryption" {
		t.Fatal("artifact still contains plaintext; encryption did not run")
	}

	// Decrypt back and check the plaintext is recovered.
	if err := DecryptFile(outPath, filepath.Join(dir, "decrypted"), key); err != nil {
		t.Fatalf("decrypt failed: %v", err)
	}
	dec, _ := os.ReadFile(filepath.Join(dir, "decrypted"))
	if string(dec) != "secret-bytes-for-encryption" {
		t.Fatalf("decrypted content mismatch: %q", string(dec))
	}
	_ = argsFile
}

func TestOceanBaseExecutor_Backup_RequiresTenantName(t *testing.T) {
	e := NewOceanBaseExecutor()
	_, err := e.Backup(context.Background(), ConnInfo{Host: "h", User: "u", DB: "db"}, BackupOptions{
		OutputPath: "/tmp/x",
	})
	if err == nil || !strings.Contains(err.Error(), "tenant_name") {
		t.Fatalf("expected tenant_name error, got %v", err)
	}
}

func TestCrypto_Roundtrip(t *testing.T) {
	key := []byte(strings.Repeat("a", 32))
	plain := []byte("hello world, this is a test payload for AES-256-GCM")
	ciphered, err := EncryptBytes(key, plain)
	if err != nil {
		t.Fatal(err)
	}
	if len(ciphered) < len(plain)+12 {
		t.Fatalf("ciphertext too short: %d vs %d", len(ciphered), len(plain))
	}
	decrypted, err := DecryptBytes(key, ciphered)
	if err != nil {
		t.Fatal(err)
	}
	if string(decrypted) != string(plain) {
		t.Fatal("roundtrip mismatch")
	}
}

func TestCrypto_WrongKeyFails(t *testing.T) {
	key1 := []byte(strings.Repeat("a", 32))
	key2 := []byte(strings.Repeat("b", 32))
	ciphered, _ := EncryptBytes(key1, []byte("secret"))
	if _, err := DecryptBytes(key2, ciphered); err == nil {
		t.Fatal("expected decryption to fail with wrong key")
	}
}

func TestCrypto_EmptyKeyRejected(t *testing.T) {
	if _, err := EncryptBytes(nil, []byte("x")); err == nil {
		t.Fatal("expected empty key to fail")
	}
}
