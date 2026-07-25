package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Metrics holds Prometheus metrics for circuit breaker monitoring.
type Metrics struct {
	// TotalRequests counts all requests passing through the breaker.
	TotalRequests *prometheus.CounterVec
	// SuccessCount counts successful requests.
	SuccessCount *prometheus.CounterVec
	// FailureCount counts failed requests.
	FailureCount *prometheus.CounterVec
	// StateGauge tracks the current state of each breaker (0=closed, 1=open, 2=half_open, 3=failed, 4=recovered).
	StateGauge *prometheus.GaugeVec
	// OpenDurationSeconds tracks how long each breaker has been in open state.
	OpenDurationSeconds *prometheus.GaugeVec
	// RequestLatencyMs measures request latency in milliseconds.
	RequestLatencyMs *prometheus.HistogramVec
	// TransitionsTotal counts state transitions.
	TransitionsTotal *prometheus.CounterVec
}

// NewMetrics creates a new Metrics instance with default labels.
func NewMetrics() *Metrics {
	labels := []string{"config_id", "strategy"}

	return &Metrics{
		TotalRequests: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "orion_circuit_breaker_total_requests",
			Help: "Total number of requests processed by the circuit breaker",
		}, labels),

		SuccessCount: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "orion_circuit_breaker_success_total",
			Help: "Total number of successful requests",
		}, labels),

		FailureCount: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "orion_circuit_breaker_failure_total",
			Help: "Total number of failed requests",
		}, labels),

		StateGauge: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "orion_circuit_breaker_state",
			Help: "Current state of the circuit breaker (0=closed, 1=open, 2=half_open, 3=failed, 4=recovered)",
		}, labels),

		OpenDurationSeconds: promauto.NewGaugeVec(prometheus.GaugeOpts{
			Name: "orion_circuit_breaker_open_duration_seconds",
			Help: "Duration in seconds that the breaker has been in open state",
		}, labels),

		RequestLatencyMs: promauto.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "orion_circuit_breaker_request_latency_ms",
			Help:    "Request latency in milliseconds",
			Buckets: prometheus.DefBuckets,
		}, labels),

		TransitionsTotal: promauto.NewCounterVec(prometheus.CounterOpts{
			Name: "orion_circuit_breaker_transitions_total",
			Help: "Total number of state transitions",
		}, append(labels, "from", "to")),
	}
}

// StateToFloat converts a state string to a float64 for the gauge.
func StateToFloat(state string) float64 {
	switch state {
	case "closed":
		return 0
	case "open":
		return 1
	case "half_open":
		return 2
	case "failed":
		return 3
	case "recovered":
		return 4
	case "forced_open":
		return 1.5
	case "forced_closed":
		return 0.5
	default:
		return -1
	}
}
