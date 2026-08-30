package executor

import (
	"context"
	"errors"
	"fmt"
	"os"
)

// replayArchives walks ArchivePaths in order, verifying each file exists and
// recording its size. Real PG PITR requires server restart + recovery.conf
// and MySQL PITR requires mysqlbinlog --stop-datetime piping; those
// orchestrations land in Phase 4. Phase 3 validates the archive set is
// present and accounted-for so the upper RecoveryService can compute RPO
// and operators can see what was staged before the actual replay call.
//
// The helper is shared across all engine-specific executors so the
// behaviour is consistent: missing file → hard error (the restore must
// fail closed); present file → its byte size is recorded.
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
