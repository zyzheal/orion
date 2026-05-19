package monitor

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// MetricCollector collects metrics from hosts
type MetricCollector struct {
	db *gorm.DB
}

// NewMetricCollector creates a new MetricCollector
func NewMetricCollector(db *gorm.DB) *MetricCollector {
	return &MetricCollector{
		db: db,
	}
}

// CollectMetrics collects metrics from a specific host
func (mc *MetricCollector) CollectMetrics(hostID string) ([]Metric, error) {
	// In a real implementation, this would SSH to the host and collect metrics
	// For now, generate mock metrics
	metrics := mc.generateMockMetrics(hostID)

	// Save metrics to database
	for i := range metrics {
		if err := mc.db.Create(&metrics[i]).Error; err != nil {
			return nil, fmt.Errorf("failed to save metric: %w", err)
		}
	}

	return metrics, nil
}

// GetMetrics retrieves metrics for a host within a time range
func (mc *MetricCollector) GetMetrics(hostID string, metricType MetricType, startTime, endTime time.Time) ([]Metric, error) {
	var metrics []Metric

	query := mc.db.Where("host_id = ? AND timestamp BETWEEN ? AND ?", hostID, startTime, endTime)
	if metricType != "" {
		query = query.Where("type = ?", metricType)
	}

	if err := query.Order("timestamp DESC").Find(&metrics).Error; err != nil {
		return nil, fmt.Errorf("failed to get metrics: %w", err)
	}

	return metrics, nil
}

// GetLatestMetric gets the latest metric of a specific type for a host
func (mc *MetricCollector) GetLatestMetric(hostID string, metricType MetricType) (*Metric, error) {
	var metric Metric
	if err := mc.db.Where("host_id = ? AND type = ?", hostID, metricType).
		Order("timestamp DESC").First(&metric).Error; err != nil {
		return nil, fmt.Errorf("metric not found: %w", err)
	}
	return &metric, nil
}

// GetMetricStats returns statistics for a metric over a time range
func (mc *MetricCollector) GetMetricStats(hostID string, metricName string, duration time.Duration) (map[string]float64, error) {
	startTime := time.Now().Add(-duration)

	var result struct {
		Avg   float64
		Min   float64
		Max   float64
		Sum   float64
		Count int64
	}

	if err := mc.db.Model(&Metric{}).
		Select("AVG(value) as avg, MIN(value) as min, MAX(value) as max, SUM(value) as sum, COUNT(*) as count").
		Where("host_id = ? AND name = ? AND timestamp >= ?", hostID, metricName, startTime).
		Scan(&result).Error; err != nil {
		return nil, fmt.Errorf("failed to get stats: %w", err)
	}

	return map[string]float64{
		"avg":   result.Avg,
		"min":   result.Min,
		"max":   result.Max,
		"sum":   result.Sum,
		"count": float64(result.Count),
	}, nil
}

// generateMockMetrics generates mock metrics for testing
func (mc *MetricCollector) generateMockMetrics(hostID string) []Metric {
	now := time.Now()

	return []Metric{
		{
			ID:        uuid.New().String(),
			HostID:    hostID,
			Name:      "cpu_usage",
			Type:      MetricTypeCPU,
			Value:     45.5,
			Unit:      "%",
			Timestamp: now,
		},
		{
			ID:        uuid.New().String(),
			HostID:    hostID,
			Name:      "memory_usage",
			Type:      MetricTypeMemory,
			Value:     72.3,
			Unit:      "%",
			Timestamp: now,
		},
		{
			ID:        uuid.New().String(),
			HostID:    hostID,
			Name:      "disk_usage",
			Type:      MetricTypeDisk,
			Value:     58.1,
			Unit:      "%",
			Timestamp: now,
		},
		{
			ID:        uuid.New().String(),
			HostID:    hostID,
			Name:      "network_in",
			Type:      MetricTypeNetwork,
			Value:     1024.5,
			Unit:      "MB/s",
			Timestamp: now,
		},
		{
			ID:        uuid.New().String(),
			HostID:    hostID,
			Name:      "network_out",
			Type:      MetricTypeNetwork,
			Value:     512.3,
			Unit:      "MB/s",
			Timestamp: now,
		},
	}
}