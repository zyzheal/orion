package auth

import (
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
)

// promAnonymousRequestsName is the Prometheus counter metric name. The "orion_"
// prefix keeps it in the project's namespace, matching the pattern used by
// internal/alert-breaker/metrics and internal/middleware/prometheus.go.
const promAnonymousRequestsName = "orion_anonymous_requests_total"

// PrometheusAnonymousTracker is a Prometheus-backed AnonymousTracker. Unlike
// ZapAnonymousTracker (which rate-limits individual log lines), this tracker
// emits an unbounded counter increment per anonymous request and is intended
// for dashboards and alerting. Label cardinality is bounded by the API surface
// (method × path × reason), where reason ∈ {no-authorization-header,
// non-bearer-auth-header, token-blacklisted, token-parse-error} and method is
// the HTTP verb — both are small closed sets.
//
// The counter is registered with a user-supplied Registerer so tests can pass
// prometheus.NewRegistry() and avoid the duplicate-registration panic that
// promauto would trigger when the same tracker is constructed twice in a test
// binary. Pass nil to use prometheus.DefaultRegisterer (the production path).
//
// If registration fails (typically because a tracker was already registered
// with the same registerer under the same metric name), the constructor
// returns nil. OptionalAuth already treats a nil AnonymousTracker as
// "no tracking", so this degrades gracefully instead of panicking.
type PrometheusAnonymousTracker struct {
	counter    *prometheus.CounterVec
	registerer prometheus.Registerer
}

// NewPrometheusAnonymousTracker builds and registers a Prometheus-backed
// tracker. A nil registerer falls back to prometheus.DefaultRegisterer.
// Returns nil on registration failure (the caller's nil-check turns Track into
// a no-op); see the type doc for why this is preferable to a panic.
func NewPrometheusAnonymousTracker(registerer prometheus.Registerer) *PrometheusAnonymousTracker {
	if registerer == nil {
		registerer = prometheus.DefaultRegisterer
	}
	c := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: promAnonymousRequestsName,
		Help: "Total anonymous requests admitted by OptionalAuth, labeled by method, path and reason.",
	}, []string{"method", "path", "reason"})
	if err := registerer.Register(c); err != nil {
		return nil
	}
	return &PrometheusAnonymousTracker{counter: c, registerer: registerer}
}

// Track implements AnonymousTracker. It never blocks, never returns an error,
// and is safe for concurrent use. A nil receiver, nil counter, or any nil
// argument produces a no-op rather than a panic.
func (p *PrometheusAnonymousTracker) Track(c *gin.Context, method, path, reason string) {
	if p == nil || p.counter == nil {
		return
	}
	p.counter.WithLabelValues(method, path, reason).Inc()
}

// Unregister deregisters the counter from its registerer. Useful when a test
// binary constructs a tracker against the default registerer and needs to
// tear it down. Returns false if the counter is not currently registered.
func (p *PrometheusAnonymousTracker) Unregister() bool {
	if p == nil || p.counter == nil || p.registerer == nil {
		return false
	}
	return p.registerer.Unregister(p.counter)
}

// Counter exposes the underlying CounterVec for inspection in tests
// (typically via testutil.ToFloat64 or a testutil.CollectAndCount check).
// Returns nil for a nil receiver.
func (p *PrometheusAnonymousTracker) Counter() *prometheus.CounterVec {
	if p == nil {
		return nil
	}
	return p.counter
}
