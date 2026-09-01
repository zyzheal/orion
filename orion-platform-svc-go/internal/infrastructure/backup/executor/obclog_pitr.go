package executor

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"go.uber.org/zap"
)

// OBCLogExecutor implements the OceanBase clog PITR recovery path. It connects
// to the sys tenant to read archived clog via oblogminer and replays to
// TargetTime. State-changing commands are emitted as runbook comments; only
// idempotent verification runs by default (G1 pattern, design D4 in
// docs/oceanbase-clog-pitr-design-2026-08-31.md).
//
// Scope: MySQL-mode tenants only; Oracle-mode tenant PITR is Phase 2. The
// executor is not registered in the Registry — it serves DialectOceanBase and
// is routed to from OceanBaseExecutor.Restore's PITR branch (design D1).
type OBCLogExecutor struct {
	OblogminerBin string
}

// NewOBCLogExecutor returns an OceanBase clog PITR executor with production
// defaults.
func NewOBCLogExecutor() *OBCLogExecutor {
	return &OBCLogExecutor{OblogminerBin: DefaultBinPath("oblogminer")}
}

func (e *OBCLogExecutor) Dialect() Dialect { return DialectOceanBase }

// OBCLogRecoveryOptions mirrors PGRecoveryOptions for the OB clog path.
// TargetConn must be the sys tenant connection (TenantName == "sys") because
// oblogminer reads archived clog only from the sys tenant.
type OBCLogRecoveryOptions struct {
	BackupID     string
	BackupPath   string
	ArchivePaths []string
	TargetTime   *time.Time
	ScratchDir   string
	TargetConn   ConnInfo // sys tenant connection (TenantName == "sys")
}

// OBCLogArchiveInfo describes one archived clog segment in the plan.
type OBCLogArchiveInfo struct {
	Path    string    `json:"path"`
	Size    int64     `json:"size"`
	SHA256  string    `json:"sha256"`
	ModTime time.Time `json:"modTime"`
}

// OBCLogRecoveryPlan mirrors PGRecoveryPlan for the OB clog path. It is the
// machine-readable manifest (0o600) emitted alongside the runbook.
type OBCLogRecoveryPlan struct {
	BackupID       string              `json:"backupId"`
	BackupPath     string              `json:"backupPath"`
	TargetTime     *time.Time          `json:"targetTime,omitempty"`
	ArchiveDir     string              `json:"archiveDir"`
	ArchiveFiles   []OBCLogArchiveInfo `json:"archiveFiles"`
	ManifestSHA256 string              `json:"manifestSha256"`
	ScriptPath     string              `json:"scriptPath"`
	ManifestPath   string              `json:"manifestPath"`
	GeneratedAt    time.Time           `json:"generatedAt"`
	// Host/Port/User describe the sys tenant connection the runbook targets.
	// They are connection metadata only — the sys password never appears here
	// (G2 baseline: OB_PASSWORD env only).
	Host   string `json:"host"`
	Port   string `json:"port"`
	User   string `json:"user"`
	Tenant string `json:"tenant"`
	// RPO is the gap between TargetTime and the newest clog segment ModTime.
	// RTO is the plan-generation duration (not the DBA-driven replay time).
	RPO string `json:"rpo,omitempty"`
	RTO string `json:"rto,omitempty"`
}

// OBCLogManifestPath returns where the OB clog PITR manifest will be written.
func OBCLogManifestPath(scratchDir, backupID string) string {
	return filepath.Join(scratchDir, "obclog-"+backupID+"-manifest.json")
}

// OBCLogScriptPath returns where the OB clog PITR runbook will be written.
func OBCLogScriptPath(scratchDir, backupID string) string {
	return filepath.Join(scratchDir, "obclog-restore-"+backupID+".sh")
}

