package statistics

import (
	"context"
	"fmt"
	"sort"
	"testing"
	"time"
)

// --- Aggregator tests ---

func TestAggregator_Aggregate(t *testing.T) {
	a := DefaultAggregator()
	values := []float64{10, 20, 30, 40, 50}
	now := time.Now().UTC()

	result, err := a.Aggregate(values, "latency", "ms", nil, Window1m, now)
	if err != nil {
		t.Fatalf("Aggregate error: %v", err)
	}

	if result.Count != 5 {
		t.Errorf("expected count 5, got %d", result.Count)
	}
	if result.Sum != 150 {
		t.Errorf("expected sum 150, got %f", result.Sum)
	}
	if result.Avg != 30 {
		t.Errorf("expected avg 30, got %f", result.Avg)
	}
	if result.Min != 10 {
		t.Errorf("expected min 10, got %f", result.Min)
	}
	if result.Max != 50 {
		t.Errorf("expected max 50, got %f", result.Max)
	}
	if _, ok := result.Percentiles[50]; !ok {
		t.Error("expected p50 in result")
	}
	if result.Percentiles[50] != 30 {
		t.Errorf("expected p50=30, got %f", result.Percentiles[50])
	}
}

func TestAggregator_Aggregate_Empty(t *testing.T) {
	a := DefaultAggregator()
	_, err := a.Aggregate([]float64{}, "latency", "ms", nil, Window1m, time.Now())
	if err == nil {
		t.Fatal("expected error for empty aggregation")
	}
}

func TestAggregator_AggregateHistogram(t *testing.T) {
	a := DefaultAggregator()
	values := []float64{0.01, 0.02, 0.5, 1.0, 10.0}

	result, err := a.AggregateHistogram(values, "latency", "s", nil, Window1m, time.Now(), []float64{0.1, 1.0, 10.0})
	if err != nil {
		t.Fatalf("AggregateHistogram error: %v", err)
	}
	if len(result.Buckets) != 3 {
		t.Fatalf("expected 3 buckets, got %d", len(result.Buckets))
	}
	// bucket [-, 0.1): count=2 (0.01, 0.02)
	if result.Buckets[0].Count != 2 {
		t.Errorf("expected bucket 0 count=2, got %d", result.Buckets[0].Count)
	}
}

func TestAggregator_AggregateByWindow(t *testing.T) {
	a := DefaultAggregator()
	now := time.Now().UTC()

	metrics := []StatMetric{
		NewStatMetric("latency", 10, "ms", nil),
		NewStatMetric("latency", 20, "ms", nil),
		NewStatMetric("latency", 30, "ms", nil),
	}

	results, err := a.AggregateByWindow(metrics, Window1m, now)
	if err != nil {
		t.Fatalf("AggregateByWindow error: %v", err)
	}
	if len(results) == 0 {
		t.Fatal("expected at least one result")
	}
	total := int64(0)
	for _, r := range results {
		total += r.Count
	}
	if total != 3 {
		t.Errorf("expected total count 3 across windows, got %d", total)
	}
}

func TestAggregator_AggregateByWindow_Empty(t *testing.T) {
	a := DefaultAggregator()
	_, err := a.AggregateByWindow([]StatMetric{}, Window1m, time.Now())
	if err != nil {
		t.Fatal("expected error for empty metrics")
	}
}

// --- Processor tests ---

func TestProcessor_IngestAndAggregate(t *testing.T) {
	p := NewProcessor()
	now := time.Now().UTC()

	// Ingest 5 values with explicit timestamps.
	for i := 1; i <= 5; i++ {
		m := StatMetric{
			Name:      "latency",
			Value:     float64(i) * 10,
			Unit:      "ms",
			Timestamp: now.Add(time.Duration(i) * time.Second),
			Tags:      map[string]string{"service": "api"},
		}
		p.Ingest(m)
	}

	result, err := p.Aggregate("latency", map[string]string{"service": "api"}, Window1m, "ms", now.Add(6*time.Second))
	if err != nil {
		t.Fatalf("Aggregate error: %v", err)
	}
	if result.Count != 5 {
		t.Errorf("expected count 5, got %d", result.Count)
	}
	if result.Name != "latency" {
		t.Errorf("expected name latency, got %s", result.Name)
	}
}

