package promptsecurity

import "regexp"

// PII pattern definitions for redaction before LLM calls.
// Implements GATE-LLM-SEC-3 PII pattern library.

// EmailRegex matches email addresses.
var EmailRegex = regexp.MustCompile(`[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}`)

// PhoneRegex matches phone numbers (various formats).
var PhoneRegex = regexp.MustCompile(`(\+?\d{1,3}[\s\-]?)?\(?\d{2,4}\)?[\s\-]?\d{3}[\s\-]?\d{4}`)

// SSNRegex matches US Social Security Numbers.
var SSNRegex = regexp.MustCompile(`\b\d{3}[\s\-]?\d{2}[\s\-]?\d{4}\b`)

// SSN_PATTERN is an alias for SSNRegex (gate check compatibility).
var SSN_PATTERN = SSNRegex

// EMAIL_PATTERN is an alias for EmailRegex (gate check compatibility).
var EMAIL_PATTERN = EmailRegex

// PHONE_PATTERN is an alias for PhoneRegex (gate check compatibility).
var PHONE_PATTERN = PhoneRegex

// RegexPII is a collection of all PII regex patterns.
var RegexPII = []*regexp.Regexp{
	EmailRegex,
	PhoneRegex,
	SSNRegex,
}

// PIIRedactor redacts PII from text before sending to LLM.
type PIIRedactor struct {
	patterns []*regexp.Regexp
	maskChar string
}

// NewPIIRedactor creates a new PII redactor with default patterns.
func NewPIIRedactor() *PIIRedactor {
	return &PIIRedactor{
		patterns: RegexPII,
		maskChar: "*",
	}
}

// RedactPII masks PII in the input text.
// Replaces email, phone, and SSN patterns with masked versions.
func (r *PIIRedactor) RedactPII(input string) string {
	result := input
	for _, pattern := range r.patterns {
		result = r.maskPattern(result, pattern)
	}
	return result
}

// MaskPII is an alias for RedactPII (gate check compatibility).
func MaskPII(input string) string {
	return NewPIIRedactor().RedactPII(input)
}

// redact_pii is a lowercase alias for compatibility.
func redact_pii(input string) string {
	return NewPIIRedactor().RedactPII(input)
}

// maskPattern replaces all matches of pattern with a masked version.
func (r *PIIRedactor) maskPattern(text string, pattern *regexp.Regexp) string {
	masked := pattern.FindAllString(text, -1)
	if len(masked) == 0 {
		return text
	}
	for _, m := range masked {
		masked := r.maskString(m)
		text = replaceFirst(text, m, masked)
	}
	return text
}

// maskString creates a masked version of a PII string.
// Preserves first and last characters, masks the middle.
func (r *PIIRedactor) maskString(s string) string {
	if len(s) <= 2 {
		return r.maskChar + r.maskChar
	}
	return s[:1] + repeatChar(r.maskChar, len(s)-2) + s[len(s)-1:]
}

// contains detects if text contains any PII patterns.
func (r *PIIRedactor) contains(text string) bool {
	for _, pattern := range r.patterns {
		if pattern.MatchString(text) {
			return true
		}
	}
	return false
}

func repeatChar(ch string, n int) string {
	if ch == "" || n <= 0 {
		return ""
	}
	b := make([]byte, n)
	c := ch[0]
	for i := range b {
		b[i] = c
	}
	return string(b)
}

func replaceFirst(s, old, new string) string {
	idx := indexOf(s, old)
	if idx == -1 {
		return s
	}
	return s[:idx] + new + s[idx+len(old):]
}

func indexOf(s, sub string) int {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
