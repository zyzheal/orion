package triggers

import (
	"sort"
	"sync"
	"time"
)

// ring implements a fixed-capacity FIFO ring buffer over a generic type.
type ring[T any] struct {
	buf    []T
	head   int
	tail   int
	count  int
	cap    int
	mu     sync.Mutex
}

func newRing[T any](cap int) *ring[T] {
	return &ring[T]{
		buf: make([]T, cap),
		cap: cap,
	}
}

// push appends an element, evicting the oldest if full.
func (r *ring[T]) push(v T) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.buf[r.tail] = v
	r.tail = (r.tail + 1) % r.cap
	if r.count < r.cap {
		r.count++
	} else {
		r.head = (r.head + 1) % r.cap
	}
}

// slice returns a copy of the buffer in oldest→newest order.
func (r *ring[T]) slice() []T {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]T, 0, r.count)
	for i := 0; i < r.count; i++ {
		idx := (r.head + i) % r.cap
		out = append(out, r.buf[idx])
	}
	return out
}

// len returns the current number of elements.
func (r *ring[T]) len() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.count
}

// SlidingWindow holds a fixed-size window of MetricSnapshots.
// It provides thread-safe push and iteration.
type SlidingWindow struct {
	ring    *ring[MetricSnapshot]
	cap     int
	mu      sync.RWMutex
	window  time.Duration // logical window duration (for diagnostics)
	started time.Time
}

// NewSlidingWindow creates a window that retains the last `cap` snapshots.
func NewSlidingWindow(cap int) *SlidingWindow {
	return &SlidingWindow{
		ring:    newRing[MetricSnapshot](cap),
		cap:     cap,
		started: time.Now().UTC(),
	}
}

// Push adds a snapshot to the window, evicting the oldest if full.
func (w *SlidingWindow) Push(s MetricSnapshot) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if s.Timestamp.IsZero() {
		s.Timestamp = time.Now().UTC()
	}
	w.ring.push(s)
}

// All returns all snapshots in oldest-to-newest order.
func (w *SlidingWindow) All() []MetricSnapshot {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.ring.slice()
}

// Count returns the number of snapshots currently in the window.
func (w *SlidingWindow) Count() int {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.ring.len()
}

// Aggregated computes aggregate metrics across all snapshots in the window:
// total error count, total request count, and combined latency samples.
func (w *SlidingWindow) Aggregated() AggregatedMetrics {
	snapshots := w.All()
	agg := AggregatedMetrics{}
	for _, s := range snapshots {
		agg.TotalCount += s.TotalCount
		agg.ErrorCount += s.ErrorCount
		agg.LatencySamples = append(agg.LatencySamples, s.LatencySamples...)
	}
	return agg
}

// Clear removes all snapshots from the window.
func (w *SlidingWindow) Clear() {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.ring = newRing[MetricSnapshot](w.cap)
	w.started = time.Now().UTC()
}

// AggregatedMetrics is the result of aggregating the entire window.
type AggregatedMetrics struct {
	ErrorCount     int     `json:"errorCount"`
	TotalCount     int     `json:"totalCount"`
	ErrorRate      float64 `json:"errorRate"`
	LatencySamples []int64 `json:"latencySamples,omitempty"`
	P99LatencyMs   int64   `json:"p99LatencyMs"`
}

// Compute fills derived fields (ErrorRate, P99LatencyMs).
func (a *AggregatedMetrics) Compute() {
	if a.TotalCount > 0 {
		a.ErrorRate = float64(a.ErrorCount) / float64(a.TotalCount)
	}
	samples := a.LatencySamples
	if len(samples) > 0 {
		sorted := make([]int64, len(samples))
		copy(sorted, samples)
		sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })
		idx := int(float64(len(sorted)-1) * 0.99)
		if idx < 0 {
			idx = 0
		}
		a.P99LatencyMs = sorted[idx]
	}
}
