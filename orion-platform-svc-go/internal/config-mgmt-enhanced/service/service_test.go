package service

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"testing"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/config-mgmt-enhanced/models"
)

// cfgRepoFake is a scripted RepositoryInterface. It records every call so a
// test can assert both that a write happened and, just as importantly, that a
// write was skipped on the failure path.
type cfgRepoFake struct {
	getErr         error
	listErr        error
	listNil        bool
	missingRow     bool
	createErr      error
	deleteErr      error
	updateErr      error
	getCRErr       error
	addHistoryErr  error
	updateCRErr    error
	getDriftErr    error
	createDriftErr error
	updateDriftErr error
	historyNil     bool

	cr      *models.ChangeRequest
	drifts  map[string]*models.DriftReport
	deleted bool

	calls          []string
	lastAttrs      map[string]interface{}
	lastCRAttrs    map[string]interface{}
	lastHistory    *models.ChangeHistory
	lastDrift      *models.DriftReport
	lastDriftAttrs map[string]interface{}
}

var _ RepositoryInterface = (*cfgRepoFake)(nil)

func (f *cfgRepoFake) rec(name string) {
	f.calls = append(f.calls, name)
}

func (f *cfgRepoFake) Create(ctx context.Context, entity *models.ConfigMgmt) error {
	f.rec("Create")
	return f.createErr
}

func (f *cfgRepoFake) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	f.rec("Delete")
	if f.deleteErr != nil {
		return false, f.deleteErr
	}
	return f.deleted, nil
}

func (f *cfgRepoFake) GetByID(ctx context.Context, id, tenantID string) (*models.ConfigMgmt, error) {
	f.rec("GetByID")
	if f.getErr != nil {
		return nil, f.getErr
	}
	if f.missingRow {
		return nil, sql.ErrNoRows
	}
	return &models.ConfigMgmt{ID: id, TenantID: tenantID, Name: "n"}, nil
}

func (f *cfgRepoFake) List(ctx context.Context, tenantID string) ([]models.ConfigMgmt, error) {
	f.rec("List")
	if f.listErr != nil {
		return nil, f.listErr
	}
	if f.listNil {
		return nil, nil
	}
	return []models.ConfigMgmt{{ID: "cm-1", Name: "n"}}, nil
}

func (f *cfgRepoFake) Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ConfigMgmt, error) {
	f.rec("Update")
	f.lastAttrs = attrs
	if f.updateErr != nil {
		return nil, f.updateErr
	}
	return &models.ConfigMgmt{ID: id, TenantID: tenantID, Name: "n"}, nil
}

func (f *cfgRepoFake) AddChangeHistory(ctx context.Context, h *models.ChangeHistory) error {
	f.rec("AddChangeHistory")
	f.lastHistory = h
	return f.addHistoryErr
}

func (f *cfgRepoFake) GetChangeRequest(ctx context.Context, id, tenantID string) (*models.ChangeRequest, error) {
	f.rec("GetChangeRequest")
	if f.getCRErr != nil {
		return nil, f.getCRErr
	}
	if f.cr != nil {
		return f.cr, nil
	}
	return nil, sql.ErrNoRows
}

func (f *cfgRepoFake) UpdateChangeRequest(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ChangeRequest, error) {
	f.rec("UpdateChangeRequest")
	f.lastCRAttrs = attrs
	if f.updateCRErr != nil {
		return nil, f.updateCRErr
	}
	// The real repository re-reads the row after the UPDATE, so the returned
	// row carries whatever was just written. A fake that returned an empty row
	// would hide a service that forgets to write the identity columns.
	if f.cr != nil {
		for k, v := range attrs {
			switch k {
			case "status":
				f.cr.Status = v.(models.ChangeRequestStatus)
			case "approvals":
				f.cr.Approvals = v.(string)
			case "approved_by", "executed_by", "rolled_back_by":
				str := v.(string)
				if k == "approved_by" {
					f.cr.ApprovedBy = &str
				} else if k == "executed_by" {
					f.cr.ExecutedBy = &str
				} else {
					f.cr.RolledBackBy = &str
				}
			case "approved_at", "executed_at", "rolled_back_at":
				// The service writes a time.Time value; the model holds a
				// pointer, so the fake has to copy before taking the address.
				tm := v.(time.Time)
				ptr := &tm
				switch k {
				case "approved_at":
					f.cr.ApprovedAt = ptr
				case "executed_at":
					f.cr.ExecutedAt = ptr
				default:
					f.cr.RolledBackAt = ptr
				}
			case "updated_at":
				f.cr.UpdatedAt = v.(time.Time)
			}
		}
		return f.cr, nil
	}
	return &models.ChangeRequest{ID: id, TenantID: tenantID}, nil
}

