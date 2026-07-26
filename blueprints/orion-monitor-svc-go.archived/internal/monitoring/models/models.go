package models

// PrometheusQueryRequest for instant query.
type PrometheusQueryRequest struct {
	Query string `json:"query" binding:"required"`
	Time  string `json:"time"`
}

// PrometheusRangeQueryRequest for range query.
type PrometheusRangeQueryRequest struct {
	Query string `json:"query" binding:"required"`
	Start string `json:"start" binding:"required"`
	End   string `json:"end" binding:"required"`
	Step  string `json:"step"`
}

// PrometheusResponse wraps Prometheus API responses.
type PrometheusResponse struct {
	Status  string      `json:"status"`
	Data    interface{} `json:"data"`
	Error   string      `json:"error,omitempty"`
	Errors  []string    `json:"errors,omitempty"`
}

// PredefinedMetric represents a predefined metric shortcut.
type PredefinedMetric struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	PromQL      string `json:"promql"`
}