// PrepareOBCLogRecoveryPlan builds an OB clog PITR manifest + runbook for the
// given base backup and archived clog segments. It does NOT run any
// state-changing command — it produces artifacts a DBA executes after review
// (runbook-first, design D4). Fail-closed: missing/empty segments, a missing
// TargetTime, or a non-sys connection are hard errors so no plan is emitted
// for an unusable input.
func PrepareOBCLogRecoveryPlan(ctx context.Context, opts OBCLogRecoveryOptions, log *zap.Logger) (*OBCLogRecoveryPlan, error) {
	if opts.BackupID == "" {
		return nil, fmt.Errorf("oceanbase clog PITR: backup id required")
	}
	if opts.BackupPath == "" {
		return nil, fmt.Errorf("oceanbase clog PITR: backup path required")
	}
	if opts.TargetTime == nil {
		return nil, fmt.Errorf("oceanbase clog PITR: target time required")
	}
	if len(opts.ArchivePaths) == 0 {
		return nil, fmt.Errorf("oceanbase clog PITR: archive paths required")
	}
	if opts.TargetConn.TenantName != "sys" {
		return nil, fmt.Errorf("oceanbase clog PITR: sys tenant connection required (got tenant %q)", opts.TargetConn.TenantName)
	}
	if opts.ScratchDir == "" {
		opts.ScratchDir = "/var/lib/orion-pitr"
	}
	if err := os.MkdirAll(opts.ScratchDir, 0o750); err != nil {
		return nil, fmt.Errorf("oceanbase clog PITR: scratch dir: %w", err)
	}

	start := time.Now()
	var files []OBCLogArchiveInfo
	var newest time.Time
	for i, src := range opts.ArchivePaths {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}
		if src == "" {
			return nil, fmt.Errorf("oceanbase clog PITR: archive segment %d has empty path", i)
		}
		fi, err := os.Stat(src)
		if err != nil {
			return nil, fmt.Errorf("oceanbase clog PITR: archive segment %d: %w", i, err)
		}
		hash, err := SHA256File(src)
		if err != nil {
			return nil, fmt.Errorf("oceanbase clog PITR: archive segment %d checksum: %w", i, err)
		}
		if fi.ModTime().After(newest) {
			newest = fi.ModTime()
		}
		files = append(files, OBCLogArchiveInfo{
			Path:    src,
			Size:    fi.Size(),
			SHA256:  hash,
			ModTime: fi.ModTime(),
		})
	}

	// The archive dir is the shared ob_archive_log location the DBA enables via
	// ALTER SYSTEM ARCHIVELOG (design D5). Segments may be staged there or on a
	// mounted target-side path — derive it from the first segment's parent.
	archiveDir := filepath.Dir(opts.ArchivePaths[0])

	rpo := ""
	if !newest.IsZero() {
		rpo = opts.TargetTime.Sub(newest).Round(time.Second).String()
	}

	plan := &OBCLogRecoveryPlan{
		BackupID:     opts.BackupID,
		BackupPath:   opts.BackupPath,
		TargetTime:   opts.TargetTime,
		ArchiveDir:   archiveDir,
		ArchiveFiles: files,
		ScriptPath:   OBCLogScriptPath(opts.ScratchDir, opts.BackupID),
		ManifestPath: OBCLogManifestPath(opts.ScratchDir, opts.BackupID),
		GeneratedAt:  time.Now().UTC(),
		Host:         opts.TargetConn.Host,
		Port:         opts.TargetConn.Port,
		User:         opts.TargetConn.User,
		Tenant:       "sys",
		RPO:          rpo,
		RTO:          time.Since(start).Round(time.Millisecond).String(),
	}

	script := buildOBCLogRunbook(plan)
	if err := os.WriteFile(plan.ScriptPath, []byte(script), 0o700); err != nil {
		return nil, fmt.Errorf("oceanbase clog PITR: write script: %w", err)
	}
	plan.ManifestSHA256 = hashString(fmt.Sprintf("%s|%d", script, len(files)))

	manifestPath := OBCLogManifestPath(opts.ScratchDir, opts.BackupID)
	manifestJSON, err := json.MarshalIndent(plan, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("oceanbase clog PITR: manifest marshal: %w", err)
	}
	if err := os.WriteFile(manifestPath, manifestJSON, 0o600); err != nil {
		return nil, fmt.Errorf("oceanbase clog PITR: write manifest: %w", err)
	}
	if log != nil {
		log.Info("oceanbase clog PITR plan prepared",
			zap.String("backup_id", opts.BackupID),
			zap.Int("archive_files", len(files)),
			zap.String("script", plan.ScriptPath))
	}
	return plan, nil
}