func (f *cfgRepoFake) GetDriftReport(ctx context.Context, id, tenantID string) (*models.DriftReport, error) {
	f.rec("GetDriftReport")
	if f.getDriftErr != nil {
		return nil, f.getDriftErr
	}
	dr, ok := f.drifts[id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return dr, nil
}

func (f *cfgRepoFake) CreateDriftReport(ctx context.Context, dr *models.DriftReport) error {
	f.rec("CreateDriftReport")
	f.lastDrift = dr
	return f.createDriftErr
}

func (f *cfgRepoFake) UpdateDriftReport(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.DriftReport, error) {
	f.rec("UpdateDriftReport")
	f.lastDriftAttrs = attrs
	if f.updateDriftErr != nil {
		return nil, f.updateDriftErr
	}
	if dr := f.drifts[id]; dr != nil {
		for k, v := range attrs {
			switch k {
			case "drift_status":
				dr.DriftStatus = v.(models.DriftStatus)
			case "remediation_log":
				dr.RemediationLog = v.(string)
			case "last_checked_at":
				dr.LastCheckedAt = v.(time.Time)
			}
		}
	}
	return f.drifts[id], nil
}

func (f *cfgRepoFake) GetChangeHistory(ctx context.Context, changeRequestID, tenantID string) ([]models.ChangeHistory, error) {
	f.rec("GetChangeHistory")
	if f.listErr != nil {
		return nil, f.listErr
	}
	if f.historyNil {
		return nil, nil
	}
	return []models.ChangeHistory{{
		ID: "h-1", TenantID: tenantID, ChangeRequestID: changeRequestID,
		Action: "approve", Actor: "u1", Notes: "ok", CreatedAt: time.Unix(1700000000, 0).UTC(),
	}}, nil
}

func cfgSvc(f *cfgRepoFake) *Service {
	return NewService(f)
}

func cfgCtx() context.Context {
	return context.Background()
}

func pendingCR() *models.ChangeRequest {
	return &models.ChangeRequest{
		ID: "cr-1", TenantID: "tenant-1", ConfigKey: "db.host", ConfigGroup: "db",
		Environment: "prod", Status: models.StatusPending, OldValue: "old", NewValue: "new",
	}
}

func TestCfgServiceMapRead(t *testing.T) {
	if !errors.Is(mapRead("cfg read", "id-1", sql.ErrNoRows), sentinel.NotFound) {
		t.Fatalf("sql.ErrNoRows must surface as sentinel.NotFound")
	}
	if err := mapRead("cfg read", "id-1", nil); err != nil {
		t.Fatalf("nil error must pass through, got %v", err)
	}
	orig := errors.New("connection refused")
	wrapped := mapRead("cfg read", "id-1", orig)
	if !errors.Is(wrapped, orig) {
		t.Fatalf("driver errors must stay wrappable: %v", wrapped)
	}
	if errors.Is(wrapped, sentinel.NotFound) {
		t.Fatalf("a driver error must not read as not-found: %v", wrapped)
	}
	if err := mapList("cfg list", nil); err != nil {
		t.Fatalf("nil error must pass through, got %v", err)
	}
	origList := errors.New("connection refused")
	wrappedList := mapList("cfg list", origList)
	if !errors.Is(wrappedList, origList) {
		t.Fatalf("list errors must stay wrappable, so a caller can identify the driver: %v", wrappedList)
	}
}

func TestCfgServiceCreate(t *testing.T) {
	f := &cfgRepoFake{}
	got, err := cfgSvc(f).Create(cfgCtx(), &models.CreateRequest{Name: "n"}, "tenant-1")
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if got.Name != "n" || got.TenantID != "tenant-1" {
		t.Fatalf("entity = %+v", got)
	}
	if _, err := cfgSvc(&cfgRepoFake{createErr: errors.New("deadlock")}).Create(cfgCtx(), &models.CreateRequest{Name: "n"}, "tenant-1"); err == nil {
		t.Fatalf("a create error must propagate")
	}
}

func TestCfgServiceGetAndList(t *testing.T) {
	if _, err := cfgSvc(&cfgRepoFake{missingRow: true}).Get(cfgCtx(), "cm-1", "tenant-1"); !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("a missing row must surface as sentinel.NotFound, got %v", err)
	}
	orig := errors.New("connection refused")
	if _, err := cfgSvc(&cfgRepoFake{getErr: orig}).Get(cfgCtx(), "cm-1", "tenant-1"); !errors.Is(err, orig) {
		t.Fatalf("driver errors must stay wrappable: %v", err)
	}
	if _, err := cfgSvc(&cfgRepoFake{listErr: orig}).List(cfgCtx(), "tenant-1"); !errors.Is(err, orig) {
		t.Fatalf("driver errors must stay wrappable: %v", err)
	}
	if _, err := cfgSvc(&cfgRepoFake{deleteErr: orig}).Delete(cfgCtx(), "cm-1", "tenant-1"); !errors.Is(err, orig) {
		t.Fatalf("driver errors must stay wrappable: %v", err)
	}
}