func TestProcessor_IngestBatch(t *testing.T) {
	p := NewProcessor()
	metrics := []StatMetric{
		NewStatMetric("cpu", 1.5, "percent", nil),
		NewStatMetric("cpu", 2.5, "percent", nil),
	}
	p.IngestBatch(metrics)

	if p.MetricCount() != 2 {
		t.Errorf("expected 2 metrics, got %d", p.MetricCount())
	}
}

func TestProcessor_Aggregate_Missing(t *testing.T) {
	p := NewProcessor()
	_, err := p.Aggregate("nonexistent", nil, Window1m, "ms", time.Now())
	if err != nil {
		t.Fatal("expected error for missing metric")
	}
}

func TestProcessor_AggregateWindowFiltering(t *testing.T) {
	p := NewProcessor()
	now := time.Now().UTC()

	// Value 1 hour ago — should be excluded from 1m window.
	m1 := StatMetric{
		Name:      "latency",
		Value:     100,
		Unit:      "ms",
		Timestamp: now.Add(-1 * time.Hour),
	}
	// Value 30 seconds ago — should be included.
	m2 := StatMetric{
		Name:      "latency",
		Value:     50,
		Unit:      "ms",
		Timestamp: now.Add(-30 * time.Second),
	}
	p.Ingest(m1)
	p.Ingest(m2)

	result, err := p.Aggregate("latency", nil, Window1m, "ms", now)
	if err != nil {
		t.Fatalf("Aggregate error: %v", err)
	}
	if result.Count != 1 {
		t.Errorf("expected count 1 (only recent value), got %d", result.Count)
	}
	if result.Avg != 50 {
		t.Errorf("expected avg 50, got %f", result.Avg)
	}
}

func TestProcessor_Prune(t *testing.T) {
	p := NewProcessor(WithRetention(1 * time.Minute))
	now := time.Now().UTC()

	// Old metric (2 min ago)
	m1 := StatMetric{
		Name:      "old_metric",
		Value:     1,
		Timestamp: now.Add(-2 * time.Minute),
	}
	// New metric
	m2 := StatMetric{
		Name:      "new_metric",
		Value:     2,
		Timestamp: now,
	}
	p.Ingest(m1)
	p.Ingest(m2)

	removed := p.Prune(context.Background())
	if removed != 1 {
		t.Errorf("expected 1 removed, got %d", removed)
	}
	if p.MetricCount() != 1 {
		t.Errorf("expected 1 remaining, got %d", p.MetricCount())
	}
}

func TestProcessor_Prune_ContextCancelled(t *testing.T) {
	p := NewProcessor(WithRetention(1 * time.Hour))
	ctx, cancel := context.WithCancel(context.Background())

	// Ingest a bunch of old metrics
	for i := 0; i < 100; i++ {
		p.Ingest(StatMetric{
			Name:      "test",
			Value:     1,
			Timestamp: time.Now().Add(-2 * time.Hour),
		})
	}

	// Cancel immediately
	cancel()
	removed := p.Prune(ctx)
	if removed >= 100 {
		t.Error("prune should have been cancelled before removing all metrics")
	}
}

func TestProcessor_StartBackgroundPrune(t *testing.T) {
	p := NewProcessor(WithRetention(1 * time.Second))
	p.Ingest(StatMetric{
		Name:      "expiring",
		Value:     1,
		Timestamp: time.Now().Add(-2 * time.Second),
	})

	stop := p.StartBackgroundPrune(context.Background(), 500*time.Millisecond)
	time.Sleep(1200 * time.Millisecond)
	close(stop)

	if p.MetricCount() != 0 {
		t.Errorf("expected 0 metrics after background prune, got %d", p.MetricCount())
	}
}

func TestProcessor_AggregateAll(t *testing.T) {
	p := NewProcessor()
	now := time.Now().UTC()

	for i := 1; i <= 3; i++ {
		p.Ingest(StatMetric{
			Name:      fmt.Sprintf("metric_%d", i),
			Value:     float64(i),
			Unit:      "unit",
			Timestamp: now,
		})
	}

	results, err := p.AggregateAll(Window1m, now)
	if err != nil {
		t.Fatalf("AggregateAll error: %v", err)
	}
	if len(results) != 3 {
		t.Errorf("expected 3 results, got %d", len(results))
	}
}

