package handler

import (
	"net/http"
	"strings"

	"orion/go-common/pkg/errors"

	"github.com/gin-gonic/gin"
)

// respondError returns a safe error response without leaking internal details.
// For validation errors (from ShouldBindJSON), the raw error is acceptable.
// For internal errors, a generic message is returned.
func respondError(c *gin.Context, status int, err error) {
	msg := err.Error()
	// Only leak validation/binding errors (client input issues)
	if status == http.StatusBadRequest {
		errors.WriteError(c, errors.ErrInternal, msg, status)
		return
	}
	// For known business errors, return them
	if isBusinessError(msg) {
		errors.WriteError(c, errors.ErrInternal, msg, status)
		return
	}
	// For internal errors, return generic message
	errors.WriteError(c, errors.ErrInternal, "internal server error", http.StatusInternalServerError)
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
