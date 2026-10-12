package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/saga/models"
)

// TEST-5: coverage for the 23 zero-percentage methods in the saga package.
// Prior state (2026-10-11): 32.8% coverage.
// Target: >70% — closing GATE-TEST-SAGA-70 gap.

// seedSagaAndStep seeds a running saga transaction with a single pending step.
// Returns (coordinator, tx, step).
func seedSagaAndStep(t *testing.T) (*SagaCoordinator, *models.SagaTransaction, *models.SagaStep) {
	t.Helper()
	m := newMockRepo()
	c := NewSagaCoordinator(m)
	tx, err := c.Start(context.Background(), "tenant-1", &models.CreateSagaRequest{
		SagaName: "deploy",
		Input:    map[string]interface{}{"env": "prod"},
	})
	if err != nil {
		t.Fatalf("start saga: %v", err)
	}
	step := &models.SagaStep{
		TenantID:      "tenant-1",
		TransactionID: tx.ID,
		StepName:      "build",
		Sequence:      1,
		Status:        models.SagaStepStatusPending,
	}
	if err := m.CreateStep(context.Background(), step); err != nil {
		t.Fatalf("create step: %v", err)
	}
	return c, tx, step
}

// --- ExecuteNextStep ---

func TestExecuteNextStep_RealStep(t *testing.T) {
	c, tx, _ := seedSagaAndStep(t)
	result, err := c.ExecuteNextStep(context.Background(), "tenant-1", tx.ID)
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	if !result.Success {
		t.Errorf("expected success, got %+v", result)
	}
	if result.Output["status"] != "completed" {
		t.Errorf("output.status = %v", result.Output["status"])
	}
}

func TestExecuteNextStep_InvalidStatus(t *testing.T) {
	m := newMockRepo()
	c := NewSagaCoordinator(m)
	tx, err := c.Start(context.Background(), "tenant-1", &models.CreateSagaRequest{
		SagaName: "deploy", Input: map[string]interface{}{},
	})
	if err != nil {
		t.Fatal(err)
	}
	tx.Status = models.SagaStatusFailed
	m.transactions[tx.ID] = tx

	_, err = c.ExecuteNextStep(context.Background(), "tenant-1", tx.ID)
	if !errors.Is(err, ErrInvalidStatus) {
		t.Errorf("expected ErrInvalidStatus, got %v", err)
	}
}

func TestExecuteNextStep_NoPendingStep_CompletesSaga(t *testing.T) {
	// No pending steps left (create saga with no steps)
	m := newMockRepo()
	coordinator2 := NewSagaCoordinator(m)
	tx2, _ := coordinator2.Start(context.Background(), "tenant-1", &models.CreateSagaRequest{
		SagaName: "deploy", Input: map[string]interface{}{},
	})
	result, err := coordinator2.ExecuteNextStep(context.Background(), "tenant-1", tx2.ID)
	if err != nil {
		t.Fatalf("execute (no steps): %v", err)
	}
	if !result.Success {
		t.Errorf("expected success on markCompleted")
	}
	if result.Output["status"] != "completed" {
		t.Errorf("output.status = %v", result.Output["status"])
	}
}

// --- ExecuteAll ---

func TestExecuteAll_TerminatesCleanlyOnNoSteps(t *testing.T) {
	m := newMockRepo()
	c := NewSagaCoordinator(m)
	tx, _ := c.Start(context.Background(), "tenant-1", &models.CreateSagaRequest{
		SagaName: "deploy", Input: map[string]interface{}{},
	})
	result, err := c.ExecuteAll(context.Background(), "tenant-1", tx.ID)
	if err != nil {
		t.Fatalf("executeAll should terminate cleanly, got: %v", err)
	}
	if !result.Success {
		t.Errorf("expected success")
	}
	if result.Output["final"] != true {
		t.Errorf("expected final=true sentinel, got %v", result.Output["final"])
	}
}

func TestExecuteAll_WrongStatus_ReturnsError(t *testing.T) {
	m := newMockRepo()
	c := NewSagaCoordinator(m)
	tx, _ := c.Start(context.Background(), "tenant-1", &models.CreateSagaRequest{
		SagaName: "deploy", Input: map[string]interface{}{},
	})
	// Force status out of Running.
	m.transactions[tx.ID].Status = models.SagaStatusCompleted
	_, err := c.ExecuteAll(context.Background(), "tenant-1", tx.ID)
	if !errors.Is(err, ErrInvalidStatus) {
		t.Errorf("expected ErrInvalidStatus, got %v", err)
	}
}

