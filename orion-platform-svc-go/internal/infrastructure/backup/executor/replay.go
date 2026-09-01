package executor

import (
	"context"
	"errors"
	"fmt"
	"os"
)

// replayArchives walks ArchivePaths in order, verifying each file exists and
// recording its size. It is the accounting helper for engines without a
// dedicated PITR orchestration path yet — notably OceanBase (clog replay,
// Phase 7 G4). PostgreSQL now routes PITR restores through
// PreparePGRecoveryPlan (pg_pitr.go) when a TargetTime + archive set is
// present; this helper remains for the non-PITR / OceanBase cases so the
// restore fails closed on a missing segment while still surfacing sizes.
//
// The helper is shared across engine-specific executors so the behaviour is
// consistent: missing file → hard error (the restore must fail closed);
// present file → its byte size is recorded.
func replayArchives(ctx context.Context, paths []string, result *RestoreResult) error {
	if len(paths) == 0 || result == nil {
		return nil
	}
	var sizes []int64
	for i, p := range paths {
		select {
		case <-ctx.Done():
			return fmt.Errorf("archive replay cancelled at segment %d: %w", i, ctx.Err())
		default:
		}
		if p == "" {
			return fmt.Errorf("archive segment %d has empty path", i)
		}
		fi, err := os.Stat(p)
		if err != nil {
			if errors.Is(err, os.ErrNotExist) {
				return fmt.Errorf("archive segment %d missing: %s", i, p)
			}
			return fmt.Errorf("archive segment %d stat failed: %w", i, err)
		}
		sizes = append(sizes, fi.Size())
		result.ArchReplayed++
	}
	result.ArchSizes = sizes
	return nil
}
