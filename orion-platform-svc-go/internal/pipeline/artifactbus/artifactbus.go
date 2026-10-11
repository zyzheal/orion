// Package artifactbus implements the ADR-014 Pipeline ArtifactBus
// (docs/adr/ADR-014-Pipeline-ArtifactBus-方案.md §3.2.2).
//
// Design intent:
//   - Interface-first: consumers depend on ArtifactBus, not PGArtifactBus.
//   - Noop default: when the feature flag is off, use NoopArtifactBus.
//     Publish is a silent no-op, Get/List return empty — preserving the
//     pre-ADR-014 execution path (R-P0-01 mitigation §3.3).
//   - Size limit: single artifact 10 MiB cap, matching ADR-014 §3.3.
//   - Checksum: sha256 hex-encoded, computed at Publish time.
//   - Metadata: JSONB round-trip; nil maps are stored as "{}".
//
// Migration dependency: 730_create_pipeline_artifacts.sql (pipeline_artifacts).
package artifactbus

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// ErrArtifactTooLarge is returned by Publish when len(Content) exceeds
// the maxSize limit. Callers can check with errors.Is.
var ErrArtifactTooLarge = errors.New("artifactbus: artifact too large")

// ErrNotFound is returned by Get when no matching artifact exists.
var ErrNotFound = errors.New("artifactbus: artifact not found")

// DefaultMaxSize is 10 MiB, matching ADR-014 §3.3.
const DefaultMaxSize int64 = 10 * 1024 * 1024

// DefaultTTL is 7 days, matching ADR-014 §3.2.1 (migration default).
const DefaultTTL = 7 * 24 * time.Hour

// Artifact is the bus payload. Mirrors the pipeline_artifacts table.
//
// Zero-value fields:
//   - ID, Checksum: assigned at Publish time (server-side).
//   - SizeBytes: computed from len(Content) at Publish time.
//   - Metadata: nil is stored as empty JSON object.
//   - ExpiresAt: zero value means "use DefaultTTL at Publish time".
type Artifact struct {
	ID            string
	TenantID      string
	PipelineRunID string
	StageID       string
	Name          string
	ContentType   string
	SizeBytes     int64
	Content       []byte
	Checksum      string
	Metadata      map[string]any
	CreatedAt     time.Time
	ExpiresAt     time.Time
}

// ArtifactBus is the interface StageExecutor integrates against.
// All methods are safe for concurrent use.
type ArtifactBus interface {
	// Publish persists an artifact. Assigns ID, Checksum, SizeBytes,
	// and (if unset) ExpiresAt = now + DefaultTTL. Returns ErrArtifactTooLarge
	// if the content exceeds the configured max size.
	Publish(ctx context.Context, a *Artifact) error

	// Get returns the artifact matching (tenantID, pipelineRunID, stageID, name).
	// Returns ErrNotFound if no match.
	Get(ctx context.Context, tenantID, pipelineRunID, stageID, name string) (*Artifact, error)

	// List returns all artifacts for (tenantID, pipelineRunID), ordered by
	// created_at ASC then id ASC for stable ordering.
	List(ctx context.Context, tenantID, pipelineRunID string) ([]*Artifact, error)

	// Delete removes the artifact with the given id (scoped to tenant).
	// Returns ErrNotFound if the id does not exist.
	Delete(ctx context.Context, tenantID, id string) error

	// Cleanup removes all expired artifacts (expires_at < now). Returns
	// the number of rows deleted. Safe to call on a schedule.
	Cleanup(ctx context.Context) (int, error)
}

// NoopArtifactBus is the feature-flag-off implementation. All methods
// succeed silently; no state is persisted. Publish returns nil error so
// that callers (per ADR-014 §3.3) do not treat disabled propagation as
// a stage-execution failure.
type NoopArtifactBus struct{}

// Publish on NoopArtifactBus is a silent no-op.
func (NoopArtifactBus) Publish(_ context.Context, _ *Artifact) error { return nil }

// Get on NoopArtifactBus always returns ErrNotFound (no data was written).
func (NoopArtifactBus) Get(_ context.Context, _, _, _, _ string) (*Artifact, error) {
	return nil, ErrNotFound
}

// List on NoopArtifactBus always returns an empty slice.
func (NoopArtifactBus) List(_ context.Context, _, _ string) ([]*Artifact, error) {
	return nil, nil
}

// Delete on NoopArtifactBus is a silent no-op.
func (NoopArtifactBus) Delete(_ context.Context, _, _ string) error { return nil }

// Cleanup on NoopArtifactBus always returns (0, nil).
func (NoopArtifactBus) Cleanup(_ context.Context) (int, error) { return 0, nil }

// New computes the derived fields of an Artifact before persistence:
// SizeBytes, Checksum (sha256 hex), and ExpiresAt (default TTL if zero).
// Returns ErrArtifactTooLarge if the content exceeds maxSize.
func New(a *Artifact, maxSize int64) error {
	if a == nil {
		return errors.New("artifactbus: nil artifact")
	}
	if maxSize <= 0 {
		maxSize = DefaultMaxSize
	}
	if int64(len(a.Content)) > maxSize {
		return fmt.Errorf("%w: got %d bytes, max %d", ErrArtifactTooLarge, len(a.Content), maxSize)
	}
	a.SizeBytes = int64(len(a.Content))
	sum := sha256.Sum256(a.Content)
	a.Checksum = hex.EncodeToString(sum[:])
	if a.CreatedAt.IsZero() {
		a.CreatedAt = time.Now().UTC()
	}
	if a.ExpiresAt.IsZero() {
		a.ExpiresAt = a.CreatedAt.Add(DefaultTTL)
	}
	// Normalize nil metadata to empty map so JSONB encoding is stable.
	if a.Metadata == nil {
		a.Metadata = map[string]any{}
	}
	return nil
}

// EncodeMetadata serializes the metadata map to JSON bytes. Never fails
// for the supported types (map[string]any with JSON-compatible values).
func EncodeMetadata(m map[string]any) ([]byte, error) {
	if m == nil {
		return []byte("{}"), nil
	}
	return json.Marshal(m)
}

// DecodeMetadata parses JSON bytes into a metadata map. Returns nil for
// empty input.
func DecodeMetadata(b []byte) (map[string]any, error) {
	if len(b) == 0 {
		return nil, nil
	}
	out := map[string]any{}
	if err := json.Unmarshal(b, &out); err != nil {
		return nil, fmt.Errorf("artifactbus: decode metadata: %w", err)
	}
	return out, nil
}
