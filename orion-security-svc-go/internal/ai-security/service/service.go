package service

import (
	"context"
	"errors"
	"fmt"
	"orion/security-svc-go/internal/ai-security/models"
	"orion/security-svc-go/internal/ai-security/repository"
	"regexp"
	"strings"
	"time"
)

var (
	ErrPolicyNotFound    = errors.New("policy not found")
	ErrInvalidInput      = errors.New("input is required")
	ErrSecurityViolation = errors.New("security violation detected")
)

type Service struct {
	repo       *repository.Repository
	config     AISecurityConfig
	policies   map[string]*models.SecurityPolicy
}

type AISecurityConfig struct {
	EnableInputSanitization  bool
	MaxInputLength           int
	BlockedPatterns          []string
	EnableSandbox            bool
	EnableOutputValidation   bool
	MaxOutputLength          int
	EnableAuditLog           bool
}

func NewService(repo *repository.Repository) *Service {
	return &Service{
		repo: repo,
		config: AISecurityConfig{
			EnableInputSanitization: true,
			MaxInputLength:         10000,
			BlockedPatterns:        []string{"DROP TABLE", "SELECT.*FROM", "rm -rf", "eval(", "exec(", "__proto__", "constructor.prototype", "document.cookie"},
			EnableSandbox:          true,
			EnableOutputValidation: true,
			MaxOutputLength:        50000,
			EnableAuditLog:         true,
		},
		policies: make(map[string]*models.SecurityPolicy),
	}
}

func (s *Service) initPolicies() {
	s.policies["input-sanitization"] = &models.SecurityPolicy{
		ID:          "input-sanitization",
		Name:        "Input Sanitization",
		Enabled:     s.config.EnableInputSanitization,
		Description: "Sanitize AI input to remove potential malicious content",
		Settings:    models.JSONB{"maxInputLength": s.config.MaxInputLength, "blockedPatternCount": len(s.config.BlockedPatterns)},
	}
	s.policies["execution-sandbox"] = &models.SecurityPolicy{
		ID:          "execution-sandbox",
		Name:        "Execution Sandbox",
		Enabled:     s.config.EnableSandbox,
		Description: "Execute AI-generated code in an isolated sandbox environment",
	}
	s.policies["output-validation"] = &models.SecurityPolicy{
		ID:          "output-validation",
		Name:        "Output Validation",
		Enabled:     s.config.EnableOutputValidation,
		Description: "Validate AI output for sensitive information and code injection",
		Settings:    models.JSONB{"maxOutputLength": s.config.MaxOutputLength},
	}
	s.policies["audit-logging"] = &models.SecurityPolicy{
		ID:          "audit-logging",
		Name:        "Audit Logging",
		Enabled:     s.config.EnableAuditLog,
		Description: "Log all security events for compliance and analysis",
	}
}

func (s *Service) Scan(ctx context.Context, input string, userID string) (*models.ScanResult, error) {
	if input == "" {
		return nil, ErrInvalidInput
	}

	s.initPolicies()

	violations := s.validateInput(input)

	result := &models.ScanResult{
		Input:        input,
		UserID:       userID,
		RiskScore:    s.calculateRiskScore(violations),
		Sanitized:    s.config.EnableInputSanitization,
		HasViolation: len(violations) > 0,
		Violations:   violations,
		ScannedAt:    time.Now(),
	}

	if s.config.EnableAuditLog && s.repo != nil {
		_ = s.repo.LogScan(ctx, result)
	}

	return result, nil
}

func (s *Service) ListScans(ctx context.Context, tenantID string, userID string, startTime, endTime *time.Time, page, pageSize int) ([]models.ScanResult, error) {
	if s.repo == nil {
		return nil, nil
	}
	return s.repo.ListScans(ctx, tenantID, userID, startTime, endTime, page, pageSize)
}

func (s *Service) GetScan(ctx context.Context, tenantID, id string) ([]models.ScanResult, error) {
	if s.repo == nil {
		return nil, nil
	}
	return s.repo.GetScanBySessionID(ctx, tenantID, id)
}

func (s *Service) GetPolicies() ([]*models.SecurityPolicy, error) {
	s.initPolicies()
	var policies []*models.SecurityPolicy
	for _, p := range s.policies {
		policies = append(policies, p)
	}
	return policies, nil
}

func (s *Service) GetPolicy(id string) (*models.SecurityPolicy, error) {
	s.initPolicies()
	if p, ok := s.policies[id]; ok {
		return p, nil
	}
	return nil, ErrPolicyNotFound
}

func (s *Service) UpdatePolicy(id string, enabled *bool) error {
	s.initPolicies()
	validPolicies := map[string]bool{
		"input-sanitization": true,
		"execution-sandbox": true,
		"output-validation": true,
		"audit-logging": true,
	}
	if !validPolicies[id] {
		return ErrPolicyNotFound
	}

	p := s.policies[id]
	if enabled != nil {
		p.Enabled = *enabled
	}

	return nil
}

func (s *Service) DisablePolicy(id string) error {
	return s.UpdatePolicy(id, func() *bool { b := false; return &b }())
}

