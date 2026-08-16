package service

import (
	"context"
	"testing"

	"go.uber.org/zap"

	"orion/platform-svc-go/internal/code-embedding/models"
)

func Test_generateVector_Deterministic(t *testing.T) {
	svc := &CodeEmbeddingService{}
	v1 := svc.generateVector("func main() {}", "go")
	v2 := svc.generateVector("func main() {}", "go")
	if len(v1) != 1536 {
		t.Fatalf("expected dim 1536, got %d", len(v1))
	}
	if len(v2) != 1536 {
		t.Fatalf("expected dim 1536, got %d", len(v2))
	}
	for i := range v1 {
		if v1[i] != v2[i] {
			t.Errorf("index %d: v1=%f v2=%f", i, v1[i], v2[i])
			break
		}
	}
}

func Test_generateVector_EmptyString(t *testing.T) {
	svc := &CodeEmbeddingService{}
	v := svc.generateVector("", "go")
	if len(v) != 1536 {
		t.Fatalf("expected dim 1536, got %d", len(v))
	}
	// With empty content, hash = i*7, so entry = float64((i*7)%1000)/1000 - 0.5
	// index 0 -> 0/1000 - 0.5 = -0.5
	if v[0] != -0.5 {
		t.Errorf("index 0: expected -0.5, got %f", v[0])
	}
	if v[1] != float64(7)/1000.0-0.5 {
		t.Errorf("index 1: expected %f, got %f", float64(7)/1000.0-0.5, v[1])
	}
}

func Test_cosineSimilarity_Identical(t *testing.T) {
	svc := &CodeEmbeddingService{}
	a := []float64{1.0, 0.0, 0.0}
	b := []float64{1.0, 0.0, 0.0}
	got := svc.cosineSimilarity(a, b)
	if got != 1.0 {
		t.Errorf("expected 1.0, got %f", got)
	}
}

func Test_cosineSimilarity_Opposite(t *testing.T) {
	svc := &CodeEmbeddingService{}
	a := []float64{1.0, 0.0}
	b := []float64{-1.0, 0.0}
	got := svc.cosineSimilarity(a, b)
	if got != -1.0 {
		t.Errorf("expected -1.0, got %f", got)
	}
}

func Test_cosineSimilarity_Orthogonal(t *testing.T) {
	svc := &CodeEmbeddingService{}
	a := []float64{1.0, 0.0}
	b := []float64{0.0, 1.0}
	got := svc.cosineSimilarity(a, b)
	if got != 0.0 {
		t.Errorf("expected 0.0, got %f", got)
	}
}

func Test_cosineSimilarity_ZeroVector(t *testing.T) {
	svc := &CodeEmbeddingService{}
	a := []float64{0, 0, 0}
	b := []float64{1.0, 2.0, 3.0}
	got := svc.cosineSimilarity(a, b)
	if got != 0.0 {
		t.Errorf("expected 0.0, got %f", got)
	}
}

func Test_cosineSimilarity_OrthogonalLong(t *testing.T) {
	svc := &CodeEmbeddingService{}
	a := []float64{3.0, 0.0, 0.0}
	b := []float64{0.0, 4.0, 0.0}
	got := svc.cosineSimilarity(a, b)
	// dot=0, so cosine=0
	if got != 0.0 {
		t.Errorf("expected 0.0, got %f", got)
	}
}

func Test_cosineSimilarity_NonTrivial(t *testing.T) {
	svc := &CodeEmbeddingService{}
	a := []float64{1.0, 1.0, 0.0}
	b := []float64{1.0, 0.0, 1.0}
	got := svc.cosineSimilarity(a, b)
	// dot=1, normA=sqrt(2), normB=sqrt(2), cosine=1/(2*2)=0.25? no.
	// dot/(normA * normB) per code. normA = sum of squares = 2. normB = 2. dot/(2*2)=1/4=0.25
	expected := 0.25
	if got != expected {
		t.Errorf("expected %f, got %f", expected, got)
	}
}

func Test_Emdbed_NoRepo(t *testing.T) {
	logger, _ := zap.NewDevelopment()
	svc := &CodeEmbeddingService{logger: logger}
	if svc.hasRepo() {
		t.Fatal("expected hasRepo() to be false when repo is nil")
	}

	req := &models.EmbedRequest{
		RepoID:   "repo-1",
		FilePath: "/main.go",
		Language: "go",
		Content:  "package main",
	}
	resp, err := svc.Embed(context.Background(), "tenant-1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp == nil || resp.Embedding == nil {
		t.Fatal("expected non-nil response")
	}
	if resp.Embedding.Model != "code-embedding-3-small" {
		t.Errorf("expected default model, got %q", resp.Embedding.Model)
	}
	if resp.Embedding.TenantID != "tenant-1" {
		t.Errorf("expected tenantID=tenant-1, got %q", resp.Embedding.TenantID)
	}
	if resp.Embedding.RepoID != "repo-1" {
		t.Errorf("expected repoID=repo-1, got %q", resp.Embedding.RepoID)
	}
	if len(resp.Embedding.Vector) == 0 {
		t.Error("expected non-empty vector")
	}
}

func Test_Embed_DefaultModel(t *testing.T) {
	logger, _ := zap.NewDevelopment()
	svc := &CodeEmbeddingService{logger: logger}
	req := &models.EmbedRequest{
		RepoID:   "repo-1",
		FilePath: "/main.go",
		Content:  "package main",
		Model:    "",
	}
	resp, err := svc.Embed(context.Background(), "t1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Embedding.Model != "code-embedding-3-small" {
		t.Errorf("expected default model, got %q", resp.Embedding.Model)
	}
}

func Test_Embed_CustomModel(t *testing.T) {
	logger, _ := zap.NewDevelopment()
	svc := &CodeEmbeddingService{logger: logger}
	req := &models.EmbedRequest{
		RepoID:   "repo-1",
		FilePath: "/main.go",
		Content:  "package main",
		Model:    "custom-1536",
	}
	resp, err := svc.Embed(context.Background(), "t1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Embedding.Model != "custom-1536" {
		t.Errorf("expected custom model, got %q", resp.Embedding.Model)
	}
}

func Test_Search_NoRepo_DefaultTopK(t *testing.T) {
	logger, _ := zap.NewDevelopment()
	svc := &CodeEmbeddingService{logger: logger}
	req := &models.SearchRequest{
		RepoID: "repo-1",
		Query:  "func main",
	}
	resp, err := svc.Search(context.Background(), "t1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp == nil {
		t.Fatal("expected non-nil response")
	}
	if resp.TopK != 5 {
		t.Errorf("expected topK=5, got %d", resp.TopK)
	}
	if resp.Query != "func main" {
		t.Errorf("expected query=func main, got %q", resp.Query)
	}
}

func Test_min(t *testing.T) {
	if min(3, 5) != 3 {
		t.Error("min(3,5) expected 3")
	}
	if min(5, 3) != 3 {
		t.Error("min(5,3) expected 3")
	}
	if min(3, 3) != 3 {
		t.Error("min(3,3) expected 3")
	}
}