// A nil slice must not reach the API as null: []serialises as an array and
// null as nil, which breaks any client that indexes the result.
func TestCfgServiceListNilBecomesEmpty(t *testing.T) {
	got, err := cfgSvc(&cfgRepoFake{listNil: true}).List(cfgCtx(), "tenant-1")
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if got == nil {
		t.Fatalf("a nil repository slice must become an empty slice")
	}
	if len(got) != 0 {
		t.Fatalf("got %d rows, want 0", len(got))
	}
}

func TestCfgServiceUpdate(t *testing.T) {
	name := "renamed"
	f := &cfgRepoFake{}
	got, err := cfgSvc(f).Update(cfgCtx(), "cm-1", "tenant-1", &models.UpdateRequest{Name: &name})
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if got.ID != "cm-1" {
		t.Fatalf("got %+v", got)
	}
	if f.lastAttrs["name"] != "renamed" {
		t.Fatalf("attrs = %v, want name=renamed", f.lastAttrs)
	}
	if len(f.lastAttrs) != 1 {
		t.Fatalf("attrs = %v, want only name", f.lastAttrs)
	}
	for _, bad := range []string{"id", "tenant_id", "created_at"} {
		if _, ok := f.lastAttrs[bad]; ok {
			t.Errorf("attrs must not carry %s", bad)
		}
	}
}

func TestCfgServiceApproveRequiresCaller(t *testing.T) {
	f := &cfgRepoFake{}
	got, err := cfgSvc(f).ApproveChangeRequest(cfgCtx(), "tenant-1", "cr-1", "", &models.ApproveRequest{Comment: "ok"})
	if err == nil {
		t.Fatalf("approving without a caller must fail")
	}
	if got != nil {
		t.Fatalf("got %v, want nil", got)
	}
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("err = %v, want ErrInvalidInput", err)
	}
	if len(f.calls) != 0 {
		t.Fatalf("a rejected caller must not touch the repository: %v", f.calls)
	}
}

