// Package benchmark provides a lightweight, zero-dependency benchmark framework
// for running concurrent performance tests against Go services.
//
// Usage:
//
//	cfg := benchmark.DefaultConfig()
//	cfg.Concurrency = 20
//	cfg.Duration = 30 * time.Second
//
//	result := cfg.RunBenchmark("my-endpoint", func() error {
//	    resp, err := http.Get("http://localhost:8080/api/health")
//	    if err != nil {
//	        return err
//	    }
//	    resp.Body.Close()
//	    return nil
//	})
//	result.Report()
package benchmark

import "time"

// Config holds benchmark configuration parameters.
type Config struct {
	// BaseURL is the target service base URL for HTTP benchmarks.
	BaseURL string

	// Concurrency is the number of concurrent workers.
	Concurrency int

	// Duration is the maximum duration of the benchmark run.
	Duration time.Duration

	// RateLimit is the maximum requests per second (0 = unlimited).
	RateLimit int
}

// DefaultConfig returns a Config with sensible defaults.
func DefaultConfig() *Config {
	return &Config{
		BaseURL:     "http://localhost:8080",
		Concurrency: 10,
		Duration:    10 * time.Second,
		RateLimit:   0,
	}
}