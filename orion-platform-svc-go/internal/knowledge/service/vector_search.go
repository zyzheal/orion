package service

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"hash/fnv"
	"sort"
	"strings"

	"orion/platform-svc-go/internal/knowledge/models"
)

// EmbeddingConfig configures the embedding provider.
type EmbeddingConfig struct {
	Provider   string // "openai", "local", "fake"
	Model      string
	Dimensions int
}

// Embedder generates vector embeddings for text.
type Embedder interface {
	Embed(ctx context.Context, texts []string) ([][]float32, error)
}

// FakeEmbedder produces deterministic 128-dim vectors for development.
type FakeEmbedder struct {
	dimensions int
}

func NewFakeEmbedder(dimensions int) *FakeEmbedder {
	if dimensions == 0 {
		dimensions = 128
	}
	return &FakeEmbedder{dimensions: dimensions}
}

func (e *FakeEmbedder) Embed(ctx context.Context, texts []string) ([][]float32, error) {
	results := make([][]float32, len(texts))
	for i, text := range texts {
		h := fnv.New64a()
		h.Write([]byte(text))
		seed := h.Sum64()
		vec := make([]float32, e.dimensions)
		for d := 0; d < e.dimensions; d++ {
			v := sha256.Sum256([]byte(fmt.Sprintf("%d-%d", seed, d)))
			b := binary.LittleEndian.Uint64(v[:8])
			vec[d] = float32(b%1000) / 1000.0
		}
		// normalize to unit vector
		var norm float32
		for _, v := range vec {
			norm += v * v
		}
		if norm > 0 {
			inv := 1.0 / float32(norm)
			for d := 0; d < e.dimensions; d++ {
				vec[d] *= inv
			}
		}
		results[i] = vec
	}
	return results, nil
}

// VectorSearcher provides hybrid search combining vector similarity with BM25-like scoring.
type VectorSearcher struct {
	embedder   Embedder
	indexPath  string
	index      map[string][]float32
	metadata   map[string]models.RAGRetrieveResult
}

func NewVectorSearcher(embedder Embedder) *VectorSearcher {
	return &VectorSearcher{
		embedder: embedder,
		index:    make(map[string][]float32),
		metadata: make(map[string]models.RAGRetrieveResult),
	}
}

// IndexDocument adds a document to the vector index.
func (vs *VectorSearcher) IndexDocument(ctx context.Context, doc models.RAGRetrieveResult) error {
	if vs.embedder == nil {
		return nil
	}
	texts := []string{doc.Title + " " + doc.Content}
	vecs, err := vs.embedder.Embed(ctx, texts)
	if err != nil {
		return err
	}
	if len(vecs) == 0 || len(vecs[0]) == 0 {
		return nil
	}
	vs.index[doc.ID] = vecs[0]
	vs.metadata[doc.ID] = doc
	return nil
}

// Search performs vector similarity search against the index.
func (vs *VectorSearcher) Search(ctx context.Context, query string, topK int) ([]models.RAGRetrieveResult, error) {
	if vs.embedder == nil || len(vs.index) == 0 {
		return nil, nil
	}

	vecs, err := vs.embedder.Embed(ctx, []string{query})
	if err != nil {
		return nil, err
	}
	if len(vecs) == 0 || len(vecs[0]) == 0 {
		return nil, nil
	}
	queryVec := vecs[0]

	type scored struct {
		id      string
		score   float64
	}
	var scoredList []scored

	for id, docVec := range vs.index {
		sim := cosineSimilarity(queryVec, docVec)
		scoredList = append(scoredList, scored{id: id, score: sim})
	}

	sort.Slice(scoredList, func(i, j int) bool {
		return scoredList[i].score > scoredList[j].score
	})

	limit := topK
	if limit <= 0 {
		limit = 10
	}
	if limit > len(scoredList) {
		limit = len(scoredList)
	}

	var results []models.RAGRetrieveResult
	for i := 0; i < limit; i++ {
		item := scoredList[i]
		meta := vs.metadata[item.id]
		meta.Similarity = float64(item.score)
		results = append(results, meta)
	}
	return results, nil
}

// HybridSearch combines vector similarity with keyword BM25-like scoring.
func (vs *VectorSearcher) HybridSearch(ctx context.Context, tenantID string, query string, topK int) ([]models.RAGRetrieveResult, error) {
	vectorResults, err := vs.Search(ctx, query, topK)
	if err != nil {
		return nil, err
	}

	var keywordResults []models.RAGRetrieveResult
	if vs.index != nil && len(vs.index) > 0 {
		keywordResults = make([]models.RAGRetrieveResult, 0, len(vs.metadata))
		queryLower := strings.ToLower(query)
		for _, meta := range vs.metadata {
			score := keywordScore(queryLower, meta.Title, meta.Content)
			meta.Similarity = score
			keywordResults = append(keywordResults, meta)
		}
	}

	fused := rrfFuse(vectorResults, keywordResults, topK)
	return fused, nil
}

func cosineSimilarity(a, b []float32) float64 {
	if len(a) != len(b) {
		return 0
	}
	var dot, normA, normB float64
	for i := range a {
		dot += float64(a[i] * b[i])
		normA += float64(a[i] * a[i])
		normB += float64(b[i] * b[i])
	}
	if normA == 0 || normB == 0 {
		return 0
	}
	return dot / (normA * normB)
}

func keywordScore(query, title, content string) float64 {
	if query == "" {
		return 0
	}
	titleLower := strings.ToLower(title)
	contentLower := strings.ToLower(content)
	var score float64
	for _, word := range strings.Fields(query) {
		word = strings.Trim(word, ".,!?；，。？")
		if len(word) < 2 {
			continue
		}
		if strings.Contains(titleLower, word) {
			score += 0.4
		}
		if strings.Contains(contentLower, word) {
			score += 0.2
		}
	}
	return score
}

func rrfFuse(vecResults, keywordResults []models.RAGRetrieveResult, topK int) []models.RAGRetrieveResult {
	type entry struct {
		doc  models.RAGRetrieveResult
		sim  float64
	}
	scoreMap := make(map[string]*entry)

	for i, d := range vecResults {
		e := scoreMap[d.ID]
		if e == nil {
			e = &entry{doc: d}
			scoreMap[d.ID] = e
		}
		e.sim += 1.0 / float64(i+1)
	}
	for i, d := range keywordResults {
		e := scoreMap[d.ID]
		if e == nil {
			e = &entry{doc: d}
			scoreMap[d.ID] = e
		}
		e.sim += 1.0 / float64(i+1)
	}

	if len(scoreMap) == 0 {
		return nil
	}

	var scored []entry
	for _, e := range scoreMap {
		e.doc.Similarity = e.sim
		scored = append(scored, *e)
	}
	sort.Slice(scored, func(i, j int) bool {
		return scored[i].sim > scored[j].sim
	})

	limit := topK
	if limit > len(scored) {
		limit = len(scored)
	}
	var result []models.RAGRetrieveResult
	for i := 0; i < limit; i++ {
		result = append(result, scored[i].doc)
	}
	return result
}