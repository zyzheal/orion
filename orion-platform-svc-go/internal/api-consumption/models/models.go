package models

import (
	"time"
)

// Consumption represents an API consumption record.
type Consumption struct {
	ID               string    `json:"id" db:"id"`
	TenantID         string    `json:"tenantId" db:"tenant_id"`
	APIKeyID         string    `json:"apiKeyId" db:"api_key_id"`
	EndpointPath     string    `json:"endpointPath" db:"endpoint_path"`
	Method           string    `json:"method" db:"method"`
	RequestCount     int       `json:"requestCount" db:"request_count"`
	ErrorCount       int       `json:"errorCount" db:"error_count"`
	BytesTransferred int64     `json:"bytesTransferred" db:"bytes_transferred"`
	Date             string    `json:"date" db:"date"`
	CreatedAt        time.Time `json:"createdAt" db:"created_at"`
}

// CreateConsumptionRequest is the request body for creating a consumption record.
type CreateConsumptionRequest struct {
	APIKeyID         string `json:"apiKeyId" binding:"required"`
	EndpointPath     string `json:"endpointPath" binding:"required"`
	Method           string `json:"method" binding:"required"`
	RequestCount     int    `json:"requestCount"`
	ErrorCount       int    `json:"errorCount"`
	BytesTransferred int64  `json:"bytesTransferred"`
	Date             string `json:"date" binding:"required"`
}

// Limit represents an API usage limit.
type Limit struct {
	ID           string    `json:"id" db:"id"`
	TenantID     string    `json:"tenantId" db:"tenant_id"`
	APIKeyID     string    `json:"apiKeyId" db:"api_key_id"`
	EndpointPath *string   `json:"endpointPath" db:"endpoint_path"`
	Method       *string   `json:"method" db:"method"`
	LimitCount   int       `json:"limitCount" db:"limit_count"`
	Period       string    `json:"period" db:"period"`
	LimitAmount  *int64    `json:"limitAmount" db:"limit_amount"`
	LimitBytes   *int64    `json:"limitBytes" db:"limit_bytes"`
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
}

// CreateLimitRequest is the request body for creating a usage limit.
type CreateLimitRequest struct {
	APIKeyID     string  `json:"apiKeyId" binding:"required"`
	EndpointPath *string `json:"endpointPath"`
	Method       *string `json:"method"`
	LimitCount   int     `json:"limitCount" binding:"required"`
	Period       string  `json:"period" binding:"required"`
	LimitAmount  *int64  `json:"limitAmount"`
	LimitBytes   *int64  `json:"limitBytes"`
}

// UpdateLimitRequest is the request body for updating a usage limit.
type UpdateLimitRequest struct {
	EndpointPath *string `json:"endpointPath"`
	Method       *string `json:"method"`
	LimitCount   *int    `json:"limitCount"`
	Period       *string `json:"period"`
	LimitAmount  *int64  `json:"limitAmount"`
	LimitBytes   *int64  `json:"limitBytes"`
}

// ConsumptionFilter represents filter parameters for listing consumptions.
type ConsumptionFilter struct {
	APIKeyID     *string
	EndpointPath *string
	Method       *string
	DateFrom     *string
	DateTo       *string
	Limit        int
	Offset       int
}

// ConsumptionStats holds aggregated consumption statistics.
type ConsumptionStats struct {
	TotalRequests int64   `json:"totalRequests"`
	TotalErrors   int64   `json:"totalErrors"`
	TotalBytes    int64   `json:"totalBytes"`
	ErrorRate     float64 `json:"errorRate"`
	TopEndpoint   *string `json:"topEndpoint"`
	TopAPIKeyID   *string `json:"topKeyId"`
}