func (s *Service) GetAlerts(ctx context.Context, tenantID string, userID string, startTime, endTime *time.Time, page, pageSize int) ([]models.SecurityAlert, error) {
	return s.repo.ListAlerts(ctx, tenantID, userID, startTime, endTime, page, pageSize)
}

func (s *Service) GetAlert(ctx context.Context, tenantID, id string) (*models.SecurityAlert, error) {
	return s.repo.GetAlertByID(ctx, tenantID, id)
}

func (s *Service) ListAuditLogs(ctx context.Context, tenantID string, userID string, action string, startTime, endTime *time.Time) ([]models.ScanResult, error) {
	return s.repo.ListAuditLogs(ctx, tenantID, userID, action, startTime, endTime)
}

func (s *Service) GetAuditLogs(ctx context.Context, tenantID string, userID string, startTime, endTime *time.Time, sessionId string) ([]models.ScanResult, error) {
	return s.repo.GetAuditLogsByFilter(ctx, tenantID, userID, startTime, endTime, sessionId)
}

func (s *Service) GetConfig() AISecurityConfig {
	return s.config
}

func (s *Service) validateInput(input string) []string {
	var violations []string
	inputUpper := strings.ToUpper(input)

	// Check length
	if len(input) > s.config.MaxInputLength {
		violations = append(violations, fmt.Sprintf("input exceeds max length (%d > %d)", len(input), s.config.MaxInputLength))
	}

	// Check blocked patterns
	for _, pattern := range s.config.BlockedPatterns {
		regex, err := regexp.Compile("(?i)" + pattern)
		if err != nil {
			continue
		}
		if regex.MatchString(input) {
			violations = append(violations, fmt.Sprintf("blocked pattern detected: %s", pattern))
		}
	}

	// Check for SQL injection patterns
	sqlPatterns := []string{
		"(?i)\\bDROP\\b", "(?i)\\bSELECT\\b.*\\bFROM\\b", "(?i)\\bINSERT\\b.*\\bINTO\\b",
		"(?i)\\bUPDATE\\b.*\\bSET\\b", "(?i)\\bDELETE\\b.*\\bFROM\\b", "(?i)\\bUNION\\b.*\\bSELECT\\b",
		"(?i)\\bEXEC\\b", "(?i)\\bDECLARE\\b", "(?i)\\bEXECUTE\\b",
	}
	for _, pattern := range sqlPatterns {
		regex, err := regexp.Compile(pattern)
		if err != nil {
			continue
		}
		if regex.MatchString(input) {
			violations = append(violations, "potential SQL injection detected")
			break
		}
	}

	// Check for XSS patterns
	xssPatterns := []string{
		"(?i)<script", "(?i)javascript:", "(?i)onerror=", "(?i)onload=",
		"(?i)<iframe", "(?i)<object", "(?i)<embed",
	}
	for _, pattern := range xssPatterns {
		regex, err := regexp.Compile(pattern)
		if err != nil {
			continue
		}
		if regex.MatchString(input) {
			violations = append(violations, "potential XSS detected")
			break
		}
	}

	// Check for command injection
	cmdPatterns := []string{
		"(?i)\\b\\|\\b.*\\b", "(?i)\\b;\\b.*\\b", "(?i)\\b`\\b.*\\b`",
		"(?i)\\$\\(", "(?i)\\b\\>\\b", "(?i)\\b\\|\\|", "(?i)\\b&&",
	}
	for _, pattern := range cmdPatterns {
		regex, err := regexp.Compile(pattern)
		if err != nil {
			continue
		}
		if regex.MatchString(input) {
			violations = append(violations, "potential command injection detected")
			break
		}
	}

	// Check for path traversal
	traversalPatterns := []string{
		"(?i)\\.\\./", "(?i)\\.\\.\\", "(?i)/etc/passwd", "(?i)/etc/shadow",
	}
	for _, pattern := range traversalPatterns {
		regex, err := regexp.Compile(pattern)
		if err != nil {
			continue
		}
		if regex.MatchString(input) {
			violations = append(violations, "path traversal attempt detected")
			break
		}
	}

	// Check for sensitive data patterns (API keys, tokens)
	sensitivePatterns := []string{
		"(?i)api[_-]?key\\s*[=:]\\s*[\\w-]{20,}",
		"(?i)password\\s*[=:]\\s*[\\S]+",
		"(?i)secret\\s*[=:]\\s*[\\S]+",
		"(?i)token\\s*[=:]\\s*[\\w-]{20,}",
	}
	for _, pattern := range sensitivePatterns {
		regex, err := regexp.Compile(pattern)
		if err != nil {
			continue
		}
		if regex.MatchString(input) {
			violations = append(violations, "potential sensitive data detected")
			break
		}
	}

	return violations
}

func (s *Service) calculateRiskScore(violations []string) float64 {
	if len(violations) == 0 {
		return 0.0
	}
	// Higher risk for more violations
	return float64(len(violations)) * 10.0
}

func (s *Service) ListPolicies(ctx context.Context) ([]models.SecurityPolicy, error) {
	policies, err := s.GetPolicies()
	if err != nil {
		return nil, err
	}
	result := make([]models.SecurityPolicy, len(policies))
	for i, p := range policies {
		result[i] = *p
	}
	return result, nil
}
