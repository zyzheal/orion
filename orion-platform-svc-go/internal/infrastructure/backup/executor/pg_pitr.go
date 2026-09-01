package executor

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"go.uber.org/zap"
)

// PITRManifestPath returns the location where the generated PITR manifest
// will be written, given the scratch directory and backup ID.
func PITRManifestPath(scratchDir, backupID string) string {
	return filepath.Join(scratchDir, "pitr-"+backupID+"-manifest.json")
}

// PITRScriptPath returns the location where the generated PITR runbook
// script will be written.
func PITRScriptPath(scratchDir, backupID string) string {
	return filepath.Join(scratchDir, "pitr-"+backupID+".sh")
}

// PGRecoveryPlan is the structured plan emitted by PreparePGRecoveryPlan.
// Operators can read it directly, or use the generated shell script.
type PGRecoveryPlan struct {
	BackupID    string    `json:"backupId"`
	BackupPath  string    `json:"backupPath"`
	TargetTime  *time.Time `json:"targetTime,omitempty"`
	ArchiveDir  string    `json:"archiveDir"`
	ArchiveFiles []ArchiveFileInfo `json:"archiveFiles"`
	ManifestSHA256 string `json:"manifestSha256"`
	ScriptPath  string    `json:"scriptPath"`
	GeneratedAt time.Time `json:"generatedAt"`
}

// ArchiveFileInfo describes one WAL segment in the PITR plan.
type ArchiveFileInfo struct {
	Path     string `json:"path"`
	Size     int64  `json:"size"`
	SHA256   string `json:"sha256"`
	ModTime  time.Time `json:"modTime"`
}

// PreparePGRecoveryPlan builds a PITR manifest + runbook script for the
// given base backup + WAL segments. It does NOT restart the server or
// modify PostgreSQL config files — it produces artifacts that a DBA can
// execute as the postgres user after validating the plan.
//
// The function is idempotent: running it twice with the same inputs
// produces the same script path (overwrites are safe).
func PreparePGRecoveryPlan(ctx context.Context, opts PGRecoveryOptions, log *zap.Logger) (*PGRecoveryPlan, error) {
	if opts.BackupID == "" {
		return nil, fmt.Errorf("backup id required")
	}
	if opts.BackupPath == "" {
		return nil, fmt.Errorf("backup path required")
	}
	if opts.ScratchDir == "" {
		opts.ScratchDir = "/var/lib/orion-pitr"
	}
	if err := os.MkdirAll(opts.ScratchDir, 0o750); err != nil {
		return nil, fmt.Errorf("scratch dir: %w", err)
	}

	// 1. Copy archive segments into the scratch dir so the manifest is
	// self-contained (not dependent on the source dir staying stable).
	destDir := filepath.Join(opts.ScratchDir, "pitr-"+opts.BackupID)
	if err := os.MkdirAll(destDir, 0o750); err != nil {
		return nil, fmt.Errorf("archive dir: %w", err)
	}

	var files []ArchiveFileInfo
	for i, src := range opts.ArchivePaths {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}
		if src == "" {
			return nil, fmt.Errorf("archive segment %d has empty path", i)
		}
		fi, err := os.Stat(src)
		if err != nil {
			return nil, fmt.Errorf("archive segment %d: %w", i, err)
		}
		hash, err := SHA256File(src)
		if err != nil {
			return nil, fmt.Errorf("archive segment %d checksum: %w", i, err)
		}
		dest := filepath.Join(destDir, filepath.Base(src))
		if err := copyFile(src, dest); err != nil {
			return nil, fmt.Errorf("archive segment %d copy: %w", i, err)
		}
		files = append(files, ArchiveFileInfo{
			Path:    dest,
			Size:    fi.Size(),
			SHA256:  hash,
			ModTime: fi.ModTime(),
		})
	}

	scriptPath := PITRScriptPath(opts.ScratchDir, opts.BackupID)
	script := buildPGRecoveryScript(PGRecoveryPlan{
		BackupID:   opts.BackupID,
		BackupPath: opts.BackupPath,
		TargetTime: opts.TargetTime,
		ArchiveDir: destDir,
		ArchiveFiles: files,
		ScriptPath: scriptPath,
		GeneratedAt: time.Now().UTC(),
	})
	if err := os.WriteFile(scriptPath, []byte(script), 0o700); err != nil {
		return nil, fmt.Errorf("write script: %w", err)
	}

	// 2. Manifest JSON for programmatic inspection — written to disk so the
	// plan is fully self-contained (runbook + manifest), not just in-memory.
	manifest := PGRecoveryPlan{
		BackupID:   opts.BackupID,
		BackupPath: opts.BackupPath,
		TargetTime: opts.TargetTime,
		ArchiveDir: destDir,
		ArchiveFiles: files,
		ScriptPath: scriptPath,
		GeneratedAt: time.Now().UTC(),
	}
	manifest.ManifestSHA256 = hashString(fmt.Sprintf("%s|%d", script, len(files)))

	manifestPath := PITRManifestPath(opts.ScratchDir, opts.BackupID)
	manifestJSON, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("manifest marshal: %w", err)
	}
	if err := os.WriteFile(manifestPath, manifestJSON, 0o600); err != nil {
		return nil, fmt.Errorf("write manifest: %w", err)
	}
	if log != nil {
		log.Info("pitr plan prepared",
			zap.String("backup_id", opts.BackupID),
			zap.Int("archive_files", len(files)),
			zap.String("script", script))
	}
	return &manifest, nil
}