func TestCfgServiceApprove(t *testing.T) {
	f := &cfgRepoFake{cr: pendingCR()}
	got, err := cfgSvc(f).ApproveChangeRequest(cfgCtx(), "tenant-1", "cr-1", "u1", &models.ApproveRequest{Comment: "looks good"})
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if got == nil {
		t.Fatalf("got nil")
	}
	if len(got.ApprovalsList) != 1 {
		t.Fatalf("approvals = %v, want one record", got.ApprovalsList)
	}
	rec := got.ApprovalsList[0]
	if rec.Approver != "u1" {
		t.Errorf("approver = %q, want the caller u1", rec.Approver)
	}
	if rec.Action != "approve" {
		t.Errorf("action = %q, want approve", rec.Action)
	}
	if rec.Comment != "looks good" {
		t.Errorf("comment = %q", rec.Comment)
	}
	if rec.ApprovedAt.IsZero() {
		t.Errorf("the approval record must carry a timestamp")
	}
	if got.ApprovedBy == nil || *got.ApprovedBy != "u1" {
		t.Errorf("approved_by = %v, want u1", got.ApprovedBy)
	}
	if got.ApprovedAt == nil || got.ApprovedAt.IsZero() {
		t.Errorf("approved_at must be set")
	}

	if f.lastHistory == nil {
		t.Fatalf("no audit row was written")
	}
	h := f.lastHistory
	if h.Actor != "u1" {
		t.Errorf("actor = %q, want u1", h.Actor)
	}
	if h.Action != "approve" {
		t.Errorf("history action = %q", h.Action)
	}
	if h.ChangeRequestID != "cr-1" || h.TenantID != "tenant-1" {
		t.Errorf("history id/tenant = %q/%q", h.ChangeRequestID, h.TenantID)
	}
	if h.ConfigKey != "db.host" || h.ConfigGroup != "db" || h.Environment != "prod" {
		t.Errorf("history did not capture the change context: %+v", h)
	}
	if h.Notes != "looks good" {
		t.Errorf("notes = %q", h.Notes)
	}

	if f.lastCRAttrs["status"] != models.StatusApproved {
		t.Errorf("status = %v", f.lastCRAttrs["status"])
	}
	if f.lastCRAttrs["approved_by"] != "u1" {
		t.Errorf("approved_by = %v", f.lastCRAttrs["approved_by"])
	}
	if _, ok := f.lastCRAttrs["approved_at"]; !ok {
		t.Errorf("approved_at missing from %v", f.lastCRAttrs)
	}
	approvals, ok := f.lastCRAttrs["approvals"].(string)
	if !ok || !strings.Contains(approvals, "u1") {
		t.Errorf("approvals column = %v, want the JSON approval list", f.lastCRAttrs["approvals"])
	}
	for _, bad := range []string{"id", "tenant_id", "created_at", "executed_by", "rolled_back_by"} {
		if _, ok := f.lastCRAttrs[bad]; ok {
			t.Errorf("update must not touch %s: %v", bad, f.lastCRAttrs)
		}
	}
}

// A second approval must keep the first record. The approvals column is
// rewritten in full on every transition, so a reset-and-append would erase the
// earlier approver from the stored row and from the history that follows it.
func TestCfgServiceApproveAppendsWithExistingApprovals(t *testing.T) {
	f := &cfgRepoFake{cr: pendingCR()}
	first, err := cfgSvc(f).ApproveChangeRequest(cfgCtx(), "tenant-1", "cr-1", "u1", &models.ApproveRequest{Comment: "one"})
	if err != nil {
		t.Fatalf("first approval: %v", err)
	}
	if len(first.ApprovalsList) != 1 {
		t.Fatalf("first approvals = %v, want one record", first.ApprovalsList)
	}

	// The fake hands back the same pointer, so the list the service just
	// appended is already on the row: this is the shape of a row read back from
	// storage after one approval.
	f.cr.Status = models.StatusPending

	second, err := cfgSvc(f).ApproveChangeRequest(cfgCtx(), "tenant-1", "cr-1", "u2", &models.ApproveRequest{Comment: "two"})
	if err != nil {
		t.Fatalf("second approval: %v", err)
	}
	if len(second.ApprovalsList) != 2 {
		t.Fatalf("approvals = %v, want both records kept", second.ApprovalsList)
	}
	if second.ApprovalsList[0].Approver != "u1" || second.ApprovalsList[1].Approver != "u2" {
		t.Fatalf("approvals = %v, want u1 then u2", second.ApprovalsList)
	}
	if second.ApprovalsList[1].Comment != "two" {
		t.Errorf("second comment = %q", second.ApprovalsList[1].Comment)
	}
	if second.ApprovedBy == nil || *second.ApprovedBy != "u2" {
		t.Errorf("approved_by = %v, want the latest approver u2", second.ApprovedBy)
	}
}

