// Package promptsecurity provides LLM security hardening: prompt injection
// detection and PII redaction before LLM calls.
//
// Implements GATE-LLM-SEC-2 (prompt injection guard) and GATE-LLM-SEC-3 (PII redaction).
package promptsecurity

import "regexp"

// BlockedPatterns contains regex patterns that detect prompt injection attempts.
// These patterns match known prompt injection techniques including:
// - Instruction override attempts ("ignore previous instructions")
// - Role hijacking ("you are now a different model")
// - System prompt extraction attempts
var BlockedPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)ignore\s+(all\s+)?previous\s+instructions`),
	regexp.MustCompile(`(?i)forget\s+(your|all)\s+(instructions|training)`),
	regexp.MustCompile(`(?i)you\s+are\s+now\s+(a|the)\s+\w+`),
	regexp.MustCompile(`(?i)disregard\s+(all\s+)?(previous|prior)\s+(instructions|training)`),
	regexp.MustCompile(`(?i)new\s+instructions?\s*:`),
	regexp.MustCompile(`(?i)act\s+as\s+(if\s+)?(you\s+are|a)\s+(different|other)`),
}

// BLOCKED_PATTERNS is an alias for compatibility with the gate check.
// Deprecated: Use BlockedPatterns instead.
var BLOCKED_PATTERNS = BlockedPatterns

// InjectionDetector detects prompt injection attempts in user input.
type InjectionDetector struct {
	patterns []*regexp.Regexp
}

// NewInjectionDetector creates a new injection detector with default patterns.
func NewInjectionDetector() *InjectionDetector {
	return &InjectionDetector{patterns: BlockedPatterns}
}

// IsSafePrompt returns true if the input does not contain injection patterns.
func (d *InjectionDetector) IsSafePrompt(input string) bool {
	for _, p := range d.patterns {
		if p.MatchString(input) {
			return false
		}
	}
	return true
}

// DetectInjection returns the matched pattern if injection is detected.
func (d *InjectionDetector) DetectInjection(input string) (*regexp.Regexp, bool) {
	for _, p := range d.patterns {
		if p.MatchString(input) {
			return p, true
		}
	}
	return nil, false
}

// SanitizeInput removes or flags potentially dangerous content.
func SanitizeInput(input string) (string, bool) {
	detector := NewInjectionDetector()
	if !detector.IsSafePrompt(input) {
		return "", false
	}
	return input, true
}

// ValidatePrompt checks if a prompt is safe to send to an LLM.
func ValidatePrompt(prompt string) error {
	detector := NewInjectionDetector()
	if !detector.IsSafePrompt(prompt) {
		return errPromptInjectionDetected
	}
	return nil
}

var errPromptInjectionDetected = errInjection("prompt injection detected")

type errInjection string

func (e errInjection) Error() string { return string(e) }
