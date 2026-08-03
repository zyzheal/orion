package service

import (
	"testing"
	"time"

	"orion/platform-svc-go/internal/finops/cost/models"
)

// buildDailyMap converts a slice of (date, cost) pairs into sorted daily maps
// and returns (dates, dailyMap) for direct unit testing of pure functions.
func buildDailyInput(dateStrings []string, costs []float64) (map[string]float64, time.Time, time.Time) {
	dailyMap := make(map[string]float64, len(dateStrings))
	for i, d := range dateStrings {
		dailyMap[d] = costs[i]
	}
	// Parse first and last dates for window bounds.
	t0, _ := time.Parse("2006-01-02", dateStrings[0])
	t1, _ := time.Parse("2006-01-02", dateStrings[len(dateStrings)-1])
	return dailyMap, t0, t1
}

// ---- Tests for detectZScoreAnomalies ----

func TestDetectZScoreAnomalies_NoAnomaly(t *testing.T) {
	// Steady data: all values close to mean, stdDev should be small relative to spread.
	dates := []string{"2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05",
		"2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09", "2026-01-10"}
	costs := []float64{100, 102, 98, 101, 99, 103, 97, 100, 101, 99} // mean≈100, stdDev≈2
	dailyMap, t0, t1 := buildDailyInput(dates, costs)

	svc := NewAnomalyService(nil)
	svc.zScoreThreshold = 2.0

	anomalies := svc.detectZScoreAnomalies("t1", dailyMap, t0, t1)
	if len(anomalies) != 0 {
		t.Fatalf("expected 0 anomalies for steady data, got %d: %v", len(anomalies), anomalies)
	}
}

func TestDetectZScoreAnomalies_Spike(t *testing.T) {
	dates := []string{"2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05",
		"2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09", "2026-01-10"}
	costs := []float64{100, 102, 98, 101, 99, 103, 97, 100, 101, 500} // spike on day 10
	dailyMap, t0, t1 := buildDailyInput(dates, costs)

	svc := NewAnomalyService(nil)
	svc.zScoreThreshold = 2.0

	anomalies := svc.detectZScoreAnomalies("t1", dailyMap, t0, t1)
	if len(anomalies) == 0 {
		t.Fatal("expected at least 1 spike anomaly, got 0")
	}

	foundSpike := false
	for _, a := range anomalies {
		if a.Type == models.AnomalySpike && a.Value == 500 {
			foundSpike = true
			if a.Severity != "critical" {
				t.Errorf("expected critical severity for spike, got %s", a.Severity)
			}
			break
		}
	}
	if !foundSpike {
		var types []string
		for _, a := range anomalies {
			types = append(types, string(a.Type))
		}
		t.Fatalf("expected spike with value 500, got types: %v", types)
	}
}

func TestDetectZScoreAnomalies_Drop(t *testing.T) {
	dates := []string{"2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05",
		"2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09", "2026-01-10"}
	costs := []float64{100, 102, 98, 101, 99, 103, 97, 100, 101, 5} // drop on day 10
	dailyMap, t0, t1 := buildDailyInput(dates, costs)

	svc := NewAnomalyService(nil)
	svc.zScoreThreshold = 2.0

	anomalies := svc.detectZScoreAnomalies("t1", dailyMap, t0, t1)
	if len(anomalies) == 0 {
		t.Fatal("expected at least 1 drop anomaly, got 0")
	}

	foundDrop := false
	for _, a := range anomalies {
		if a.Type == models.AnomalyDrop && a.Value == 5 {
			foundDrop = true
			break
		}
	}
	if !foundDrop {
		var types []string
		for _, a := range anomalies {
			types = append(types, string(a.Type))
		}
		t.Fatalf("expected drop with value 5, got types: %v", types)
	}
}

// ---- Tests for detectIQRAnomalies ----

func TestDetectIQRAnomalies_Spike(t *testing.T) {
	dates := []string{"2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"}
	costs := []float64{100, 102, 98, 101, 500} // day 5 is spike
	dailyMap, t0, t1 := buildDailyInput(dates, costs)

	anomalies := detectIQRAnomalies("t1", dailyMap, t0, t1, 1.5)
	if len(anomalies) == 0 {
		t.Fatal("expected IQR spike anomaly, got 0")
	}
	for _, a := range anomalies {
		if a.Type == models.AnomalySpike && a.Value == 500 {
			return
		}
	}
	t.Fatalf("expected spike with value 500, got anomalies: %v", anomalies)
}

