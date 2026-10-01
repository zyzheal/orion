// Package util provides pagination and general utility helpers.
package util

import (
	"encoding/base64"
	"fmt"
	"time"
)

// PaginationConfig controls pagination limits.
type PaginationConfig struct {
	MaxLimit     int
	DefaultLimit int
	MinLimit     int
}

// DefaultPaginationConfig returns sensible defaults.
func DefaultPaginationConfig() PaginationConfig {
	return PaginationConfig{MaxLimit: 100, DefaultLimit: 20, MinLimit: 1}
}

// OffsetParams holds parsed offset pagination parameters.
type OffsetParams struct {
	Limit  int
	Offset int
	Sort   string
	Order  string // "asc" or "desc"
}

// CursorParams holds parsed cursor pagination parameters.
type CursorParams struct {
	Limit     int
	Cursor    string
	Direction string // "next" or "previous"
}

// OffsetMeta holds offset pagination metadata.
type OffsetMeta struct {
	Type    string `json:"type"`
	Total   int    `json:"total"`
	Limit   int    `json:"limit"`
	Offset  int    `json:"offset"`
	HasMore bool   `json:"hasMore"`
}

// CursorMeta holds cursor pagination metadata.
type CursorMeta struct {
	Type   string           `json:"type"`
	Limit  int             `json:"limit"`
	Cursor CursorMetaValues `json:"cursor"`
	HasMore bool           `json:"hasMore"`
}

// CursorMetaValues holds the cursor values.
type CursorMetaValues struct {
	Current string `json:"current,omitempty"`
	Next    string `json:"next,omitempty"`
	Previous string `json:"previous,omitempty"`
}

// PaginationResponse is the unified response wrapper.
type PaginationResponse struct {
	Data       interface{}    `json:"data"`
	Pagination interface{}    `json:"pagination"`
	Meta       PaginationResMeta `json:"meta"`
}

// PaginationResMeta is response metadata.
type PaginationResMeta struct {
	RequestID string `json:"requestId,omitempty"`
	Timestamp string `json:"timestamp"`
}

// OffsetPaginator handles offset-based pagination.
type OffsetPaginator struct {
	config PaginationConfig
}

// NewOffsetPaginator creates an offset paginator with the given config.
func NewOffsetPaginator(cfg PaginationConfig) *OffsetPaginator {
	if cfg.MaxLimit == 0 {
		cfg = DefaultPaginationConfig()
	}
	return &OffsetPaginator{config: cfg}
}

// ParseParams parses and validates offset pagination parameters.
func (p *OffsetPaginator) ParseParams(limit, offset int, sort, order string) OffsetParams {
	if limit == 0 {
		limit = p.config.DefaultLimit
	}
	if limit < p.config.MinLimit {
		limit = p.config.MinLimit
	}
	if limit > p.config.MaxLimit {
		limit = p.config.MaxLimit
	}
	if offset < 0 {
		offset = 0
	}
	if sort == "" {
		sort = "createdAt"
	}
	if order == "" {
		order = "desc"
	}
	return OffsetParams{Limit: limit, Offset: offset, Sort: sort, Order: order}
}

// CreateResponse builds an offset pagination response.
func (p *OffsetPaginator) CreateResponse(data interface{}, total int, params OffsetParams, requestID string) PaginationResponse {
	hasMore := params.Offset+len(toInterfaceSlice(data)) < total
	return PaginationResponse{
		Data: data,
		Pagination: OffsetMeta{
			Type: "offset", Total: total, Limit: params.Limit,
			Offset: params.Offset, HasMore: hasMore,
		},
		Meta: PaginationResMeta{
			RequestID: requestID,
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		},
	}
}

// GetTotalPages calculates total pages.
func (p *OffsetPaginator) GetTotalPages(total, limit int) int {
	if limit == 0 {
		return 0
	}
	return (total + limit - 1) / limit
}

// HasPreviousPage returns true if offset > 0.
func (p *OffsetPaginator) HasPreviousPage(offset int) bool {
	return offset > 0
}

// HasNextPage returns true if there are more items.
func (p *OffsetPaginator) HasNextPage(offset, limit, total int) bool {
	return offset+limit < total
}

// CursorPaginator handles cursor-based pagination.
type CursorPaginator struct {
	config PaginationConfig
}

// NewCursorPaginator creates a cursor paginator with the given config.
func NewCursorPaginator(cfg PaginationConfig) *CursorPaginator {
	if cfg.MaxLimit == 0 {
		cfg = DefaultPaginationConfig()
	}
	return &CursorPaginator{config: cfg}
}

// ParseParams parses and validates cursor pagination parameters.
func (p *CursorPaginator) ParseParams(limit int, cursor, direction string) CursorParams {
	if limit == 0 {
		limit = p.config.DefaultLimit
	}
	if limit < p.config.MinLimit {
		limit = p.config.MinLimit
	}
	if limit > p.config.MaxLimit {
		limit = p.config.MaxLimit
	}
	if direction == "" {
		direction = "next"
	}
	return CursorParams{Limit: limit, Cursor: cursor, Direction: direction}
}

// CreateResponse builds a cursor pagination response from a data slice.
// idField is the key to extract from each item for cursor encoding.
func (p *CursorPaginator) CreateResponse(data []map[string]interface{}, params CursorParams, idField string, requestID string) PaginationResponse {
	var current, next, prev string

	if params.Cursor != "" {
		current = params.Cursor
	} else if len(data) > 0 {
		if id, ok := data[0][idField].(string); ok {
			current = p.EncodeCursor(id)
		}
	}

	if len(data) > 0 {
		if id, ok := data[len(data)-1][idField].(string); ok {
			next = p.EncodeCursor(id)
		}
		if id, ok := data[0][idField].(string); ok {
			prev = p.EncodeCursor(id)
		}
	}

	hasMore := len(data) >= params.Limit
	nextCursor := ""
	if hasMore {
		nextCursor = next
	}

	return PaginationResponse{
		Data: data,
		Pagination: CursorMeta{
			Type: "cursor", Limit: params.Limit,
			Cursor: CursorMetaValues{
				Current: current, Next: nextCursor, Previous: prev,
			},
			HasMore: hasMore,
		},
		Meta: PaginationResMeta{
			RequestID: requestID,
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		},
	}
}

// EncodeCursor base64-encodes a cursor value.
func (p *CursorPaginator) EncodeCursor(value string) string {
	return base64.StdEncoding.EncodeToString([]byte(value))
}

// DecodeCursor decodes a base64 cursor.
func (p *CursorPaginator) DecodeCursor(cursor string) (string, error) {
	if cursor == "" {
		return "", fmt.Errorf("invalid cursor: empty")
	}
	decoded, err := base64.StdEncoding.DecodeString(cursor)
	if err != nil {
		return "", fmt.Errorf("invalid cursor: %w", err)
	}
	if len(decoded) == 0 {
		return "", fmt.Errorf("invalid cursor: decoded empty")
	}
	return string(decoded), nil
}

// ApplyOffsetPagination slices a slice for offset pagination.
func ApplyOffsetPagination(items []interface{}, offset, limit int) []interface{} {
	if offset >= len(items) {
		return []interface{}{}
	}
	end := offset + limit
	if end > len(items) {
		end = len(items)
	}
	return items[offset:end]
}

// toInterfaceSlice converts a generic slice to []interface{} for length counting.
func toInterfaceSlice(data interface{}) []interface{} {
	switch v := data.(type) {
	case []interface{}:
		return v
	case nil:
		return nil
	default:
		return []interface{}{v}
	}
}
