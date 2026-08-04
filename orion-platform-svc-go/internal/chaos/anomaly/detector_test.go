package anomaly

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"orion/platform-svc-go/internal/chaos/models"
)

// --- MetricHistory tests ---

func TestMetricHistory_RecordAndValues(t *testing.T) {
	h := newMetricHistory(10)
	h.record(10.0, time.Now())
	h.record(20.0, time.Now())
	h.record(30.0, time.Now())
	vals := h.values()
	assert.Len(t, vals, 3)
	assert.Equal(t, 10.0, vals[0])
	assert.Equal(t, 20.0, vals[1])
	assert.Equal(t, 30.0, vals[2])
}

func TestMetricHistory_RingBufferWraps(t *testing.T) {
	cap := 3
	h := newMetricHistory(cap)
	for i := 0; i < 6; i++ {
		h.record(float64(i)*10, time.Now())
	}
	vals := h.values()
	assert.Len(t, vals, 3)
	assert.Equal(t, 30.0, vals[0])
	assert.Equal(t, 40.0, vals[1])
	assert.Equal(t, 50.0, vals[2])
}

// --- Detector construction ---

func TestNewDetector_Defaults(t *testing.T) {
	d := NewDetector(0, 0.5)
	assert.Equal(t, 50, d.historyCap)
	assert.Equal(t, 3.0, d.zscoreLimit)
}

func TestNewDetector_UserValues(t *testing.T) {
	d := NewDetector(100, 4.0)
	assert.Equal(t, 100, d.historyCap)
	assert.Equal(t, 4.0, d.zscoreLimit)
}

// --- RecordMetric ---

func TestRecordMetric_Basic(t *testing.T) {
	d := NewDetector(50, 3.0)
	d.RecordMetric("t1", "cpu", 50.0, time.Now())
	d.RecordMetric("t1", "cpu", 52.0, time.Now())
	obj, ok := d.metrics.Load("t1/cpu")
	require.True(t, ok)
	hist := obj.(*MetricHistory)
	vals := hist.values()
	assert.Len(t, vals, 2)
}

func TestRecordMetric_IgnoredEmptyTenant(t *testing.T) {
	d := NewDetector(50, 3.0)
	d.RecordMetric("", "cpu", 50.0, time.Now())
	_, ok := d.metrics.Load("/cpu")
	assert.False(t, ok)
	_, ok = d.metrics.Load("t/cpu")
	assert.False(t, ok)
}

func TestRecordMetric_IgnoredEmptyMetric(t *testing.T) {
	d := NewDetector(50, 3.0)
	d.RecordMetric("t1", "", 50.0, time.Now())
	_, ok := d.metrics.Load("t1/")
	assert.False(t, ok)
}

func TestRecordMetric_DefaultTimestamp(t *testing.T) {
	d := NewDetector(50, 3.0)
	before := time.Now()
	d.RecordMetric("t1", "mem", 100.0, time.Time{})
	after := time.Now()
	obj, ok := d.metrics.Load("t1/mem")
	require.True(t, ok)
	ts := obj.(*MetricHistory).values()
	assert.Len(t, ts, 1)
	// Can't easily test timestamp without exposing it; just verify record was made.
	_ = before
	_ = after
}

// --- DetectAnomaly: z-score ---

func TestDetectAnomaly_ZScoreFlags(t *testing.T) {
	d := NewDetector(50, 2.0)
	base := time.Now()
	// Record steady values around 100 with stddev 5.
	for i := 0; i < 20; i++ {
		d.RecordMetric("t1", "cpu", 100.0, base.Add(time.Duration(i)*time.Second))
	}
	// Inject an outlier.
	d.RecordMetric("t1", "cpu", 115.0, base.Add(21*time.Second))

	anomalies, err := d.DetectAnomaly("t1", "cpu", 22)
	require.NoError(t, err)
	assert.NotEmpty(t, anomalies)
	found := false
	for _, a := range anomalies {
		if a.Type == "zscore" {
			found = true
			assert.Contains(t, []string{"low", "medium", "high", "critical"}, a.Severity)
		}
	}
	assert.True(t, found, "expected zscore anomaly")
}

func TestDetectAnomaly_NoData(t *testing.T) {
	d := NewDetector(50, 3.0)
	anomalies, err := d.DetectAnomaly("t1", "cpu", 10)
	require.NoError(t, err)
	assert.Nil(t, anomalies)
}

func TestDetectAnomaly_IgnoredEmptyInput(t *testing.T) {
	d := NewDetector(50, 3.0)
	_, err := d.DetectAnomaly("", "cpu", 10)
	assert.Error(t, err)
}

// --- DetectAnomaly: IQR ---