func TestCfgServiceApproveInvalidState(t *testing.T) {
	f := &cfgRepoFake{cr: pendingCR()}
	f.cr.Status = models.StatusExecuted
	got, err := cfgSvc(f).ApproveChangeRequest(cfgCtx(), "tenant-1", "cr-1", "u1", &models.ApproveRequest{})
	if !errors.Is(err, ErrInvalidState) {
		t.Fatalf("err = %v, want ErrInvalidState", err)
	}
	if !strings.Contains(err.Error(), string(models.StatusExecuted)) {
		t.Fatalf("err %q must name the blocking status", err.Error())
	}
	if got != nil {
		t.Fatalf("got %v, want nil", got)
	}
	if len(f.calls) != 1 || f.calls[0] != "GetChangeRequest" {
		t.Fatalf("an invalid state must not write: %v", f.calls)
	}
}

func TestCfgServiceApproveMissingRow(t *testing.T) {
	got, err := cfgSvc(&cfgRepoFake{}).ApproveChangeRequest(cfgCtx(), "tenant-1", "cr-1", "u1", &models.ApproveRequest{})
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("err = %v, want sentinel.NotFound", err)
	}
	if got != nil {
		t.Fatalf("got %v, want nil", got)
	}
}

func TestCfgServiceApproveHistoryFailureAborts(t *testing.T) {
	// A lost audit row must not leave an approved change with no approver on
	// record, so the status update has to be skipped.
	f := &cfgRepoFake{cr: pendingCR(), addHistoryErr: errors.New("disk full")}
	got, err := cfgSvc(f).ApproveChangeRequest(cfgCtx(), "tenant-1", "cr-1", "u1", &models.ApproveRequest{})
	if err == nil {
		t.Fatalf("a failed audit write must propagate")
	}
	if got != nil {
		t.Fatalf("got %v, want nil", got)
	}
	if len(f.calls) != 2 || f.calls[1] != "AddChangeHistory" {
		t.Fatalf("calls = %v, want GetChangeRequest then AddChangeHistory", f.calls)
	}
	for _, call := range f.calls {
		if call == "UpdateChangeRequest" {
			t.Fatalf("the status flipped without an audit row: %v", f.calls)
		}
	}
}

func TestCfgServiceExecute(t *testing.T) {
	f := &cfgRepoFake{cr: pendingCR()}
	f.cr.Status = models.StatusApproved
	got, err := cfgSvc(f).ExecuteChangeRequest(cfgCtx(), "tenant-1", "cr-1", "u1")
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if got == nil {
		t.Fatalf("got nil")
	}
	if f.lastHistory == nil {
		t.Fatalf("no audit row was written")
	}
	if f.lastHistory.Actor != "u1" || f.lastHistory.Action != "execute" {
		t.Errorf("history = %+v", f.lastHistory)
	}
	if f.lastHistory.OldValue != "old" || f.lastHistory.NewValue != "new" {
		t.Errorf("history did not carry the values: %+v", f.lastHistory)
	}
	if f.lastCRAttrs["status"] != models.StatusExecuted {
		t.Errorf("status = %v", f.lastCRAttrs["status"])
	}
	if f.lastCRAttrs["executed_by"] != "u1" {
		t.Errorf("executed_by = %v", f.lastCRAttrs["executed_by"])
	}
	if _, ok := f.lastCRAttrs["executed_at"]; !ok {
		t.Errorf("executed_at missing: %v", f.lastCRAttrs)
	}
}

func TestCfgServiceExecuteRequiresActor(t *testing.T) {
	f := &cfgRepoFake{}
	if _, err := cfgSvc(f).ExecuteChangeRequest(cfgCtx(), "tenant-1", "cr-1", ""); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("err = %v, want ErrInvalidInput", err)
	}
	if len(f.calls) != 0 {
		t.Fatalf("calls = %v", f.calls)
	}
}

func TestCfgServiceExecuteInvalidState(t *testing.T) {
	f := &cfgRepoFake{cr: pendingCR()}
	if _, err := cfgSvc(f).ExecuteChangeRequest(cfgCtx(), "tenant-1", "cr-1", "u1"); !errors.Is(err, ErrInvalidState) {
		t.Fatalf("err = %v, want ErrInvalidState", err)
	}
	if len(f.calls) != 1 {
		t.Fatalf("calls = %v", f.calls)
	}
}

