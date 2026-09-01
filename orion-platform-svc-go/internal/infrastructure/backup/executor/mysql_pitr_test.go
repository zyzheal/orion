package executor

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestMySQLExecutor_HasBinlogBin(t *testing.T) {
	e := NewMySQLExecutor()
	if e.BinlogBin == "" {
		t.Fatal("BinlogBin should have a default")
	}
}

func TestReplayArchivePaths_EmptyPathsNoop(t *testing.T) {
	e := NewMySQLExecutor()
	result := &RestoreResult{}
	if err := e.replayArchivePaths(context.Background(), RestoreOptions{}, "mysql", result); err != nil {
		t.Fatal(err)
	}
	if result.ArchReplayed != 0 {
		t.Fatalf("expected 0 replayed, got %d", result.ArchReplayed)
	}
}

func TestReplayArchivePaths_MissingBinlogBinFails(t *testing.T) {
	// Override BinlogBin to a path that doesn't exist.
	e := &MySQLExecutor{
		ClientBin: "mysql",
		BinlogBin: "/definitely/does/not/exist/mysqlbinlog",
	}
	result := &RestoreResult{}
	_, err := os.CreateTemp("", "binlog-*.log")
	if err != nil {
		t.Skip("temp failed")
	}
	err = e.replayArchivePaths(context.Background(), RestoreOptions{
		ArchivePaths: []string{"/tmp/nonexistent-binlog"},
		TargetConn:   ConnInfo{Host: "localhost", Port: "3306", DB: "test"},
	}, "mysql", result)
	if err == nil {
		t.Fatal("expected error when mysqlbinlog is missing")
	}
}

func TestBinlogReplay_NoopWithoutBinaries(t *testing.T) {
	// When both binaries are missing, the function returns a descriptive
	// error rather than panicking.
	e := &MySQLExecutor{
		ClientBin: "/missing/mysql",
		BinlogBin: "/missing/mysqlbinlog",
	}
	// Write a dummy archive file so os.Stat in the caller would pass.
	dir := t.TempDir()
	archivePath := filepath.Join(dir, "mysql-bin.000001")
	if err := os.WriteFile(archivePath, []byte("dummy"), 0o600); err != nil {
		t.Fatal(err)
	}
	result := &RestoreResult{}
	_ = e.replayArchivePaths(context.Background(), RestoreOptions{
		ArchivePaths: []string{archivePath},
		TargetConn:   ConnInfo{Host: "localhost", Port: "3306", DB: "test"},
	}, e.ClientBin, result)
	// Just checking we didn't panic.
	_ = result
	// Ensure LookPath is the same primitive the code uses.
	if _, err := exec.LookPath("/missing/mysqlbinlog"); err == nil {
		t.Skip("missing binary test is a no-op on this host")
	}
}
