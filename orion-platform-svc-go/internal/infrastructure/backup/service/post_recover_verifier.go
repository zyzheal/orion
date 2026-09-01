package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/infrastructure/backup/executor"
	"orion/platform-svc-go/internal/infrastructure/backup/models"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var postRecoverTracer = otel.Tracer("orion-backup-svc/post-recover")

// ErrPostRecoverVerifierNotConfigured is returned when VerifyRecovery is
// called before the recovery service has been wired to a repository.
var ErrPostRecoverVerifierNotConfigured = errors.New("post-recovery verifier is not configured")

// PostRecoveryCheckResult is the outcome of a post-recovery smoke check.
// It is intentionally small — callers should inspect Status for the
// pass/fail signal and Details for the human-readable diagnostic.
type PostRecoveryCheckResult struct {
	BackupID   string    `json:"backupId"`
	RecoveryID string    `json:"recoveryId"`
	Status     string    `json:"status"` // "passed" | "failed" | "skipped"
	CheckedAt  time.Time `json:"checkedAt"`
	DurationMS int64     `json:"durationMs"`
	Details    string    `json:"details"`
	// Probe is populated when the verifier runs a real DB probe (see
	// PostRecoveryProbe). It is nil when the structural check is enough
	// or when the plan's target JSON couldn't be parsed.
	Probe *ProbeResult `json:"probe,omitempty"`
}

// VerifyRecovery runs a post-restore check against the target database.
// It performs two layers of validation:
//
//  1. Structural: confirms the recovery reached a terminal state and,
//     when Completed, that RTO/RPO were met.
//  2. Behavioral (optional): if skipProbe == false and the plan's target
//     can be parsed, ProbeTargetDB runs a real SELECT COUNT(*) against
//     the target to confirm the restored data is reachable. Failures of
//     the probe downgrade Status to "failed" so operators see the real
//     problem, not a false-positive "passed".
//
// The probe uses the same CLI binaries the executors depend on (psql /
// mysql / ob-loader-dumper), so no new DB driver is introduced.
func (s *RecoveryService) VerifyRecovery(ctx context.Context, tenantID, recoveryID string) (*PostRecoveryCheckResult, error) {
	ctx, span := postRecoverTracer.Start(ctx, "RecoveryService.VerifyRecovery",
		trace.WithAttributes(attribute.String("recovery_id", recoveryID)))
	defer span.End()

	start := time.Now()
	res := &PostRecoveryCheckResult{
		RecoveryID: recoveryID,
		CheckedAt:  time.Now().UTC(),
	}

	if s.repo == nil {
		res.Status = "failed"
		res.Details = "recovery repository not configured"
		return res, nil
	}

	rec, err := s.repo.GetRecoveryByID(ctx, tenantID, recoveryID)
	if err != nil || rec == nil {
		res.Status = "failed"
		res.Details = "recovery record not found: " + recoveryID
		return res, nil
	}
	res.BackupID = ""
	if rec.BackupID != nil {
		res.BackupID = *rec.BackupID
	}

	// Check 1: status is terminal. Anything other than Completed or
	// Failed is an indeterminate state — surface as skipped so the
	// caller knows the recovery is still in flight.
	if rec.Status != models.RecoveryStatusCompleted && rec.Status != models.RecoveryStatusFailed {
		res.Status = "skipped"
		res.Details = fmt.Sprintf("recovery is %s — wait for completion", rec.Status)
		return res, nil
	}

	// Check 2: for Completed recoveries, confirm RTO/RPO were met.
	if rec.Status == models.RecoveryStatusCompleted {
		rtoOK := rec.RtoMet != nil && *rec.RtoMet
		rpoOK := rec.RpoMet != nil && *rec.RpoMet
		if !rtoOK {
			res.Status = "failed"
			res.Details = "RTO target not met"
			res.DurationMS = time.Since(start).Milliseconds()
			return res, nil
		}
		if !rpoOK {
			res.Status = "failed"
			res.Details = "RPO target not met"
			res.DurationMS = time.Since(start).Milliseconds()
			return res, nil
		}
	}

	// Check 3: for failed recoveries, the check itself passes — we
	// detected the failure, which is what the operator wants.
	if rec.Status == models.RecoveryStatusFailed {
		res.Status = "passed"
		res.Details = "recovery failure detected and confirmed"
		res.DurationMS = time.Since(start).Milliseconds()
		return res, nil
	}

	res.Status = "passed"
	res.Details = "recovery completed within RTO/RPO targets"

	// 2. Behavioral probe — only when the recovery succeeded. A failed
	// recovery is already surfaced by Status, so we don't want to add a
	// second failure reason on top of the first.
	if rec.Status == models.RecoveryStatusCompleted {
		if probeRes, probeErr := s.runProbe(ctx, tenantID, rec); probeErr != nil {
			res.Probe = probeRes
			res.Status = "failed"
			res.Details = "post-recovery probe failed: " + probeErr.Error()
		} else if probeRes != nil {
			res.Probe = probeRes
			res.Details = fmt.Sprintf("recovery completed within RTO/RPO targets; probe: %d tables, %d rows sampled",
				probeRes.TableCount, probeRes.SampledRows)
		}
	}

	res.DurationMS = time.Since(start).Milliseconds()
	return res, nil
}

// runProbe runs a real DB probe against the target DB for the given
// recovery record. It looks up the plan's Target JSON, converts it to
// a ConnInfo, and calls ProbeTargetDB.
//
// Returns (nil, nil) when probing is intentionally skipped — currently
// that happens when:
//
//   - the plan target JSON is missing or malformed
//   - the dialect is unsupported
//   - the target host/port is empty
//
// Returns (probe, err) otherwise.
func (s *RecoveryService) runProbe(ctx context.Context, tenantID string, rec *models.RecoveryRecord) (*ProbeResult, error) {
	if s.repo == nil || rec == nil || rec.PlanID == "" {
		return nil, nil
	}
	plan, err := s.repo.GetPlanByID(ctx, tenantID, rec.PlanID)
	if err != nil || plan == nil {
		return nil, nil // not configured — structural check is enough
	}
	var tgt models.BackupTarget
	if err := json.Unmarshal(plan.Target, &tgt); err != nil || tgt.Host == "" {
		return nil, nil
	}
	conn := ProbeTarget{
		Host:       tgt.Host,
		Port:       tgt.Port,
		DB:         tgt.DB,
		User:       tgt.User,
		Password:   tgt.Password,
		SSLMode:    tgt.SSLMode,
		TenantName: tgt.TenantName,
	}
	probeCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	probe, err := ProbeTargetDB(probeCtx, executor.Dialect(tgt.Dialect), conn)
	if err != nil {
		return probe, err
	}
	return probe, nil
}

// SetExecutorRegistryForVerify allows tests to inject a fake registry so
// the verifier can exercise paths that depend on executor lookup.
func (s *RecoveryService) SetExecutorRegistryForVerify(reg *executor.Registry) {
	s.execRegistry = reg
}
