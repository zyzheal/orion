// Package index provides the IndexerRegistry that coordinates multiple per-module
// SearchIndexer implementations for unified global search.
package index

import (
	"context"
	"sync"
	"time"

	"orion/platform-svc-go/internal/global-search/elasticsearch"
	"orion/platform-svc-go/internal/global-search/interfaces"
	"orion/platform-svc-go/internal/global-search/models"
)

// IndexerRegistry manages the lifecycle of per-module SearchIndexer implementations
// and provides unified search across all registered modules.
type IndexerRegistry struct {
	mu       sync.RWMutex
	indexers map[string]interfaces.SearchIndexer
	es       *elasticsearch.Client
	svc      *elasticsearch.SearchService
}

// New creates an IndexerRegistry. The ES client is optional (nil disables search).
func New(es *elasticsearch.Client) *IndexerRegistry {
	svc := elasticsearch.NewSearchService(es)
	return &IndexerRegistry{
		indexers: make(map[string]interfaces.SearchIndexer),
		es:       es,
		svc:      svc,
	}
}

// Register adds a SearchIndexer to the registry.
// It is safe to call at package init time (e.g. from module packages).
func (r *IndexerRegistry) Register(indexer interfaces.SearchIndexer) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.indexers[indexer.Module()] = indexer
}

// Unregister removes an indexer by module name.
func (r *IndexerRegistry) Unregister(module string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.indexers, module)
}

// Get returns the indexer for a given module, or nil.
func (r *IndexerRegistry) Get(module string) interfaces.SearchIndexer {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.indexers[module]
}

// All returns a copy of all registered module names.
func (r *IndexerRegistry) All() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	names := make([]string, 0, len(r.indexers))
	for name := range r.indexers {
		names = append(names, name)
	}
	return names
}

// Search executes a unified search across all or a subset of registered modules.
// Returns results grouped by module.
func (r *IndexerRegistry) Search(ctx context.Context, req *models.SearchRequest) (*models.SearchResponse, error) {
	// Build index list from registered indexers, filtered by requested modules.
	indices := r.resolveIndices(req.Modules)
	if len(indices) == 0 {
		return &models.SearchResponse{
			Total:   0,
			Query:   req.Query,
			Results: make(map[string]*models.SearchResultGroup),
		}, nil
	}

	start := time.Now()

	// Build query body.
	body := r.buildQueryBody(req)

	response := &models.SearchResponse{
		Query:   req.Query,
		Results: make(map[string]*models.SearchResultGroup),
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	var searchErr error
	resultsCh := make(chan searchResult, len(indices))

	for _, idx := range indices {
		wg.Add(1)
		go func(index string) {
			defer wg.Done()
			result, err := r.es.Search(ctx, []string{index}, body)
			mu.Lock()
			if err != nil && err != elasticsearch.ErrESUnavailable {
				searchErr = err
			}
			mu.Unlock()
			if result != nil {
				module := r.moduleForIndex(index)
				resultsCh <- searchResult{index: index, module: module, result: result}
			}
		}(idx)
	}

	wg.Wait()
	close(resultsCh)

	if searchErr != nil {
		// Drain channel to avoid goroutine leak
		for range resultsCh {
		}
		return nil, searchErr
	}

	for res := range resultsCh {
		if res.result == nil {
			continue
		}
		group := &models.SearchResultGroup{
			Total: r.extractTotal(res.result),
			Hits:  r.parseHits(res.result, res.module),
		}
		response.Results[res.module] = group
		response.Total += group.Total
	}

	response.TookMs = time.Since(start).Milliseconds()
	return response, nil
}

// searchResult holds a single index's search result for aggregation.
type searchResult struct {
	index  string
	module string
	result *elasticsearch.SearchResultRaw
}

// Reindex triggers a full reindex for the given module. Pass empty module for all.
func (r *IndexerRegistry) Reindex(ctx context.Context, module string) ([]models.ReindexResponse, error) {
	var targets []interfaces.SearchIndexer
	r.mu.RLock()
	if module != "" {
		if ix := r.indexers[module]; ix != nil {
			targets = append(targets, ix)
		} else {
			return nil, nil
		}
	} else {
		targets = make([]interfaces.SearchIndexer, 0, len(r.indexers))
		for _, ix := range r.indexers {
			targets = append(targets, ix)
		}
	}
	r.mu.RUnlock()

	results := make([]models.ReindexResponse, 0, len(targets))
	for _, ix := range targets {
		start := time.Now()
		err := ix.Reindex(ctx)
		resp := models.ReindexResponse{
			Module:     ix.Module(),
			DurationMs: time.Since(start).Milliseconds(),
			Success:    err == nil,
		}
		if err != nil {
			resp.Error = err.Error()
		}
		results = append(results, resp)
	}
	return results, nil
}

// Status returns the health status of all registered indexers.
func (r *IndexerRegistry) Status(ctx context.Context) []models.IndexerStatus {
	r.mu.RLock()
	defer r.mu.RUnlock()
	statuses := make([]models.IndexerStatus, 0, len(r.indexers))
	for _, ix := range r.indexers {
		s := models.IndexerStatus{
			Module:    ix.Module(),
			IndexName: ix.IndexName(),
		}
		count, err := ix.Count(ctx)
		if err != nil {
			s.Error = err.Error()
			s.Healthy = false
		} else {
			s.DocCount = count
			s.Healthy = true
		}
		statuses = append(statuses, s)
	}
	return statuses
}

// ESClient returns the underlying ES client (may be nil).
func (r *IndexerRegistry) ESClient() *elasticsearch.Client {
	return r.es
}

// resolveIndices maps requested modules to ES index names via registered indexers.
func (r *IndexerRegistry) resolveIndices(requested []string) []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	indices := make([]string, 0)

	if len(requested) > 0 {
		for _, mod := range requested {
			if ix, ok := r.indexers[mod]; ok {
				indices = append(indices, ix.IndexName())
			}
		}
		return indices
	}

	// All modules
	for _, ix := range r.indexers {
		indices = append(indices, ix.IndexName())
	}
	return indices
}

