package service

import "testing"

func TestServiceErrors(t *testing.T) {
	if ErrTraceNotFound.Error() != "trace not found" {
		t.Errorf("unexpected: %s", ErrTraceNotFound.Error())
	}
}

func TestEstimateTokens(t *testing.T) {
	// Empty text
	if got := EstimateTokens(""); got != 0 {
		t.Errorf("expected 0, got %d", got)
	}
	// Pure English: ~4 chars per token
	if got := EstimateTokens("hello"); got < 1 {
		t.Errorf("expected >= 1 for 'hello', got %d", got)
	}
	// Pure Chinese: ~1 char per token
	if got := EstimateTokens("你好世界"); got < 4 {
		t.Errorf("expected >= 4 for Chinese text, got %d", got)
	}
}
