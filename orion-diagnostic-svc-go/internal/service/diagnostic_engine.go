package service

import (
	"encoding/json"
	"fmt"
	"orion/diagnostic-svc-go/internal/models"
	"strings"

	"github.com/google/uuid"
)

// Engine is the core diagnostic reasoning engine. It clusters symptoms, runs the
// decision tree, and synthesizes a root-cause hypothesis.
type Engine struct {
	tree  *DecisionTree
	kb    *KnowledgeService
}

// EngineConfig holds optional overrides for the engine.
type EngineConfig struct {
	DecisionTree *DecisionTree
	KnowledgeSvc *KnowledgeService
}

// NewEngine returns an engine backed by a default decision tree and a given
// knowledge service.
func NewEngine(kb *KnowledgeService) *Engine {
	return &Engine{
		tree:  CreateDefaultDecisionTree(),
		kb:    kb,
	}
}

// Diagnose runs the full diagnostic pipeline for a set of symptoms and returns
// the resulting findings and root-cause hypothesis.
func (e *Engine) Diagnose(symptoms []models.Symptom) (findings []models.Finding, rootCause *models.RootCause, confidence int) {
	clusters := e.clusterSymptoms(symptoms)
	findings = e.generateFindings(clusters, symptoms)

	treeResult := e.tree.Evaluate(symptoms)

	// Try knowledge-base match
	matches := e.kb.MatchSymptoms(symptoms)

	rootCause, confidence = e.synthesizeRootCause(treeResult, matches, symptoms)
	return findings, rootCause, confidence
}

// RunStep executes a single diagnostic step on a session's symptoms.
func (e *Engine) RunStep(symptoms []models.Symptom, stepType string) (result json.RawMessage, err error) {
	switch stepType {
	case "correlate":
		clusters := e.clusterSymptoms(symptoms)
		return json.Marshal(map[string]interface{}{
			"clusters": clusters,
		})
	case "identify":
		treeResult := e.tree.Evaluate(symptoms)
		matches := e.kb.MatchSymptoms(symptoms)
		rc, conf := e.synthesizeRootCause(treeResult, matches, symptoms)
		return json.Marshal(map[string]interface{}{
			"root_cause": rc,
			"confidence": conf,
			"tree_path":  treeResult.Path,
		})
	case "report":
		return nil, nil // report is handled by Reporter.GenerateReport
	}
	return nil, nil
}

// --- Private helpers ---

type symptomCluster struct {
	ID             string
	Symptoms       []models.Symptom
	CommonCategory string
	MaxSeverity    string
}

var severityOrder = map[string]int{
	"info": 0, "warning": 1, "error": 2, "critical": 3,
}

var reverseSeverity = map[int]string{
	0: "info", 1: "warning", 2: "error", 3: "critical",
}

func (e *Engine) clusterSymptoms(symptoms []models.Symptom) []symptomCluster {
	sourceGroups := make(map[string][]models.Symptom)
	for _, s := range symptoms {
		prefix := s.Source
		if dash := strings.Index(s.Source, "-"); dash > 0 {
			prefix = s.Source[:dash]
		}
		sourceGroups[prefix] = append(sourceGroups[prefix], s)
	}

	clusters := make([]symptomCluster, 0, len(sourceGroups))
	for prefix, group := range sourceGroups {
		maxLevel := 0
		for _, s := range group {
			if lvl := severityOrder[s.Severity]; lvl > maxLevel {
				maxLevel = lvl
			}
		}
		// infer common category by majority
		catCounts := make(map[string]int)
		for _, s := range group {
			catCounts[inferCategory(s)]++
		}
		bestCat, bestN := "infrastructure", 0
		for cat, n := range catCounts {
			if n > bestN {
				bestCat, bestN = cat, n
			}
		}
		clusters = append(clusters, symptomCluster{
			ID:             uuid.New().String(),
			Symptoms:       group,
			CommonCategory: bestCat,
			MaxSeverity:    reverseSeverity[maxLevel],
		})
	}
	return clusters
}

