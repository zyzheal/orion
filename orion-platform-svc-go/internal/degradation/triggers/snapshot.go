package triggers

import (
	"sort"
	"time"
)

// MetricSnapshot is a point-in-time observation fed to the evaluator.
// It corresponds to what a Prometheus scrape or a middleware exporter
// would produce for one evaluation period.
type MetricSnapshot struct {
	// ErrorCount is the number of failed requests during this period.
	ErrorCount int `json:"errorCount"`

	// TotalCount is the total number of requests during this period.
	TotalCount int `json:"totalCount"`

	// LatencySamples is the raw per-request latency (ms) observed during
	// this period.  The evaluator computes P99 from this slice.
	LatencySamples []int64 `json:"latencySamples"`

	// Timestamp marks when the snapshot was produced.
	Timestamp time.Time `json:"timestamp"`
}

// ErrorRate computes the observed error rate for this snapshot.
// Returns 0.0 when there is no traffic (TotalCount == 0).
func (s MetricSnapshot) ErrorRate() float64 {
	if s.TotalCount <= 0 {
		return 0.0
	}
	return float64(s.ErrorCount) / float64(s.TotalCount)
}

// P99Latency computes the P99 latency across all collected LatencySamples.
// When no samples are present it returns 0.
func (s MetricSnapshot) P99Latency() int64 {
	if len(s.LatencySamples) == 0 {
		return 0
	}
	samples := make([]int64, len(s.LatencySamples))
	copy(samples, s.LatencySamples)
	sort.Slice(samples, func(i, j int) bool { return samples[i] < samples[j] })
	// Use nearest-rank method.
	idx := int(float64(len(samples)-1)*0.99)
	if idx < 0 {
		idx = 0
	}
	return samples[idx]
}

// Valid returns true when the snapshot has enough data to make a
// meaningful evaluation.
func (s MetricSnapshot) Valid() bool {
	return s.TotalCount > 0
}
