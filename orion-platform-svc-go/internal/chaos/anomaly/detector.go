package anomaly

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"

	"orion/platform-svc-go/internal/chaos/models"
)

// Observation represents a single metric observation.
type Observation struct {
	Value float64
	Ts    time.Time
}

// Anomaly represents a detected anomaly for a metric.
type Anomaly struct {
	Type        string  `json:"type"`        // zscore | iqr | threshold
	MetricName  string  `json:"metric_name"`
	Value       float64 `json:"value"`
	Threshold   float64 `json:"threshold"`
	Severity    string  `json:"severity"`     // low | medium | high | critical
	Message     string  `json:"message"`
}

// MetricHistory holds per-tenant metric observations using a ring buffer.
type MetricHistory struct {
	buffer   []Observation
	head     int
	count    int
	capacity int
}

func newMetricHistory(capacity int) *MetricHistory {
	buf := make([]Observation, capacity)
	return &MetricHistory{
		buffer:   buf,
		head:     0,
		count:    0,
		capacity: capacity,
	}
}

func (m *MetricHistory) record(value float64, ts time.Time) {
	if m.count < m.capacity {
		m.buffer[m.count] = Observation{Value: value, Ts: ts}
		m.count++
		return
	}
	m.buffer[m.head] = Observation{Value: value, Ts: ts}
	m.head = (m.head + 1) % m.capacity
}

func (m *MetricHistory) values() []float64 {
	v := make([]float64, m.count)
	if m.count < m.capacity {
		for i := 0; i < m.count; i++ {
			v[i] = m.buffer[i].Value
		}
	} else {
		for i := 0; i < m.count; i++ {
			v[i] = m.buffer[(m.head+i)%m.capacity].Value
		}
	}
	return v
}

// Detector provides ML-based anomaly detection for chaos experiments.
// It keeps per-tenant, per-metric metric histories using sync.Map and ring buffers.
type Detector struct {
	mu           sync.RWMutex
	// Key format: "tenantID/metricName"
	metrics      sync.Map
	historyCap   int
	zscoreLimit  float64
	fatalityChan chan *Anomaly

	// injectedExperiments keeps a map of auto-triggered experiment IDs per tenant.
	injectedExperiments sync.Map // key: "tenantID:metricName" -> experimentID
}

// NewDetector creates a new anomaly detector with given defaults.
func NewDetector(historyCap int, zscoreLimit float64) *Detector {
	if historyCap < 10 {
		historyCap = 50
	}
	if zscoreLimit < 1.0 {
		zscoreLimit = 3.0
	}
	return &Detector{
		metrics:      sync.Map{},
		historyCap:   historyCap,
		zscoreLimit:  zscoreLimit,
		fatalityChan: make(chan *Anomaly, 100),
	}
}

// RecordMetric records a metric observation for a tenant.
func (d *Detector) RecordMetric(tenantID, metricName string, value float64, ts time.Time) {
	if tenantID == "" || metricName == "" {
		return
	}
	if ts.IsZero() {
		ts = time.Now()
	}
	key := tenantID + "/" + metricName
	obj, _ := d.metrics.LoadOrStore(key, newMetricHistory(d.historyCap))
	hist := obj.(*MetricHistory)
	d.mu.Lock()
	defer d.mu.Unlock()
	hist.record(value, ts)
}

// DetectAnomaly runs z-score and IQR detection on the last `window` observations
// for the given metric and tenant. Returns all detected anomalies.
func (d *Detector) DetectAnomaly(tenantID, metricName string, window int) ([]Anomaly, error) {
	if tenantID == "" || metricName == "" {
		return nil, fmt.Errorf("tenantID and metricName must not be empty")
	}
	key := tenantID + "/" + metricName
	obj, ok := d.metrics.Load(key)
	if !ok {
		return nil, nil
	}
	hist := obj.(*MetricHistory)

	vars := hist.values()
	if len(vars) == 0 {
		return nil, nil
	}
	if window > len(vars) {
		window = len(vars)
	}
	w := vars[len(vars)-window:]
	if len(w) < 2 {
		return nil, nil
	}

	var anomalies []Anomaly

	// --- Z-score detection ---
	anomalies = append(anomalies, d.detectZScore(metricName, w)...)

	// --- IQR detection ---
	anomalies = append(anomalies, d.detectIQR(metricName, w)...)

	return anomalies, nil
}

