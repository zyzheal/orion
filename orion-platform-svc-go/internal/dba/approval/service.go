package approval

import (
	"context"
	"fmt"
	"time"
)

// OrderLookup is the minimal contract the approval service needs from
// the parent DBA service to validate that a submitted order actually
// exists before spinning up an approval chain. Returning nil for the
// status string is treated as "found with unknown status" — the
// service still proceeds. Returning err is treated as "not found or
// unreachable" and aborts the submit.
type OrderLookup interface {
	GetOrder(ctx context.Context, id string) (orderID string, status string, err error)
}

// Repo is the persistence contract for the approval module. Named
// Repo (rather than Repository) to avoid colliding with the concrete
// Repository struct declared in repository.go. Implemented by
// Repository (PostgreSQL) and by memRepo (tests).
type Repo interface {
	CreateWorkflow(ctx context.Context, w *ApprovalWorkflow) error
	GetWorkflow(ctx context.Context, id string) (*ApprovalWorkflow, error)
	ListWorkflows(ctx context.Context, tenantID string) ([]ApprovalWorkflow, error)

	CreateInstance(ctx context.Context, inst *ApprovalInstance) error
	GetInstance(ctx context.Context, id string) (*ApprovalInstance, error)
	UpdateInstance(ctx context.Context, inst *ApprovalInstance) (*ApprovalInstance, error)
	ListInstancesByOrder(ctx context.Context, orderID string) ([]ApprovalInstance, error)

	InsertRecord(ctx context.Context, rec *ApprovalRecord) error
}

// Service implements the business logic of multi-stage approvals.
// It owns the Config and Repository and depends on an OrderLookup
// to verify orders at submit time. All state transitions run through
// EvaluateStep so the DAG semantics are centralized.
type Service struct {
	repo  Repo
	cfg   Config
	now   func() time.Time
	orders OrderLookup
}

// ServiceOption mutates Service construction.
type ServiceOption func(*Service)

// WithClock overrides the clock used by the service. Used in tests
// to simulate timeouts deterministically.
func WithClock(f func() time.Time) ServiceOption {
	return func(s *Service) { s.now = f }
}

// WithOrderLookup wires the parent DBA order lookup. When nil, the
// service skips order existence validation and relies on callers.
func WithOrderLookup(l OrderLookup) ServiceOption {
	return func(s *Service) { s.orders = l }
}

// NewService constructs a Service with the given repo, config, and
// any applicable options.
func NewService(repo Repo, cfg Config, opts ...ServiceOption) *Service {
	s := &Service{
		repo: repo,
		cfg:  cfg,
		now:  func() time.Time { return time.Now().UTC() },
	}
	for _, o := range opts {
		o(s)
	}
	return s
}

// ---- Workflow management ----

// CreateWorkflow persists a new workflow definition. It runs full
// validation before inserting so callers can rely on 4xx-style errors.
func (s *Service) CreateWorkflow(ctx context.Context, tenantID string, req CreateWorkflowRequest) (*ApprovalWorkflow, error) {
	w := &ApprovalWorkflow{
		TenantID: tenantID,
		Name:     req.Name,
		Steps:    req.Steps,
		Enabled:  true,
	}
	if err := ValidateWorkflow(w, s.cfg); err != nil {
		return nil, fmt.Errorf("validate workflow: %w", err)
	}
	if err := s.repo.CreateWorkflow(ctx, w); err != nil {
		return nil, fmt.Errorf("create workflow: %w", err)
	}
	return w, nil
}

// GetWorkflow fetches a workflow by ID.
func (s *Service) GetWorkflow(ctx context.Context, id string) (*ApprovalWorkflow, error) {
	return s.repo.GetWorkflow(ctx, id)
}

// ListWorkflows returns all workflows visible to the given tenant.
func (s *Service) ListWorkflows(ctx context.Context, tenantID string) ([]ApprovalWorkflow, error) {
	return s.repo.ListWorkflows(ctx, tenantID)
}

// ---- Instance lifecycle ----

