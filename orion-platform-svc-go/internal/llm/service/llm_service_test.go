package service

import (
	"testing"

	"orion/platform-svc-go/internal/llm/models"
)

func TestEstimateTokensEmpty(t *testing.T) {
	if got := EstimateTokens(""); got != 0 {
		t.Errorf("expected 0 for empty string, got %d", got)
	}
}

func TestEstimateTokensPureEnglish(t *testing.T) {
	// "hello" = 5 chars -> (5+3)/4 = 2 tokens
	got := EstimateTokens("hello")
	if got != 2 {
		t.Errorf("expected 2 for 'hello', got %d", got)
	}

	// "a" = 1 char -> (1+3)/4 = 1 token
	if got := EstimateTokens("a"); got != 1 {
		t.Errorf("expected 1 for 'a', got %d", got)
	}
}

func TestEstimateTokensPureChinese(t *testing.T) {
	// "你好世界" = 4 CJK chars -> 4 tokens
	got := EstimateTokens("你好世界")
	if got != 4 {
		t.Errorf("expected 4 for '你好世界', got %d", got)
	}
}

func TestEstimateTokensMixed(t *testing.T) {
	// "你好hello" = 2 CJK + 5 other = 2 + (5+3)/4 = 2 + 2 = 4
	got := EstimateTokens("你好hello")
	if got != 4 {
		t.Errorf("expected 4 for '你好hello', got %d", got)
	}
}

func TestEstimateTokensNumericAndSymbols(t *testing.T) {
	// "123!" = 4 non-CJK chars -> (4+3)/4 = 1
	got := EstimateTokens("123!")
	if got != 1 {
		t.Errorf("expected 1 for '123!', got %d", got)
	}
}

func TestHashContentConsistency(t *testing.T) {
	h1 := hashContent("hello")
	h2 := hashContent("hello")
	if h1 != h2 {
		t.Errorf("hashContent should be deterministic")
	}
	if len(h1) != 64 {
		t.Errorf("expected hash length 64, got %d", len(h1))
	}
}

func TestHashContentEmpty(t *testing.T) {
	h := hashContent("")
	if len(h) != 64 {
		t.Errorf("expected hash length 64 for empty string, got %d", len(h))
	}
}

func TestToJSONBEmpty(t *testing.T) {
	got := toJSONB(nil)
	if got != nil {
		t.Errorf("expected nil for nil map, got %#v", got)
	}

	got2 := toJSONB(map[string]interface{}{})
	if got2 != nil {
		t.Errorf("expected nil for empty map, got %#v", got2)
	}
}

func TestToJSONBNonEmpty(t *testing.T) {
	m := map[string]interface{}{"key": "value"}
	got := toJSONB(m)
	if got == nil {
		t.Fatal("expected non-nil result")
	}
	if got["key"] != "value" {
		t.Errorf("expected key=value, got %v", got["key"])
	}
}

func TestPtrStrEmpty(t *testing.T) {
	if got := ptrStr(""); got != nil {
		t.Errorf("expected nil for empty string, got %v", got)
	}
}

func TestPtrStrNonEmpty(t *testing.T) {
	s := "hello"
	got := ptrStr(s)
	if got == nil || *got != "hello" {
		t.Errorf("expected pointer to 'hello', got %v", got)
	}
}

func TestNewServiceNotNil(t *testing.T) {
	s := NewService(nil)
	if s == nil {
		t.Fatal("NewService(nil) should return non-nil service")
	}
}

func TestDefaultModelPricingContainsGPT4(t *testing.T) {
	p, ok := models.DefaultModelPricing["gpt-4"]
	if !ok {
		t.Fatal("expected gpt-4 in DefaultModelPricing")
	}
	if p.Input <= 0 || p.Output <= 0 {
		t.Errorf("expected positive pricing for gpt-4, got input=%f output=%f", p.Input, p.Output)
	}
}

func TestErrPricingMissing(t *testing.T) {
	if ErrPricingMissing == nil {
		t.Fatal("ErrPricingMissing should not be nil")
	}
	if ErrPricingMissing.Error() != "pricing not found for model" {
		t.Errorf("unexpected error message: %s", ErrPricingMissing.Error())
	}
}
