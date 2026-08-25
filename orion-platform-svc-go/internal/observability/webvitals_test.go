package observability

import "testing"

func TestExtractPagePath(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"", "/"},
		{"/", "/"},
		{"/dashboard", "/dashboard"},
		{"http://localhost:3000/dashboard", "dashboard"},
		{"https://example.com/app/settings/profile", "app/settings/profile"},
		{"/page?query=1", "/page"},
		{"/page#section", "/page"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := extractPagePath(tt.input)
			if result != tt.expected {
				t.Errorf("extractPagePath(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestFindIndex(t *testing.T) {
	tests := []struct {
		s      string
		ch     byte
		expect int
	}{
		{"hello", 'l', 2},
		{"hello", 'z', -1},
		{"", 'a', -1},
		{"abc/def", '/', 3},
	}
	for _, tt := range tests {
		result := findIndex(tt.s, tt.ch)
		if result != tt.expect {
			t.Errorf("findIndex(%q, %c) = %d, want %d", tt.s, tt.ch, result, tt.expect)
		}
	}
}

func TestExtractService(t *testing.T) {
	if extractService("") != "unknown" {
		t.Error("empty userAgent should return unknown")
	}
	if extractService("Mozilla/5.0") != "web" {
		t.Error("non-empty userAgent should return web")
	}
}

func TestFindBestRating(t *testing.T) {
	vitals := []VitalMetric{
		{Name: "LCP", Rating: "good"},
		{Name: "CLS", Rating: "needs-improvement"},
	}
	if findBestRating(vitals) != "needs-improvement" {
		t.Error("expected needs-improvement")
	}

	vitals = []VitalMetric{
		{Name: "LCP", Rating: "poor"},
		{Name: "CLS", Rating: "good"},
	}
	if findBestRating(vitals) != "poor" {
		t.Error("expected poor")
	}

	vitals = []VitalMetric{
		{Name: "LCP", Rating: "good"},
	}
	if findBestRating(vitals) != "good" {
		t.Error("expected good")
	}
}
