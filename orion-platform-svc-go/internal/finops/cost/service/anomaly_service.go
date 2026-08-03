package service

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"

	"orion/platform-svc-go/internal/finops/cost/models"
	"orion/platform-svc-go/internal/finops/cost/repository"

	"github.com/google/uuid"
)

// AnomalyService detects cost anomalies using statistical methods (Z-score + IQR).
type AnomalyService struct {
	repo            *repository.CostRepository
	zScoreThreshold float64
	iqrMultiplier   float64
	spikePctPct     float64 // percentage change threshold for spike classification
}

// NewAnomalyService creates a new anomaly detection service.
func NewAnomalyService(repo *repository.CostRepository) *AnomalyService {
	return &AnomalyService{
		repo:            repo,
		zScoreThreshold: 2.0,
		iqrMultiplier:   1.5,
		spikePctPct:     0.0,
	}
}

// AnomalyOpts holds configurable options for anomaly detection.
type AnomalyOpts struct {
	ZScoreThreshold float64
	IQRMultiplier   float64
	MinDataPoints   int
}

// NewAnomalyServiceWithOpts creates a new anomaly detection service with custom thresholds.
func NewAnomalyServiceWithOpts(repo *repository.CostRepository, opts AnomalyOpts) *AnomalyService {
	s := NewAnomalyService(repo)
	if opts.ZScoreThreshold > 0 {
		s.zScoreThreshold = opts.ZScoreThreshold
	}
	if opts.IQRMultiplier > 0 {
		s.iqrMultiplier = opts.IQRMultiplier
	}
	return s
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
	dailyMap, dateStart, dateEnd := s.groupByDay(costs)

	if len(dailyMap) < 3 {
		return &models.AnomalyDetectionResult{
			Anomalies:          []models.AnomalyAlert{},
			DetectedAt:         time.Now(),
			DataPointsAnalyzed: len(costs),
			TimeWindow:         models.TimeRange{Start: dateStart, End: dateEnd},
		}
	}

	anomalies := s.detectZScoreAnomalies(tenantID, dailyMap, dateStart, dateEnd)
	sustainedAnomalies := s.detectSustainedHigh(tenantID, dailyMap, dateStart, dateEnd)
	anomalies = append(anomalies, sustainedAnomalies...)

	// Store anomalies in database
	for i := range anomalies {
		_ = s.repo.CreateAnomalyAlert(ctx, &anomalies[i])
	}

	return &models.AnomalyDetectionResult{
		Anomalies:          anomalies,
		DataPointsAnalyzed: len(costs),
		DetectedAt:         time.Now(),
		TimeWindow:         models.TimeRange{Start: dateStart, End: dateEnd},
	}
}

// GetAnomalies retrieves anomalies for a tenant.
func (s *AnomalyService) GetAnomalies(ctx context.Context, tenantID, severity string, offset, limit int) ([]models.AnomalyAlert, error) {
	return s.repo.GetAnomalies(ctx, tenantID, severity, offset, limit)
}

// GetRecentAnomalies returns the most recent anomalies.
func (s *AnomalyService) GetRecentAnomalies(ctx context.Context, tenantID string) ([]models.AnomalyAlert, error) {
	return s.repo.GetRecentAnomalies(ctx, tenantID, 20)
}

// groupByDay aggregates cost records by date string (YYYY-MM-DD),
// also returning the earliest and latest dates.
func (s *AnomalyService) groupByDay(costs []models.CostRecord) (map[string]float64, time.Time, time.Time) {
	dailyMap := make(map[string]float64)
	var dateStart, dateEnd time.Time
	first := true
	for _, c := range costs {
		key := c.Date.Format("2006-01-02")
		dailyMap[key] += c.Cost
		if first {
			dateStart = c.Date
			dateEnd = c.Date
			first = false
		} else {
			if c.Date.Before(dateStart) {
				dateStart = c.Date
			}
			if c.Date.After(dateEnd) {
				dateEnd = c.Date
			}
		}
	}
	return dailyMap, dateStart, dateEnd
}