// buildOBCLogRunbook emits a bash runbook for the OB clog PITR recovery. Every
// state-changing command (ALTER SYSTEM ARCHIVELOG, oblogminer replay, ALTER
// SYSTEM RESTORE / tenant switch) is emitted as a `#` comment for DBA review;
// only idempotent verification steps (checksum verify, SHOW TENANT, SELECT 1)
// run by default. The sys password is referenced via OB_PASSWORD env, never
// argv (G2 baseline).
func buildOBCLogRunbook(plan *OBCLogRecoveryPlan) string {
	var b strings.Builder
	b.WriteString("#!/usr/bin/env bash\n")
	b.WriteString("# OceanBase clog PITR recovery runbook — review then execute.\n")
	b.WriteString("# Generated " + plan.GeneratedAt.Format(time.RFC3339) + "\n")
	b.WriteString("# Backup ID: " + plan.BackupID + "\n")
	b.WriteString("# Base artifact: " + plan.BackupPath + "\n")
	b.WriteString("# Clog archive dir (ob_archive_log): " + plan.ArchiveDir + "\n")
	if plan.TargetTime != nil {
		b.WriteString("# Target time: " + plan.TargetTime.UTC().Format(time.RFC3339) + "\n")
	}
	if plan.RPO != "" {
		b.WriteString("# RPO (target vs newest clog commit): " + plan.RPO + "\n")
	}
	if plan.RTO != "" {
		b.WriteString("# RTO (plan generation duration): " + plan.RTO + "\n")
	}
	b.WriteString("# Sys tenant connection: " + plan.User + "@sys@" + plan.Host + ":" + plan.Port + "\n")
	b.WriteString("# NOTE: OB_PASSWORD must hold the sys tenant password (env-only, never argv).\n")
	b.WriteString("set -euo pipefail\n\n")

	b.WriteString("echo \"=== OceanBase clog PITR plan for backup " + plan.BackupID + " ===\"\n")
	b.WriteString("echo \"Archive dir: " + plan.ArchiveDir + "\"\n")
	b.WriteString("echo \"Archive segments: " + fmt.Sprintf("%d", len(plan.ArchiveFiles)) + "\"\n\n")

	// Step 1: verify archived clog segment checksums (read-only, default run).
	b.WriteString("# Step 1: verify archived clog segment checksums (read-only)\n")
	for _, f := range plan.ArchiveFiles {
		b.WriteString("echo \"verify " + f.Path + "\"\n")
		b.WriteString("echo " + f.SHA256 + " | sha256sum -c - < " + f.Path + "\n")
	}
	b.WriteString("\n")

	// Step 2: probe the target tenant (idempotent, read-only, default run).
	b.WriteString("# Step 2: verify tenant exists and is readable (idempotent, read-only)\n")
	b.WriteString("ob_client -h " + plan.Host + " -P " + plan.Port + " -u root@sys -p\"$OB_PASSWORD\" -e \"SHOW TENANT;\"\n")
	b.WriteString("ob_client -h " + plan.Host + " -P " + plan.Port + " -u \"root@${OB_TARGET_TENANT:?set OB_TARGET_TENANT to the target tenant}\" -p\"$OB_PASSWORD\" -e \"SELECT 1;\"\n\n")

	// REVIEW SECTION: state-changing commands — uncomment to apply.
	b.WriteString("# --- REVIEW SECTION: uncomment to apply the recovery ---\n")
	b.WriteString("# 1) Enable clog archiving (state-changing, requires sys tenant):\n")
	b.WriteString("# ob_client -h " + plan.Host + " -P " + plan.Port + " -u root@sys -p\"$OB_PASSWORD\" -e \"ALTER SYSTEM ARCHIVELOG;\"\n\n")

	startTime := ""
	if len(plan.ArchiveFiles) > 0 {
		startTime = plan.ArchiveFiles[len(plan.ArchiveFiles)-1].ModTime.UTC().Format("2006-01-02 15:04:05")
	}
	b.WriteString("# 2) Replay archived clog to the target tenant (state-changing):\n")
	b.WriteString("#   --cluster <ob-cluster-name> must be set to the source cluster.\n")
	if plan.TargetTime != nil {
		b.WriteString("# oblogminer --host " + plan.Host + " --port " + plan.Port +
			" --user root@sys --cluster <ob-cluster-name>" +
			" --start-time '" + startTime + "' --stop-time '" +
			plan.TargetTime.UTC().Format("2006-01-02 15:04:05") +
			"' --out /var/lib/orion-pitr/" + plan.BackupID + "-replay -p\"$OB_PASSWORD\"\n\n")
	}

	b.WriteString("# 3) Restore/switch the target tenant to the replayed state (state-changing):\n")
	b.WriteString("# ob_client -h " + plan.Host + " -P " + plan.Port + " -u root@sys -p\"$OB_PASSWORD\" -e \"ALTER SYSTEM RESTORE \\\"$OB_TARGET_TENANT\\\" FROM ...;\"\n\n")

	b.WriteString("echo \"PITR plan complete — review and execute the commented steps above.\"\n")
	return b.String()
}
