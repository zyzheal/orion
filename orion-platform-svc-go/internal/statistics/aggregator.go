package statistics

import (
	"fmt"
	"sort"
	"time"
)

// groupKey uniquely identifies a metric series by name, unit, and tags.
type groupKey struct {
	name string
	unit string
	tags string // serialized map key
}

// Aggregator computes statistical aggregates over a collection of StatMetric values.
type Aggregator struct {
	// DefaultPercentiles are the percentiles computed for every aggregation by default.
	DefaultPercentiles []float64
	// DefaultBuckets are the histogram bucket boundaries used when no explicit buckets
	// are supplied to AggregateHistogram.
	DefaultBuckets []float64
}

// DefaultAggregator returns an Aggregator with commonly useful percentiles and
// default histogram buckets aligned with Prometheus "DefBuckets".
func DefaultAggregator() *Aggregator {
	return &Aggregator{
		DefaultPercentiles: []float64{50, 75, 90, 95, 99},
		DefaultBuckets: []float64{
			0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0,
			2.5, 5.0, 10.0, 25.0, 50.0, 100.0, 250.0, 500.0, 1000.0,
		},
	}
}

// Aggregate computes count, sum, avg, min, max and percentiles for the given
// slice of StatMetric values.
func (a *Aggregator) Aggregate(values []float64, name, unit string, tags map[string]string, window AggregationWindow, now time.Time) (*AggregationResult, error) {
	if len(values) == 0 {
		return nil, fmt.Errorf("statistics: cannot aggregate empty value set for metric %q", name)
	}

	windowStart := now.Add(-window.Duration())

	sorted := make([]float64, len(values))
	copy(sorted, values)
	sort.Float64s(sorted)

	sum := 0.0
	for _, v := range values {
		sum += v
	}

	result := &AggregationResult{
		Name:        name,
		Unit:        unit,
		Window:      window.String(),
		WindowStart: windowStart,
		WindowEnd:   now,
		Count:       int64(len(values)),
		Sum:         sum,
		Avg:         sum / float64(len(values)),
		Min:         sorted[0],
		Max:         sorted[len(sorted)-1],
		Percentiles: a.percentiles(sorted, a.DefaultPercentiles),
		Tags:        tags,
	}
	return result, nil
}

// AggregateHistogram returns AggregationResult including histogram buckets for
// the given values. The buckets parameter is optional; when nil, DefaultBuckets is used.
func (a *Aggregator) AggregateHistogram(values []float64, name, unit string, tags map[string]string, window AggregationWindow, now time.Time, buckets []float64) (*AggregationResult, error) {
	result, err := a.Aggregate(values, name, unit, tags, window, now)
	if err != nil {
		return nil, err
	}

	if buckets == nil {
		buckets = a.DefaultBuckets
	}

	result.Buckets = a.buildBuckets(values, buckets)
	return result, nil
}

// AggregateByWindow iterates over the metrics and groups them into windows,
// returning one AggregationResult per window.
func (a *Aggregator) AggregateByWindow(metrics []StatMetric, window AggregationWindow, now time.Time) ([]*AggregationResult, error) {
	if len(metrics) == 0 {
		return nil, fmt.Errorf("statistics: cannot aggregate empty metric set")
	}

	// Group metrics by (name + tags key) and time window.
	groups := make(map[groupKey]map[time.Time][]float64)

	for _, m := range metrics {
		// Clamp the metric into the window whose end is >= the metric timestamp.
		windowEnd := m.Timestamp.Add(window.Duration()).Truncate(window.Duration())
		tagsKey := serializeTags(m.Tags)
		key := groupKey{name: m.Name, unit: m.Unit, tags: tagsKey}
		if groups[key] == nil {
			groups[key] = make(map[time.Time][]float64)
		}
		groups[key][windowEnd] = append(groups[key][windowEnd], m.Value)
	}

	results := make([]*AggregationResult, 0, len(groups))
	for key, windows := range groups {
		for wEnd, values := range windows {
			r, err := a.Aggregate(values, key.name, key.unit, deserializeTags(key.tags), window, wEnd)
			if err != nil {
				return nil, fmt.Errorf("statistics: failed to aggregate group %v: %w", key.name, err)
			}
			results = append(results, r)
		}
	}

	// Sort results by window end time.
	sort.Slice(results, func(i, j int) bool {
		return results[i].WindowEnd.Before(results[j].WindowEnd)
	})
	return results, nil
}

// percentile computes a single percentile from a sorted slice of values.
func (a *Aggregator) percentile(sorted []float64, p float64) float64 {
	if p < 0 {
		p = 0
	}
	if p > 100 {
		p = 100
	}
	idx := float64(len(sorted)-1) * p / 100.0
	lower := int(idx)
	upper := lower + 1
	if upper >= len(sorted) {
		upper = len(sorted) - 1
	}
	frac := idx - float64(lower)
	return sorted[lower]*(1-frac) + sorted[upper]*frac
}

// percentiles computes the requested percentiles from a sorted slice of values.
func (a *Aggregator) percentiles(sorted []float64, percentiles []float64) map[float64]float64 {
	result := make(map[float64]float64)
	for _, p := range percentiles {
		result[p] = a.percentile(sorted, p)
	}
	return result
}

// buildBuckets builds histogram buckets from a value set.
func (a *Aggregator) buildBuckets(values []float64, boundaries []float64) []Bucket {
	sorted := make([]float64, len(boundaries))
	copy(sorted, boundaries)
	sort.Float64s(sorted)

	buckets := make([]Bucket, len(sorted))
	for i, upper := range sorted {
		var lower float64
		if i == 0 {
			lower = -1e100 // effectively negative infinity
		} else {
			lower = sorted[i-1]
		}
		count := 0
		for _, v := range values {
			if v < upper {
				count++
			}
		}
		var pct float64
		if len(values) > 0 {
			pct = float64(count) / float64(len(values)) * 100.0
		}
		buckets[i] = Bucket{
			Lower:      lower,
			Upper:      upper,
			Count:      int64(count),
			Percentage: pct,
		}
	}
	return buckets
}

// serializeTags converts a map to a deterministic string key for grouping.
func serializeTags(tags map[string]string) string {
	keys := make([]string, 0, len(tags))
	for k := range tags {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, k+"="+tags[k])
	}
	return join(parts, ";")
}

// deserializeTags restores a map from its serialized string.
func deserializeTags(s string) map[string]string {
	m := make(map[string]string)
	if s == "" {
		return m
	}
	for _, part := range split(s, ";") {
		if part == "" {
			continue
		}
		eq := findIndex(part, "=")
		if eq < 0 {
			continue
		}
		m[part[:eq]] = part[eq+1:]
	}
	return m
}

// join concatenates a slice of strings with a separator.
func join(parts []string, sep string) string {
	if len(parts) == 0 {
		return ""
	}
	result := parts[0]
	for _, p := range parts[1:] {
		result += sep + p
	}
	return result
}

// split divides a string by a separator.
func split(s, sep string) []string {
	result := []string{}
	start := 0
	for {
		idx := findIndex(s[start:], sep)
		if idx < 0 {
			if start < len(s) {
				remaining := s[start:]
				if remaining != "" {
					result = append(result, remaining)
				}
			}
			break
		}
		result = append(result, s[start:start+idx])
		start += idx + len(sep)
	}
	return result
}

// findIndex finds the first occurrence of sub in s.
func findIndex(s, sub string) int {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
