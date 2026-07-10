package service

import (
	"encoding/json"
	"fmt"
	"orion/diagnostic-svc-go/internal/models"
	"time"

	"github.com/google/uuid"
)

// FixComplexityEstimate is the output of Reporter.EstimateFixComplexity.
type FixComplexityEstimate struct {
	Complexity                 string `json:"complexity"`
	EstimatedFixTimeMs         int64  `json:"estimated_fix_time_ms"`
	ManualInterventionRequired bool   `json:"manual_intervention_required"`
	RiskLevel                  string `json:"risk_level"`
	Description                string `json:"description"`
}

// Reporter produces structured DiagnosticReport from a completed DiagnosticSession.
type Reporter struct{}

// GenerateReport creates a report from the given session.
func (r *Reporter) GenerateReport(session *models.DiagnosticSession) *models.DiagnosticReport {
	timeline := r.formatTimeline(session)
	recommendations := r.generateRecommendations(session)
	estimate := r.estimateFixTime(session)
	summary := r.generateSummary(session)

	findingsJSON := models.JSONText(session.Findings)
	rootCauseRaw := json.RawMessage("null")
	if session.RootCause != nil {
		rc, err := json.Marshal(session.RootCause)
		if err == nil {
			rootCauseRaw = rc
		}
	}
	recommendationsJSON, _ := json.Marshal(recommendations)
	timelineJSON, _ := json.Marshal(timeline)

	return &models.DiagnosticReport{
		ID:                 uuid.New().String(),
		TenantID:           session.TenantID,
		SessionID:          session.ID,
		Summary:            summary,
		Findings:           findingsJSON,
		RootCause:          models.JSONText(rootCauseRaw),
		Recommendations:    models.JSONText(recommendationsJSON),
		Timeline:           models.JSONText(timelineJSON),
		EstimatedFixTimeMs: estimate,
		GeneratedAt:        time.Now(),
	}
}

func (r *Reporter) EstimateFixComplexity(session *models.DiagnosticSession) *FixComplexityEstimate {
	if session.RootCause == nil {
		return &FixComplexityEstimate{
			Complexity:                 "expert",
			EstimatedFixTimeMs:         3600000,
			ManualInterventionRequired: true,
			RiskLevel:                  "high",
			Description:                "Root cause unknown - expert investigation required",
		}
	}
	actions := session.RootCause.RecommendedActions
	totalActions := len(actions)
	manualCount := 0
	criticalCount := 0
	var totalEst int64
	for _, a := range actions {
		if a.AutomationLevel == "manual" {
			manualCount++
		}
		if a.Priority == "critical" {
			criticalCount++
		}
		et := a.EstimatedTimeMs
		if et == 0 {
			et = 300000
		}
		totalEst += et
	}
	score := totalActions*10 + criticalCount*15 + len(session.Symptoms)*5 + (100-session.RootCause.Confidence)/5
	if totalActions > 0 {
		score += manualCount * 30 / totalActions
	}
	var complexity, risk string
	if score < 20 {
		complexity, risk = "trivial", "low"
	} else if score < 40 {
		complexity, risk = "simple", "low"
	} else if score < 60 {
		complexity, risk = "moderate", "medium"
	} else if score < 80 {
		complexity, risk = "complex", "high"
	} else {
		complexity, risk = "expert", "high"
	}
	return &FixComplexityEstimate{
		Complexity:                 complexity,
		EstimatedFixTimeMs:         totalEst,
		ManualInterventionRequired: manualCount > 0 || complexity == "expert",
		RiskLevel:                  risk,
		Description:                r.getComplexityDescription(complexity, totalActions, manualCount),
	}
}

// --- Private ---

