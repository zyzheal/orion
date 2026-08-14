package code_embedding_test

import (
	"testing"

	"orion/platform-svc-go/internal/code-embedding/models"
	"orion/platform-svc-go/internal/code-embedding/service"
)

func TestCodeEmbedding_NewService(t *testing.T) {
	s := service.NewCodeEmbeddingService(nil, nil)
	if s == nil {
		t.Fatal("NewCodeEmbeddingService returned nil")
	}
}

func TestCodeEmbedding_ModelsCompile(t *testing.T) {
	emb := models.CodeEmbedding{
		ID:       "e1",
		TenantID: "t1",
		RepoID:   "r1",
	}
	if emb.ID != "e1" {
		t.Fatal("unexpected embedding")
	}
}

func TestCodeEmbedding_PackageAvailable(t *testing.T) {
	_ = models.EmbedRequest{}
	_ = models.SearchRequest{}
}