func TestDetectAnomaly_IQRFlags(t *testing.T) {
	d := NewDetector(50, 3.0)
	base := time.Now()
	// Spreading base values gives Q1≠Q3 → IQR>0 → high outliers detected.
	// Sorted window: [10,20,30,40,50,60,200], Q1=22.5, Q3=52.5, IQR=30
	// lowBound=22.5-45=-22.5, highBound=52.5+45=97.5 → 200 > 97.5 → flagged
	d.RecordMetric("t1", "latency", 10.0, base)
	d.RecordMetric("t1", "latency", 20.0, base.Add(1*time.Second))
	d.RecordMetric("t1", "latency", 30.0, base.Add(2*time.Second))
	d.RecordMetric("t1", "latency", 40.0, base.Add(3*time.Second))
	d.RecordMetric("t1", "latency", 50.0, base.Add(4*time.Second))
	d.RecordMetric("t1", "latency", 60.0, base.Add(5*time.Second))
	d.RecordMetric("t1", "latency", 200.0, base.Add(6*time.Second))

	anomalies, err := d.DetectAnomaly("t1", "latency", 7)
	require.NoError(t, err)
	assert.NotEmpty(t, anomalies)
	found := false
	for _, a := range anomalies {
		if a.Type == "iqr" {
			found = true
			assert.Equal(t, "latency", a.MetricName)
		}
	}
	assert.True(t, found, "expected iqr anomaly")
}

func TestDetectAnomaly_StableNoAnomaly(t *testing.T) {
	d := NewDetector(50, 3.0)
	base := time.Now()
	for i := 0; i < 10; i++ {
		d.RecordMetric("t1", "mem", 50.0, base.Add(time.Duration(i)*time.Second))
	}
	anomalies, err := d.DetectAnomaly("t1", "mem", 10)
	require.NoError(t, err)
	assert.Empty(t, anomalies)
}

// --- AutoInjectOnCritical ---

type mockChaosExecutor struct {
	injectFn func(ctx context.Context, tenantID, target, config string) (*models.InjectResult, error)
}

func (m *mockChaosExecutor) CreateExperiment(ctx context.Context, tenantID string, req models.CreateExperimentRequest) (*models.Experiment, error) {
	return &models.Experiment{ID: "exp-1", TenantID: tenantID, Name: req.Name}, nil
}
func (m *mockChaosExecutor) ActivateExperiment(ctx context.Context, tenantID, id string) (*models.Experiment, error) {
	return &models.Experiment{ID: id, TenantID: tenantID}, nil
}
func (m *mockChaosExecutor) ExecuteCPUSpike(ctx context.Context, tenantID, target, config string) (*models.InjectResult, error) {
	if m.injectFn != nil {
		return m.injectFn(ctx, tenantID, target, config)
	}
	return &models.InjectResult{InjectionID: "cpu-1", Target: target, Status: "injected"}, nil
}

func TestAutoInjectOnCritical_InjectsCritical(t *testing.T) {
	d := NewDetector(50, 3.0)
	exec := &mockChaosExecutor{}
	ctx := context.Background()
	anomalies := []Anomaly{
		{Type: "zscore", MetricName: "cpu", Value: 95, Threshold: 80, Severity: "critical"},
	}
	results, err := d.AutoInjectOnCritical(ctx, anomalies, "t1", "svc-a", exec)
	require.NoError(t, err)
	assert.NotEmpty(t, results)
}

func TestAutoInjectOnCritical_SkipsLow(t *testing.T) {
	d := NewDetector(50, 3.0)
	exec := &mockChaosExecutor{}
	ctx := context.Background()
	anomalies := []Anomaly{
		{Type: "zscore", MetricName: "cpu", Value: 10, Threshold: 5, Severity: "low"},
	}
	results, err := d.AutoInjectOnCritical(ctx, anomalies, "t1", "svc-a", exec)
	require.NoError(t, err)
	assert.Empty(t, results)
}

func TestAutoInjectOnCritical_NilExecutor(t *testing.T) {
	d := NewDetector(50, 3.0)
	results, err := d.AutoInjectOnCritical(context.Background(), []Anomaly{{Severity: "critical"}}, "t1", "svc", nil)
	require.NoError(t, err)
	assert.Nil(t, results)
}

func TestAutoInjectOnCritical_ExecutorError(t *testing.T) {
	d := NewDetector(50, 3.0)
	exec := &mockChaosExecutor{
		injectFn: func(ctx context.Context, tenantID, target, config string) (*models.InjectResult, error) {
			return nil, errors.New("executor down")
		},
	}
	_, err := d.AutoInjectOnCritical(context.Background(), []Anomaly{{Severity: "critical"}}, "t1", "svc", exec)
	assert.Error(t, err)
}

// --- Percentile helper ---

func TestPercentile(t *testing.T) {
	v := []float64{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	assert.Equal(t, 3.25, percentile(v, 0.25))
	assert.Equal(t, 7.75, percentile(v, 0.75)) // idx=6.75 → 7*0.25 + 8*0.75 = 7.75
	assert.Equal(t, 5.5, percentile(v, 0.5))
}