// moduleForIndex maps an index name back to a module name.
func (r *IndexerRegistry) moduleForIndex(index string) string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for name, ix := range r.indexers {
		if ix.IndexName() == index {
			return name
		}
	}
	return index
}

// buildQueryBody constructs the ES query DSL from a SearchRequest.
func (r *IndexerRegistry) buildQueryBody(req *models.SearchRequest) map[string]interface{} {
	return map[string]interface{}{
		"from":  req.From,
		"size":  req.Size,
		"query": r.buildQuery(req),
		"highlight": map[string]interface{}{
			"fields": map[string]interface{}{
				"title": map[string]interface{}{
					"fragment_size":       150,
					"number_of_fragments": 3,
				},
				"body": map[string]interface{}{
					"fragment_size":       200,
					"number_of_fragments": 3,
				},
			},
		},
	}
}

// buildQuery creates the ES bool query.
func (r *IndexerRegistry) buildQuery(req *models.SearchRequest) map[string]interface{} {
	boolQuery := map[string]interface{}{
		"must": []map[string]interface{}{
			{
				"multi_match": map[string]interface{}{
					"query":     req.Query,
					"fields":    []string{"title^3", "body", "type", "status"},
					"fuzziness": "AUTO",
				},
			},
		},
	}

	if len(req.Filters) > 0 {
		filters := make([]map[string]interface{}, 0, len(req.Filters))
		for k, v := range req.Filters {
			filters = append(filters, map[string]interface{}{
				"term": map[string]string{
					"fields." + k + ".keyword": v,
				},
			})
		}
		boolQuery["filter"] = filters
	}

	return map[string]interface{}{
		"bool": boolQuery,
	}
}

// extractTotal extracts total count from ES response.
func (r *IndexerRegistry) extractTotal(result *elasticsearch.SearchResultRaw) int64 {
	if result == nil || result.Hits.Total == nil {
		return 0
	}
	v, ok := result.Hits.Total["value"]
	if !ok {
		return 0
	}
	switch t := v.(type) {
	case int64:
		return t
	case float64:
		return int64(t)
	case int:
		return int64(t)
	}
	return 0
}

// parseHits converts raw ES hits to SearchHit models.
func (r *IndexerRegistry) parseHits(result *elasticsearch.SearchResultRaw, module string) []models.SearchHit {
	if result == nil {
		return nil
	}
	hits := make([]models.SearchHit, 0, len(result.Hits.Hits))
	for _, hit := range result.Hits.Hits {
		sh := models.SearchHit{
			ID:          hit.ID,
			Score:       hit.Score,
			Module:      module,
			Fields:      hit.Source,
			Highlighted: make(map[string]string),
		}
		if t, ok := hit.Source["title"]; ok {
			if s, ok := t.(string); ok {
				sh.Title = s
			}
		}
		for field, frags := range hit.Highlight {
			if len(frags) >= 2 {
				sh.Highlighted[field] = frags[0] + " ... " + frags[len(frags)-1]
			} else if len(frags) == 1 {
				sh.Highlighted[field] = frags[0]
			}
		}
		sh.Type = module
		if tp, ok := hit.Source["type"]; ok {
			if s, ok := tp.(string); ok {
				sh.Type = s
			}
		}
		hits = append(hits, sh)
	}
	return hits
}
