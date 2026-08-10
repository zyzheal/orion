package topology

import "errors"

type TopologyError struct { Code string; Message string; Cause error }

func (e *TopologyError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *TopologyError) Is(target error) bool { _, ok := target.(*TopologyError); return ok }
func (e *TopologyError) Unwrap() error { return e.Cause }

var (
    ErrTopologyNotFound     = &TopologyError{Code: "topology_not_found", Message: "topology: not found"}
    ErrTopologyInvalidInput = &TopologyError{Code: "topology_invalid_input", Message: "topology: invalid input"}
    ErrTopologyConflict     = &TopologyError{Code: "topology_conflict", Message: "topology: conflict"}
    ErrTopologyUnauthorized = &TopologyError{Code: "topology_unauthorized", Message: "topology: unauthorized"}
    ErrTopologyInternal     = &TopologyError{Code: "topology_internal", Message: "topology: internal error"}
)

func NewTopologyError(code, msg string) error { return &TopologyError{Code: code, Message: msg} }
func IsTopologyNotFound(err error) bool { return errors.Is(err, ErrTopologyNotFound) }
