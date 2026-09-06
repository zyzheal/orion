package approval

import (
	"strconv"
)

// LoadConfig parses environment-style configuration into a Config.
// The parameters accept empty strings for any/all keys, in which case
// Defaults() values are used. This keeps wiring code simple: pass env
// vars directly without pre-validating.
//
// Recognised keys:
//   DBA_APPROVAL_DEFAULT_TIMEOUT_HOURS
//   DBA_APPROVAL_DEFAULT_TIMEOUT_ACTION
//   DBA_APPROVAL_MAX_STEPS
//   DBA_APPROVAL_MAX_APPROVERS
func LoadConfig(timeoutHours, timeoutAction, maxSteps, maxApprovers string) Config {
	c := Defaults()

	if v, err := strconv.Atoi(timeoutHours); err == nil && v > 0 {
		c.DefaultTimeoutHours = v
	}
	if timeoutAction != "" {
		switch timeoutAction {
		case TimeoutActionReject, TimeoutActionEscalate, TimeoutActionApprove:
			c.DefaultTimeoutAction = timeoutAction
		}
	}
	if v, err := strconv.Atoi(maxSteps); err == nil && v > 0 {
		c.MaxSteps = v
	}
	if v, err := strconv.Atoi(maxApprovers); err == nil && v > 0 {
		c.MaxApprovers = v
	}
	return c
}

// EffectiveDefaults applies Config defaults to a step definition,
// filling in zero-valued fields. Returns a shallow copy so callers can
// mutate the result without touching the original workflow.
func (c Config) EffectiveDefaults(def ApprovalStepDef) ApprovalStepDef {
	out := def
	if out.TimeoutHours <= 0 {
		out.TimeoutHours = c.DefaultTimeoutHours
	}
	if out.TimeoutAction == "" {
		out.TimeoutAction = c.DefaultTimeoutAction
	}
	if out.Mode == "" {
		out.Mode = ModeUnanimous
	}
	return out
}
