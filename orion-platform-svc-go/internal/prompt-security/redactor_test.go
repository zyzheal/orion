package promptsecurity

import "testing"

func TestPIIRedactorEmail(t *testing.T) {
	r := NewPIIRedactor()
	input := "Contact me at john.doe@example.com for details"
	result := r.RedactPII(input)
	if result == input {
		t.Error("email should be redacted")
	}
	if EmailRegex.MatchString(result) {
		t.Error("redacted result should not contain original email pattern")
	}
}

func TestPIIRedactorPhone(t *testing.T) {
	r := NewPIIRedactor()
	input := "Call me at 555-123-4567"
	result := r.RedactPII(input)
	if PhoneRegex.MatchString(result) {
		t.Error("phone should be redacted")
	}
}

func TestPIIRedactorSSN(t *testing.T) {
	r := NewPIIRedactor()
	input := "SSN: 123-45-6789"
	result := r.RedactPII(input)
	if SSNRegex.MatchString(result) {
		t.Error("SSN should be redacted")
	}
}

func TestMaskPII(t *testing.T) {
	input := "My email is test@test.com and phone is 123-456-7890"
	result := MaskPII(input)
	if result == input {
		t.Error("PII should be masked")
	}
}

func TestRedactNoPII(t *testing.T) {
	r := NewPIIRedactor()
	input := "Hello world, no PII here"
	result := r.RedactPII(input)
	if result != input {
		t.Errorf("no-PII text should be unchanged: %q", result)
	}
}

func TestContainsPII(t *testing.T) {
	r := NewPIIRedactor()
	if !r.contains("email: test@test.com") {
		t.Error("should detect email PII")
	}
	if r.contains("no pii here") {
		t.Error("should not detect PII in clean text")
	}
}

func TestRegexPIIPatterns(t *testing.T) {
	if len(RegexPII) != 3 {
		t.Errorf("expected 3 PII patterns, got %d", len(RegexPII))
	}
}

func TestPatternAliases(t *testing.T) {
	if EMAIL_PATTERN != EmailRegex {
		t.Error("EMAIL_PATTERN should equal EmailRegex")
	}
	if PHONE_PATTERN != PhoneRegex {
		t.Error("PHONE_PATTERN should equal PhoneRegex")
	}
	if SSN_PATTERN != SSNRegex {
		t.Error("SSN_PATTERN should equal SSNRegex")
	}
}
