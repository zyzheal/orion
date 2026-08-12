package service

import (
	"regexp"
	"sync"
	"time"

	"orion/platform-svc-go/internal/knowledge/models"
)

// SafetyFilter provides content safety filtering for RAG queries and feedback.
// It checks for PII, injection attempts, and disallowed content patterns.
type SafetyFilter struct {
	mu          sync.RWMutex
	sensitiveRx []*regexp.Regexp
	injectionRx []*regexp.Regexp
}

// NewSafetyFilter creates a SafetyFilter with default patterns.
func NewSafetyFilter() *SafetyFilter {
	return &SafetyFilter{
		sensitiveRx: compilePatterns([]string{
			`\b\d{3}-\d{2,4}-\d{4}\b`,             // SSN-like
			`\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b`, // credit card-like
			`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b`, // email
			`\b(?:\d{1,3}\.){3}\d{1,3}\b`,          // IP address
		}),
		injectionRx: compilePatterns([]string{
			`(?i)\bignore\s+(all\s+)?previous\s+instructions\b`,
			`(?i)\bdisregard\s+(all\s+)?(prior|above)\b`,
			`(?i)\byou\s+are\s+(now\s+)?(a\s+)?(free|released|unconstrained)\b`,
			`(?i)\bforget\s+(all\s+)?(previous\s+)?(instructions|context|rules)\b`,
			`(?i)\bjust\s+say\s+.*(yes|ok|true)\b`,
			`(?i)\boutput\s+the\s+(above|previous|first)\s+(prompt|instruction|text|message)\b`,
			`(?i)\bprint\s+your\s+(system\s+)?prompt\b`,
			`(?i)\breturn\s+the\s+(above|initial|first)\s+(prompt|instruction|text|message)\b`,
			`(?i)\breveal\s+(your\s+)?(system\s+)?(prompt|instructions|rules)\b`,
			`(?i)\b这个\s*话题\s*不\s*受\s*限制\b`,
			`(?i)\b你\s*现在\s*是\s*一个\s*自由\s*的\s*(AI|助手|机器人)\b`,
			`(?i)\b忽略\s*所有\s*(之前|以上|前面)\s*的\s*(指令|规则|限制|提示)\b`,
		}),
	}
}

func compilePatterns(patterns []string) []*regexp.Regexp {
	rx := make([]*regexp.Regexp, 0, len(patterns))
	for _, p := range patterns {
		if re, err := regexp.Compile(p); err == nil {
			rx = append(rx, re)
		}
	}
	return rx
}

// CheckQuery checks a user query for safety concerns.
func (s *SafetyFilter) CheckQuery(query string) models.SafetyFilterResult {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Check PII in query
	for _, rx := range s.sensitiveRx {
		if rx.MatchString(query) {
			return models.SafetyFilterResult{
				IsSafe:  false,
				Reason:  "查询包含潜在敏感信息（PII）",
				Flagged: true,
			}
		}
	}

	// Check injection attempts
	for _, rx := range s.injectionRx {
		if rx.MatchString(query) {
			return models.SafetyFilterResult{
				IsSafe:  false,
				Reason:  "检测到潜在的 Prompt Injection 尝试",
				Flagged: true,
			}
		}
	}

	return models.SafetyFilterResult{IsSafe: true, Flagged: false}
}

// CheckFeedback validates user-submitted corrections for safety.
func (s *SafetyFilter) CheckFeedback(correction string) models.SafetyFilterResult {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Check PII
	for _, rx := range s.sensitiveRx {
		if rx.MatchString(correction) {
			return models.SafetyFilterResult{
				IsSafe:  false,
				Reason:  "纠正内容包含潜在敏感信息（PII）",
				Flagged: true,
			}
		}
	}

	// Check injection in correction
	for _, rx := range s.injectionRx {
		if rx.MatchString(correction) {
			return models.SafetyFilterResult{
				IsSafe:  false,
				Reason:  "纠正内容包含潜在恶意内容",
				Flagged: true,
			}
		}
	}

	// Length check: unreasonable corrections
	if len(correction) > 10000 {
		return models.SafetyFilterResult{
			IsSafe:  false,
			Reason:  "纠正内容过长（超过 10000 字符）",
			Flagged: true,
		}
	}

	return models.SafetyFilterResult{IsSafe: true, Flagged: false}
}

// Sanitize removes PII from a text string for safe storage/display.
func (s *SafetyFilter) Sanitize(text string) string {
	// Replace email addresses
	emailRx := regexp.MustCompile(`[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`)
	text = emailRx.ReplaceAllString(text, "[EMAIL]")

	// Replace SSN-like patterns
	ssnRx := regexp.MustCompile(`\b\d{3}-\d{2,4}-\d{4}\b`)
	text = ssnRx.ReplaceAllString(text, "[REDACTED]")

	// Replace IP addresses
	ipRx := regexp.MustCompile(`\b(?:\d{1,3}\.){3}\d{1,3}\b`)
	text = ipRx.ReplaceAllString(text, "[IP]")

	// Replace credit card numbers
	ccRx := regexp.MustCompile(`\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b`)
	text = ccRx.ReplaceAllString(text, "[CARD]")

	return text
}

// NewUserSafetyWindow checks if a user is in the "new user" safety window.
func (s *SafetyFilter) NewUserSafetyWindow(createdAt time.Time, days int) bool {
	return time.Since(createdAt) < time.Duration(days)*24*time.Hour
}

// FeedbackRateLimit checks if a user's correction rejection rate is too high.
func (s *SafetyFilter) FeedbackRateLimit(totalRejected, totalSubmitted int) bool {
	if totalSubmitted < 3 {
		return false
	}
	if totalSubmitted > 0 && float64(totalRejected)/float64(totalSubmitted) > 0.5 {
		return true
	}
	return false
}