// buildOrderedSeries returns sorted date keys and their corresponding costs.
func buildOrderedSeries(dailyMap map[string]float64) ([]string, []float64) {
	dates := make([]string, 0, len(dailyMap))
	for d := range dailyMap {
		dates = append(dates, d)
	}
	sort.Strings(dates)

	costs := make([]float64, len(dates))
	for i, d := range dates {
		costs[i] = dailyMap[d]
	}
	return dates, costs
}

// detectZScoreAnomalies identifies individual-day anomalies using the Z-score method.
// Positive Z-scores > threshold => spike; Negative Z-scores < -threshold => drop.
func (s *AnomalyService) detectZScoreAnomalies(tenantID string, dailyMap map[string]float64, dateStart, dateEnd time.Time) []models.AnomalyAlert {
	dates, costs := buildOrderedSeries(dailyMap)
	mean := sumFloats(costs) / float64(len(costs))
	stdDev := computeStdDev(costs, mean)

	var anomalies []models.AnomalyAlert
	for i, date := range dates {
		zScore := 0.0
		if stdDev > 0 {
			zScore = (costs[i] - mean) / stdDev
		}

		if math.Abs(zScore) > s.zScoreThreshold {
			var anomalyType models.AnomalyType
			if zScore > 0 {
				anomalyType = models.AnomalySpike
			} else {
				anomalyType = models.AnomalyDrop
			}

			deviation := 0.0
			if mean > 0 {
				deviation = (costs[i] - mean) / mean * 100
			}

			direction := "above"
			if zScore < 0 {
				direction = "below"
			}

			anomalies = append(anomalies, models.AnomalyAlert{
				ID:            uuid.New().String(),
				TenantID:      tenantID,
				Type:          anomalyType,
				Severity:      s.calculateSeverity(zScore, deviation),
				Value:         roundFloat(costs[i]),
				ExpectedValue: roundFloat(mean),
				Deviation:     roundFloat(deviation),
				DetectedAt:    time.Now(),
				TimeWindowStart: dateStart,
				TimeWindowEnd:   dateEnd,
				Description:     fmt.Sprintf("Cost %s expected on %s: $%.2f (expected ~$%.2f, z=%.2f)", direction, date, costs[i], mean, zScore),
				Metadata:        models.JSONB{"z_score": roundFloat(zScore)},
			})
		}
	}

	return anomalies
}