// --- StartCompensation paths ---

func TestStartCompensation_WithCompletedStepNoCompensator(t *testing.T) {
	c, tx, step := seedSagaAndStep(t)
	// Manually mark the step as completed so compensation iterates it.
	step.Status = models.SagaStepStatusCompleted

	// Execute one step first (this completes the step)
	_, _ = c.ExecuteNextStep(context.Background(), "tenant-1", tx.ID)

	if err := c.StartCompensation(context.Background(), "tenant-1", tx.ID, "manual"); err != nil {
		t.Fatalf("compensation: %v", err)
	}
}

// --- Cancel path with running saga ---

func TestCancel_RunningSaga_TransitionsToFailed(t *testing.T) {
	c, tx, _ := seedSagaAndStep(t)
	got, err := c.Cancel(context.Background(), "tenant-1", tx.ID, "user cancel")
	if err != nil {
		t.Fatalf("cancel: %v", err)
	}
	if got.Status != models.SagaStatusFailed {
		t.Errorf("status = %s, want failed", got.Status)
	}
}

// --- executeStep cancellation via context ---

func TestExecuteStep_ContextCancelled_ReturnsFailure(t *testing.T) {
	m := newMockRepo()
	c := NewSagaCoordinator(m)
	// Cancelled context returns failure immediately in executeStep.
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	res := c.executeStep(ctx, "t", "tx", &models.SagaStep{StepName: "build"})
	if res.Success {
		t.Errorf("expected success=false on cancelled ctx")
	}
	if !strings.Contains(res.Error, "context") {
		t.Errorf("error = %q, want 'context' mention", res.Error)
	}
}

// --- getAndMarkFailed and markCompleted direct exercise ---

func TestGetAndMarkFailed_PersistsFailedStatus(t *testing.T) {
	m := newMockRepo()
	c := NewSagaCoordinator(m)
	tx, _ := c.Start(context.Background(), "tenant-1", &models.CreateSagaRequest{
		SagaName: "deploy", Input: map[string]interface{}{},
	})
	got, err := c.getAndMarkFailed(context.Background(), "tenant-1", tx.ID, "oops")
	if err != nil {
		t.Fatalf("getAndMarkFailed: %v", err)
	}
	if got.Status != models.SagaStatusFailed {
		t.Errorf("status = %s", got.Status)
	}
	if got.Error == nil || *got.Error != "oops" {
		t.Errorf("error = %v", got.Error)
	}
}

func TestMarkCompleted_ReturnsSuccessResult(t *testing.T) {
	m := newMockRepo()
	c := NewSagaCoordinator(m)
	tx, _ := c.Start(context.Background(), "tenant-1", &models.CreateSagaRequest{
		SagaName: "deploy", Input: map[string]interface{}{},
	})
	res, err := c.markCompleted(context.Background(), "tenant-1", tx.ID)
	if err != nil {
		t.Fatalf("markCompleted: %v", err)
	}
	if !res.Success {
		t.Error("expected success")
	}
	if res.Output["status"] != "completed" {
		t.Errorf("output.status = %v", res.Output["status"])
	}
}

// --- DeploySaga ---

func TestDeploySaga_Execute_AllStepsComplete(t *testing.T) {
	m := newMockRepo()
	c := NewSagaCoordinator(m)
	ds := NewDeploySaga(c, m)

	res, err := ds.Execute(context.Background(), "tenant-1", "deploy-1", ExecuteInput{
		Target:  "prod",
		Version: "v1.0.0",
	})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	if res.Status != "completed" {
		t.Errorf("status = %s", res.Status)
	}
	if len(res.Steps) != len(deploySteps) {
		t.Errorf("steps = %d, want %d", len(res.Steps), len(deploySteps))
	}
	for _, s := range res.Steps {
		if s.Status != "completed" {
			t.Errorf("step %s = %s", s.StepName, s.Status)
		}
	}
}

func TestDeploySaga_Execute_ContextCancelledMidway(t *testing.T) {
	m := newMockRepo()
	c := NewSagaCoordinator(m)
	ds := NewDeploySaga(c, m)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	res, err := ds.Execute(ctx, "tenant-1", "deploy-2", ExecuteInput{Target: "prod", Version: "v1"})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}
	if res.Status != "failed" {
		t.Errorf("status = %s, want failed", res.Status)
	}
}

