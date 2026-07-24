package models

// TrendEntry represents a single data point in a pipeline run history trend.
type TrendEntry struct {
	Date        string   `json:"date"`
	Total       int      `json:"total"`
	Succeeded   int      `json:"succeeded"`
	Failed      int      `json:"failed"`
	Cancelled   int      `json:"cancelled"`
	AvgDuration *float64 `json:"avgDuration,omitempty"`
}

// TrendResponse is the API response for a single pipeline trend query.
type TrendResponse struct {
	Data        []TrendEntry `json:"data"`
	PipelineID  string       `json:"pipelineId"`
	Period      string       `json:"period"`
	Granularity string       `json:"granularity"`
	Total       int          `json:"total"`
}

// CompareRequest represents a request to compare multiple pipeline run histories.
type CompareRequest struct {
	PipelineIDs []string `json:"pipelineIds" binding:"required"`
	Period      string   `json:"period"`
	Granularity string   `json:"granularity"`
}

// CompareResponse is the API response for a cross-pipeline comparison query.
type CompareResponse struct {
	Data          map[string][]TrendEntry `json:"data"`
	Period        string                  `json:"period"`
	Granularity   string                  `json:"granularity"`
	PipelineCount int                     `json:"pipelineCount"`
}
