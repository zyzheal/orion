// Package interfaces defines the SPI (Service Provider Interface) for per-module
// search indexers. Each module (ticket, alert, cmdb, etc.) registers its own
// SearchIndexer implementation with the global search registry.
package interfaces

import (
	"context"
)

// SearchIndexer is the per-module SPI that any Orion module implements to
// expose its documents for global full-text search.
//
// Design:
//  - Module() identifies the data domain (e.g. "ticket", "alert", "cmdb").
//  - IndexName() returns the Elasticsearch index name for this module.
//  - Reindex() rebuilds the entire index from source data.
//  - DeleteIndex() removes the module's search index.
//  - Documents() returns the module's indexed documents (paginated) so the
//    SearchService can batch them into Elasticsearch.
//  - Config() returns module-specific indexing configuration.
type SearchIndexer interface {
	// Module returns the unique module identifier (e.g. "ticket").
	Module() string

	// IndexName returns the Elasticsearch index name (e.g. "ticket_v1").
	IndexName() string

	// Reindex rebuilds the module's index from source data.
	// Should be safe to call concurrently (idempotent).
	Reindex(ctx context.Context) error

	// DeleteIndex removes the module's index.
	DeleteIndex(ctx context.Context) error

	// Documents returns paginated source documents for this module.
	// offset/limit define the page; returns (docs, nextOffset, err).
	// The caller (SearchService) uses this to batch-index documents into ES.
	Documents(ctx context.Context, offset, limit int) ([]*Document, int, error)

	// Count returns the total number of indexable documents.
	Count(ctx context.Context) (int64, error)

	// Config returns the module's indexing configuration.
	Config() IndexerConfig
}

// IndexerConfig holds module-specific configuration for indexing.
type IndexerConfig struct {
	// BatchSize is the number of documents to send to ES per bulk request.
	BatchSize int
	// RefreshInterval is how often ES should refresh this index (e.g. "5s").
	RefreshInterval string
	// Replicas is the number of replica shards.
	Replicas int
	// Shards is the number of primary shards.
	Shards int
	// Fields lists the field names that should be indexed (empty = all).
	Fields []string
	// FullTextField is the primary field for full-text search (e.g. "title").
	FullTextField string
}

// Document is a single record extracted from a module for indexing.
type Document struct {
	// ID is the unique document identifier (e.g. "ticket-123").
	ID string
	// Type is the document subtype within the module (e.g. "bug", "incident").
	Type string
	// Title is the human-readable title.
	Title string
	// Body is the long-form text content for full-text search.
	Body string
	// Fields contains all indexed structured fields.
	Fields map[string]interface{}
	// CreatedAt is the document creation time.
	CreatedAt interface{} // time.Time or string
	// UpdatedAt is the document last-updated time.
	UpdatedAt interface{} // time.Time or string
}
