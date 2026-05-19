package monitor

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AlertManager manages alerts
type AlertManager struct {
	db *gorm.DB
}

// NewAlertManager creates a new AlertManager
func NewAlertManager(db *gorm.DB) *AlertManager {
	return &AlertManager{
		db: db,
	}
}

// CreateAlert creates a new alert
func (am *AlertManager) CreateAlert(alert *Alert) error {
	if alert.ID == "" {
		alert.ID = uuid.New().String()
	}

	if alert.Status == "" {
		alert.Status = AlertStatusFiring
	}

	now := time.Now()
	alert.FiredAt = &now
	alert.CreatedAt = now
	alert.UpdatedAt = now

	if err := am.db.Create(alert).Error; err != nil {
		return fmt.Errorf("failed to create alert: %w", err)
	}

	return nil
}

// GetAlerts retrieves alerts for a host
func (am *AlertManager) GetAlerts(hostID string) ([]Alert, error) {
	var alerts []Alert
	if err := am.db.Where("host_id = ?", hostID).Order("created_at DESC").Find(&alerts).Error; err != nil {
		return nil, fmt.Errorf("failed to get alerts: %w", err)
	}
	return alerts, nil
}

// GetActiveAlerts retrieves all active (firing) alerts
func (am *AlertManager) GetActiveAlerts() ([]Alert, error) {
	var alerts []Alert
	if err := am.db.Where("status = ?", AlertStatusFiring).Order("created_at DESC").Find(&alerts).Error; err != nil {
		return nil, fmt.Errorf("failed to get active alerts: %w", err)
	}
	return alerts, nil
}

// ResolveAlert resolves an alert
func (am *AlertManager) ResolveAlert(alertID string) error {
	var alert Alert
	if err := am.db.Where("id = ?", alertID).First(&alert).Error; err != nil {
		return fmt.Errorf("alert not found: %w", err)
	}

	now := time.Now()
	alert.Status = AlertStatusResolved
	alert.ResolvedAt = &now
	alert.UpdatedAt = now

	if err := am.db.Model(&alert).Updates(map[string]interface{}{
		"status":      AlertStatusResolved,
		"resolved_at": now,
		"updated_at":  now,
	}).Error; err != nil {
		return fmt.Errorf("failed to resolve alert: %w", err)
	}

	return nil
}

// CheckThresholds checks metrics against thresholds and creates alerts
func (am *AlertManager) CheckThresholds(hostID string, metrics []Metric) error {
	for _, metric := range metrics {
		threshold := am.getThreshold(metric.Name)
		if threshold == 0 {
			continue
		}

		if metric.Value > threshold {
			alert := &Alert{
				ID:          uuid.New().String(),
				HostID:      hostID,
				Name:        fmt.Sprintf("%s threshold exceeded", metric.Name),
				Description: fmt.Sprintf("%s is %.2f%%, exceeds threshold %.2f%%", metric.Name, metric.Value, threshold),
				Severity:    AlertSeverityWarning,
				Status:      AlertStatusFiring,
				MetricName:  metric.Name,
				Threshold:   threshold,
				CurrentValue: metric.Value,
			}

			// Check if alert already exists
			var existing Alert
			err := am.db.Where("host_id = ? AND metric_name = ? AND status = ?", hostID, metric.Name, AlertStatusFiring).First(&existing).Error
			if err == gorm.ErrRecordNotFound {
				if err := am.CreateAlert(alert); err != nil {
					return err
				}
			}
		}
	}

	return nil
}

// getThreshold returns the threshold for a metric (mock implementation)
func (am *AlertManager) getThreshold(metricName string) float64 {
	thresholds := map[string]float64{
		"cpu_usage":    80.0,
		"memory_usage": 85.0,
		"disk_usage":   90.0,
	}
	return thresholds[metricName]
}

// DeleteAlert deletes an alert
func (am *AlertManager) DeleteAlert(alertID string) error {
	if err := am.db.Where("id = ?", alertID).Delete(&Alert{}).Error; err != nil {
		return fmt.Errorf("failed to delete alert: %w", err)
	}
	return nil
}