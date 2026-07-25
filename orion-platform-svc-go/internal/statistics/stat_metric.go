package statistics

import (
	"fmt"
	"time"
)

// StatMetric represents a single statistical measurement.
type StatMetric struct {
	Name      string            // Metric name (e.g. "request_latency_ms")
	Value     float64           // Numeric measurement value
	Unit      string            // Unit of measurement (e.g. "ms", "bytes", "count")
	Timestamp time.Time         // When the measurement was taken
	Tags      map[string]string // Optional dimensions/labels
}

// NewStatMetric creates a StatMetric with a pre-populated timestamp.
func NewStatMetric(name string, value float64, unit string, tags map[string]string) StatMetric {
	if tags == nil {
		tags = make(map[string]string)
	}
	return StatMetric{
		Name:      name,
		Value:     value,
		Unit:      unit,
		Timestamp: time.Now().UTC(),
		Tags:      tags,
	}
}

// MetricType describes the semantic kind of a metric, used to choose default
// aggregation strategies.
type MetricType int

const (
	MetricTypeCounter   MetricType = iota // Monotonically increasing count
	MetricTypeGauge                       // Value that can go up and down
	MetricTypeHistogram                   // Distribution of values
)

func (mt MetricType) String() string {
	switch mt {
	case MetricTypeCounter:
		return "counter"
	case MetricTypeGauge:
		return "gauge"
	case MetricTypeHistogram:
		return "histogram"
	default:
		return "unknown"
	}
}

// AggregationWindow defines a pre-defined time window for rolling aggregation.
type AggregationWindow int

const (
	Window1m  AggregationWindow = AggregationWindow(1 * time.Minute)
	Window5m  AggregationWindow = AggregationWindow(5 * time.Minute)
	Window1h  AggregationWindow = AggregationWindow(1 * time.Hour)
	Window24h AggregationWindow = AggregationWindow(24 * time.Hour)
)

func (w AggregationWindow) Duration() time.Duration {
	return time.Duration(w)
}

func (w AggregationWindow) String() string {
	switch w {
	case Window1m:
		return "1m"
	case Window5m:
		return "5m"
	case Window1h:
		return "1h"
	case Window24h:
		return "24h"
	default:
		return fmt.Sprintf("%ds", w.Duration().Seconds())
	}
}

// AggregationResult holds the computed statistics for a metric over a window.
type AggregationResult struct {
	Name        string              `json:"name"`
	Unit        string              `json:"unit"`
	Window      string              `json:"window"`
	WindowStart time.Time           `json:"window_start"`
	WindowEnd   time.Time           `json:"window_end"`
	Count       int64               `json:"count"`
	Sum         float64             `json:"sum"`
	Avg         float64             `json:"avg"`
	Min         float64             `json:"min"`
	Max         float64             `json:"max"`
	Percentiles map[float64]float64 `json:"percentiles"`       // key = percentile (0-100), value = result
	Buckets     []Bucket            `json:"buckets,omitempty"` // Histogram buckets
	Tags        map[string]string   `json:"tags"`
}

// Bucket represents a single histogram bucket [lower, upper).
type Bucket struct {
	Lower      float64 `json:"lower"`
	Upper      float64 `json:"upper"`
	Count      int64   `json:"count"`
	Percentage float64 `json:"percentage"`
}

// ErrInvalidPercentile indicates a percentile value outside the valid range.
var ErrInvalidPercentile = fmt.Errorf("statistics: percentile must be between 0 and 100")
