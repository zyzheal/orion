package service

import (
	"context"
	"fmt"
	"net"
	"regexp"
	"strconv"
	"strings"
	"time"

	"orion/ai-svc-go/internal/prompt-security/models"
	"go.uber.org/zap"
)

type PromptSecurityService struct {
	config *models.PromptSecurityConfig
	logger *zap.Logger
	piiPatterns []*regexp.Regexp
	injectionPatterns []*regexp.Regexp
}

func NewPromptSecurityService(logger *zap.Logger) *PromptSecurityService {
	s := &PromptSecurityService{
		config: &models.PromptSecurityConfig{
			ID:               "default",
			IsEnabled:        true,
			InjectionEnabled: true,
			PiiDetection:     true,
			MaxPromptLength:  10000,
			BlockedPatterns:  "ignore previous,disregard,discard,forget",
		},
		logger: logger,
		piiPatterns: []*regexp.Regexp{
			regexp.MustCompile(`\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b`), // email
			regexp.MustCompile(`\b\d{3}-\d{2}-\d{4}\b`), // SSN
			regexp.MustCompile(`\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b`), // credit card
			regexp.MustCompile(`\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b`), // phone
		},
		injectionPatterns: []*regexp.Regexp{
			regexp.MustCompile(`(?i)(ignore|disregard|discard|forget|override|bypass)\s+(previous|prior|earlier|last|all)`),
			regexp.MustCompile(`(?i)(you\s+are\s+now|act\s+as\s+a?|pretend\s+to\s+be|you\s+are\s+no\s+longer)`),
			regexp.MustCompile(`(?i)(system\s+prompt|developer\s+message|system\s+instruction)`),
			regexp.MustCompile(`(?i)(extract|reveal|show|display|output)\s+(the?\s+(system|prompt|instruction|config))`),
		},
	}
	return s
}

// Scan scans a prompt for security issues.
func (s *PromptSecurityService) Scan(ctx context.Context, tenantID string, req *models.ScanRequest) (*models.ScanResponse, error) {
	start := time.Now()
	findings := []string{}
	score := 0.0

	// Check prompt length
	if len(req.Prompt) > s.config.MaxPromptLength {
		findings = append(findings, fmt.Sprintf("prompt too long: %d/%d chars", len(req.Prompt), s.config.MaxPromptLength))
		score += 0.3
	}

	// Check blocked patterns
	blockedPatterns := strings.Split(s.config.BlockedPatterns, ",")
	for _, pattern := range blockedPatterns {
		if strings.Contains(strings.ToLower(req.Prompt), strings.TrimSpace(strings.ToLower(pattern))) {
			findings = append(findings, fmt.Sprintf("blocked pattern found: %s", pattern))
			score += 0.2
		}
	}

	// Check for injection patterns
	if s.config.InjectionEnabled {
		for _, pattern := range s.injectionPatterns {
			matches := pattern.FindAllString(req.Prompt, -1)
			if len(matches) > 0 {
				findings = append(findings, fmt.Sprintf("injection pattern: %s", matches[0]))
				score += 0.4
			}
		}
	}

	// Check for PII
	if s.config.PiiDetection {
		for _, pattern := range s.piiPatterns {
			matches := pattern.FindAllString(req.Prompt, -1)
			if len(matches) > 0 {
				// Anonymize the match
				anonymized := strings.Repeat("*", len(matches[0]))
				findings = append(findings, fmt.Sprintf("PII detected (anonymized): %s", anonymized))
				score += 0.15
			}
		}
	}

	// Check for IP addresses
	ipPattern := regexp.MustCompile(`\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b`)
	ipMatches := ipPattern.FindAllString(req.Prompt, -1)
	for _, ip := range ipMatches {
		if net.ParseIP(ip) != nil {
			findings = append(findings, fmt.Sprintf("IP address detected: %s", ip))
			score += 0.1
		}
	}

	isSafe := score < 0.5
	scanTime := int(time.Since(start).Milliseconds())

	scan := &models.SecurityScan{
		ID:               fmt.Sprintf("scan_%d", time.Now().UnixNano()),
		TenantID:         tenantID,
		Prompt:           req.Prompt[:min(len(req.Prompt), 200)] + "...",
		Score:            score,
		IsSafe:           isSafe,
		InjectionDetected: strings.Contains(strings.Join(findings, ","), "injection"),
		PiiDetected:     strings.Contains(strings.Join(findings, ","), "PII"),
		Findings:        findings,
		ScanTimeMs:      scanTime,
		ScannedAt:       time.Now(),
	}

	s.logger.Info("prompt scanned",
		zap.String("tenantId", tenantID),
		zap.Float64("score", score),
		zap.Bool("isSafe", isSafe),
		zap.Int("findings", len(findings)),
		zap.Int("scanTimeMs", scanTime),
	)

	return &models.ScanResponse{Scan: scan}, nil
}

// GetConfig returns the current security config.
func (s *PromptSecurityService) GetConfig() *models.ConfigResponse {
	return &models.ConfigResponse{Config: s.config}
}

// UpdateConfig updates the security config.
func (s *PromptSecurityService) UpdateConfig(ctx context.Context, tenantID string, updates map[string]interface{}) *models.PromptSecurityConfig {
	for key, value := range updates {
		switch key {
		case "is_enabled":
			if v, ok := value.(bool); ok {
				s.config.IsEnabled = v
			}
		case "injection_detection":
			if v, ok := value.(bool); ok {
				s.config.InjectionEnabled = v
			}
		case "pii_detection":
			if v, ok := value.(bool); ok {
				s.config.PiiDetection = v
			}
		case "max_prompt_length":
			if v, ok := value.(float64); ok {
				s.config.MaxPromptLength = int(v)
			}
		case "blocked_patterns":
			if v, ok := value.(string); ok {
				s.config.BlockedPatterns = v
			}
		}
	}

	s.logger.Info("prompt security config updated",
		zap.String("tenantId", tenantID),
	)
	return s.config
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
