package handlers

import (
	"fmt"
	"strings"
	"time"
)

// dateValueHandler handles date-only attribute values (date without time).
//
// Accepted formats: YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
// Normalised output: YYYY-MM-DD (ISO 8601 date)
type dateValueHandler struct{}

func (h dateValueHandler) Type() string { return "date" }

func (h dateValueHandler) Validate(value string) error {
	if value == "" {
		return nil
	}
	_, err := h.Parse(value)
	if err != nil {
		return fmt.Errorf("invalid date: %w", err)
	}
	return nil
}

func (h dateValueHandler) Parse(value string) (interface{}, error) {
	v := strings.TrimSpace(value)
	if v == "" {
		return "", nil
	}
	// Normalise common separators to "-"
	normalised := strings.ReplaceAll(v, "/", "-")
	normalised = strings.ReplaceAll(normalised, ".", "-")

	t, err := time.Parse("2006-01-02", normalised)
	if err != nil {
		return "", fmt.Errorf("invalid date format (expected YYYY-MM-DD): %q", v)
	}
	// Reject out-of-range dates for CMDB sanity
	if t.Year() < 1900 || t.Year() > 2099 {
		return "", fmt.Errorf("date out of range [1900-01-01, 2099-12-31]: %q", v)
	}
	return t.Format("2006-01-02"), nil
}

func (h dateValueHandler) Serialize(v interface{}) string {
	switch t := v.(type) {
	case string:
		return t
	case time.Time:
		return t.Format("2006-01-02")
	default:
		return fmt.Sprintf("%v", v)
	}
}

func (h dateValueHandler) Compare(a, b string) int {
	parsedA, errA := h.Parse(a)
	parsedB, errB := h.Parse(b)
	if errA != nil && errB != nil {
		return 0
	}
	sA, _ := parsedA.(string)
	sB, _ := parsedB.(string)
	return strings.Compare(sA, sB)
}
