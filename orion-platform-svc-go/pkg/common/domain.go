package common

import (
	"fmt"
	"strings"
)

// DomainError represents a typed domain error for any module.
type DomainError struct {
	Code    string
	Message string
	Cause   error
}

func (e *DomainError) Error() string {
	if e == nil {
		return ""
	}
	if e.Cause != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Cause)
	}
	return e.Message
}

func (e *DomainError) Is(target error) bool {
	_, ok := target.(*DomainError)
	return ok
}

func (e *DomainError) Unwrap() error { return e.Cause }

func NewDomainError(code, msg string) error {
	return &DomainError{Code: code, Message: msg}
}

// DomainValidator provides common validation rules for domain entities.
type DomainValidator struct {
	MaxNameLength int
	MaxDescLength int
}

func DefaultDomainValidator() *DomainValidator {
	return &DomainValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *DomainValidator) ValidateName(name string) error {
	if strings.TrimSpace(name) == "" {
		return NewDomainError("invalid_input", "name is required")
	}
	if len(name) > v.MaxNameLength {
		return fmt.Errorf("name too long")
	}
	if strings.ContainsAny(name, "<>") {
		return fmt.Errorf("invalid name")
	}
	return nil
}

func (v *DomainValidator) ValidateDescription(desc string) error {
	if len(desc) > v.MaxDescLength {
		return fmt.Errorf("description too long")
	}
	return nil
}

func (v *DomainValidator) ValidateType(typ string) error {
	if typ == "" {
		return NewDomainError("invalid_input", "type is required")
	}
	return nil
}

func (v *DomainValidator) ValidateID(id string) error {
	if strings.TrimSpace(id) == "" {
		return NewDomainError("invalid_input", "id is required")
	}
	return nil
}

func (v *DomainValidator) Validate(name, desc, typ, id string) *ValidationResult {
	r := &ValidationResult{}
	for _, err := range []error{
		v.ValidateName(name), v.ValidateDescription(desc),
		v.ValidateType(typ), v.ValidateID(id),
	} {
		if err != nil {
			r.Errors = append(r.Errors, err.Error())
		}
	}
	r.Valid = len(r.Errors) == 0
	return r
}

type ValidationResult struct {
	Valid  bool
	Errors []string
}

// DomainMetrics provides basic in-memory metrics for any module.
type DomainMetrics struct {
	counters map[string]int64
	gauges   map[string]float64
	observed map[string]float64
}

func NewDomainMetrics() *DomainMetrics {
	return &DomainMetrics{
		counters: make(map[string]int64),
		gauges:   make(map[string]float64),
		observed: make(map[string]float64),
	}
}

func (m *DomainMetrics) Incr(counter string) { m.counters[counter]++ }

func (m *DomainMetrics) Decr(counter string) { m.counters[counter]-- }

func (m *DomainMetrics) SetGauge(name string, value float64) { m.gauges[name] = value }

func (m *DomainMetrics) Observe(name string, value float64) { m.observed[name] = value }

func (m *DomainMetrics) GetCounter(name string) int64 { return m.counters[name] }

func (m *DomainMetrics) GetGauge(name string) float64 { return m.gauges[name] }

func (m *DomainMetrics) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"counters": m.counters,
		"gauges":   m.gauges,
	}
}

func (m *DomainMetrics) Reset() {
	m.counters = make(map[string]int64)
	m.gauges = make(map[string]float64)
	m.observed = make(map[string]float64)
}