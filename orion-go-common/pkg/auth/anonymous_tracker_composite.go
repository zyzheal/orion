package auth

import (
	"github.com/gin-gonic/gin"
)

// CompositeAnonymousTracker fans out Track calls to multiple AnonymousTracker
// implementations. Use it when you want more than one sink — typically a
// ZapAnonymousTracker (per-event detail, rate-limited) plus a
// PrometheusAnonymousTracker (aggregate volumes, unbounded but cardinality-
// bounded). OptionalAuth takes a single AnonymousTracker, so the composite is
// the fan-out point.
//
// Nil trackers in the slice are skipped; an empty or all-nil slice makes Track
// a no-op. Track is non-blocking and never returns an error — individual
// trackers are responsible for their own error handling.
type CompositeAnonymousTracker struct {
	trackers []AnonymousTracker
}

// NewCompositeAnonymousTracker builds a composite from any number of
// AnonymousTracker values. Nil trackers are filtered out. Passing no trackers
// (or all nils) returns a non-nil tracker whose Track is a no-op — the caller
// can always wire it without a nil check.
func NewCompositeAnonymousTracker(trackers ...AnonymousTracker) *CompositeAnonymousTracker {
	out := make([]AnonymousTracker, 0, len(trackers))
	for _, t := range trackers {
		if t == nil {
			continue
		}
		out = append(out, t)
	}
	return &CompositeAnonymousTracker{trackers: out}
}

// Track implements AnonymousTracker by calling each underlying tracker's Track
// in order. A nil receiver is a no-op. Trackers are called independently: a
// panic in one would propagate, so the caller should only wire panic-safe
// implementations (the built-in zap and Prometheus trackers are both
// panic-free).
func (c *CompositeAnonymousTracker) Track(ctx *gin.Context, method, path, reason string) {
	if c == nil {
		return
	}
	for _, t := range c.trackers {
		if t == nil {
			continue
		}
		t.Track(ctx, method, path, reason)
	}
}
