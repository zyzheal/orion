package semantic_search_test

import (
	"testing"

	"orion/platform-svc-go/internal/semantic-search/models"
	"orion/platform-svc-go/internal/semantic-search/service"
)

func TestSemanticSearch_NewService_Nil(t *testing.T) {
	s := service.NewSemanticSearchService(nil, nil)
	if s == nil {
		t.Fatal("NewSemanticSearchService returned nil")
	}
}

func TestSemanticSearch_ModelsCompile(t *testing.T) {
	sr := models.SearchResult{
		ID:    "r1",
		Title: "doc",
		Score: 0.95,
	}
	if sr.ID != "r1" || sr.Score != 0.95 {
		t.Fatalf("unexpected result: %+v", sr)
	}
}

func TestSemanticSearch_PackageAvailable(t *testing.T) {
	_ = models.SearchRequest{}
	_ = models.SearchResponse{}
}