// detectIQRAnomalies identifies anomalies using the Interquartile Range (IQR) method.
// This is a lower-dependency alternative for datasets with heavy outliers.
func detectIQRAnomalies(tenantID string, dailyMap map[string]float64, dateStart, dateEnd time.Time, multiplier float64) []models.AnomalyAlert {
	dates, costs := buildOrderedSeries(dailyMap)
	if len(costs) < 4 {
		return nil
	}

	q1, q3 := computeQuartiles(costs)
	iqr := q3 - q1
	if iqr <= 0 {
		// Degenerate case: all values identical or monotonic with zero spread
		return nil
	}

	lowerBound := q1 - multiplier*iqr
	upperBound := q3 + multiplier*iqr

	var anomalies []models.AnomalyAlert
	for i, date := range dates {
		if costs[i] > upperBound {
			deviation := 0.0
			if q3 > 0 {
				deviation = (costs[i] - q3) / q3 * 100
			}
			anomalies = append(anomalies, models.AnomalyAlert{
				ID:            uuid.New().String(),
				TenantID:      tenantID,
				Type:          models.AnomalySpike,
				Severity:      "high",
				Value:         roundFloat(costs[i]),
				ExpectedValue: roundFloat(q3),
				Deviation:     roundFloat(deviation),
				DetectedAt:    time.Now(),
				TimeWindowStart: dateStart,
				TimeWindowEnd:   dateEnd,
				Description:     fmt.Sprintf("IQR spike on %s: $%.2f exceeds upper bound $%.2f", date, costs[i], upperBound),
				Metadata:        models.JSONB{"iqr_lower": roundFloat(lowerBound), "iqr_upper": roundFloat(upperBound), "q1": roundFloat(q1), "q3": roundFloat(q3)},
			})
		} else if costs[i] < lowerBound {
			deviation := 0.0
			if q1 > 0 {
				deviation = (costs[i] - q1) / q1 * 100
			}
			anomalies = append(anomalies, models.AnomalyAlert{
				ID:            uuid.New().String(),
				TenantID:      tenantID,
				Type:          models.AnomalyDrop,
				Severity:      "high",
				Value:         roundFloat(costs[i]),
				ExpectedValue: roundFloat(q1),
				Deviation:     roundFloat(deviation),
				DetectedAt:    time.Now(),
				TimeWindowStart: dateStart,
				TimeWindowEnd:   dateEnd,
				Description:     fmt.Sprintf("IQR drop on %s: $%.2f below lower bound $%.2f", date, costs[i], lowerBound),
				Metadata:        models.JSONB{"iqr_lower": roundFloat(lowerBound), "iqr_upper": roundFloat(upperBound), "q1": roundFloat(q1), "q3": roundFloat(q3)},
			})
		}
	}
	return anomalies
}

// detectSustainedHigh finds 3+ consecutive days above the mean + 2*stdDev threshold.
func (s *AnomalyService) detectSustainedHigh(tenantID string, dailyMap map[string]float64, dateStart, dateEnd time.Time) []models.AnomalyAlert {
	dates, costs := buildOrderedSeries(dailyMap)
	mean := sumFloats(costs) / float64(len(costs))
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
				anomalies = append(anomalies, s.sustainedHighAlert(tenantID, dates, costs, streakStart, i, threshold, dateStart, dateEnd))
			}
			streakStart = -1
		}
	}

	if streakStart != -1 && len(dates)-streakStart >= 3 {
		anomalies = append(anomalies, s.sustainedHighAlert(tenantID, dates, costs, streakStart, len(dates), threshold, dateStart, dateEnd))
	}

	return anomalies
}

func (s *AnomalyService) sustainedHighAlert(tenantID string, dates []string, costs []float64, start, end int, threshold float64, dateStart, dateEnd time.Time) models.AnomalyAlert {
	var streakCost float64
	for i := start; i < end; i++ {
		streakCost += costs[i]
	}

	return models.AnomalyAlert{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		Type:          models.AnomalySustainedHigh,
		Severity:      "high",
		Value:         roundFloat(streakCost),
		ExpectedValue: roundFloat(sumFloats(costs) / float64(len(costs))),
		DetectedAt:    time.Now(),
		TimeWindowStart: dateStart,
		TimeWindowEnd:   dateEnd,
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

// ==================== Pure helpers (extracted for testability) ====================

func sumFloats(costs []float64) float64 {
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

func computeQuartiles(sorted []float64) (float64, float64) {
	// Values must already be sorted for quartile computation.
	s := make([]float64, len(sorted))
	copy(s, sorted)
	sort.Float64s(s)

	n := len(s)
	q1 := percentile(s, 25)
	q3 := percentile(s, 75)
	return q1, q3
}

func percentile(sorted []float64, p float64) float64 {
	if len(sorted) == 1 {
		return sorted[0]
	}
	idx := (p / 100) * float64(len(sorted)-1)
	lower := int(math.Floor(idx))
	upper := int(math.Ceil(idx))
	if lower == upper {
		return sorted[lower]
	}
	frac := idx - float64(lower)
	return sorted[lower]*(1-frac) + sorted[upper]*frac
}

func roundFloat(f float64) float64 {
	return float64(int(f*100+0.5)) / 100
}
