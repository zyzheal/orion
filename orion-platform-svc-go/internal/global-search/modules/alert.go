package modules

import (
	"context"

	"orion/platform-svc-go/internal/global-search/elasticsearch"
	"orion/platform-svc-go/internal/global-search/interfaces"
)

// AlertIndexer indexes alert documents (title, severity, status, source, message).
type AlertIndexer struct {
	indexName string
	client    *elasticsearch.Client
	fetcher   AlertFetchFunc
}

// Alert represents an alert document for indexing.
type Alert struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Severity  string `json:"severity"`
	Status    string `json:"status"`
	Source    string `json:"source"`
	Message   string `json:"message"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// AlertFetchFunc returns alerts in a paginated batch.
type AlertFetchFunc func(ctx context.Context, offset, limit int) ([]*Alert, error)

// NewAlertIndexer creates a new AlertIndexer.
func NewAlertIndexer(indexName string, client *elasticsearch.Client, fetcher AlertFetchFunc) *AlertIndexer {
	return &AlertIndexer{
		indexName: indexName,
		client:    client,
		fetcher:   fetcher,
	}
}

func (a *AlertIndexer) Module() string {
	return "alert"
}

func (a *AlertIndexer) IndexName() string {
	return a.indexName
}

func (a *AlertIndexer) Config() interfaces.IndexerConfig {
	return interfaces.IndexerConfig{
		BatchSize:       500,
		RefreshInterval: "3s",
		Replicas:        0,
		Shards:          1,
		FullTextField:   "title",
		Fields:          []string{"title", "severity", "status", "source", "message", "created_at", "updated_at"},
	}
}

func (a *AlertIndexer) Reindex(ctx context.Context) error {
	mapping := map[string]interface{}{
		"properties": map[string]interface{}{
			"id":       map[string]string{"type": "keyword"},
			"title":    map[string]string{"type": "text"},
			"severity": map[string]string{"type": "keyword"},
			"status":   map[string]string{"type": "keyword"},
			"source":   map[string]string{"type": "keyword"},
			"message":  map[string]string{"type": "text"},
			"body":     map[string]string{"type": "text"},
			"fields":   map[string]string{"type": "object", "enabled": "true"},
			"created_at":  map[string]string{"type": "date"},
			"updated_at":  map[string]string{"type": "date"},
		},
	}
	if err := a.client.CreateIndex(ctx, a.indexName, mapping); err != nil {
		return err
	}
	if a.fetcher == nil {
		return nil
	}

	batchSize := a.Config().BatchSize
	offset := 0
	for {
		alerts, err := a.fetcher(ctx, offset, batchSize)
		if err != nil {
			return err
		}
		if len(alerts) == 0 {
			break
		}

		docs := make([]map[string]interface{}, 0, len(alerts))
		for _, al := range alerts {
			doc := map[string]interface{}{
				"id":       al.ID,
				"title":    al.Title,
				"severity": al.Severity,
				"status":   al.Status,
				"source":   al.Source,
				"message":  al.Message,
				"created_at": al.CreatedAt,
				"updated_at": al.UpdatedAt,
				"body":     al.Title + " " + al.Message,
				"fields": map[string]interface{}{
					"severity": al.Severity,
					"status":   al.Status,
					"source":   al.Source,
				},
			}
			docs = append(docs, doc)
		}
		if _, err := a.client.BulkIndex(ctx, a.indexName, docs); err != nil {
			return err
		}
		offset += batchSize
	}
	return nil
}

func (a *AlertIndexer) DeleteIndex(ctx context.Context) error {
	return a.client.DeleteIndex(ctx, a.indexName)
}

func (a *AlertIndexer) Documents(ctx context.Context, offset, limit int) ([]*interfaces.Document, int, error) {
	if a.fetcher == nil {
		return nil, 0, nil
	}
	alerts, err := a.fetcher(ctx, offset, limit)
	if err != nil {
		return nil, 0, err
	}
	docs := make([]*interfaces.Document, 0, len(alerts))
	for _, al := range alerts {
		docs = append(docs, &interfaces.Document{
			ID:      al.ID,
			Type:    al.Severity,
			Title:   al.Title,
			Body:    al.Title + " " + al.Message,
			CreatedAt: al.CreatedAt,
			UpdatedAt: al.UpdatedAt,
			Fields: map[string]interface{}{
				"severity": al.Severity,
				"status":   al.Status,
				"source":   al.Source,
			},
		})
	}
	return docs, offset+len(alerts), nil
}

func (a *AlertIndexer) Count(ctx context.Context) (int64, error) {
	exists, err := a.client.Exists(ctx, a.indexName)
	if err != nil {
		return 0, err
	}
	if !exists {
		return 0, nil
	}
	return a.client.Count(ctx, a.indexName)
}