func (e *Engine) generateFindings(clusters []symptomCluster, symptoms []models.Symptom) []models.Finding {
	findings := make([]models.Finding, 0, len(clusters)+1)
	for _, c := range clusters {
		evidence := make([]string, len(c.Symptoms))
		related := make([]string, len(c.Symptoms))
		for i, s := range c.Symptoms {
			evidence[i] = s.Description
			related[i] = s.Type
		}
		src := "unknown"
		if len(c.Symptoms) > 0 {
			src = c.Symptoms[0].Source
		}
		findings = append(findings, models.Finding{
			Description:     fmt.Sprintf("Detected %d related symptom(s) from source \"%s\" with %s severity in %s category", len(c.Symptoms), src, c.MaxSeverity, c.CommonCategory),
			Category:        c.CommonCategory,
			Evidence:        evidence,
			Severity:        c.MaxSeverity,
			RelatedSymptoms: related,
		})
	}
	// cross-cluster systemic finding
	if len(clusters) > 1 {
		affected := make([]string, len(clusters))
		for i, c := range clusters {
			prefix := c.Symptoms[0].Source
			if dash := strings.Index(prefix, "-"); dash > 0 {
				prefix = prefix[:dash]
			}
			affected[i] = prefix
		}
		evidence := make([]string, len(symptoms))
		related := make([]string, len(symptoms))
		for i, s := range symptoms {
			evidence[i] = s.Description
			related[i] = s.Type
		}
		findings = append(findings, models.Finding{
			Description:     fmt.Sprintf("Multiple components affected: %s. This suggests a systemic issue rather than an isolated component failure.", joinStrings(affected, ", ")),
			Category:        "infrastructure",
			Evidence:        evidence,
			Severity:        "critical",
			RelatedSymptoms: related,
		})
	}
	return findings
}

func (e *Engine) synthesizeRootCause(treeResult *TreeResult, kbMatches []*KBMatch, symptoms []models.Symptom) (*models.RootCause, int) {
	best := pickBestMatch(kbMatches)

	if best != nil && best.Score >= 60 {
		entries := make([]string, 0, 3+len(best.MatchedSymptoms))
		entries = append(entries,
			fmt.Sprintf("Pattern \"%s\" matched with %d%% confidence", best.Entry.Name, best.Score),
			fmt.Sprintf("Pattern has been seen %d times previously", best.Entry.Frequency),
		)
		for _, ms := range best.MatchedSymptoms {
			entries = append(entries, fmt.Sprintf("Symptom: %s", ms.Description))
		}
		rc := &models.RootCause{
			Description: best.Entry.RootCause,
			Category:    best.Entry.Category,
			Confidence:  minInt(95, best.Entry.AverageConfidence+best.Score/3),
			Evidence:    entries,
			RecommendedActions: []models.RecommendedAction{
				{
					Description:     best.Entry.Solution,
					ActionType:      "fix",
					Priority:        condPriority(best.Score, 80, "critical", "high"),
					EstimatedTimeMs: 300000,
					AutomationLevel: "semi_auto",
				},
			},
		}
		if treeResult.RootCause != nil {
			rc.Evidence = append(rc.Evidence, fmt.Sprintf("Decision tree also suggests: %s", treeResult.RootCause.Description))
			rc.Confidence = (rc.Confidence + treeResult.RootCause.Confidence) / 2
		}
		return rc, rc.Confidence
	}

	if treeResult.RootCause != nil {
		return treeResult.RootCause, treeResult.RootCause.Confidence
	}

	// fallback
	evidence := make([]string, len(symptoms))
	for i, s := range symptoms {
		evidence[i] = fmt.Sprintf("Symptom: %s", s.Description)
	}
	return &models.RootCause{
		Description: "Unable to determine root cause from available symptoms",
		Category:    "unknown",
		Confidence:  0,
		Evidence:    evidence,
		RecommendedActions: []models.RecommendedAction{
			{
				Description:     "Manual investigation required - escalate to on-call engineer",
				ActionType:      "notify",
				Priority:        "high",
				EstimatedTimeMs: 900000,
				AutomationLevel: "manual",
			},
		},
	}, 0
}

func inferCategory(s models.Symptom) string {
	lower := strings.ToLower(s.Type + " " + s.Source + " " + s.Description)
	if strings.Contains(lower, "database") || strings.Contains(lower, "query") || strings.Contains(lower, " db") || strings.Contains(lower, "db") {
		return "database"
	}
	if strings.Contains(lower, "network") || strings.Contains(lower, "connection") {
		return "network"
	}
	if strings.Contains(lower, "deploy") || strings.Contains(lower, "container") || strings.Contains(lower, "image") {
		return "deployment"
	}
	if strings.Contains(lower, "pipeline") || strings.Contains(lower, "stage") || strings.Contains(lower, "task") {
		return "pipeline"
	}
	if strings.Contains(lower, "security") || strings.Contains(lower, "auth") || strings.Contains(lower, "permission") {
		return "security"
	}
	if strings.Contains(lower, "performance") || strings.Contains(lower, "slow") || strings.Contains(lower, "latency") {
		return "performance"
	}
	if strings.Contains(lower, "config") {
		return "configuration"
	}
	return "infrastructure"
}

func condPriority(score, threshold int, hi, lo string) string {
	if score >= threshold {
		return hi
	}
	return lo
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func joinStrings(s []string, sep string) string {
	out := ""
	for i, v := range s {
		if i > 0 {
			out += sep
		}
		out += v
	}
	return out
}