func TestCfgServiceRollback(t *testing.T) {
	f := &cfgRepoFake{cr: pendingCR()}
	f.cr.Status = models.StatusExecuted
	got, err := cfgSvc(f).RollbackChangeRequest(cfgCtx(), "tenant-1", "cr-1", "u1", &models.RollbackRequest{Reason: "bad deploy"})
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if got == nil {
		t.Fatalf("got nil")
	}
	if f.lastHistory == nil {
		t.Fatalf("no audit row was written")
	}
	if f.lastHistory.Actor != "u1" || f.lastHistory.Action != "rollback" {
		t.Errorf("history = %+v", f.lastHistory)
	}
	// A rollback records the change in reverse: the new value becomes the old
	// one and vice versa.
	if f.lastHistory.OldValue != "new" || f.lastHistory.NewValue != "old" {
		t.Errorf("rollback history values are not reversed: %+v", f.lastHistory)
	}
	if f.lastHistory.Notes != "bad deploy" {
		t.Errorf("notes = %q", f.lastHistory.Notes)
	}
	if f.lastCRAttrs["status"] != models.StatusRolledBack {
		t.Errorf("status = %v", f.lastCRAttrs["status"])
	}
	if f.lastCRAttrs["rolled_back_by"] != "u1" {
		t.Errorf("rolled_back_by = %v", f.lastCRAttrs["rolled_back_by"])
	}
	if _, ok := f.lastCRAttrs["rolled_back_at"]; !ok {
		t.Errorf("rolled_back_at missing: %v", f.lastCRAttrs)
	}
}

func TestCfgServiceRollbackRequiresActor(t *testing.T) {
	f := &cfgRepoFake{}
	if _, err := cfgSvc(f).RollbackChangeRequest(cfgCtx(), "tenant-1", "cr-1", "", &models.RollbackRequest{}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("err = %v, want ErrInvalidInput", err)
	}
	if len(f.calls) != 0 {
		t.Fatalf("calls = %v", f.calls)
	}
}

func TestCfgServiceRollbackInvalidState(t *testing.T) {
	f := &cfgRepoFake{cr: pendingCR()}
	if _, err := cfgSvc(f).RollbackChangeRequest(cfgCtx(), "tenant-1", "cr-1", "u1", &models.RollbackRequest{}); !errors.Is(err, ErrInvalidState) {
		t.Fatalf("err = %v, want ErrInvalidState", err)
	}
	if len(f.calls) != 1 {
		t.Fatalf("calls = %v", f.calls)
	}
}

func TestCfgServiceChangeHistory(t *testing.T) {
	f := &cfgRepoFake{cr: pendingCR()}
	got, err := cfgSvc(f).GetChangeHistory(cfgCtx(), "tenant-1", "cr-1")
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("got %v, want one entry", got)
	}
	e := got[0]
	if e.Action != "approve" || e.PerformedBy != "u1" || e.Comment != "ok" {
		t.Fatalf("entry = %+v", e)
	}
	if e.At != time.Unix(1700000000, 0).UTC().Unix() {
		t.Fatalf("at = %d", e.At)
	}

	// An empty trail is [], never nil.
	f = &cfgRepoFake{cr: pendingCR(), historyNil: true}
	empty, err := cfgSvc(f).GetChangeHistory(cfgCtx(), "tenant-1", "cr-1")
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if empty == nil {
		t.Fatalf("an empty history must be an empty slice, not nil")
	}
	if len(empty) != 0 {
		t.Fatalf("got %v", empty)
	}

	// The change request must belong to the caller's tenant before its trail is
	// read; a missing row is a 404, not an empty list.
	if _, err := cfgSvc(&cfgRepoFake{}).GetChangeHistory(cfgCtx(), "tenant-1", "cr-1"); !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("err = %v, want sentinel.NotFound", err)
	}
}

