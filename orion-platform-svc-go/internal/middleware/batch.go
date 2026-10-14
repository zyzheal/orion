// Package middleware provides HTTP middleware and shared response types
// for the Orion platform. This file contains batch operation response types
// used by domain handlers that support bulk create/update/delete.
package middleware

import "github.com/gin-gonic/gin"

// BatchItemResult represents the outcome of processing a single item
// within a batch operation. The Index field corresponds to the position
// of the item in the original request array.
type BatchItemResult struct {
	Index  int    `json:"index"`
	OK     bool   `json:"ok"`
	ID     string `json:"id,omitempty"`
	Error  string `json:"error,omitempty"`
}

// BatchResponse is the standard response for batch operations. It uses
// HTTP 207 Multi-Status semantics: the overall request succeeds (207)
// even if individual items fail. Clients inspect per-item results.
type BatchResponse struct {
	Total      int                `json:"total"`
	Succeeded  int                `json:"succeeded"`
	Failed     int                `json:"failed"`
	Results    []BatchItemResult  `json:"results"`
}

// RespondBatch sends a 207 Multi-Status response with per-item results.
func RespondBatch(c *gin.Context, resp *BatchResponse) {
	c.JSON(207, resp)
}

// RespondBatchAllOK sends a 200 response when all items succeeded.
func RespondBatchAllOK(c *gin.Context, results []BatchItemResult) {
	c.JSON(200, &BatchResponse{
		Total:     len(results),
		Succeeded: len(results),
		Failed:    0,
		Results:   results,
	})
}