// PGRecoveryOptions controls the PITR plan generation.
type PGRecoveryOptions struct {
	BackupID   string
	BackupPath string
	ArchivePaths []string
	TargetTime  *time.Time
	ScratchDir  string
}

// buildPGRecoveryScript emits a bash script that a DBA runs as the
// postgres user. It documents every step explicitly so the operator can
// review before executing.
func buildPGRecoveryScript(plan PGRecoveryPlan) string {
	var b strings.Builder
	b.WriteString("#!/usr/bin/env bash\n")
	b.WriteString("# Auto-generated by orion-platform-svc — review before executing.\n")
	b.WriteString("# Generated at: " + plan.GeneratedAt.Format(time.RFC3339) + "\n")
	b.WriteString("# Backup ID: " + plan.BackupID + "\n\n")
	b.WriteString("set -euo pipefail\n\n")
	b.WriteString("echo \"=== PITR recovery plan for backup " + plan.BackupID + " ===\"\n")
	b.WriteString("echo \"Archive dir: " + plan.ArchiveDir + "\"\n")
	b.WriteString("echo \"Archive files: " + fmt.Sprintf("%d", len(plan.ArchiveFiles)) + "\"\n")
	if plan.TargetTime != nil {
		b.WriteString("echo \"Target time: " + plan.TargetTime.UTC().Format(time.RFC3339) + "\"\n")
	}
	b.WriteString("\n# Step 1: verify archive file checksums\n")
	for _, f := range plan.ArchiveFiles {
		b.WriteString("echo \"verify " + f.Path + "\"\n")
		b.WriteString("echo " + f.SHA256 + " | sha256sum -c - < " + f.Path + "\n")
	}
	b.WriteString("\n# Step 2: (commented) pg_restore base backup\n")
	b.WriteString("# pg_restore -d \"$TARGET_DB\" --clean --if-exists " + plan.BackupPath + "\n\n")
	b.WriteString("# Step 3: (commented) copy archives to PG data dir/pg_wal or archive\n")
	b.WriteString("# for f in " + plan.ArchiveDir + "/*; do cp \"$f\" /var/lib/postgresql/data/pg_wal/; done\n\n")
	b.WriteString("# Step 4: (commented) configure recovery.conf for PITR\n")
	b.WriteString("# cat > /var/lib/postgresql/data/recovery.conf <<EOF\n")
	b.WriteString("# restore_command = 'cp /var/lib/postgresql/data/pg_wal/%f %p'\n")
	if plan.TargetTime != nil {
		b.WriteString("# recovery_target_time = '" + plan.TargetTime.UTC().Format("2006-01-02 15:04:05+00:00") + "'\n")
	}
	b.WriteString("# recovery_target_inclusive = 'on'\n")
	b.WriteString("# EOF\n\n")
	b.WriteString("# Step 5: (commented) restart postgres to begin recovery\n")
	b.WriteString("# pg_ctl -D /var/lib/postgresql/data restart\n\n")
	b.WriteString("# Step 6: monitor pg_is_in_recovery() and wait for it to return false\n")
	b.WriteString("# psql -c 'SELECT pg_is_in_recovery(), pg_last_xact_replay_timestamp();'\n\n")
	b.WriteString("echo \"PITR plan complete — review and execute the commented steps above.\"\n")
	return b.String()
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()
	if _, err := io.Copy(out, in); err != nil {
		return err
	}
	return out.Chmod(0o600)
}

func hashString(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}
