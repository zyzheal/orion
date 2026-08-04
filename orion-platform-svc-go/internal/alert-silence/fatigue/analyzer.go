package fatigue

import (
	"sync"
	"time"
)

// FatigueInfo holds per-rule fatigue metrics.
type FatigueInfo struct {
	RuleName       string  `json:"rule_name"`
	TotalAlerts    int     `json:"total_alerts"`
	AvgInterval    float64 `json:"avg_interval_seconds"`
	SilenceRatio   float64 `json:"silence_ratio"`
	Score          float64 `json:"score"`
	Recommendation string  `json:"recommendation"`
}

// AlertRecord represents a single fired alert in the sliding window.
type AlertRecord struct {
	Ts        time.Time
	Severity  string
	Silenced  bool
}

// Analyzer tracks alert frequency per rule (tenant-scoped, sliding window).
type Analyzer struct {
	mu       sync.RWMutex
	// key format: "tenantID|ruleName"
	alerts      map[string][]AlertRecord
	window      time.Duration
	fatigueTh   float64 // threshold above which auto-silence is recommended
}

func NewAnalyzer(window time.Duration, fatigueTh float64) *Analyzer {
	return &Analyzer{
		alerts:      make(map[string][]AlertRecord),
		window:      window,
		fatigueTh:   fatigueTh,
	}
}

// RecordAlert records a fired alert for the given rule and tenant.
func (a *Analyzer) RecordAlert(tenantID, ruleName, severity string) {
	if tenantID == "" || ruleName == "" {
		return
	}
	key := tenantID + "|" + ruleName
	a.mu.Lock()
	defer a.mu.Unlock()
	a.alerts[key] = append(a.alerts[key], AlertRecord{
		Ts:       time.Now(),
		Severity: severity,
		Silenced: false,
	})
	a.prune(key, time.Now())
}

// RecordSilencedAlert records an alert that was silenced.
func (a *Analyzer) RecordSilencedAlert(tenantID, ruleName, severity string) {
	if tenantID == "" || ruleName == "" {
		return
	}
	key := tenantID + "|" + ruleName
	a.mu.Lock()
	defer a.mu.Unlock()
	a.alerts[key] = append(a.alerts[key], AlertRecord{
		Ts:       time.Now(),
		Severity: severity,
		Silenced: true,
	})
	a.prune(key, time.Now())
}

// GetFatigueScore returns per-rule fatigue metrics for the tenant.
func (a *Analyzer) GetFatigueScore(tenantID string) map[string]FatigueInfo {
	now := time.Now()
	a.mu.Lock()
	defer a.mu.Unlock()

	result := make(map[string]FatigueInfo)
	for key, records := range a.alerts {
		if key[:len(tenantID)] != tenantID {
			continue
		}
		ruleName := key[len(tenantID)+1:] // strip tenantID|
		a.prune(key, now)
		records = a.alerts[key]
		if len(records) == 0 {
			continue
		}
		info := computeFatigue(ruleName, records, a.fatigueTh)
		result[ruleName] = info
	}
	return result
}

// GetRuleFatigue returns fatigue info for a single rule.
func (a *Analyzer) GetRuleFatigue(tenantID, ruleName string) (*FatigueInfo, bool) {
	now := time.Now()
	key := tenantID + "|" + ruleName
	a.mu.Lock()
	defer a.mu.Unlock()
	records, ok := a.alerts[key]
	if !ok {
		return nil, false
	}
	a.prune(key, now)
	records = a.alerts[key]
	if len(records) == 0 {
		return nil, false
	}
	info := computeFatigue(ruleName, records, a.fatigueTh)
	return &info, true
}

// AutoSilenceRecommendations returns rule names that should be added to the silence list.
func (a *Analyzer) AutoSilenceRecommendations(tenantID string) []string {
	scoreMap := a.GetFatigueScore(tenantID)
	var names []string
	for name, info := range scoreMap {
		if info.Score >= a.fatigueTh {
			names = append(names, name)
		}
	}
	return names
}

// ---- Internals ----

func (a *Analyzer) prune(key string, now time.Time) {
	records := a.alerts[key]
	cutoff := now.Add(-a.window)
	var kept []AlertRecord
	for _, r := range records {
		if !r.Ts.Before(cutoff) {
			kept = append(kept, r)
		}
	}
	a.alerts[key] = kept
}

func computeFatigue(ruleName string, records []AlertRecord, threshold float64) FatigueInfo {
	total := len(records)
	silenced := 0
	for _, r := range records {
		if r.Silenced {
			silenced++
		}
	}
	silenceRatio := 0.0
	if total > 0 {
		silenceRatio = float64(silenced) / float64(total)
	}

	var avgInterval float64
	if total >= 2 {
		var totalDur float64
		for i := 1; i < len(records); i++ {
			totalDur += records[i].Ts.Sub(records[i-1].Ts).Seconds()
		}
		avgInterval = totalDur / float64(len(records)-1)
	}

	// Score computation:
	//   frequency component: min(total/10, 20) -- rewards lower alert volume, capped
	//   interval component: if avgInterval < 30s -> +20, 30-60s -> +15, 60-120s -> +10, >120s -> +5
	//   silence component: (1 - silenceRatio) * 20 -- less silenced -> more fatiguing
	//   severity boost: critical +10, high +5
	frequency := float64(total) / 10
	if frequency > 20 {
		frequency = 20
	}

	intervalScore := 5.0
	if avgInterval > 0 {
		switch {
		case avgInterval < 30:
			intervalScore = 20
		case avgInterval < 60:
			intervalScore = 15
		case avgInterval < 120:
			intervalScore = 10
		}
	}

	silenceComponent := (1 - silenceRatio) * 20

	severityBoost := 0.0
	for _, r := range records {
		switch r.Severity {
		case "critical":
			severityBoost += 2.0
		case "high":
			severityBoost += 1.0
		}
	}
	// Cap severity boost.
	if severityBoost > 10 {
		severityBoost = 10
	}

	score := frequency + intervalScore + silenceComponent + severityBoost

	recommendation := "ok"
	if score >= threshold {
		recommendation = "add to silence list"
	} else if score >= threshold*0.7 {
		recommendation = "consider merging or silencing"
	} else if total > 5 {
		recommendation = "monitor"
	}

	return FatigueInfo{
		RuleName:       ruleName,
		TotalAlerts:    total,
		AvgInterval:    avgInterval,
		SilenceRatio:   silenceRatio,
		Score:          score,
		Recommendation: recommendation,
	}
}