func TestDetectIQRAnomalies_Drop(t *testing.T) {
	dates := []string{"2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"}
	costs := []float64{100, 102, 98, 101, 1} // day 5 is drop
	dailyMap, t0, t1 := buildDailyInput(dates, costs)

	anomalies := detectIQRAnomalies("t1", dailyMap, t0, t1, 1.5)
	if len(anomalies) == 0 {
		t.Fatal("expected IQR drop anomaly, got 0")
	}
	for _, a := range anomalies {
		if a.Type == models.AnomalyDrop && a.Value == 1 {
			return
		}
	}
	t.Fatalf("expected drop with value 1, got anomalies: %v", anomalies)
}

// ---- Tests for helper functions ----

func TestSumFloats(t *testing.T) {
	cases := []struct {
		name string
		input []float64
		expected float64
	}{
		{"normal", []float64{1, 2, 3, 4, 5}, 15},
		{"empty", []float64{}, 0},
		{"single", []float64{42}, 42},
		{"negative", []float64{-5, 5, -3, 3}, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := sumFloats(tc.input)
			if got != tc.expected {
				t.Errorf("expected %v, got %v", tc.expected, got)
			}
		})
	}
}

func TestComputeStdDev(t *testing.T) {
	// [1,1,1,1] => mean=1, stdDev=0
	variance := computeStdDev([]float64{1, 1, 1, 1}, 1)
	if variance != 0 {
		t.Errorf("expected 0 stdDev for identical values, got %v", variance)
	}

	// [2,4,4,4,5,5,7,9] => mean=5, pop stdDev = sqrt(4) = 2
	variance2 := computeStdDev([]float64{2, 4, 4, 4, 5, 5, 7, 9}, 5)
	if variance2 != 2 {
		t.Errorf("expected 2 stdDev, got %v", variance2)
	}
}

func TestComputeQuartiles(t *testing.T) {
	q1, q3 := computeQuartiles([]float64{1, 2, 3, 4, 5, 6, 7, 8, 9})
	if q1 != 2.75 {
		t.Errorf("expected q1=2.75, got %v", q1)
	}
	if q3 != 7.25 {
		t.Errorf("expected q3=7.25, got %v", q3)
	}
}

func TestRoundFloat(t *testing.T) {
	cases := []struct {
		input    float64
		expected float64
	}{
		{123.456, 123.46},
		{123.454, 123.45},
		{0.1, 0.1},
	}
	for _, tc := range cases {
		got := roundFloat(tc.input)
		if got != tc.expected {
			t.Errorf("roundFloat(%v) = %v, want %v", tc.input, got, tc.expected)
		}
	}
}

// ---- Tests for calculateSeverity ----

func TestCalculateSeverity(t *testing.T) {
	svc := NewAnomalyService(nil)

	cases := []struct {
		name      string
		zScore    float64
		deviation float64
		expected  string
	}{
		{"critical_zscore", 3.5, 0, "critical"},
		{"critical_deviation", 2.1, 210, "critical"},
		{"high_zscore", 2.7, 0, "high"},
		{"high_deviation", 2.1, 110, "high"},
		{"medium_zscore", 2.1, 0, "medium"},
		{"medium_deviation", 1.5, 60, "medium"},
		{"low", 1.5, 30, "low"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := svc.calculateSeverity(tc.zScore, tc.deviation)
			if got != tc.expected {
				t.Errorf("expected %s, got %s", tc.expected, got)
			}
		})
	}
}

// ---- Tests for sustained high detection ----

func TestDetectSustainedHigh(t *testing.T) {
	dates := []string{"2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05",
		"2026-01-06", "2026-01-07", "2026-01-08"}
	costs := []float64{100, 200, 210, 220, 230, 240, 100, 100} // 5 consecutive days above threshold
	dailyMap, t0, t1 := buildDailyInput(dates, costs)

	svc := NewAnomalyService(nil)
	svc.zScoreThreshold = 2.0

	anomalies := svc.detectSustainedHigh("t1", dailyMap, t0, t1)
	if len(anomalies) == 0 {
		t.Fatal("expected sustained high anomaly, got 0")
	}
	for _, a := range anomalies {
		if a.Type != models.AnomalySustainedHigh {
			t.Errorf("expected AnomalySustainedHigh, got %v", a.Type)
		}
	}
}

// ---- Tests for NewAnomalyServiceWithOpts ----

func TestNewAnomalyServiceWithOpts(t *testing.T) {
	svc := NewAnomalyServiceWithOpts(nil, AnomalyOpts{
		ZScoreThreshold: 3.0,
		IQRMultiplier:   2.0,
	})
	if svc.zScoreThreshold != 3.0 {
		t.Errorf("expected zScoreThreshold=3.0, got %v", svc.zScoreThreshold)
	}
	if svc.iqrMultiplier != 2.0 {
		t.Errorf("expected iqrMultiplier=2.0, got %v", svc.iqrMultiplier)
	}
}
