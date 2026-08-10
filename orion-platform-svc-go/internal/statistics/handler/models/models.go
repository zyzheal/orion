package models

type StatMetricRequest struct {
        Name    string            `json:"name" binding:"required"`
        Value   float64           `json:"value"`
        Unit    string            `json:"unit"`
        Tags    map[string]string `json:"tags"`
}

type AggregateRequest struct {
        Name      string            `json:"name" binding:"required"`
        Tags      map[string]string `json:"tags"`
        Window    string            `json:"window"`
        Unit      string            `json:"unit"`
}

type AggregationResultResponse struct {
	Name    string            `json:"name"`
	Count   int               `json:"count"`
	Sum     float64           `json:"sum"`
	Avg     float64           `json:"avg"`
	Min     float64           `json:"min"`
	Max     float64           `json:"max"`
	Tags    map[string]string `json:"tags"`
	Unit    string            `json:"unit"`
}

type ProcessorStats struct {
        MetricCount  int `json:"metric_count"`
        SeriesCount  int `json:"series_count"`
}
