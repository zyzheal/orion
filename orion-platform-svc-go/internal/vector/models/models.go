package models

import "time"

type VectorStore struct {
	ID         string    `db:"id" json:"id"`
	TenantID   string    `db:"tenant_id" json:"tenant_id"`
	Name       string    `db:"name" json:"name"`
	Dimensions int       `db:"dimensions" json:"dimensions"`
	Metric     string    `db:"metric" json:"metric"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
	UpdatedAt  time.Time `db:"updated_at" json:"updated_at"`
}

type VectorItem struct {
	ID        string                 `db:"id" json:"id"`
	StoreID   string                 `db:"store_id" json:"store_id"`
	Vector    string                 `db:"vector" json:"vector"`  // JSON array of float64
	Metadata  string                 `db:"metadata" json:"metadata"` // JSON map
	CreatedAt time.Time              `db:"created_at" json:"created_at"`
}

type SearchQuery struct {
	Vector []float64 `json:"vector"`
	Limit  int       `json:"limit"`
}

type SearchResult struct {
	ItemID   string  `json:"item_id"`
	Distance float64 `json:"distance"`
}

type CreateStoreRequest struct {
	Name       string `json:"name" binding:"required"`
	Dimensions int    `json:"dimensions"`
	Metric     string `json:"metric"`
}

type UpsertVectorsRequest struct {
	Vector   []float64        `json:"vector" binding:"required"`
	Metadata map[string]string `json:"metadata"`
}
