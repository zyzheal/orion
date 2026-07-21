package repository

import "testing"

func TestIsValidSeverity(t *testing.T) {
	valid := []string{"critical", "high", "medium", "low", "info"}
	for _, s := range valid {
		if !isValidSeverity(s) {
			t.Errorf("isValidSeverity(%q) = false, want true", s)
		}
	}

	invalid := []string{
		"",
		"Critical",    // case-sensitive
		"urgent",
		"1=1",
		"; DROP TABLE",
		"high' OR '1=1",
		"medium\"; DELETE FROM",
		"low' UNION SELECT * FROM",
		"$1 OR 1=1",
	}
	for _, s := range invalid {
		if isValidSeverity(s) {
			t.Errorf("isValidSeverity(%q) = true, want false", s)
		}
	}
}

func TestIsValidSeverityRejectsSQLInjection(t *testing.T) {
	attackStrings := []string{
		"' OR '1=1",
		"' UNION SELECT * FROM users --",
		"; DROP TABLE security_findings; --",
		"' ; DELETE FROM audit_plans --",
		"%27+OR+1=1--",
		"high' AND '1'='1",
	}
	for _, s := range attackStrings {
		if isValidSeverity(s) {
			t.Errorf("isValidSeverity should reject injection: %q", s)
		}
	}
}
