package service

import "testing"

func TestEstimateTokensMore(t *testing.T) {
	tests := []struct {
		name string
		text string
		min  int
		max  int
	}{
		{"empty", "", 0, 0},
		{"english short", "hello", 1, 3},
		{"english medium", "hello world this is a test", 3, 10},
		{"chinese short", "你好", 2, 4},
		{"chinese medium", "你好世界，今天天气很好", 7, 12},
		{"mixed", "hello你好world世界", 4, 10},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := EstimateTokens(tt.text)
			if got < tt.min || got > tt.max {
				t.Errorf("EstimateTokens(%q) = %d, want between %d and %d",
					tt.text, got, tt.min, tt.max)
			}
		})
	}
}

func TestEstimateTokensConsistency(t *testing.T) {
	// Same text should produce same result
	result1 := EstimateTokens("Hello World")
	result2 := EstimateTokens("Hello World")
	if result1 != result2 {
		t.Errorf("expected consistent results, got %d and %d", result1, result2)
	}
}
