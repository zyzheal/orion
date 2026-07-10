package service

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"

	"orion/cost-svc-go/internal/models"
	"orion/cost-svc-go/internal/repository"

	"github.com/google/uuid"
)

// AnomalyService detects cost anomalies using statistical methods.
type AnomalyService struct {
	repo              *repository.CostRepository
	zScoreThreshold   float64
	spikeThreshold    float64
}

// NewAnomalyService creates a new anomaly detection service.
func NewAnomalyService(repo *repository.CostRepository) *AnomalyService {
	return &AnomalyService{
		repo:            repo,
		zScoreThreshold: 2.0,
		spikeThreshold:  50,
	}
}

// DetectAnomalies analyzes cost data and detects anomalies.
func (s *AnomalyService) DetectAnomalies(ctx context.Context, tenantID, startDate, endDate string) *models.AnomalyDetectionResult {
	costs, err := s.repo.FindCostRecords(ctx, tenantID, nil, 0, 1000)
	if err != nil {
		return &models.AnomalyDetectionResult{
			DetectedAt: time.Now(),
		}
	}

	// Group by day
	dailyMap := make(map[string]float64)
	for _, c := range costs {
		key := c.Date.Format("2006-01-02")
		dailyMap[key] += c.Cost
	}

	dates := make([]string, 0, len(dailyMap))
	for d := range dailyMap {
		dates = append(dates, d)
	}
	sort.Strings(dates)

	if len(dates) < 3 {
		return &models.AnomalyDetectionResult{
			Anomalies:           []models.AnomalyAlert{},
			DetectedAt:          time.Now(),
			DataPointsAnalyzed:  len(costs),
		}
	}

	anomalies := s.detectZScoreAnomalies(tenantID, dates, dailyMap)
	sustainedAnomalies := s.detectSustainedHigh(tenantID, dates, dailyMap)
	anomalies = append(anomalies, sustainedAnomalies...)

	// Store anomalies in database
	for _, a := range anomalies {
		_ = s.repo.CreateAnomalyAlert(ctx, &a)
	}

	return &models.AnomalyDetectionResult{
		Anomalies:          anomalies,
		DataPointsAnalyzed: len(costs),
		DetectedAt:         time.Now(),
		TimeWindow: models.TimeRange{
			Start: time.Now().AddDate(0, 0, -30),
			End:   time.Now(),
		},
	}
}

// GetAnomalies retrieves anomalies for a tenant.
func (s *AnomalyService) GetAnomalies(ctx context.Context, tenantID string, severity string, offset, limit int) ([]models.AnomalyAlert, error) {
	return s.repo.GetAnomalies(ctx, tenantID, severity, offset, limit)
}

// GetRecentAnomalies returns the most recent anomalies.
func (s *AnomalyService) GetRecentAnomalies(ctx context.Context, tenantID string) ([]models.AnomalyAlert, error) {
	return s.repo.GetRecentAnomalies(ctx, tenantID, 20)
}

func (s *AnomalyService) detectZScoreAnomalies(tenantID string, dates []string, dailyMap map[string]float64) []models.AnomalyAlert {
	costs := make([]float64, len(dates))
	for i, d := range dates {
		costs[i] = dailyMap[d]
	}

	mean := sumCosts(costs) / float64(len(costs))
	stdDev := computeStdDev(costs, mean)

	var anomalies []models.AnomalyAlert
	for i, date := range dates {
		zScore := 0.0
		if stdDev > 0 {
			zScore = (costs[i] - mean) / stdDev
		}

		if math.Abs(zScore) > s.zScoreThreshold {
			deviation := 0.0
			if mean > 0 {
				deviation = (costs[i] - mean) / mean * 100
			}
			anomalies = append(anomalies, models.AnomalyAlert{
				ID:              uuid.New().String(),
				TenantID:        tenantID,
				Type:            models.AnomalySpike,
				Severity:        s.calculateSeverity(zScore, deviation),
				Value:           roundFloat(costs[i]),
				ExpectedValue:   roundFloat(mean),
				Deviation:       roundFloat(deviation),
				DetectedAt:      time.Now(),
				TimeWindowStart: time.Now().AddDate(0, 0, -30),
				TimeWindowEnd:   time.Now(),
				Description:     fmt.Sprintf("Cost spike detected on %s: $%.2f (expected ~$%.2f)", date, costs[i], mean),
				Metadata:        models.JSONB{"z_score": roundFloat(zScore)},
			})
		}
	}

	return anomalies
}

func (s *AnomalyService) detectSustainedHigh(tenantID string, dates []string, dailyMap map[string]float64) []models.AnomalyAlert {
	costs := make([]float64, len(dates))
	for i, d := range dates {
		costs[i] = dailyMap[d]
	}

	mean := sumCosts(costs) / float64(len(costs))
	stdDev := computeStdDev(costs, mean)
	threshold := mean + 2*stdDev

	var anomalies []models.AnomalyAlert
	streakStart := -1

	for i := range dates {
		if costs[i] > threshold {
			if streakStart == -1 {
				streakStart = i
			}
		} else {
			if streakStart != -1 && i-streakStart >= 3 {
				anomalies = append(anomalies, s.sustainedHighAlert(tenantID, dates, costs, streakStart, i, threshold))
			}
			streakStart = -1
		}
	}

	// Check final streak
	if streakStart != -1 && len(dates)-streakStart >= 3 {
		anomalies = append(anomalies, s.sustainedHighAlert(tenantID, dates, costs, streakStart, len(dates), threshold))
	}

	return anomalies
}

func (s *AnomalyService) sustainedHighAlert(tenantID string, dates []string, costs []float64, start, end int, threshold float64) models.AnomalyAlert {
	var streakCost float64
	for i := start; i < end; i++ {
		streakCost += costs[i]
	}

	return models.AnomalyAlert{
		ID:              uuid.New().String(),
		TenantID:        tenantID,
		Type:            models.AnomalySustainedHigh,
		Severity:        "high",
		Value:           roundFloat(streakCost),
		ExpectedValue:   roundFloat(sumCosts(costs) / float64(len(costs))),
		DetectedAt:      time.Now(),
		TimeWindowStart: time.Now().AddDate(0, 0, -30),
		TimeWindowEnd:   time.Now(),
		Description:     fmt.Sprintf("Sustained high cost: %d consecutive days above $%.2f", end-start, threshold),
		Metadata:        models.JSONB{"streak_days": end - start},
	}
}

func (s *AnomalyService) calculateSeverity(zScore, deviation float64) string {
	if math.Abs(zScore) > 3 || math.Abs(deviation) > 200 {
		return "critical"
	}
	if math.Abs(zScore) > 2.5 || math.Abs(deviation) > 100 {
		return "high"
	}
	if math.Abs(zScore) > 2 || math.Abs(deviation) > 50 {
		return "medium"
	}
	return "low"
}

func sumCosts(costs []float64) float64 {
	var sum float64
	for _, c := range costs {
		sum += c
	}
	return sum
}

func computeStdDev(costs []float64, mean float64) float64 {
	variance := 0.0
	for _, c := range costs {
		variance += (c - mean) * (c - mean)
	}
	return math.Sqrt(variance / float64(len(costs)))
}

func roundFloat(f float64) float64 {
	return float64(int(f*100+0.5)) / 100
}