// SubmitForApproval starts a new approval instance for an existing
// order. It clones the workflow's step definitions so subsequent edits
// to the workflow do not affect this running instance.
func (s *Service) SubmitForApproval(ctx context.Context, tenantID string, req SubmitForApprovalRequest) (*ApprovalInstance, error) {
	if req.OrderID == "" {
		return nil, fmt.Errorf("order_id is required")
	}
	if req.WorkflowID == "" {
		return nil, fmt.Errorf("workflow_id is required")
	}
	wf, err := s.repo.GetWorkflow(ctx, req.WorkflowID)
	if err != nil {
		return nil, fmt.Errorf("get workflow: %w", err)
	}
	if !wf.Enabled {
		return nil, fmt.Errorf("workflow %q is disabled", wf.ID)
	}
	if wf.TenantID != tenantID && tenantID != "" {
		return nil, fmt.Errorf("workflow %q belongs to a different tenant", wf.ID)
	}
	if err := ValidateWorkflow(wf, s.cfg); err != nil {
		return nil, fmt.Errorf("validate workflow: %w", err)
	}

	// Optional order existence check — only when an OrderLookup is wired.
	if s.orders != nil {
		_, status, err := s.orders.GetOrder(ctx, req.OrderID)
		if err != nil {
			return nil, fmt.Errorf("get order: %w", err)
		}
		if status == "rejected" || status == "cancelled" {
			return nil, fmt.Errorf("order is already %s", status)
		}
	}

	// Clone step definitions (shallow copy of each def + a fresh slice).
	steps := make([]ApprovalStep, 0, len(wf.Steps))
	for i, def := range wf.Steps {
		steps = append(steps, NewPendingStep(i, def, s.cfg))
	}

	now := s.now()
	inst := &ApprovalInstance{
		TenantID:     tenantID,
		OrderID:      req.OrderID,
		WorkflowID:   wf.ID,
		WorkflowName: wf.Name,
		CurrentStep:  0,
		Status:       StatusPending,
		Steps:        steps,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := s.repo.CreateInstance(ctx, inst); err != nil {
		return nil, fmt.Errorf("create instance: %w", err)
	}
	// Kick off step 0 (pending → in_progress) and persist the result.
	if err := s.advance(ctx, inst, true); err != nil {
		return nil, fmt.Errorf("advance instance: %w", err)
	}
	_, err = s.repo.UpdateInstance(ctx, inst)
	if err != nil {
		return nil, fmt.Errorf("persist instance: %w", err)
	}
	return inst, nil
}

// GetInstance returns a single instance by ID, applying any pending
// timeout transitions so the caller sees a fresh view.
func (s *Service) GetInstance(ctx context.Context, id string) (*ApprovalInstance, error) {
	inst, err := s.repo.GetInstance(ctx, id)
	if err != nil {
		return nil, err
	}
	if err := s.applyTimeouts(ctx, inst); err != nil {
		return nil, err
	}
	return inst, nil
}

// ListInstances returns all approval instances for a given order ID.
// Timed-out steps are not applied here because callers are typically
// polling — a separate Refresh endpoint (or a scheduled job) can
// reapply timeouts in bulk.
func (s *Service) ListInstances(ctx context.Context, orderID string) ([]ApprovalInstance, error) {
	return s.repo.ListInstancesByOrder(ctx, orderID)
}

// ApproveStep records an approval from userID on the current step.
// After recording, the step is re-evaluated and the flow advances if
// the threshold was met. Duplicate approvals by the same user on the
// same step are rejected.
func (s *Service) ApproveStep(ctx context.Context, instanceID string, stepIdx int, userID, comment string) (*ApprovalInstance, error) {
	inst, err := s.repo.GetInstance(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	if inst.Status != StatusInProgress {
		return nil, fmt.Errorf("instance %q is not in_progress (status=%q)", instanceID, inst.Status)
	}
	if err := s.applyTimeouts(ctx, inst); err != nil {
		return nil, err
	}
	if stepIdx != inst.CurrentStep {
		return nil, fmt.Errorf("step %d is not current (current=%d)", stepIdx, inst.CurrentStep)
	}
	if stepIdx >= len(inst.Steps) {
		return nil, fmt.Errorf("step index %d out of range", stepIdx)
	}
	if userID == "" {
		return nil, fmt.Errorf("user_id is required")
	}
	step := &inst.Steps[stepIdx]
	if step.HasApprovedBy(userID) {
		return nil, fmt.Errorf("user %s already approved step %d", userID, stepIdx)
	}
	rec := ApprovalRecord{
		InstanceID: inst.ID,
		StepIndex:  stepIdx,
		UserID:     userID,
		Action:     ActionApprove,
		Comment:    comment,
		ActionedAt: s.now(),
	}
	if err := step.AppendRecord(rec); err != nil {
		return nil, err
	}
	if err := s.repo.InsertRecord(ctx, &rec); err != nil {
		return nil, fmt.Errorf("insert record: %w", err)
	}
	if err := s.advance(ctx, inst, false); err != nil {
		return nil, err
	}
	return s.repo.UpdateInstance(ctx, inst)
}

// RejectStep records a rejection. Any rejection immediately fails the
// step and marks the whole instance as rejected.
func (s *Service) RejectStep(ctx context.Context, instanceID string, stepIdx int, userID, comment string) (*ApprovalInstance, error) {
	inst, err := s.repo.GetInstance(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	if inst.Status != StatusInProgress {
		return nil, fmt.Errorf("instance %q is not in_progress (status=%q)", instanceID, inst.Status)
	}
	if stepIdx != inst.CurrentStep {
		return nil, fmt.Errorf("step %d is not current (current=%d)", stepIdx, inst.CurrentStep)
	}
	if stepIdx >= len(inst.Steps) {
		return nil, fmt.Errorf("step index %d out of range", stepIdx)
	}
	if userID == "" {
		return nil, fmt.Errorf("user_id is required")
	}
	step := &inst.Steps[stepIdx]
	if step.HasRejectedBy(userID) {
		return nil, fmt.Errorf("user %s already rejected step %d", userID, stepIdx)
	}
	now := s.now()
	rec := ApprovalRecord{
		InstanceID: inst.ID,
		StepIndex:  stepIdx,
		UserID:     userID,
		Action:     ActionReject,
		Comment:    comment,
		ActionedAt: now,
	}
	if err := step.AppendRecord(rec); err != nil {
		return nil, err
	}
	if err := s.repo.InsertRecord(ctx, &rec); err != nil {
		return nil, fmt.Errorf("insert record: %w", err)
	}
	// Fail-fast: reject the step and the whole instance.
	if err := step.FinishStep(StatusRejected, now); err != nil {
		return nil, err
	}
	inst.Status = StatusRejected
	inst.FinishedAt = ptrTime(now)
	if _, err := s.repo.UpdateInstance(ctx, inst); err != nil {
		return nil, err
	}
	return inst, nil
}

// Escalate advances the flow from the current step to the next one
// without recording an approval from any user. Only allowed when the
// current step's evaluation reports CanEscalate (i.e. it timed out
// with TimeoutAction=escalate). Records an ActionEscalate audit
// record for traceability.
func (s *Service) Escalate(ctx context.Context, instanceID string, stepIdx int, escalatedBy string) (*ApprovalInstance, error) {
	inst, err := s.repo.GetInstance(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	if inst.Status != StatusInProgress {
		return nil, fmt.Errorf("instance %q is not in_progress (status=%q)", instanceID, inst.Status)
	}
	if stepIdx != inst.CurrentStep {
		return nil, fmt.Errorf("step %d is not current (current=%d)", stepIdx, inst.CurrentStep)
	}
	if stepIdx >= len(inst.Steps) {
		return nil, fmt.Errorf("step index %d out of range", stepIdx)
	}
	if escalatedBy == "" {
		return nil, fmt.Errorf("escalated_by is required")
	}
	step := &inst.Steps[stepIdx]
	now := s.now()
	ev := EvaluateStep(*step, step.Def, s.cfg, now)
	if !ev.CanEscalate {
		return nil, fmt.Errorf("step %d cannot be escalated: %s", stepIdx, ev.Reason)
	}
	// Record the escalation so audit trails can find it.
	rec := ApprovalRecord{
		InstanceID: inst.ID,
		StepIndex:  stepIdx,
		UserID:     escalatedBy,
		Action:     ActionEscalate,
		Comment:    "step timed out; escalated to next step",
		ActionedAt: now,
	}
	// We bypass step.AppendRecord because ActionEscalate is not in its
	// allowed set; we validate the record manually and append directly.
	if rec.InstanceID == "" || rec.UserID == "" {
		return nil, fmt.Errorf("invalid escalate record")
	}
	step.Approvals = append(step.Approvals, rec)
	if err := s.repo.InsertRecord(ctx, &rec); err != nil {
		return nil, fmt.Errorf("insert record: %w", err)
	}
	if err := step.FinishStep(StatusTimedOut, now); err != nil {
		return nil, err
	}
	step.EscalatedTo = escalatedBy
	if err := s.advance(ctx, inst, false); err != nil {
		return nil, err
	}
	return s.repo.UpdateInstance(ctx, inst)
}

// ---- Internal helpers ----

// advance re-evaluates the current step and either:
//   - leaves the instance unchanged (step still in progress), OR
//   - flips the step to its terminal state and either fails the whole
//     instance (rejected) or moves to the next step (approved), OR
//   - marks the whole instance as approved when the last step passes.
//
// The `initialKick` flag is used by SubmitForApproval to move the
// first step from pending → in_progress on creation. When true the
// function returns after starting step 0 without evaluating anything
// else.
func (s *Service) advance(ctx context.Context, inst *ApprovalInstance, initialKick bool) error {
	now := s.now()
	if initialKick {
		if err := inst.Steps[inst.CurrentStep].StartStep(now); err != nil {
			return err
		}
		inst.Status = StatusInProgress
		inst.UpdatedAt = now
		return nil
	}
	// Re-evaluate the current step until it either completes or is
	// still in flight. Because a single step can only be evaluated
	// once per record addition, we do a single pass here; if the
	// evaluation says not-complete the caller will try again later.
	step := &inst.Steps[inst.CurrentStep]
	ev := EvaluateStep(*step, step.Def, s.cfg, now)
	if !ev.Complete {
		inst.UpdatedAt = now
		return nil
	}
	if err := step.FinishStep(ev.TerminalStatus, now); err != nil {
		return err
	}
	if !ev.Passed {
		// Step failed → whole instance fails.
		inst.Status = StatusRejected
		inst.FinishedAt = ptrTime(now)
		inst.UpdatedAt = now
		return nil
	}
	// Step passed. Advance to next step or complete the instance.
	nextIdx := inst.CurrentStep + 1
	if nextIdx >= len(inst.Steps) {
		inst.Status = StatusApproved
		inst.FinishedAt = ptrTime(now)
		inst.UpdatedAt = now
		return nil
	}
	inst.CurrentStep = nextIdx
	if err := inst.Steps[nextIdx].StartStep(now); err != nil {
		return err
	}
	inst.Status = StatusInProgress
	inst.UpdatedAt = now
	return nil
}

// applyTimeouts sweeps every non-terminal step and applies timeout
// rules. Called from read paths so that stale timeouts are always
// applied by the time a client sees the instance.
func (s *Service) applyTimeouts(ctx context.Context, inst *ApprovalInstance) error {
	now := s.now()
	if inst.Status != StatusInProgress {
		return nil
	}
	// Only the current step can time out; previous steps are already
	// terminal and later steps have not started.
	step := &inst.Steps[inst.CurrentStep]
	if step.Status != StatusInProgress {
		return nil
	}
	ev := EvaluateStep(*step, step.Def, s.cfg, now)
	if !ev.Complete {
		return nil
	}
	if err := step.FinishStep(ev.TerminalStatus, now); err != nil {
		return err
	}
	if !ev.Passed {
		inst.Status = StatusRejected
		inst.FinishedAt = ptrTime(now)
		inst.UpdatedAt = now
		_, err := s.repo.UpdateInstance(ctx, inst)
		return err
	}
	nextIdx := inst.CurrentStep + 1
	if nextIdx >= len(inst.Steps) {
		inst.Status = StatusApproved
		inst.FinishedAt = ptrTime(now)
		inst.UpdatedAt = now
		_, err := s.repo.UpdateInstance(ctx, inst)
		return err
	}
	inst.CurrentStep = nextIdx
	if err := inst.Steps[nextIdx].StartStep(now); err != nil {
		return err
	}
	inst.Status = StatusInProgress
	inst.UpdatedAt = now
	_, err := s.repo.UpdateInstance(ctx, inst)
	return err
}

func ptrTime(t time.Time) *time.Time {
	x := t
	return &x
}