func TestProcessor_AggregateByWindow(t *testing.T) {
	p := NewProcessor()
	now := time.Now().UTC()

	for i := 1; i <= 5; i++ {
		p.Ingest(StatMetric{
			Name:      "latency",
			Value:     float64(i),
			Unit:      "ms",
			Timestamp: now,
		})
	}

	results, err := p.AggregateByWindow("latency", nil, Window1m, "ms", now)
	if err != nil {
		t.Fatalf("AggregateByWindow error: %v", err)
	}
	if len(results) == 0 {
		t.Fatal("expected at least one window result")
	}
}

func TestProcessor_Concurrency(t *testing.T) {
	p := NewProcessor()
	done := make(chan bool)

	// Ingest from multiple goroutines concurrently.
	for i := 0; i < 10; i++ {
		go func(n int) {
			for j := 0; j < 100; j++ {
				p.Ingest(StatMetric{
					Name:      "concurrent_metric",
					Value:     float64(n*100 + j),
					Unit:      "value",
					Timestamp: time.Now(),
				})
			}
			done <- true
		}(i)
	}

	for i := 0; i < 10; i++ {
		<-done
	}

	count := p.MetricCount()
	if count != 1000 {
		t.Errorf("expected 1000 metrics, got %d", count)
	}
}

func TestPercentileEdgeCases(t *testing.T) {
	a := DefaultAggregator()
	sorted := []float64{10, 20}

	result := a.percentiles(sorted, []float64{0, 50, 100})
	if result[0] != 10 {
		t.Errorf("expected p0=10, got %f", result[0])
	}
	if result[50] != 15 {
		t.Errorf("expected p50=15, got %f", result[50])
	}
	if result[100] != 20 {
		t.Errorf("expected p100=20, got %f", result[100])
	}
}

func TestMetricTypeString(t *testing.T) {
	tests := []struct {
		mt   MetricType
		want string
	}{
		{MetricTypeCounter, "counter"},
		{MetricTypeGauge, "gauge"},
		{MetricTypeHistogram, "histogram"},
		{MetricType(99), "unknown"},
	}
	for _, tt := range tests {
		if got := tt.mt.String(); got != tt.want {
			t.Errorf("%v.String() = %q, want %q", tt.mt, got, tt.want)
		}
	}
}

func TestNewStatMetric_NilTags(t *testing.T) {
	m := NewStatMetric("test", 1.0, "ms", nil)
	if m.Tags == nil {
		t.Fatal("tags should be non-nil even when input is nil")
	}
}

func TestWindowString(t *testing.T) {
	tests := []struct {
		w    AggregationWindow
		want string
	}{
		{Window1m, "1m"},
		{Window5m, "5m"},
		{Window1h, "1h"},
		{Window24h, "24h"},
		{AggregationWindow(99), "99s"},
	}
	for _, tt := range tests {
		if got := tt.w.String(); got != tt.want {
			t.Errorf("%v.String() = %q, want %q", tt.w, got, tt.want)
		}
	}
}

func TestDeserializeTags(t *testing.T) {
	m := deserializeTags("host=web-1;env=prod")
	if m["host"] != "web-1" {
		t.Errorf("expected host=web-1, got %q", m["host"])
	}
	if m["env"] != "prod" {
		t.Errorf("expected env=prod, got %q", m["env"])
	}

	empty := deserializeTags("")
	if len(empty) != 0 {
		t.Error("expected empty map for empty string")
	}
}

func TestSerializeTags_Ordered(t *testing.T) {
	m := map[string]string{"z": "3", "a": "1", "m": "2"}
	s1 := serializeTags(m)
	s2 := serializeTags(m)
	if s1 != s2 {
		t.Error("serializeTags should be deterministic")
	}
}

func TestAggregateResult_Sorting(t *testing.T) {
	// Verify results from AggregateByWindow are sorted by WindowEnd.
	a := DefaultAggregator()
	now := time.Now().UTC()

	// Create metrics spanning 3 different 1-minute windows.
	metrics := []StatMetric{
		{Name: "x", Value: 1, Timestamp: now.Add(-2 * time.Minute)},
		{Name: "x", Value: 2, Timestamp: now.Add(-1 * time.Minute)},
		{Name: "x", Value: 3, Timestamp: now},
	}

	results, err := a.AggregateByWindow(metrics, Window1m, now)
	if err != nil {
		t.Fatalf("AggregateByWindow error: %v", err)
	}
	for i := 1; i < len(results); i++ {
		if results[i-1].WindowEnd.After(results[i].WindowEnd) {
			t.Errorf("results not sorted: result[%d].WindowEnd > result[%d].WindowEnd", i-1, i)
		}
	}
}
