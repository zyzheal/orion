package service

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strconv"

	"orion/platform-svc-go/internal/branch-policy/models"
)

// SchemaCompatCheckerDefaultLookback is the number of recent deploy events per
// env that the checker inspects when looking for the currently-deployed
// artifact's migration checksum. It bounds the repo query; real deployments
// keep the most recent event for an env within the last handful of deploys.
const SchemaCompatCheckerDefaultLookback = 20

// migrationChecksumRe matches a MigrationChecksum that carries a monotonic
// version marker: "v<N>:" prefix, where N is a non-negative decimal integer.
// Examples: "v1:20260909-ab12", "v0:", "v42:hash". Checksums without this
// prefix cannot be compared and are treated as "no version info" — the checker
// degrades to an informational pass rather than blocking.
var migrationChecksumRe = regexp.MustCompile(`^v([0-9]+):`)

// MigrationChecksumChecker is a concrete SchemaCompatibilityChecker backed by
// the BuildArtifact.MigrationChecksum field. It implements the design-doc R6
// intent "Schema 兼容（DB migration 不降级）":
//
//   - The "new" checksum comes from the artifact being deployed
//     (req.ArtifactID → GetBuildArtifact → MigrationChecksum).
//   - The "old" checksum comes from the artifact currently deployed to
//     req.TargetEnv (ListDeployEventsByEnv → most recent success event →
//     ArtifactID → GetBuildArtifact → MigrationChecksum).
//   - Both checksums are compared by the "v<N>:" marker. Deploying an artifact
//     whose migration version is LOWER than the one already deployed to the
//     target env is a DB-migration downgrade → Compatible=false (blocking).
//
// Missing data never blocks: when the request carries no ArtifactID, the
// artifact lookup misses, the env has no prior success deploy, or either
// checksum lacks a comparable version marker, the checker returns a nil result
// (the service records an informational pass) or a pass-with-warning.
type MigrationChecksumChecker struct {
	repo RepositoryInterface
	// lookback bounds ListDeployEventsByEnv. 0 → SchemaCompatCheckerDefaultLookback.
	lookback int
}

// NewMigrationChecksumChecker wires a MigrationChecksumChecker to the
// repository used for artifact + deploy-event lookups. Pass 0 to use the
// default lookback.
func NewMigrationChecksumChecker(repo RepositoryInterface, lookback int) *MigrationChecksumChecker {
	if lookback <= 0 {
		lookback = SchemaCompatCheckerDefaultLookback
	}
	return &MigrationChecksumChecker{repo: repo, lookback: lookback}
}

// CheckSchemaCompatibility implements SchemaCompatibilityChecker.
func (c *MigrationChecksumChecker) CheckSchemaCompatibility(ctx context.Context, req *models.DeployRequest) (*SchemaCompatibilityResult, error) {
	if req == nil {
		return nil, fmt.Errorf("schema-compat: nil DeployRequest")
	}
	newChecksum, newNote, err := c.artifactChecksum(ctx, req.TenantID, req.ArtifactID)
	if err != nil {
		return nil, err
	}
	if newChecksum == "" {
		return nil, nil // no version info on the artifact → informational pass
	}
	oldChecksum, oldNote, err := c.deployedChecksum(ctx, req.TenantID, req.TargetEnv)
	if err != nil {
		return nil, err
	}
	if oldChecksum == "" {
		return nil, nil // no prior success deploy to compare against → informational pass
	}

	newVer, okNew := parseMigrationVersion(newChecksum)
	oldVer, okOld := parseMigrationVersion(oldChecksum)
	res := &SchemaCompatibilityResult{
		CheckedAgainstArtifactSchemaVersion: newChecksum,
		CheckedAgainstSchemaVersion:         oldChecksum,
	}
	switch {
	case !okNew || !okOld:
		// One of the two checksums is not in "v<N>:" form — we cannot prove a
		// downgrade, so we don't block. Surface both checksums as warnings so
		// operators can see why the rule passed.
		res.Compatible = true
		res.Warnings = append(res.Warnings, newNote, oldNote)
		return res, nil
	case newVer < oldVer:
		res.Compatible = false
		res.Breaking = append(res.Breaking,
			fmt.Sprintf("DB migration downgrade: deploying migration v%d over currently-deployed v%d (new checksum %s, deployed checksum %s)",
				newVer, oldVer, newChecksum, oldChecksum))
		return res, nil
	default:
		res.Compatible = true
		res.Warnings = append(res.Warnings, fmt.Sprintf("migration version v%d is not lower than deployed v%d", newVer, oldVer))
		return res, nil
	}
}

// artifactChecksum returns the MigrationChecksum of the build artifact
// identified by artifactID, plus a human-readable note. An empty artifactID or
// a missing artifact yields "" (no comparable info) rather than an error.
func (c *MigrationChecksumChecker) artifactChecksum(ctx context.Context, tenantID, artifactID string) (checksum, note string, err error) {
	if artifactID == "" {
		return "", "no artifactId in deploy request — schema compatibility not assessed", nil
	}
	artifact, err := c.repo.GetBuildArtifact(ctx, tenantID, artifactID)
	if err != nil {
		if errors.Is(err, sentinelNotFound) {
			return "", fmt.Sprintf("artifact %s not found — schema compatibility not assessed", artifactID), nil
		}
		return "", "", err
	}
	if artifact == nil {
		return "", fmt.Sprintf("artifact %s not found — schema compatibility not assessed", artifactID), nil
	}
	if artifact.MigrationChecksum == "" {
		return "", fmt.Sprintf("artifact %s carries no migration checksum — schema compatibility not assessed", artifactID), nil
	}
	return artifact.MigrationChecksum, "artifact migration checksum " + artifact.MigrationChecksum, nil
}

// deployedChecksum returns the MigrationChecksum of the artifact behind the
// most recent successful deploy event for the given env. No prior success
// deploy (or no artifact on that event) yields "".
func (c *MigrationChecksumChecker) deployedChecksum(ctx context.Context, tenantID, env string) (checksum, note string, err error) {
	if env == "" {
		return "", "no targetEnv in deploy request — schema compatibility not assessed", nil
	}
	events, err := c.repo.ListDeployEventsByEnv(ctx, tenantID, env, c.lookback)
	if err != nil {
		return "", "", err
	}
	var latest *models.DeployEvent
	for i := range events {
		if events[i].Outcome != models.DeployOutcomeSuccess {
			continue
		}
		latest = &events[i]
		break // repository returns newest-first (ORDER BY started_at DESC)
	}
	if latest == nil {
		return "", fmt.Sprintf("no successful prior deploy to env %q — schema compatibility not assessed", env), nil
	}
	checksum, note, err = c.artifactChecksum(ctx, tenantID, latest.ArtifactID)
	if err != nil {
		return "", "", err
	}
	if checksum == "" {
		// Artifact may have been since deleted; degrade gracefully.
		return "", fmt.Sprintf("no migration checksum for artifact currently deployed to env %q — schema compatibility not assessed", env), nil
	}
	return checksum, "currently-deployed artifact migration checksum " + checksum, nil
}

// parseMigrationVersion extracts the "v<N>" marker from a migration checksum.
// Returns ok=false when the checksum has no comparable marker.
func parseMigrationVersion(checksum string) (int, bool) {
	m := migrationChecksumRe.FindStringSubmatch(checksum)
	if len(m) != 2 {
		return 0, false
	}
	n, err := strconv.Atoi(m[1])
	if err != nil || n < 0 {
		return 0, false
	}
	return n, true
}
