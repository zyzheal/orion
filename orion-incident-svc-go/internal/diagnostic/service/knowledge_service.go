package service

import (
	"context"
	"encoding/json"
	"orion/incident-svc-go/internal/diagnostic/models"
	"orion/incident-svc-go/internal/diagnostic/repository"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
)

// KBMatch is a knowledge-base match result.
type KBMatch struct {
	Entry          *models.KnowledgeEntry
	Score          int
	MatchedSymptoms []models.Symptom
}

// KnowledgeService manages the diagnostic knowledge base.
type KnowledgeService struct {
	repo     *repository.KnowledgeRepository
	patterns []*models.KnowledgeEntry // in-memory cache
}

// NewKnowledgeService creates a knowledge service backed by a repo.
func NewKnowledgeService(repo *repository.KnowledgeRepository) *KnowledgeService {
	return &KnowledgeService{repo: repo}
}

// CreatePattern adds a new diagnostic pattern.
func (k *KnowledgeService) CreatePattern(ctx context.Context, tenantID string, req *models.CreateKnowledgeRequest) (*models.KnowledgeEntry, error) {
	symptomsJSON, err := jsonMarshalText(req.Symptoms)
	if err != nil {
		return nil, err
	}
	entry := &models.KnowledgeEntry{
		ID:                uuid.New().String(),
		TenantID:          tenantID,
		Name:              req.Name,
		Symptoms:          symptomsJSON,
		RootCause:         req.RootCause,
		Solution:          req.Solution,
		Category:          req.Category,
		Frequency:         0,
		AverageConfidence: 0,
		CreatedAt:         time.Now(),
	}
	if err := k.repo.Create(ctx, entry); err != nil {
		return nil, err
	}
	return entry, nil
}

// GetPattern retrieves a pattern by ID.
func (k *KnowledgeService) GetPattern(ctx context.Context, tenantID, id string) (*models.KnowledgeEntry, error) {
	return k.repo.GetByID(ctx, tenantID, id)
}

// ListPatterns lists patterns with optional filters.
func (k *KnowledgeService) ListPatterns(ctx context.Context, tenantID string, category, keyword string, minFrequency int, offset, limit int) ([]models.KnowledgeEntry, error) {
	return k.repo.List(ctx, tenantID, category, keyword, minFrequency, offset, limit)
}

// SearchKnowledge searches patterns by keyword.
func (k *KnowledgeService) SearchKnowledge(ctx context.Context, tenantID, keyword string) ([]models.KnowledgeEntry, error) {
	return k.repo.SearchByKeyword(ctx, tenantID, keyword)
}

// DeletePattern deletes a pattern.
func (k *KnowledgeService) DeletePattern(ctx context.Context, tenantID, id string) error {
	return k.repo.Delete(ctx, tenantID, id)
}

// MatchSymptoms returns patterns ordered by match score (descending).
func (k *KnowledgeService) MatchSymptoms(symptoms []models.Symptom) []*KBMatch {
	var allPatterns []*models.KnowledgeEntry
	// In production, load from DB; here we use the in-memory patterns cache.
	for _, p := range k.patterns {
		allPatterns = append(allPatterns, p)
	}
	// Fallback: query the repository for tenant="" (not typical).
	// For the Go service, the caller injects seeded patterns via SeedPatterns.
	results := make([]*KBMatch, 0, len(allPatterns))
	for _, pattern := range allPatterns {
		var matchedSymptoms []models.Symptom
		score := 0
		maxPossible := 0
		var symptomPatterns []models.SymptomPattern
		jsonUnmarshalText([]byte(pattern.Symptoms), &symptomPatterns)
		for _, sp := range symptomPatterns {
			maxPossible += 100
			best := 0
			var bestSymptom *models.Symptom
			for i := range symptoms {
				s := &symptoms[i]
				cs := 0
				// type match
				if s.Type == sp.Type {
					cs += 50
				}
				// source pattern (wildcard)
				if sp.SourcePattern != "" {
					if regexpMatchesWildcard(sp.SourcePattern, s.Source) {
						cs += 20
					}
				}
				// keywords
				if len(sp.Keywords) > 0 {
					lower := strings.ToLower(s.Description)
					for _, kw := range sp.Keywords {
						if strings.Contains(lower, strings.ToLower(kw)) {
							cs += 20 / len(sp.Keywords)
						}
					}
				}
				// severity
				if sp.MinSeverity != "" {
					symLevel := severityLevel(s.Severity)
					needLevel := severityLevel(sp.MinSeverity)
					if symLevel >= needLevel {
						cs += 10
					}
				}
				if cs > best {
					best = cs
					bestSymptom = s
				}
			}
			if best > 30 {
				score += best
				if bestSymptom != nil {
					matchedSymptoms = append(matchedSymptoms, *bestSymptom)
				}
			}
		}
		finalScore := 0
		if maxPossible > 0 {
			finalScore = score * 100 / maxPossible
		}
		if finalScore > 0 {
			results = append(results, &KBMatch{
				Entry:          pattern,
				Score:          finalScore,
				MatchedSymptoms: matchedSymptoms,
			})
		}
	}
	// sort descending
	for i := 0; i < len(results); i++ {
		for j := i + 1; j < len(results); j++ {
			if results[j].Score > results[i].Score {
				results[i], results[j] = results[j], results[i]
			}
		}
	}
	return results
}

