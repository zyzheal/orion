package cluster

import "errors"

type ClusterError struct { Code string; Message string; Cause error }

func (e *ClusterError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *ClusterError) Is(target error) bool { _, ok := target.(*ClusterError); return ok }
func (e *ClusterError) Unwrap() error { return e.Cause }

var (
    ErrClusterNotFound     = &ClusterError{Code: "cluster_not_found", Message: "cluster: not found"}
    ErrClusterInvalidInput = &ClusterError{Code: "cluster_invalid_input", Message: "cluster: invalid input"}
    ErrClusterConflict     = &ClusterError{Code: "cluster_conflict", Message: "cluster: conflict"}
    ErrClusterUnauthorized = &ClusterError{Code: "cluster_unauthorized", Message: "cluster: unauthorized"}
    ErrClusterInternal     = &ClusterError{Code: "cluster_internal", Message: "cluster: internal error"}
)

func NewClusterError(code, msg string) error { return &ClusterError{Code: code, Message: msg} }
func IsClusterNotFound(err error) bool { return errors.Is(err, ErrClusterNotFound) }
