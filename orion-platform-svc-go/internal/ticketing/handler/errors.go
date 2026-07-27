package handler

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// respondError maps legacy error responses to canonical error envelopes.
// For known business errors or bad-request errors the original message is
// preserved; internal errors are masked to avoid leaking details.
func respondError(c *gin.Context, status int, err error) {
	msg := err.Error()
	// Only leak validation/binding errors (client input issues)
	if status == http.StatusBadRequest {
		respondBadRequest(c, msg)
		return
	}
	// For not-found errors, return the requested status
	if status == http.StatusNotFound {
		respondNotFound(c, msg)
		return
	}
	// For known business errors, return them
	if isBusinessError(msg) {
		respondBadRequest(c, msg)
		return
	}
	// For internal errors, return generic message
	respondInternalError(c, "internal server error")
}

// isBusinessError checks if the error is a known business/domain error safe to expose
func isBusinessError(msg string) bool {
	businessErrors := []string{
		"not found",
		"already exists",
		"invalid relation type",
		"invalid suspend reason",
		"cannot activate",
		"cannot end",
		"cannot cancel",
		"invalid transition",
		"need at least",
		"engineer not currently suspended",
		"relation already exists",
		"rule not found",
	}
	lower := strings.ToLower(msg)
	for _, be := range businessErrors {
		if strings.Contains(lower, be) {
			return true
		}
	}
	return false
}