func TestDeploySaga_ListDeployments(t *testing.T) {
	m := newMockRepo()
	c := NewSagaCoordinator(m)
	ds := NewDeploySaga(c, m)
	// Seed a deploy saga via Execute.
	if _, err := ds.Execute(context.Background(), "tenant-1", "d1", ExecuteInput{Target: "prod", Version: "v1"}); err != nil {
		t.Fatalf("execute: %v", err)
	}
	list, err := ds.ListDeployments(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(list) == 0 {
		t.Error("expected >= 1 deployment")
	}
}

func TestDeploySaga_GetDeployment_NotDeploySaga(t *testing.T) {
	m := newMockRepo()
	c := NewSagaCoordinator(m)
	ds := NewDeploySaga(c, m)
	// Insert a non-deploy saga transaction
	tx := &models.SagaTransaction{
		ID: "tx-x", TenantID: "tenant-1", SagaName: "incident", Status: models.SagaStatusRunning,
	}
	m.transactions[tx.ID] = tx

	_, err := ds.GetDeployment(context.Background(), "tenant-1", tx.ID)
	if err == nil {
		t.Fatal("expected error for non-deploy saga")
	}
}

func TestDeploySaga_GetDeployment_Success(t *testing.T) {
	m := newMockRepo()
	c := NewSagaCoordinator(m)
	ds := NewDeploySaga(c, m)
	if _, err := ds.Execute(context.Background(), "tenant-1", "d-ok", ExecuteInput{Target: "prod", Version: "v1"}); err != nil {
		t.Fatalf("execute: %v", err)
	}
	// Grab the tx ID from mock
	var deployTx *models.SagaTransaction
	for _, tx := range m.transactions {
		if tx.SagaName == "deploy" {
			deployTx = tx
			break
		}
	}
	if deployTx == nil {
		t.Fatal("no deploy saga recorded")
	}
	got, err := ds.GetDeployment(context.Background(), "tenant-1", deployTx.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.SagaName != "deploy" {
		t.Errorf("sagaName = %s", got.SagaName)
	}
}

// --- TransactionLog methods ---

func TestTransactionLog_StartRecord(t *testing.T) {
	m := newMockRepo()
	tl := NewTransactionLog(m)
	tx, err := tl.StartRecord(context.Background(), "tenant-1", &models.CreateSagaRequest{
		SagaName: "deploy", Input: map[string]interface{}{"a": 1},
		Metadata: map[string]interface{}{"src": "unit-test"},
	})
	if err != nil {
		t.Fatalf("startRecord: %v", err)
	}
	if tx.Status != models.SagaStatusPending {
		t.Errorf("status = %s", tx.Status)
	}
	if !strings.Contains(tx.Metadata, "unit-test") {
		t.Errorf("metadata = %s", tx.Metadata)
	}
}

func TestTransactionLog_GetRecord(t *testing.T) {
	m := newMockRepo()
	tl := NewTransactionLog(m)
	_, err := tl.StartRecord(context.Background(), "tenant-1", &models.CreateSagaRequest{
		SagaName: "deploy", Input: map[string]interface{}{},
	})
	if err != nil {
		t.Fatal(err)
	}
	var txID string
	for id := range m.transactions {
		txID = id
	}
	got, err := tl.GetRecord(context.Background(), "tenant-1", txID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.ID != txID {
		t.Errorf("id = %s", got.ID)
	}
}

func TestTransactionLog_GetRecord_NotFound(t *testing.T) {
	m := newMockRepo()
	tl := NewTransactionLog(m)
	_, err := tl.GetRecord(context.Background(), "tenant-1", "nope")
	if !errors.Is(err, ErrTransactionLogNotFound) {
		t.Errorf("expected ErrTransactionLogNotFound, got %v", err)
	}
}

func TestTransactionLog_GetRecordByRequestId(t *testing.T) {
	m := newMockRepo()
	tl := NewTransactionLog(m)
	_, err := tl.StartRecord(context.Background(), "tenant-1", &models.CreateSagaRequest{
		SagaName: "deploy", Input: map[string]interface{}{},
	})
	if err != nil {
		t.Fatal(err)
	}
	// StartRecord sets RequestID = req.SagaName = "deploy"
	got, err := tl.GetRecordByRequestId(context.Background(), "tenant-1", "deploy")
	if err != nil {
		t.Fatalf("byRID: %v", err)
	}
	if got.SagaName != "deploy" {
		t.Errorf("sagaName = %s", got.SagaName)
	}
}

func TestTransactionLog_DeleteRecord_MarksFailed(t *testing.T) {
	m := newMockRepo()
	tl := NewTransactionLog(m)
	_, err := tl.StartRecord(context.Background(), "tenant-1", &models.CreateSagaRequest{
		SagaName: "deploy", Input: map[string]interface{}{},
	})
	if err != nil {
		t.Fatal(err)
	}
	var txID string
	for id := range m.transactions {
		txID = id
	}
	if err := tl.DeleteRecord(context.Background(), "tenant-1", txID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	tx := m.transactions[txID]
	if tx.Status != models.SagaStatusFailed {
		t.Errorf("status = %s", tx.Status)
	}
	if tx.Error == nil || !strings.Contains(*tx.Error, "deleted") {
		t.Errorf("error = %v", tx.Error)
	}
}

func TestTransactionLog_RecordStepStart(t *testing.T) {
	m := newMockRepo()
	tl := NewTransactionLog(m)
	step := &models.SagaStep{TenantID: "t", TransactionID: "tx", StepName: "build", Sequence: 1}
	if err := m.CreateStep(context.Background(), step); err != nil {
		t.Fatal(err)
	}
	if err := tl.RecordStepStart(context.Background(), "t", step.ID); err != nil {
		t.Fatalf("recordStart: %v", err)
	}
	if step.Status != models.SagaStepStatusExecuting {
		t.Errorf("step status = %s", step.Status)
	}
}

func TestTransactionLog_RecordStepSuccess(t *testing.T) {
	m := newMockRepo()
	tl := NewTransactionLog(m)
	step := &models.SagaStep{TenantID: "t", TransactionID: "tx", StepName: "build", Sequence: 1}
	_ = m.CreateStep(context.Background(), step)

	err := tl.RecordStepSuccess(context.Background(), "t", step.ID, map[string]interface{}{"k": "v"}, 2)
	if err != nil {
		t.Fatalf("recordSuccess: %v", err)
	}
	if step.Status != models.SagaStepStatusCompleted {
		t.Errorf("status = %s", step.Status)
	}
	if step.RetryCount != 2 {
		t.Errorf("retryCount = %d", step.RetryCount)
	}
	if step.Output == nil || !strings.Contains(*step.Output, "k") {
		t.Errorf("output = %v", step.Output)
	}
}

func TestTransactionLog_RecordStepFailure(t *testing.T) {
	m := newMockRepo()
	tl := NewTransactionLog(m)
	step := &models.SagaStep{TenantID: "t", TransactionID: "tx", StepName: "build", Sequence: 1}
	_ = m.CreateStep(context.Background(), step)

	if err := tl.RecordStepFailure(context.Background(), "t", step.ID, "boom", 3); err != nil {
		t.Fatalf("recordFailure: %v", err)
	}
	if step.Status != models.SagaStepStatusFailed {
		t.Errorf("status = %s", step.Status)
	}
	if step.Error == nil || *step.Error != "boom" {
		t.Errorf("error = %v", step.Error)
	}
}

func TestTransactionLog_RecordCompensation_True(t *testing.T) {
	m := newMockRepo()
	tl := NewTransactionLog(m)
	step := &models.SagaStep{TenantID: "t", TransactionID: "tx", StepName: "build", Sequence: 1}
	_ = m.CreateStep(context.Background(), step)

	if err := tl.RecordCompensation(context.Background(), "t", step.ID, true); err != nil {
		t.Fatalf("recordCompensation: %v", err)
	}
	if step.Status != models.SagaStepStatusCompensated {
		t.Errorf("status = %s", step.Status)
	}
	if step.CompensationCompletedAt == nil {
		t.Error("compensationCompletedAt not set")
	}
}

func TestTransactionLog_RecordCompensation_False(t *testing.T) {
	m := newMockRepo()
	tl := NewTransactionLog(m)
	step := &models.SagaStep{TenantID: "t", TransactionID: "tx", StepName: "build", Sequence: 1}
	_ = m.CreateStep(context.Background(), step)

	if err := tl.RecordCompensation(context.Background(), "t", step.ID, false); err != nil {
		t.Fatalf("recordCompensation: %v", err)
	}
	if step.Status != models.SagaStepStatusCompensationFailed {
		t.Errorf("status = %s", step.Status)
	}
}

func TestTransactionLog_ListRecords(t *testing.T) {
	m := newMockRepo()
	tl := NewTransactionLog(m)
	_, _ = tl.StartRecord(context.Background(), "t", &models.CreateSagaRequest{SagaName: "deploy", Input: map[string]interface{}{}})
	_, _ = tl.StartRecord(context.Background(), "t", &models.CreateSagaRequest{SagaName: "incident", Input: map[string]interface{}{}})

	status := "pending"
	resp, err := tl.ListRecords(context.Background(), "t", models.ListSagasQuery{Status: &status, Limit: 10})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if resp.Total != 2 {
		t.Errorf("total = %d", resp.Total)
	}
}

func TestTransactionLog_GetSteps(t *testing.T) {
	m := newMockRepo()
	tl := NewTransactionLog(m)
	tx := &models.SagaTransaction{ID: "tx-1", TenantID: "t", SagaName: "deploy", Status: models.SagaStatusRunning}
	m.transactions["tx-1"] = tx
	_ = m.CreateStep(context.Background(), &models.SagaStep{TenantID: "t", TransactionID: "tx-1", StepName: "build", Sequence: 1})
	_ = m.CreateStep(context.Background(), &models.SagaStep{TenantID: "t", TransactionID: "tx-1", StepName: "test", Sequence: 2})

	steps, err := tl.GetSteps(context.Background(), "t", "tx-1")
	if err != nil {
		t.Fatalf("getSteps: %v", err)
	}
	if len(steps) != 2 {
		t.Errorf("len = %d", len(steps))
	}
}

func TestTransactionLog_FindRunningTransactions(t *testing.T) {
	m := newMockRepo()
	tl := NewTransactionLog(m)
	// Seed two txs, one running.
	m.transactions["tx-r"] = &models.SagaTransaction{ID: "tx-r", SagaName: "deploy", Status: models.SagaStatusRunning}
	m.transactions["tx-f"] = &models.SagaTransaction{ID: "tx-f", SagaName: "deploy", Status: models.SagaStatusFailed}

	got, err := tl.FindRunningTransactions(context.Background(), "t")
	if err != nil {
		t.Fatalf("find: %v", err)
	}
	// mock doesn't filter; both returned.
	if len(got) < 1 {
		t.Error("expected at least one tx")
	}
}

func TestTransactionLog_RebuildFromRepository(t *testing.T) {
	m := newMockRepo()
	tl := NewTransactionLog(m)
	// Seed one running tx so the list is non-empty.
	m.transactions["tx-r"] = &models.SagaTransaction{ID: "tx-r", SagaName: "deploy", Status: models.SagaStatusRunning}

	got, err := tl.RebuildFromRepository(context.Background(), "t")
	if err != nil {
		t.Fatalf("rebuild: %v", err)
	}
	if len(got) == 0 {
		t.Error("expected at least one rebuilt transaction")
	}
}

func TestTransactionLog_StartRecord_MarshalError(t *testing.T) {
	m := newMockRepo()
	tl := NewTransactionLog(m)
	// channel as input forces json.Marshal to fail on map values? Actually a chan can't be marshalled.
	_, err := tl.StartRecord(context.Background(), "t", &models.CreateSagaRequest{
		SagaName: "deploy",
		Input:    map[string]interface{}{"chan": make(chan int)},
	})
	if err == nil {
		t.Error("expected marshal error")
	}
}

// --- helpers ---

func TestGetStr_NilAndValue(t *testing.T) {
	if getStr(nil) != "" {
		t.Error("nil -> empty")
	}
	s := "x"
	if getStr(&s) != "x" {
		t.Error("value -> x")
	}
}

func TestPtrString_Helper(t *testing.T) {
	if p := ptrString("hi"); p == nil || *p != "hi" {
		t.Error("ptrString broken")
	}
}

func TestUnixNow_ReturnsReasonable(t *testing.T) {
	v := unixNow()
	if v == 0 {
		t.Error("unixNow = 0")
	}
	_ = time.Now()
}
