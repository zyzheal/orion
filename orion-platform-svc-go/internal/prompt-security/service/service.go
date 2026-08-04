package service

import (
	"context"
	"fmt"
	"net"
	"regexp"
	"strings"
	"time"

	"orion/platform-svc-go/internal/prompt-security/models"
	"orion/platform-svc-go/internal/prompt-security/repository"
	"go.uber.org/zap"
)

// PromptSecurityService scans prompts for security issues.
type PromptSecurityService struct {
	repo              repository.RepositoryInterface
	logger            *zap.Logger
	piiPatterns       []*regexp.Regexp
	injectionPatterns []*regexp.Regexp
}

// NewPromptSecurityService creates a service backed by the repository.
func NewPromptSecurityService(repo repository.RepositoryInterface, logger *zap.Logger) *PromptSecurityService {
	return &PromptSecurityService{
		repo:   repo,
		logger: logger,
		piiPatterns: []*regexp.Regexp{
			regexp.MustCompile(`(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b`),    // email
			regexp.MustCompile(`\b\d{3}-\d{2}-\d{4}\b`),                              // SSN
			regexp.MustCompile(`\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b`),         // credit card
			regexp.MustCompile(`\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b`),                   // phone
		},
		injectionPatterns: []*regexp.Regexp{
			regexp.MustCompile(`(?i)(ignore|disregard|discard|forget|override|bypass)\s+(previous|prior|earlier|last|all)`),
			regexp.MustCompile(`(?i)(you\s+are\s+now|act\s+as\s+a?|pretend\s+to\s+be|you\s+are\s+no\s+longer)`),
			regexp.MustCompile(`(?i)(system\s+prompt|developer\s+message|system\s+instruction)`),
			regexp.MustCompile(`(?i)(extract|reveal|show|display|output)\s+(the?\s+(system|prompt|instruction|config))`),
		},
	}
}

// Scan scans a prompt for security issues and persists the result.
func (s *PromptSecurityService) Scan(ctx context.Context, tenantID string, req *models.ScanRequest) (*models.ScanResponse, error) {
	// Resolve config (may create default)
	cfg, err := s.repo.GetConfig(ctx, tenantID)
	if err != nil {
		s.logger.Warn("prompt-security config lookup failed, using defaults", zap.Error(err), zap.String("tenantId", tenantID))
		cfg = s.defaultConfig()
	}

	if !cfg.IsEnabled {
		s.logger.Info("prompt-security disabled for tenant", zap.String("tenantId", tenantID))
		return &models.ScanResponse{Scan: &models.SecurityScan{
			ID:        fmt.Sprintf("scan_%d", time.Now().UnixNano()),
			TenantID:  tenantID,
			IsSafe:    true,
			ScannedAt: time.Now(),
		}}, nil
	}

	start := time.Now()
	findings := []string{}
	score := 0.0

	if len(req.Prompt) > cfg.MaxPromptLength {
		findings = append(findings, fmt.Sprintf("prompt too long: %d/%d chars", len(req.Prompt), cfg.MaxPromptLength))
		score += 0.3
	}

	blockedPatterns := strings.Split(cfg.BlockedPatterns, ",")
	for _, pattern := range blockedPatterns {
		if strings.Contains(strings.ToLower(req.Prompt), strings.TrimSpace(strings.ToLower(pattern))) {
			findings = append(findings, fmt.Sprintf("blocked pattern found: %s", pattern))
			score += 0.2
		}
	}

	if cfg.InjectionEnabled {
		for _, pattern := range s.injectionPatterns {
			matches := pattern.FindAllString(req.Prompt, -1)
			if len(matches) > 0 {
				findings = append(findings, fmt.Sprintf("injection pattern: %s", matches[0]))
				score += 0.4
			}
		}
	}

	if cfg.PiiDetection {
		for _, pattern := range s.piiPatterns {
			matches := pattern.FindAllString(req.Prompt, -1)
			if len(matches) > 0 {
				anonymized := strings.Repeat("*", len(matches[0]))
				findings = append(findings, fmt.Sprintf("PII detected (anonymized): %s", anonymized))
				score += 0.15
			}
		}
	}

	ipPattern := regexp.MustCompile(`\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b`)
	ipMatches := ipPattern.FindAllString(req.Prompt, -1)
	for _, ip := range ipMatches {
		if net.ParseIP(ip) != nil {
			findings = append(findings, fmt.Sprintf("IP address detected: %s", ip))
			score += 0.1
		}
	}

	isSafe := score < 0.5
	scanTimeMs := int(time.Since(start).Milliseconds())

	scan := &models.SecurityScan{
		ID:                fmt.Sprintf("scan_%d", time.Now().UnixNano()),
		TenantID:          tenantID,
		Prompt:            req.Prompt[:min(len(req.Prompt), 200)] + "...",
		Score:             score,
		IsSafe:            isSafe,
		InjectionDetected: strings.Contains(strings.Join(findings, ","), "injection"),
		PiiDetected:       strings.Contains(strings.Join(findings, ","), "PII"),
		Findings:          findings,
		ScanTimeMs:        scanTimeMs,
		ScannedAt:         time.Now(),
	}

	scanRecord := repository.NewScanRecord(scan)
	if err := s.repo.SaveScan(ctx, scanRecord); err != nil {
		s.logger.Warn("failed to persist prompt security scan",
			zap.String("tenantId", tenantID),
			zap.String("scanId", scan.ID),
			zap.Error(err),
		)
	}

	s.logger.Info("prompt scanned",
		zap.String("tenantId", tenantID),
		zap.Float64("score", score),
		zap.Bool("isSafe", isSafe),
		zap.Int("findings", len(findings)),
		zap.Int("scanTimeMs", scanTimeMs),
	)

	return &models.ScanResponse{Scan: scan}, nil
}

// GetConfig returns the current security config for a tenant.
func (s *PromptSecurityService) GetConfig(ctx context.Context, tenantID string) (*models.ConfigResponse, error) {
	cfg, err := s.repo.GetConfig(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return &models.ConfigResponse{Config: cfg}, nil
}

// UpdateConfig updates the security config and persists it.
func (s *PromptSecurityService) UpdateConfig(ctx context.Context, tenantID string, updates map[string]interface{}) (*models.PromptSecurityConfig, error) {
	cfg, err := s.repo.UpdateConfig(ctx, tenantID, updates)
	if err != nil {
		return nil, err
	}
	s.logger.Info("prompt security config updated", zap.String("tenantId", tenantID))
	return cfg, nil
}

// ScanHistory returns the scan history for a tenant with pagination.
func (s *PromptSecurityService) ScanHistory(ctx context.Context, tenantID string, page, limit int) ([]repository.SecurityScanRecord, int, error) {
	scans, err := s.repo.ListScans(ctx, tenantID, page, limit)
	if err != nil {
		return nil, 0, err
	}
	count, _ := s.repo.ScanCount(ctx, tenantID)
	return scans, count, nil
}

// defaultConfig returns a fallback when DB lookup fails.
func (s *PromptSecurityService) defaultConfig() *models.PromptSecurityConfig {
	return &models.PromptSecurityConfig{
		IsEnabled:        true,
		InjectionEnabled: true,
		PiiDetection:     true,
		MaxPromptLength:  10000,
		BlockedPatterns:  "ignore previous,disregard,discard,forget",
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
