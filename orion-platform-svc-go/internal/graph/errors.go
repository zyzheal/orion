package graph

import "errors"

// GraphError represents domain errors for the graph module.
type GraphError struct {
    Code    string
    Message string
    Cause   error
}

func (e *GraphError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *GraphError) Is(target error) bool {
    _, ok := target.(*GraphError)
    return ok
}

func (e *GraphError) Unwrap() error {
    return e.Cause
}

var (
    ErrGraphNotFound     = &GraphError{Code: "graph_not_found", Message: "graph: resource not found"}
    ErrGraphInvalidInput = &GraphError{Code: "graph_invalid_input", Message: "graph: invalid input"}
    ErrGraphConflict     = &GraphError{Code: "graph_conflict", Message: "graph: resource conflict"}
    ErrGraphUnauthorized = &GraphError{Code: "graph_unauthorized", Message: "graph: unauthorized access"}
    ErrGraphInternal     = &GraphError{Code: "graph_internal", Message: "graph: internal error"}
)

func NewGraphError(code, message string) error {
    return &GraphError{Code: code, Message: message}
}

func IsGraphNotFound(err error) bool {
    return errors.Is(err, ErrGraphNotFound)
}