func TestCfgServiceDriftDetectDoesNotFabricateDrift(t *testing.T) {
	f := &cfgRepoFake{}
	got, err := cfgSvc(f).DriftDetect(cfgCtx(), "tenant-1", &models.DriftDetectRequest{
		Scope:   "prod",
		Targets: []string{"t1", "t2", "t3"},
	})
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	// Naming three targets is a request for a scan, not evidence of drift.
	if got.Status != string(models.DriftInSync) {
		t.Fatalf("status = %q, want in_sync", got.Status)
	}
	if got.Drifts == nil {
		t.Fatalf("drifts must be an empty slice, not nil")
	}
	if len(got.Drifts) != 0 {
		t.Fatalf("drifts = %v, want none", got.Drifts)
	}
	if got.Targets != 3 || got.Scope != "prod" {
		t.Fatalf("targets/scope = %d/%q", got.Targets, got.Scope)
	}
	if f.lastDrift == nil {
		t.Fatalf("no drift report was persisted")
	}
	if f.lastDrift.ConfigGroup != "prod" {
		t.Errorf("config_group = %q, want the scope", f.lastDrift.ConfigGroup)
	}
	if f.lastDrift.DriftStatus != models.DriftInSync {
		t.Errorf("persisted status = %q", f.lastDrift.DriftStatus)
	}
	if f.lastDrift.TenantID != "tenant-1" {
		t.Errorf("tenant_id = %q", f.lastDrift.TenantID)
	}
	if f.lastDrift.TotalDrifts != 0 {
		t.Errorf("persisted total_drifts = %d, want 0: the row must not claim drift it never measured", f.lastDrift.TotalDrifts)
	}
	if f.lastDrift.DriftItemsList != nil {
		t.Errorf("drift_items = %v, want none", f.lastDrift.DriftItemsList)
	}

	if _, err := cfgSvc(&cfgRepoFake{createDriftErr: errors.New("disk full")}).DriftDetect(cfgCtx(), "tenant-1", &models.DriftDetectRequest{}); err == nil {
		t.Fatalf("a failed drift report must propagate")
	}
}

func TestCfgServiceRemediateDrift(t *testing.T) {
	f := &cfgRepoFake{drifts: map[string]*models.DriftReport{
		"d-1": {ID: "d-1", TenantID: "tenant-1", ConfigGroup: "g", DriftStatus: models.DriftDetected},
	}}
	got, err := cfgSvc(f).RemediateDrift(cfgCtx(), "tenant-1", "d-1", &models.RemediateRequest{Strategy: "replace"})
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if len(got.RemediationLogList) != 1 {
		t.Fatalf("log = %v, want one entry", got.RemediationLogList)
	}
	e := got.RemediationLogList[0]
	if e.DriftID != "d-1" || e.ConfigKey != "g" {
		t.Fatalf("entry = %+v", e)
	}
	if e.Success != true {
		t.Errorf("success = %v", e.Success)
	}
	if !strings.Contains(e.Action, "replace") {
		t.Errorf("action = %q, want the strategy named", e.Action)
	}
	if e.Timestamp.IsZero() {
		t.Errorf("the log entry must carry a timestamp")
	}
	if f.lastDriftAttrs["drift_status"] != models.DriftRemediated {
		t.Errorf("status = %v", f.lastDriftAttrs["drift_status"])
	}
	if log, ok := f.lastDriftAttrs["remediation_log"].(string); !ok || !strings.Contains(log, "replace") {
		t.Errorf("remediation_log = %v", f.lastDriftAttrs["remediation_log"])
	}
	if _, ok := f.lastDriftAttrs["last_checked_at"]; !ok {
		t.Errorf("last_checked_at missing: %v", f.lastDriftAttrs)
	}

	if _, err := cfgSvc(&cfgRepoFake{}).RemediateDrift(cfgCtx(), "tenant-1", "d-1", &models.RemediateRequest{}); !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("err = %v, want sentinel.NotFound", err)
	}
	if _, err := cfgSvc(&cfgRepoFake{getDriftErr: errors.New("connection refused")}).RemediateDrift(cfgCtx(), "tenant-1", "d-1", &models.RemediateRequest{}); err == nil {
		t.Fatalf("a read error must propagate")
	}
}
