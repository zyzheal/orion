package executor

import (
	"context"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// TestBuildOceanBaseEnv verifies the password is routed through OB_PASSWORD,
// not passed as an argv flag (which would be visible in ps output).
func TestBuildOceanBaseEnv(t *testing.T) {
	env := buildOceanBaseEnv(ConnInfo{Host: "h", User: "u", Password: "p"})
	joined := strings.Join(env, " ")
	if !strings.Contains(joined, "OB_PASSWORD=p") {
		t.Errorf("expected OB_PASSWORD in env, got %s", joined)
	}
}

// TestOceanBaseExecutor_Backup_NoPasswordInArgv runs Backup against a fake
// ob-loader-dumper that records its argv and environment, then asserts the
// plaintext password never appears in argv (ps-visible) while OB_PASSWORD is
// set in the child env.
func TestOceanBaseExecutor_Backup_NoPasswordInArgv(t *testing.T) {
	dir := t.TempDir()
	argsFile := filepath.Join(dir, "args.txt")
	envFile := filepath.Join(dir, "env.txt")
	fakeBin := filepath.Join(dir, "ob-loader-dumper")
	// Record argv and OB_PASSWORD env. The tool writes to --log-file=; touch
	// it so FileSize/SHA256 in the executor succeed.
	script := `#!/bin/sh
printf '%s\n' "$@" > ` + argsFile + `
env | grep '^OB_PASSWORD=' > ` + envFile + `
for a in "$@"; do
  case "$a" in
    --log-file=*) out="${a#--log-file=}"; printf '%s' 'dummy' > "$out";;
  esac
done
`
	if err := os.WriteFile(fakeBin, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}

	e := &OceanBaseExecutor{ToolBin: fakeBin}
	outPath := filepath.Join(dir, "backup.csv")
	if _, err := e.Backup(context.Background(), ConnInfo{
		Host: "h", Port: "2881", DB: "app", User: "u", Password: "s3cret", TenantName: "tenant1",
	}, BackupOptions{
		OutputPath: outPath,
	}); err != nil {
		t.Fatalf("backup failed: %v", err)
	}

	rawArgs, _ := os.ReadFile(argsFile)
	args := strings.Join(strings.Fields(string(rawArgs)), " ")
	if strings.Contains(args, "s3cret") {
		t.Fatalf("password leaked into argv: %s", args)
	}
	if !strings.Contains(args, "-u u") {
		t.Errorf("expected -u u in argv, got %s", args)
	}

	rawEnv, _ := os.ReadFile(envFile)
	if !strings.Contains(string(rawEnv), "OB_PASSWORD=s3cret") {
		t.Errorf("expected OB_PASSWORD in child env, got %q", string(rawEnv))
	}
}

// TestOceanBaseExecutor_Restore_NoPasswordInArgv mirrors the backup check for
// the --load path: password must travel via env, never argv.
func TestOceanBaseExecutor_Restore_NoPasswordInArgv(t *testing.T) {
	dir := t.TempDir()
	argsFile := filepath.Join(dir, "args.txt")
	envFile := filepath.Join(dir, "env.txt")
	fakeBin := filepath.Join(dir, "ob-loader-dumper")
	script := `#!/bin/sh
printf '%s\n' "$@" > ` + argsFile + `
env | grep '^OB_PASSWORD=' > ` + envFile + `
`
	if err := os.WriteFile(fakeBin, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}

	art := filepath.Join(dir, "restore.csv")
	if err := os.WriteFile(art, []byte("a,b\n1,2\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	e := &OceanBaseExecutor{ToolBin: fakeBin}
	if _, err := e.Restore(context.Background(), RestoreOptions{
		BackupPath: art,
		TargetConn: ConnInfo{Host: "h", Port: "2881", DB: "app", User: "u", Password: "s3cret", TenantName: "tenant1"},
	}); err != nil {
		t.Fatalf("restore failed: %v", err)
	}

	rawArgs, _ := os.ReadFile(argsFile)
	args := strings.Join(strings.Fields(string(rawArgs)), " ")
	if strings.Contains(args, "s3cret") {
		t.Fatalf("password leaked into argv: %s", args)
	}
	if !strings.Contains(args, "--load") {
		t.Errorf("expected --load in argv, got %s", args)
	}

	rawEnv, _ := os.ReadFile(envFile)
	if !strings.Contains(string(rawEnv), "OB_PASSWORD=s3cret") {
		t.Errorf("expected OB_PASSWORD in child env, got %q", string(rawEnv))
	}
}

// forbiddenArgvPasswordPattern catches a plaintext password passed as the
// value of a "-p" / "--password" flag. The G2 gate treats any such match as a
// regression: credentials must only travel via env vars (PGPASSWORD /
// MYSQL_PWD / OB_PASSWORD).
var forbiddenArgvPasswordPattern = regexp.MustCompile(`"-p"\s*,\s*(\w*\.)?Password`)

// TestExecutorPackage_NoPasswordInArgv is the package-level gate for the G2
// baseline. It greps every non-test source file in this package and fails if
// a password is ever wired into argv.
func TestExecutorPackage_NoPasswordInArgv(t *testing.T) {
	files, err := filepath.Glob(filepath.Join("*.go"))
	if err != nil {
		t.Fatal(err)
	}
	seen := 0
	for _, f := range files {
		if strings.HasSuffix(f, "_test.go") {
			continue
		}
		raw, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		for _, m := range forbiddenArgvPasswordPattern.FindAllString(string(raw), -1) {
			t.Errorf("%s: password passed via argv: %q (use env, e.g. OB_PASSWORD)", f, m)
			seen++
		}
	}
	if seen > 0 {
		t.Fatalf("%d forbidden argv-password usage(s) found", seen)
	}
}