func (d *Detector) detectZScore(metricName string, values []float64) []Anomaly {
	n := float64(len(values))
	var sum float64
	for _, v := range values {
		sum += v
	}
	mean := sum / n

	var sumSq float64
	for _, v := range values {
		diff := v - mean
		sumSq += diff * diff
	}
	if sumSq == 0 {
		return nil
	}
	variance := sumSq / n
	sd := math.Sqrt(variance)
	if sd == 0 {
		return nil
	}

	var anomalies []Anomaly
	for _, v := range values {
		z := (v - mean) / sd
		if math.Abs(z) > d.zscoreLimit {
			sev := severityForZScore(z, d.zscoreLimit)
			threshold := mean + d.zscoreLimit*sd
			if v < mean {
				threshold = mean - d.zscoreLimit*sd
			}
			anomalies = append(anomalies, Anomaly{
				Type:        "zscore",
				MetricName:  metricName,
				Value:       v,
				Threshold:   threshold,
				Severity:    sev,
				Message:     fmt.Sprintf("z-score %.2f exceeds limit %.2f on metric %s", z, d.zscoreLimit, metricName),
			})
		}
	}
	return anomalies
}

func (d *Detector) detectIQR(metricName string, values []float64) []Anomaly {
	sorted := make([]float64, len(values))
	copy(sorted, values)
	// Simple insertion sort (small window).
	for i := 1; i < len(sorted); i++ {
		for j := i; j > 0 && sorted[j] < sorted[j-1]; j-- {
			sorted[j], sorted[j-1] = sorted[j-1], sorted[j]
		}
	}

	q1 := percentile(sorted, 0.25)
	q3 := percentile(sorted, 0.75)
	iqr := q3 - q1
	if iqr == 0 {
		return nil
	}
	lowBound := q1 - 1.5*iqr
	highBound := q3 + 1.5*iqr

	var anomalies []Anomaly
	for _, v := range values {
		if v < lowBound || v > highBound {
			sev := severityForIQR(v, lowBound, highBound)
			threshold := highBound
			if v < lowBound {
				threshold = lowBound
			}
			anomalies = append(anomalies, Anomaly{
				Type:        "iqr",
				MetricName:  metricName,
				Value:       v,
				Threshold:   threshold,
				Severity:    sev,
				Message:     fmt.Sprintf("IQR bound violation [%.2f, %.2f] on metric %s, value %.2f", lowBound, highBound, metricName, v),
			})
		}
	}
	return anomalies
}

func percentile(sorted []float64, p float64) float64 {
	if len(sorted) == 1 {
		return sorted[0]
	}
	idx := p * float64(len(sorted)-1)
	lower := int(math.Floor(idx))
	upper := int(math.Ceil(idx))
	if lower == upper {
		return sorted[lower]
	}
	ratio := idx - float64(lower)
	return sorted[lower]*(1-ratio) + sorted[upper]*ratio
}

func severityForZScore(z, limit float64) string {
	ratio := math.Abs(z) / limit
	if ratio >= 1.5 {
		return "critical"
	}
	if ratio >= 1.25 {
		return "high"
	}
	if ratio >= 1.1 {
		return "medium"
	}
	return "low"
}

func severityForIQR(value, lowBound, highBound float64) string {
	var ratio float64
	if value > highBound {
		ratio = (value - highBound) / (highBound - lowBound)
	} else {
		ratio = (lowBound - value) / (highBound - lowBound)
	}
	if ratio >= 2.0 {
		return "critical"
	}
	if ratio >= 1.0 {
		return "high"
	}
	if ratio >= 0.5 {
		return "medium"
	}
	return "low"
}

// ChaosExecutor exposes the methods the anomaly detector needs from the chaos
// service to create and run fault-injection experiments.
//
// This interface lives here (instead of importing the service package) to avoid
// circular dependencies between anomaly and chaos/service.
type ChaosExecutor interface {
	CreateExperiment(ctx context.Context, tenantID string, req models.CreateExperimentRequest) (*models.Experiment, error)
	ActivateExperiment(ctx context.Context, tenantID, id string) (*models.Experiment, error)
	ExecuteCPUSpike(ctx context.Context, tenantID, target string, config string) (*models.InjectResult, error)
}

// AutoInjectOnCritical inspects anomalies and for each critical/high severity
// anomaly it creates a small CPU-spike experiment via the provided executor and
// runs it against the named target service.  Results are collected in order;
// call-side nil executors are ignored gracefully.
func (d *Detector) AutoInjectOnCritical(ctx context.Context, anomalies []Anomaly, tenantID, target string, exec ChaosExecutor) ([]*models.InjectResult, error) {
	if exec == nil || target == "" {
		return nil, nil
	}

	var results []*models.InjectResult
	for _, a := range anomalies {
		if a.Severity != "critical" && a.Severity != "high" {
			continue
		}

		exp := &models.Experiment{
			TenantID: tenantID,
			Name:     fmt.Sprintf("anomaly-auto-response-%s", a.MetricName),
			Scope:    target,
			Faults:   "cpu",
		}

		// Record mapping for audit / later lookup.
		d.injectedExperiments.Store(tenantID+":"+a.MetricName, exp.Name)

		result, err := exec.ExecuteCPUSpike(ctx, tenantID, target, "")
		if err != nil {
			return results, fmt.Errorf("auto-inject for metric %s failed: %w", a.MetricName, err)
		}
		results = append(results, result)
	}

	return results, nil
}
