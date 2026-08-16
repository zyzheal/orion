package service

import (
	"strings"
	"testing"

	"orion/platform-svc-go/internal/semantic-search/models"
)

func Test_generateSummary_EmptyResults(t *testing.T) {
	svc := &SemanticSearchService{}
	got := svc.generateSummary(nil)
	if got != "No results found." {
		t.Errorf("expected 'No results found.', got %q", got)
	}
	got2 := svc.generateSummary([]models.SearchResult{})
	if got2 != "No results found." {
		t.Errorf("expected 'No results found.', got %q", got2)
	}
}

func Test_generateSummary_SingleResult(t *testing.T) {
	svc := &SemanticSearchService{}
	results := []models.SearchResult{
		{ID: "1", Source: "knowledge", Title: "How to deploy", Content: "Deploy to staging first.", Score: 0.95},
	}
	got := svc.generateSummary(results)
	if !strings.HasPrefix(got, "Found 1 relevant results:") {
		t.Errorf("expected prefix 'Found 1 relevant results:', got %q", got[:30])
	}
	if !strings.Contains(got, "How to deploy") {
		t.Error("expected title 'How to deploy' in summary")
	}
	if !strings.Contains(got, "0.950") {
		t.Error("expected score 0.950 in summary")
	}
}

func Test_generateSummary_MultipleResults(t *testing.T) {
	svc := &SemanticSearchService{}
	results := []models.SearchResult{
		{ID: "1", Source: "docs", Title: "A", Content: "AAA", Score: 0.8},
		{ID: "2", Source: "wiki", Title: "B", Content: "BBB", Score: 0.5},
	}
	got := svc.generateSummary(results)
	if !strings.HasPrefix(got, "Found 2 relevant results:") {
		t.Errorf("expected prefix 'Found 2 relevant results:', got %q", got[:30])
	}
	if !strings.Contains(got, "1. [docs] A") {
		t.Error("expected entry '1. [docs] A'")
	}
	if !strings.Contains(got, "2. [wiki] B") {
		t.Error("expected entry '2. [wiki] B'")
	}
}

func Test_generateSummary_TruncatesLongContent(t *testing.T) {
	svc := &SemanticSearchService{}
	longContent := strings.Repeat("x", 300)
	results := []models.SearchResult{
		{ID: "1", Source: "docs", Title: "Long", Content: longContent, Score: 0.9},
	}
	got := svc.generateSummary(results)
	// Content should be truncated: first 200 chars + "..."
	truncated := longContent[:200] + "..."
	if !strings.Contains(got, truncated) {
		t.Errorf("expected truncated content 'xxx...xxx' in summary")
	}
	// Full 300-char content should NOT appear
	if strings.Contains(got, longContent) {
		t.Error("expected content to be truncated, but full 300-char content was found")
	}
}

func Test_generateSummary_ShortContentNotTruncated(t *testing.T) {
	svc := &SemanticSearchService{}
	results := []models.SearchResult{
		{ID: "1", Source: "docs", Title: "Short", Content: "Hello world", Score: 0.5},
	}
	got := svc.generateSummary(results)
	if !strings.Contains(got, "Hello world") {
		t.Error("expected 'Hello world' in summary")
	}
	// Should not contain "..."
	if strings.Contains(got, "...") {
		t.Error("expected no truncation marker '...' for short content")
	}
}

func Test_generateSummary_ScoringFormat(t *testing.T) {
	svc := &SemanticSearchService{}
	results := []models.SearchResult{
		{ID: "1", Source: "docs", Title: "T", Content: "C", Score: 0.1234},
	}
	got := svc.generateSummary(results)
	// fmt.Sprintf "score: %.3f" -> "0.123"
	if !strings.Contains(got, "score: 0.123") {
		t.Errorf("expected 'score: 0.123' in summary, got %q", got)
	}
}
