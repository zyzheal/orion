package modules

import (
	"context"

	"orion/platform-svc-go/internal/global-search/elasticsearch"
	"orion/platform-svc-go/internal/global-search/interfaces"
)

// TicketIndexer indexes ticket documents (title, description, status, priority, created_at).
type TicketIndexer struct {
	indexName string
	client    *elasticsearch.Client
	// fetcher provides the actual ticket data from the ticketing module.
	// When nil, the indexer returns no documents (graceful degradation).
	fetcher TicketFetchFunc
}

// Ticket represents a ticket document for indexing.
type Ticket struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Status      string `json:"status"`
	Priority    string `json:"priority"`
	Type        string `json:"type"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

// TicketFetchFunc is a function that returns tickets in a paginated batch.
type TicketFetchFunc func(ctx context.Context, offset, limit int) ([]*Ticket, error)

// NewTicketIndexer creates a new TicketIndexer.
func NewTicketIndexer(indexName string, client *elasticsearch.Client, fetcher TicketFetchFunc) *TicketIndexer {
	return &TicketIndexer{
		indexName: indexName,
		client:    client,
		fetcher:   fetcher,
	}
}

func (t *TicketIndexer) Module() string {
	return "ticket"
}

func (t *TicketIndexer) IndexName() string {
	return t.indexName
}

func (t *TicketIndexer) Config() interfaces.IndexerConfig {
	return interfaces.IndexerConfig{
		BatchSize:       500,
		RefreshInterval: "5s",
		Replicas:        0,
		Shards:          1,
		FullTextField:   "title",
		Fields:          []string{"title", "description", "status", "priority", "type", "created_at", "updated_at"},
	}
}

func (t *TicketIndexer) Reindex(ctx context.Context) error {
	// Ensure index exists with proper mapping
	mapping := map[string]interface{}{
		"properties": map[string]interface{}{
			"id":          map[string]string{"type": "keyword"},
			"title":       map[string]string{"type": "text"},
			"description": map[string]string{"type": "text"},
			"status":      map[string]string{"type": "keyword"},
			"priority":    map[string]string{"type": "keyword"},
			"type":        map[string]string{"type": "keyword"},
			"created_at":  map[string]string{"type": "date"},
			"updated_at":  map[string]string{"type": "date"},
			"body":        map[string]string{"type": "text"},
			"fields":      map[string]string{"type": "object", "enabled": "true"},
		},
	}
	if err := t.client.CreateIndex(ctx, t.indexName, mapping); err != nil {
		return err
	}

	if t.fetcher == nil {
		return nil
	}

	batchSize := t.Config().BatchSize
	offset := 0
	for {
		tickets, err := t.fetcher(ctx, offset, batchSize)
		if err != nil {
			return err
		}
		if len(tickets) == 0 {
			break
		}

		docs := make([]map[string]interface{}, 0, len(tickets))
		for _, tk := range tickets {
			doc := map[string]interface{}{
				"id":          tk.ID,
				"title":       tk.Title,
				"description": tk.Description,
				"status":      tk.Status,
				"priority":    tk.Priority,
				"type":        tk.Type,
				"created_at":  tk.CreatedAt,
				"updated_at":  tk.UpdatedAt,
				"body":        tk.Title + " " + tk.Description,
				"fields": map[string]interface{}{
					"status":   tk.Status,
					"priority": tk.Priority,
					"type":     tk.Type,
				},
			}
			docs = append(docs, doc)
		}

		if _, err := t.client.BulkIndex(ctx, t.indexName, docs); err != nil {
			return err
		}
		offset += batchSize
	}
	return nil
}

func (t *TicketIndexer) DeleteIndex(ctx context.Context) error {
	return t.client.DeleteIndex(ctx, t.indexName)
}

func (t *TicketIndexer) Documents(ctx context.Context, offset, limit int) ([]*interfaces.Document, int, error) {
	if t.fetcher == nil {
		return nil, 0, nil
	}
	tickets, err := t.fetcher(ctx, offset, limit)
	if err != nil {
		return nil, 0, err
	}
	docs := make([]*interfaces.Document, 0, len(tickets))
	for _, tk := range tickets {
		docs = append(docs, &interfaces.Document{
			ID:      tk.ID,
			Type:    tk.Type,
			Title:   tk.Title,
			Body:    tk.Title + " " + tk.Description,
			CreatedAt: tk.CreatedAt,
			UpdatedAt: tk.UpdatedAt,
			Fields: map[string]interface{}{
				"status":   tk.Status,
				"priority": tk.Priority,
				"type":     tk.Type,
			},
		})
	}
	nextOffset := offset + len(tickets)
	return docs, nextOffset, nil
}

func (t *TicketIndexer) Count(ctx context.Context) (int64, error) {
	exists, err := t.client.Exists(ctx, t.indexName)
	if err != nil {
		return 0, err
	}
	if !exists {
		return 0, nil
	}
	return t.client.Count(ctx, t.indexName)
}