// SeedPatterns pre-loads built-in diagnostic patterns into the in-memory cache.
func (k *KnowledgeService) SeedPatterns() {
	seeds := []*models.KnowledgeEntry{
		{
			ID:        "seed-crashloop",
			Name:      "Container CrashLoop Pattern",
			RootCause: "Container entering CrashLoopBackOff state, typically caused by application startup error, missing configuration, or failed health probe",
			Solution:  "1. Check container logs for error messages\n2. Verify environment variables and config maps\n3. Check liveness and readiness probe configuration\n4. Fix application error and redeploy",
			Category:  "deployment",
			Symptoms:  models.JSONText("[{\"type\":\"deployment_failure\",\"source_pattern\":\"kubernetes-*\",\"keywords\":[\"CrashLoopBackOff\",\"restarting\",\"crash\"],\"min_severity\":\"error\"}]"),
		},
		{
			ID:        "seed-imagepull",
			Name:      "Image Pull Failure Pattern",
			RootCause: "Container image cannot be pulled from registry, typically due to incorrect image reference, missing pull secret, or registry authentication failure",
			Solution:  "1. Verify image name and tag exist in registry\n2. Check imagePullSecrets configuration\n3. Verify registry credentials are valid\n4. Fix image reference and redeploy",
			Category:  "deployment",
			Symptoms:  models.JSONText("[{\"type\":\"deployment_failure\",\"source_pattern\":\"kubernetes-*\",\"keywords\":[\"ImagePullBackOff\",\"ErrImagePull\",\"image\"],\"min_severity\":\"error\"}]"),
		},
		{
			ID:        "seed-db",
			Name:      "Database Connection Failure Pattern",
			RootCause: "Database connection failure, typically caused by connection pool exhaustion, database server down, network issue, or authentication failure",
			Solution:  "1. Check database server status and connectivity\n2. Review connection pool configuration and usage\n3. Check database logs for errors\n4. Verify network connectivity and firewall rules",
			Category:  "database",
			Symptoms:  models.JSONText("[{\"type\":\"database_error\",\"source_pattern\":\"*-db-*\",\"keywords\":[\"connection\",\"timeout\",\"refused\",\"pool\"],\"min_severity\":\"error\"}]"),
		},
		{
			ID:        "seed-pipeline",
			Name:      "Pipeline Test Failure Pattern",
			RootCause: "Pipeline test stage failure, typically caused by code changes breaking existing tests, test environment issues, or flaky tests",
			Solution:  "1. Review test output and identify failing tests\n2. Check if recent code changes could cause the failure\n3. Verify test environment and dependencies\n4. Fix failing tests and re-run pipeline",
			Category:  "pipeline",
			Symptoms:  models.JSONText("[{\"type\":\"test_failure\",\"source_pattern\":\"pipeline-*\",\"keywords\":[\"test\",\"failed\",\"assertion\",\"error\"],\"min_severity\":\"error\"}]"),
		},
		{
			ID:        "seed-resources",
			Name:      "Resource Exhaustion Pattern",
			RootCause: "System resource exhaustion, typically caused by memory leak, disk space depletion, or CPU overutilization",
			Solution:  "1. Check current resource usage (memory, CPU, disk)\n2. Identify processes consuming excessive resources\n3. For memory: check for leaks, increase limits\n4. For disk: clean up logs, old files, increase volume\n5. For CPU: optimize code, scale horizontally",
			Category:  "infrastructure",
			Symptoms:  models.JSONText("[{\"type\":\"resource_exhaustion\",\"source_pattern\":\"*\",\"keywords\":[\"memory\",\"cpu\",\"disk\",\"oom\",\"resource\"],\"min_severity\":\"warning\"}]"),
		},
	}
	k.patterns = seeds
}

// --- Private helpers ---

func jsonMarshalText(v interface{}) (models.JSONText, error) {
	b, err := json.Marshal(v)
	return models.JSONText(b), err
}

func jsonUnmarshalText(data []byte, v interface{}) error {
	return json.Unmarshal(data, v)
}

func regexpMatchesWildcard(pattern, text string) bool {
	re := regexp.MustCompile("^" + regexp.QuoteMeta(strings.Replace(pattern, "*", ".*", -1)) + "$")
	return re.MatchString(text)
}

func severityLevel(s string) int {
	switch s {
	case "info": return 0
	case "warning": return 1
	case "error": return 2
	case "critical": return 3
	default: return 0
	}
}

func pickBestMatch(matches []*KBMatch) *KBMatch {
	if len(matches) == 0 {
		return nil
	}
	return matches[0]
}
