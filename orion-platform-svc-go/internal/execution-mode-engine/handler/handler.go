package handler

import (
	"net/http"
)

type ExecutionModeHandler struct{}

func NewExecutionModeHandler() *ExecutionModeHandler {
	return &ExecutionModeHandler{}
}

func (h *ExecutionModeHandler) List(c interface{}) {
	_ = http.StatusOK
}
