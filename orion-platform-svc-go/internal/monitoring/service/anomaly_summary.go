package service

import (
	"context"
	"errors"
	"fmt"
	"math"

	"orion/platform-svc-go/internal/monitoring/models"
)

// GetAnomalySummary aggregates anomaly counts by severity and metric.
func (s *Service) GetAnomalySummary(ctx context.Context, tenantID string) (*models.AnomalySummary, error) {
	if tenantID == "" {
		return nil, errors.New("tenant_id is required")
	}

	// Use dedicated aggregation queries to avoid loading all rows into memory.
	byMetricRows, err := s.repo.CountAnomaliesByMetric(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("anomaly summary: count by metric: %w", err)
	}
	byMetric := make([]struct {
		Metric   string  `json:"metric"`
		Count    int     `json:"count"`
		AvgScore float64 `json:"avg_score"`
	}, 0, len(byMetricRows))
	for _, r := range byMetricRows {
		avg := math.Round(r.AvgScore*100) / 100
		byMetric = append(byMetric, struct {
			Metric   string  `json:"metric"`
			Count    int     `json:"count"`
			AvgScore float64 `json:"avg_score"`
		}{Metric: r.Metric, Count: r.Count, AvgScore: avg})
	}

	bySeverityRows, err := s.repo.CountAnomaliesBySeverity(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("anomaly summary: count by severity: %w", err)
	}
	bySeverity := make(map[string]int)
	for _, r := range bySeverityRows {
		bySeverity[r.Severity] = r.Count
	}

	totalAnomalies := 0
	for _, c := range bySeverity {
		totalAnomalies += c
	}

	last24h, _ := s.repo.CountAnomaliesLast24h(ctx, tenantID)

	return &models.AnomalySummary{
		TotalAnomalies: totalAnomalies,
		ByMetric:       byMetric,
		BySeverity:     bySeverity,
		Last24h:        last24h,
	}, nil
}
