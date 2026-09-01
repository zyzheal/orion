package storage

import (
	"context"
	"errors"
	"fmt"
	"io"

	"github.com/minio/minio-go/v7/pkg/lifecycle"
)

// This file defines the Phase 7 G8 capability surface for storage backends.
// The base StorageBackend interface stays the stable byte-movement contract;
// G8 adds *optional* capabilities (multipart resume, lifecycle rules, cold
// storage classes) that only some backends offer. Callers probe via type
// assertion rather than widening the base interface, so Local backends never
// need to stub S3-only features.
//
// P3 scope: interface definition + capability probes + thin adapters over
// the minio client (which already implements multipart upload and lifecycle
// rules). Full lifecycle management tooling is explicitly out of scope here.

// BackendCaps describes which advanced features a backend supports.
type BackendCaps struct {
	// MultipartUpload reports whether Upload can stream arbitrarily large
	// payloads via server-side multipart (resumable chunks). All S3-compatible
	// backends do; Local does not need to.
	MultipartUpload bool
	// LifecycleRules reports whether SetLifecycle can install expiration /
	// tiering rules. Only S3-compatible backends expose this.
	LifecycleRules bool
	// ColdStorage reports whether StorageClass can be requested per object
	// (e.g. Glacier / IA tiers for cold data).
	ColdStorage bool
}

// StorageClass identifies a retention tier. Empty string selects the
// backend default (hot); named classes are passed through verbatim to the
// S3-compatible service so operator-defined tiers (GLACIER, DEEP_ARCHIVE,
// STANDARD_IA, ...) work without this repo knowing every vendor's names.
type StorageClass string

func (s StorageClass) String() string { return string(s) }

// LifecyclePolicy is the declarative shape of a retention rule. Applied to a
// prefix (object key prefix), it deletes or tier-downs objects older than
// ExpireAfterDays.
type LifecyclePolicy struct {
	// ID is a stable rule identifier; empty lets the backend derive one.
	ID string
	// Prefix matches object keys ("" applies to the whole bucket).
	Prefix string
	// ExpireAfterDays > 0 installs an expiration rule deleting matching
	// objects after the given number of days. 0 disables expiry.
	ExpireAfterDays int
	// StorageClass, when non-empty, requests transition to a cold tier
	// (Glacier / IA / custom) after ExpireAfterDays.
	StorageClass StorageClass
}

// AdvancedBackend is implemented by backends that offer multipart upload and
// lifecycle management. It is a superset of StorageBackend; use type
// assertion to discover it:
//
//	if adv, ok := b.(AdvancedBackend); ok && adv.Capabilities().MultipartUpload {
//	    ...
//	}
type AdvancedBackend interface {
	StorageBackend

	// Capabilities reports the advanced features this backend supports.
	Capabilities() BackendCaps

	// MultipartUpload streams reader to path with server-side multipart —
	// resumable on large payloads and memory-friendly by construction.
	// Equivalent to Put on backends that cannot do explicit multipart.
	MultipartUpload(ctx context.Context, path string, reader io.Reader) error

	// SetLifecycle installs an expiration / tiering rule for the policy's
	// prefix. It returns ErrLifecycleUnsupported on backends without
	// lifecycle support. Policies with a zero ExpireAfterDays and empty
	// StorageClass are rejected as no-ops.
	SetLifecycle(ctx context.Context, policy LifecyclePolicy) error
}

// ErrLifecycleUnsupported is returned by SetLifecycle on backends that
// cannot manage lifecycle rules (Local).
var ErrLifecycleUnsupported = errors.New("storage: lifecycle rules not supported by this backend")

// ErrLifecycleNoop is returned when a policy would do nothing.
var ErrLifecycleNoop = errors.New("storage: lifecycle policy is a no-op (no expiration, no storage class)")

// Validate checks a policy before it is applied, fail-closed on ambiguity.
func (p LifecyclePolicy) Validate() error {
	if p.ID == "" {
		return errors.New("storage: lifecycle policy id is required")
	}
	if p.ExpireAfterDays == 0 && p.StorageClass == "" {
		return ErrLifecycleNoop
	}
	if p.ExpireAfterDays < 0 {
		return fmt.Errorf("storage: lifecycle policy expire_after_days must be >= 0 (got %d)", p.ExpireAfterDays)
	}
	return nil
}

// toMinioRule converts the policy into a minio lifecycle rule. It assumes
// the policy has already passed Validate; callers must check that first.
func (p LifecyclePolicy) toMinioRule() lifecycle.Rule {
	rule := lifecycle.Rule{
		ID:         p.ID,
		Status:     "Enabled",
		RuleFilter: lifecycle.Filter{Prefix: p.Prefix},
	}
	if p.ExpireAfterDays > 0 {
		rule.Expiration = lifecycle.Expiration{
			Days: lifecycle.ExpirationDays(p.ExpireAfterDays),
		}
	}
	if p.StorageClass != "" {
		rule.Transition = lifecycle.Transition{
			Days:         lifecycle.ExpirationDays(p.ExpireAfterDays),
			StorageClass: p.StorageClass.String(),
		}
	}
	return rule
}

// LifecycleRuleSet builds the full minio lifecycle configuration for a
// collection of validated policies. It is kept as a pure function so tests
// can assert rule shape without a live S3 service.
func LifecycleRuleSet(policies []LifecyclePolicy) (*lifecycle.Configuration, error) {
	cfg := lifecycle.NewConfiguration()
	cfg.Rules = make([]lifecycle.Rule, 0, len(policies))
	for _, p := range policies {
		if err := p.Validate(); err != nil {
			return nil, err
		}
		cfg.Rules = append(cfg.Rules, p.toMinioRule())
	}
	return cfg, nil
}