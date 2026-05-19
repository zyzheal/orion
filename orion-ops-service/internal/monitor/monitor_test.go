package monitor

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestMetricType_Constants(t *testing.T) {
	assert.Equal(t, MetricType("CPU"), MetricTypeCPU)
	assert.Equal(t, MetricType("MEMORY"), MetricTypeMemory)
	assert.Equal(t, MetricType("DISK"), MetricTypeDisk)
	assert.Equal(t, MetricType("NETWORK"), MetricTypeNetwork)
	assert.Equal(t, MetricType("PROCESS"), MetricTypeProcess)
	assert.Equal(t, MetricType("CUSTOM"), MetricTypeCustom)
}

func TestAlertSeverity_Constants(t *testing.T) {
	assert.Equal(t, AlertSeverity("INFO"), AlertSeverityInfo)
	assert.Equal(t, AlertSeverity("WARNING"), AlertSeverityWarning)
	assert.Equal(t, AlertSeverity("CRITICAL"), AlertSeverityCritical)
}

func TestAlertStatus_Constants(t *testing.T) {
	assert.Equal(t, AlertStatus("FIRING"), AlertStatusFiring)
	assert.Equal(t, AlertStatus("RESOLVED"), AlertStatusResolved)
}

func TestMetric_Creation(t *testing.T) {
	now := time.Now()
	metric := Metric{
		ID:        "metric-1",
		HostID:    "host-1",
		Name:      "cpu_usage",
		Type:      MetricTypeCPU,
		Value:     75.5,
		Unit:      "%",
		Timestamp: now,
	}

	assert.Equal(t, "metric-1", metric.ID)
	assert.Equal(t, "host-1", metric.HostID)
	assert.Equal(t, "cpu_usage", metric.Name)
	assert.Equal(t, MetricTypeCPU, metric.Type)
	assert.Equal(t, 75.5, metric.Value)
	assert.Equal(t, "%", metric.Unit)
}

func TestAlert_Creation(t *testing.T) {
	now := time.Now()
	alert := Alert{
		ID:           "alert-1",
		TenantID:     1,
		HostID:       "host-1",
		Name:         "CPU usage high",
		Description:  "CPU usage exceeds threshold",
		Severity:     AlertSeverityWarning,
		Status:       AlertStatusFiring,
		MetricName:   "cpu_usage",
		Threshold:    80.0,
		CurrentValue: 85.5,
		FiredAt:      &now,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	assert.Equal(t, "alert-1", alert.ID)
	assert.Equal(t, AlertStatusFiring, alert.Status)
	assert.Equal(t, AlertSeverityWarning, alert.Severity)
	assert.Equal(t, 85.5, alert.CurrentValue)
}