package benchmark

import (
	"math"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

// Result holds the outcome of a single benchmark run.
type Result struct {
	// Name is a human-readable label for this benchmark.
	Name string

	// Elapsed is the total wall-clock duration of the run.
	Elapsed time.Duration

	// Requests is the total number of completed function calls.
	Requests int64

	// Errors is the number of calls that returned a non-nil error.
	Errors int64

	// P50 is the median latency (50th percentile).
	P50 time.Duration

	// P95 is the 95th percentile latency.
	P95 time.Duration

	// P99 is the 99th percentile latency.
	P99 time.Duration
}

// RunBenchmark executes fn repeatedly with the given concurrency for the
// configured duration, then returns a Result with latency percentiles.
// The fn parameter should return nil on success or an error on failure.
func (c *Config) RunBenchmark(name string, fn func() error) *Result {
	var (
		requests  int64
		errCount  int64
		mu        sync.Mutex
		latencies []time.Duration
	)

	start := time.Now()
	deadline := start.Add(c.Duration)

	// sem acts as a concurrency-limiting channel-based semaphore.
	sem := make(chan struct{}, c.Concurrency)

	// done is closed when the deadline is reached.
	done := make(chan struct{})
	go func() {
		<-time.After(c.Duration)
		close(done)
	}()

	var wg sync.WaitGroup

loop:
	for {
		select {
		case <-done:
			break loop
		case sem <- struct{}{}:
		}

		// If we've already passed the deadline, stop spawning.
		if time.Now().After(deadline) {
			<-sem
			break loop
		}

		wg.Add(1)
		go func() {
			defer func() {
				<-sem
				wg.Done()
			}()

			opStart := time.Now()
			err := fn()
			opElapsed := time.Since(opStart)

			mu.Lock()
			latencies = append(latencies, opElapsed)
			mu.Unlock()

			atomic.AddInt64(&requests, 1)
			if err != nil {
				atomic.AddInt64(&errCount, 1)
			}
		}()
	}

	wg.Wait()
	elapsed := time.Since(start)

	result := &Result{
		Name:     name,
		Elapsed:  elapsed,
		Requests: atomic.LoadInt64(&requests),
		Errors:   atomic.LoadInt64(&errCount),
	}

	// Compute percentiles from sorted latencies.
	mu.Lock()
	sorted := make([]time.Duration, len(latencies))
	copy(sorted, latencies)
	mu.Unlock()

	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i] < sorted[j]
	})

	n := len(sorted)
	if n > 0 {
		result.P50 = sorted[percentileIndex(50, n)]
		result.P95 = sorted[percentileIndex(95, n)]
		result.P99 = sorted[percentileIndex(99, n)]
	}

	return result
}

// percentileIndex returns the index into a sorted slice for the given
// percentile (0-100). Uses ceiling-based rank to avoid underestimating.
func percentileIndex(p, n int) int {
	if n <= 0 {
		return 0
	}
	idx := int(math.Ceil(float64(p)/100.0*float64(n))) - 1
	if idx < 0 {
		return 0
	}
	if idx >= n {
		return n - 1
	}
	return idx
}