// ArtifactBusConfig + NewArtifactBus factory implements the ADR-014 §3.2.4
// feature-flag gating: when disabled, return a NoopArtifactBus so the
// pre-ADR-014 execution path is preserved (R-P0-01 mitigation §3.3).
package artifactbus

import (
	"context"

	"github.com/jmoiron/sqlx"
)

// ArtifactBusConfig controls bus construction.
type ArtifactBusConfig struct {
	// Enabled gates the PG implementation. When false, NewArtifactBus
	// returns NoopArtifactBus (never touches the database).
	Enabled bool

	// MaxSize caps per-artifact size in bytes. Zero/negative falls back
	// to DefaultMaxSize (10 MiB, matching ADR-014 §3.3).
	MaxSize int64

	// EnabledPipelineTypes is a grayscale whitelist: when non-empty, the
	// PG bus is only used for pipeline types in this list. Empty means
	// "all types allowed" (subject to Enabled). This is the ADR-014 §3.2.4
	// canary knob; enforced at the call site (StageExecutor), not here.
	EnabledPipelineTypes []string
}

// NewArtifactBus is the single entry point for StageExecutor. When
// cfg.Enabled is false OR db is nil, returns NoopArtifactBus — the
// caller cannot accidentally hit the database.
func NewArtifactBus(ctx context.Context, db *sqlx.DB, cfg ArtifactBusConfig) ArtifactBus {
	_ = ctx // reserved for future tracing hooks
	if !cfg.Enabled || db == nil {
		return NoopArtifactBus{}
	}
	return NewPGArtifactBus(db, cfg.MaxSize)
}