func (r *Reporter) formatTimeline(s *models.DiagnosticSession) []models.TimelineEntry {
	symptoms := []models.Symptom{}
	json.Unmarshal([]byte(s.Symptoms), &symptoms)
	findings := []models.Finding{}
	json.Unmarshal([]byte(s.Findings), &findings)

	timeline := make([]models.TimelineEntry, 0, len(symptoms)+len(findings)+1)
	for _, symp := range symptoms {
		timeline = append(timeline, models.TimelineEntry{
			Timestamp:   symp.Timestamp,
			Description: fmt.Sprintf("[%s] %s: %s", toUpper(symp.Severity), symp.Source, symp.Description),
			EventType:   "symptom_detected",
		})
	}
	for _, f := range findings {
		timeline = append(timeline, models.TimelineEntry{
			Timestamp:   s.StartedAt,
			Description: fmt.Sprintf("Finding: %s", f.Description),
			EventType:   "finding_made",
		})
	}
	if s.RootCause != nil {
		ts := s.CompletedAt
		if ts == nil {
			now := time.Now()
			ts = &now
		}
		timeline = append(timeline, models.TimelineEntry{
			Timestamp:   *ts,
			Description: fmt.Sprintf("Root Cause: %s (Confidence: %d%%)", s.RootCause.Description, s.RootCause.Confidence),
			EventType:   "root_cause_identified",
		})
	}
	return timeline
}

func (r *Reporter) generateRecommendations(s *models.DiagnosticSession) []models.RecommendedAction {
	if s.RootCause == nil {
		return []models.RecommendedAction{
			{
				Description:     "Manual investigation required - root cause not automatically identified",
				ActionType:      "investigate",
				Priority:        "high",
				EstimatedTimeMs: 900000,
				AutomationLevel: "manual",
			},
		}
	}
	return s.RootCause.RecommendedActions
}

func (r *Reporter) estimateFixTime(s *models.DiagnosticSession) int64 {
	if s.RootCause == nil || len(s.RootCause.RecommendedActions) == 0 {
		return 3600000 // 1 hour default
	}
	var total int64
	for _, a := range s.RootCause.RecommendedActions {
		et := a.EstimatedTimeMs
		if et == 0 {
			et = 300000
		}
		total += et
	}
	if total == 0 {
		return 3600000
	}
	return total
}

func (r *Reporter) generateSummary(s *models.DiagnosticSession) string {
	symptoms := []models.Symptom{}
	json.Unmarshal([]byte(s.Symptoms), &symptoms)
	findings := []models.Finding{}
	json.Unmarshal([]byte(s.Findings), &findings)

	rcDesc := "Root cause not identified"
	confidence := 0
	if s.RootCause != nil {
		rcDesc = s.RootCause.Description
		confidence = s.RootCause.Confidence
	}
	return fmt.Sprintf(
		"Diagnostic session triggered by %s (%s). Analyzed %d symptom(s) and identified %d finding(s). Root cause: %s. Confidence: %d%%.",
		r.getTriggerDescription(s.TriggerType), s.TriggerID, len(symptoms), len(findings), rcDesc, confidence)
}

func (r *Reporter) getTriggerDescription(triggerType string) string {
	descriptions := map[string]string{
		"incident":             "incident alert",
		"deployment_failure":   "deployment failure",
		"pipeline_failure":     "pipeline failure",
		"health_check_failure": "health check failure",
		"manual":               "manual request",
		"scheduled":            "scheduled check",
	}
	if d, ok := descriptions[triggerType]; ok {
		return d
	}
	return triggerType
}

func (r *Reporter) getComplexityDescription(complexity string, totalActions, manualActions int) string {
	descriptions := map[string]string{
		"trivial":  fmt.Sprintf("Trivial fix - %d action(s), all can be automated", totalActions),
		"simple":   fmt.Sprintf("Simple fix - %d action(s), mostly automated", totalActions),
		"moderate": fmt.Sprintf("Moderate complexity - %d action(s), %d require manual intervention", totalActions, manualActions),
		"complex":  fmt.Sprintf("Complex fix - %d action(s), %d require manual intervention, careful planning needed", totalActions, manualActions),
		"expert":   fmt.Sprintf("Expert level - %d action(s), %d require manual intervention, escalate to senior engineer", totalActions, manualActions),
	}
	return descriptions[complexity]
}

func toUpper(s string) string {
	if s == "" {
		return s
	}
	return fmt.Sprintf("%s%s", string(s[0]), s[1:])
}
