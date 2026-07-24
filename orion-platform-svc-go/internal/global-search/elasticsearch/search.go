package elasticsearch

import (
	"context"
	"orion/platform-svc-go/internal/global-search/models"
)

// SearchService orchestrates multi-module search queries against Elasticsearch.
type SearchService struct {
	client *Client
}

// NewSearchService creates a SearchService backed by the given ES client.
func NewSearchService(client *Client) *SearchService {
	return &SearchService{client: client}
}

// Search executes a unified full-text search across one or more module indices.
// When ES is unavailable, returns an empty response rather than an error.
func (s *SearchService) Search(ctx context.Context, req *models.SearchRequest) (*models.SearchResponse, error) {
	if req.Size <= 0 {
		req.Size = 20
	}
	if req.Size > 100 {
		req.Size = 100
	}
	if req.SortOrder == "" {
		req.SortOrder = "desc"
	}

	indices := s.resolveIndices(req.Modules)
	if len(indices) == 0 {
		return &models.SearchResponse{
			Results: make(map[string]*models.SearchResultGroup),
		}, nil
	}

	body := s.buildQueryBody(req)

	response := &models.SearchResponse{
		Query:   req.Query,
		Results: make(map[string]*models.SearchResultGroup),
	}

	total := int64(0)
	for _, idx := range indices {
		result, err := s.client.Search(ctx, []string{idx}, body)
		if err != nil {
			if err == ErrESUnavailable {
				continue
			}
			return nil, err
		}
		if result == nil {
			continue
		}

		module := stripVersionSuffix(idx)

		group := &models.SearchResultGroup{
			Total: s.extractTotal(result),
			Hits:  s.parseHits(result, module),
		}
		response.Results[module] = group
		total += group.Total
	}

	response.Total = total
	return response, nil
}

// buildQueryBody constructs the ES query DSL.
func (s *SearchService) buildQueryBody(req *models.SearchRequest) map[string]interface{} {
	body := map[string]interface{}{
		"from":  req.From,
		"size":  req.Size,
		"query": s.buildQuery(req),
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

	if req.SortBy != "" {
		sortMap := map[string]interface{}{
			req.SortBy: map[string]string{"order": req.SortOrder},
		}
		body["sort"] = []map[string]interface{}{sortMap}
	}

	return body
}

// buildQuery creates a bool query combining full-text match and filters.
func (s *SearchService) buildQuery(req *models.SearchRequest) map[string]interface{} {
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

// resolveIndices maps module names to ES index names using convention.
// In production this would use the IndexerRegistry; here we use a convention.
func (s *SearchService) resolveIndices(modules []string) []string {
	if len(modules) == 0 {
		return nil // caller should provide indices externally
	}
	indices := make([]string, 0, len(modules))
	for _, m := range modules {
		indices = append(indices, m+"_v1")
	}
	return indices
}

// extractTotal gets total count from ES response.
func (s *SearchService) extractTotal(result *SearchResultRaw) int64 {
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

// parseHits converts raw ES hits to our SearchHit model.
func (s *SearchService) parseHits(result *SearchResultRaw, module string) []models.SearchHit {
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
		// Extract title from source.
		if t, ok := hit.Source["title"]; ok {
			sh.Title = stringVal(t)
		}
		// Build snippet from highlighted fields.
		for field, frags := range hit.Highlight {
			sh.Highlighted[field] = joinFrags(frags)
		}
		// Default type to module name; override if present in source.
		sh.Type = module
		if tp, ok := hit.Source["type"]; ok {
			sh.Type = stringVal(tp)
		}
		hits = append(hits, sh)
	}
	return hits
}

// stripVersionSuffix removes _v1, _v2, etc. from an index name to get module name.
func stripVersionSuffix(index string) string {
	for i := len(index) - 1; i >= 0; i-- {
		if index[i] == '_' && i+1 < len(index) {
			rest := index[i+1:]
			if len(rest) >= 1 && rest[0] == 'v' {
				isDigits := true
				for j := 1; j < len(rest); j++ {
					if rest[j] < '0' || rest[j] > '9' {
						isDigits = false
						break
					}
				}
				if isDigits && len(rest) > 1 {
					return index[:i]
				}
			}
		}
	}
	return index
}

// joinFrags joins highlighted fragments into a readable string.
func joinFrags(frags []string) string {
	if len(frags) == 0 {
		return ""
	}
	if len(frags) == 1 {
		return frags[0]
	}
	return frags[0] + " ... " + frags[len(frags)-1]
}

// stringVal safely converts an interface{} to a string.
func stringVal(v interface{}) string {
	switch t := v.(type) {
	case string:
		return t
	case nil:
		return ""
	default:
		return ""
	}
}
