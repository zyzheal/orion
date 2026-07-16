package models

import "time"

// CircuitState represents the state of a circuit breaker.
// State machine: CLOSED → OPEN → HALF_OPEN → (CLOSED | OPEN)
type CircuitState string

const (
	StateClosed   CircuitState = "CLOSED"
	StateOpen     CircuitState = "OPEN"
	StateHalfOpen CircuitState = "HALF_OPEN"
)

// IsValid returns true if the state is a valid circuit breaker state.
func (s CircuitState) IsValid() bool {
	switch s {
	case StateClosed, StateOpen, StateHalfOpen:
		return true
	}
	return false
}

// CircuitBreaker represents a circuit-breaker record.
type CircuitBreaker struct {
	ID                string       `db:"id" json:"id"`
	TenantID          string       `db:"tenant_id" json:"tenantId"`
	Name              string       `db:"name" json:"name"`
	ServiceName       string       `db:"service_name" json:"serviceName"`
	FailureThreshold  int          `db:"failure_threshold" json:"failureThreshold"`
	SuccessThreshold  int          `db:"success_threshold" json:"successThreshold"`
	TimeoutSeconds    int          `db:"timeout_seconds" json:"timeoutSeconds"`
	State             CircuitState `db:"state" json:"state"`
	FailureCount      int          `db:"failure_count" json:"failureCount"`
	LastFailureAt     *time.Time   `db:"last_failure_at" json:"lastFailureAt,omitempty"`
	LastStateChangeAt time.Time    `db:"last_state_change_at" json:"lastStateChangeAt"`
	Metadata          string       `db:"metadata" json:"metadata"`
	Enabled           bool         `db:"enabled" json:"enabled"`
	CreatedAt         time.Time    `db:"created_at" json:"createdAt"`
	UpdatedAt         time.Time    `db:"updated_at" json:"updatedAt"`
}

// CreateRequest is the request body for creating a circuit-breaker entry.
type CreateRequest struct {
	Name             string      `json:"name" binding:"required"`
	ServiceName      string      `json:"serviceName"`
	FailureThreshold int         `json:"failureThreshold"`
	SuccessThreshold int         `json:"successThreshold"`
	TimeoutSeconds   int         `json:"timeoutSeconds"`
	Metadata         string      `json:"metadata"`
}

// UpdateRequest is the request body for updating a circuit-breaker entry.
type UpdateRequest struct {
	Name             *string     `json:"name"`
	ServiceName      *string     `json:"serviceName"`
	FailureThreshold *int        `json:"failureThreshold"`
	SuccessThreshold *int        `json:"successThreshold"`
	TimeoutSeconds   *int        `json:"timeoutSeconds"`
	State            *CircuitState `json:"state"`
	Enabled          *bool       `json:"enabled"`
	Metadata         *string     `json:"metadata"`
}

// SuccessRequest is the request body for recording a success.
type SuccessRequest struct {
	ResponseTimeMs int `json:"responseTimeMs"`
}

// FailureRequest is the request body for recording a failure.
type FailureRequest struct {
	ErrorMsg string `json:"errorMsg"`
}

// StateResponse is the response for the GET /:id/state endpoint.
type StateResponse struct {
	State            CircuitState `json:"state"`
	Proceed          bool         `json:"proceed"`
	Enabled          bool         `json:"enabled"`
	FailureCount     int          `json:"failureCount"`
	FailureThreshold int          `json:"failureThreshold"`
	Message          string       `json:"message"`
}

// CircuitEvent represents a state transition event.
type CircuitEvent struct {
	ID               string       `db:"id" json:"id"`
	CircuitBreakerID string       `db:"circuit_breaker_id" json:"circuitBreakerId"`
	TenantID         string       `db:"tenant_id" json:"tenantId"`
	PreviousState    CircuitState `db:"previous_state" json:"previousState"`
	NewState         CircuitState `db:"new_state" json:"newState"`
	Reason           string       `db:"reason" json:"reason"`
	Timestamp        time.Time    `db:"timestamp" json:"timestamp"`
}

// PaginatedResponse is a generic paginated response.
type PaginatedResponse struct {
	Data     interface{} `json:"data"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}

// OpenCircuitResponse is used in the list-open-circuits endpoint.
type OpenCircuitResponse struct {
	CircuitBreaker
	AgeSeconds int64 `json:"ageSeconds"`
}
