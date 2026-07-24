package modules

import (
	"context"

	"orion/platform-svc-go/internal/global-search/elasticsearch"
	"orion/platform-svc-go/internal/global-search/interfaces"
)

// CmdbIndexer indexes CMDB CI (Configuration Item) documents.
type CmdbIndexer struct {
	indexName string
	client    *elasticsearch.Client
	fetcher   CmdbFetchFunc
}

// CI represents a CMDB Configuration Item for indexing.
type CI struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	CiType      string            `json:"ci_type"`
	Hostname    string            `json:"hostname"`
	IP          string            `json:"ip"`
	Attributes  map[string]string `json:"attributes"`
	CreatedAt   string            `json:"created_at"`
	UpdatedAt   string            `json:"updated_at"`
}

// CmdbFetchFunc returns CIs in a paginated batch.
type CmdbFetchFunc func(ctx context.Context, offset, limit int) ([]*CI, error)

// NewCmdbIndexer creates a new CmdbIndexer.
func NewCmdbIndexer(indexName string, client *elasticsearch.Client, fetcher CmdbFetchFunc) *CmdbIndexer {
	return &CmdbIndexer{
		indexName: indexName,
		client:    client,
		fetcher:   fetcher,
	}
}

func (c *CmdbIndexer) Module() string {
	return "cmdb"
}

func (c *CmdbIndexer) IndexName() string {
	return c.indexName
}

func (c *CmdbIndexer) Config() interfaces.IndexerConfig {
	return interfaces.IndexerConfig{
		BatchSize:       500,
		RefreshInterval: "30s",
		Replicas:        0,
		Shards:          1,
		FullTextField:   "name",
		Fields:          []string{"name", "ci_type", "hostname", "ip", "attributes", "created_at", "updated_at"},
	}
}

func (c *CmdbIndexer) Reindex(ctx context.Context) error {
	mapping := map[string]interface{}{
		"properties": map[string]interface{}{
			"id":         map[string]string{"type": "keyword"},
			"name":       map[string]string{"type": "text"},
			"ci_type":    map[string]string{"type": "keyword"},
			"hostname":   map[string]string{"type": "keyword"},
			"ip":         map[string]string{"type": "keyword"},
			"attributes": map[string]string{"type": "object", "enabled": "true"},
			"body":       map[string]string{"type": "text"},
			"fields":     map[string]string{"type": "object", "enabled": "true"},
			"created_at":  map[string]string{"type": "date"},
			"updated_at":  map[string]string{"type": "date"},
		},
	}
	if err := c.client.CreateIndex(ctx, c.indexName, mapping); err != nil {
		return err
	}
	if c.fetcher == nil {
		return nil
	}

	batchSize := c.Config().BatchSize
	offset := 0
	for {
		cis, err := c.fetcher(ctx, offset, batchSize)
		if err != nil {
			return err
		}
		if len(cis) == 0 {
			break
		}

		docs := make([]map[string]interface{}, 0, len(cis))
		for _, ci := range cis {
			attrs := make(map[string]interface{}, len(ci.Attributes))
			for k, v := range ci.Attributes {
				attrs[k] = v
			}
			// Build searchable body from all fields
			body := ci.Name + " " + ci.Hostname + " " + ci.IP + " " + ci.CiType
			for _, v := range ci.Attributes {
				body += " " + v
			}
			doc := map[string]interface{}{
				"id":         ci.ID,
				"name":       ci.Name,
				"ci_type":    ci.CiType,
				"hostname":   ci.Hostname,
				"ip":         ci.IP,
				"attributes": attrs,
				"body":       body,
				"created_at": ci.CreatedAt,
				"updated_at": ci.UpdatedAt,
				"fields": map[string]interface{}{
					"ci_type": ci.CiType,
					"hostname": ci.Hostname,
					"ip":      ci.IP,
					"attributes": attrs,
				},
			}
			docs = append(docs, doc)
		}
		if _, err := c.client.BulkIndex(ctx, c.indexName, docs); err != nil {
			return err
		}
		offset += batchSize
	}
	return nil
}

func (c *CmdbIndexer) DeleteIndex(ctx context.Context) error {
	return c.client.DeleteIndex(ctx, c.indexName)
}

func (c *CmdbIndexer) Documents(ctx context.Context, offset, limit int) ([]*interfaces.Document, int, error) {
	if c.fetcher == nil {
		return nil, 0, nil
	}
	cis, err := c.fetcher(ctx, offset, limit)
	if err != nil {
		return nil, 0, err
	}
	docs := make([]*interfaces.Document, 0, len(cis))
	for _, ci := range cis {
		body := ci.Name + " " + ci.Hostname + " " + ci.IP + " " + ci.CiType
		docs = append(docs, &interfaces.Document{
			ID:      ci.ID,
			Type:    ci.CiType,
			Title:   ci.Name,
			Body:    body,
			CreatedAt: ci.CreatedAt,
			UpdatedAt: ci.UpdatedAt,
			Fields: map[string]interface{}{
				"ci_type":  ci.CiType,
				"hostname": ci.Hostname,
				"ip":       ci.IP,
			},
		})
	}
	return docs, offset+len(cis), nil
}

func (c *CmdbIndexer) Count(ctx context.Context) (int64, error) {
	exists, err := c.client.Exists(ctx, c.indexName)
	if err != nil {
		return 0, err
	}
	if !exists {
		return 0, nil
	}
	return c.client.Count(ctx, c.indexName)
}
