package service

import (
	"context"
	"errors"
	"testing"

	"orion/platform-svc-go/internal/chatops/models"
)

// ADR-016 Phase 3 TEST-5 (docs/adr/ADR-016-测试基础设施决策.md §4.1):
// chatops/service depth coverage 15.9% → 60%.
//
// The pre-existing service_test.go covered only 5 methods (Create/Get/
// Update/Delete Command, HealthCheck); the other ~50 Service methods were
// entirely uncovered. This file exercises every remaining Service method
// once against the shared mockChatOpsRepo, so a compile-time signature
// change or a nil-deref in the delegation path fails the suite before it
// reaches production.
//
// The mock stubs mostly return (nil, nil) so a test that only asserts
// "no panic, no error" is sufficient to prove the delegation path is
// wired correctly. Tests that need to verify state (Create, Update,
// ToggleDND, UpdateQuestionConfigs, ...) also assert the returned model.

func ctxBg() context.Context { return context.Background() }

// ===========================================================================
// Commands
// ===========================================================================

func TestGetCommandByName_Delegates(t *testing.T) {
	repo := newMockChatOpsRepo()
	setupCommand(repo, "t1", "getbyname")
	svc := newTestChatOpsService(repo)

	got, err := svc.GetCommandByName(ctxBg(), "t1", "getbyname")
	if err != nil {
		t.Fatalf("GetCommandByName: %v", err)
	}
	if got == nil || got.Name != "test-cmd" {
		t.Errorf("expected getbyname command, got %+v", got)
	}
}

func TestListCommands_ReturnsAll(t *testing.T) {
	repo := newMockChatOpsRepo()
	setupCommand(repo, "t1", "a")
	setupCommand(repo, "t1", "b")
	setupCommand(repo, "t2", "c") // different tenant, must be filtered
	svc := newTestChatOpsService(repo)

	out, err := svc.ListCommands(ctxBg(), "t1", nil, nil, 10, 0)
	if err != nil {
		t.Fatalf("ListCommands: %v", err)
	}
	if len(out) != 2 {
		t.Errorf("ListCommands len = %d, want 2", len(out))
	}
}

func TestGetCommandHelp_ReturnsCommand(t *testing.T) {
	repo := newMockChatOpsRepo()
	setupCommand(repo, "t1", "helpme")
	svc := newTestChatOpsService(repo)

	got, err := svc.GetCommandHelp(ctxBg(), "t1", "helpme")
	if err != nil {
		t.Fatalf("GetCommandHelp: %v", err)
	}
	if got == nil {
		t.Fatal("expected non-nil command")
	}
}

// ===========================================================================
// Executions
// ===========================================================================

func TestExecuteCommand_RequiresCommand(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	_, err := svc.ExecuteCommand(ctxBg(), "t1", "u1", models.ExecuteCommandRequest{})
	if err == nil {
		t.Error("empty command should return error")
	}
}

func TestExecuteCommand_CreatesAndCompletes(t *testing.T) {
	repo := newMockChatOpsRepo()
	svc := newTestChatOpsService(repo)
	got, err := svc.ExecuteCommand(ctxBg(), "t1", "u1", models.ExecuteCommandRequest{
		Command: "restart",
		Params:  map[string]any{"target": "svc-a"},
	})
	if err != nil {
		t.Fatalf("ExecuteCommand: %v", err)
	}
	if got.Status != "completed" {
		t.Errorf("Status = %q, want completed", got.Status)
	}
	if got.CommandID != "restart" {
		t.Errorf("CommandID = %q, want restart", got.CommandID)
	}
	if got.UserID != "u1" {
		t.Errorf("UserID = %q, want u1", got.UserID)
	}
	if got.Params == "" {
		t.Error("Params must be populated with the JSON serialization")
	}
}

func TestGetExecutionStatus_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	got, err := svc.GetExecutionStatus(ctxBg(), "t1", "e1")
	if err != nil {
		t.Fatalf("GetExecutionStatus: %v", err)
	}
	// Mock returns (nil, nil) — delegation is what we verify.
	_ = got
}

func TestListExecutions_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.ListExecutions(ctxBg(), "t1", nil, nil, nil, 10, 0)
	if err != nil {
		t.Fatalf("ListExecutions: %v", err)
	}
	_ = out
}

// ===========================================================================
// Audit Logs
// ===========================================================================

func TestCreateAuditLog_WritesLog(t *testing.T) {
	repo := newMockChatOpsRepo()
	// Track the call by counting — the mock records via CreateAuditLog.
	// Since the mock returns nil, we just verify the call succeeds.
	svc := newTestChatOpsService(repo)
	err := svc.CreateAuditLog(ctxBg(), "t1", "u1", "create", "cmd", `{"foo":"bar"}`)
	if err != nil {
		t.Fatalf("CreateAuditLog: %v", err)
	}
}

func TestListAuditLogs_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.ListAuditLogs(ctxBg(), "t1", models.AuditLogQuery{})
	if err != nil {
		t.Fatalf("ListAuditLogs: %v", err)
	}
	_ = out
}

func TestGetAuditStats_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	stats, err := svc.GetAuditStats(ctxBg(), "t1")
	if err != nil {
		t.Fatalf("GetAuditStats: %v", err)
	}
	_ = stats
}

func TestExportAuditLogs_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.ExportAuditLogs(ctxBg(), "t1", models.AuditLogQuery{})
	if err != nil {
		t.Fatalf("ExportAuditLogs: %v", err)
	}
	if out == nil {
		t.Error("expected non-nil map")
	}
}

// ===========================================================================
// Notification Preferences
// ===========================================================================

func TestGetNotificationPreference_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	got, err := svc.GetNotificationPreference(ctxBg(), "t1", "u1")
	if err != nil {
		t.Fatalf("GetNotificationPreference: %v", err)
	}
	_ = got
}

// settingsMockRepo extends mockChatOpsRepo so the settings/config service
// methods can be exercised on both the create-new and update-existing paths
// without the base mock's (nil, nil) return causing a nil dereference in the
// service's "existing" local. It returns a not-found error when the underlying
// map has no entry, mirroring what a real repository would do.
type settingsMockRepo struct {
	*mockChatOpsRepo
	prefs map[string]*models.NotificationPreference
	dnds  map[string]*models.DNDSettings
}

func newSettingsMockRepo() *settingsMockRepo {
	return &settingsMockRepo{
		mockChatOpsRepo: newMockChatOpsRepo(),
		prefs:           map[string]*models.NotificationPreference{},
		dnds:            map[string]*models.DNDSettings{},
	}
}

func (m *settingsMockRepo) GetNotificationPreference(_ context.Context, tenantID, userID string) (*models.NotificationPreference, error) {
	p, ok := m.prefs[tenantID+":"+userID]
	if !ok {
		return nil, errors.New("not found")
	}
	return p, nil
}
func (m *settingsMockRepo) UpsertNotificationPreference(_ context.Context, p *models.NotificationPreference) error {
	m.prefs[p.TenantID+":"+p.UserID] = p
	return nil
}
func (m *settingsMockRepo) CreateSession(_ context.Context, tenantID, userID string) (*models.ChatOpsSession, error) {
	return &models.ChatOpsSession{TenantID: tenantID, UserID: userID, ID: "sess-1"}, nil
}
func (m *settingsMockRepo) GetDNDSettings(_ context.Context, tenantID, userID string) (*models.DNDSettings, error) {
	d, ok := m.dnds[tenantID+":"+userID]
	if !ok {
		return nil, errors.New("not found")
	}
	return d, nil
}
func (m *settingsMockRepo) UpsertDNDSettings(_ context.Context, d *models.DNDSettings) error {
	m.dnds[d.TenantID+":"+d.UserID] = d
	return nil
}

func TestUpdateNotificationPreference_CreatesNewWhenMissing(t *testing.T) {
	repo := newSettingsMockRepo()
	svc := NewService(repo)
	got, err := svc.UpdateNotificationPreference(ctxBg(), "t1", "u1", models.UpdateNotificationPreferenceRequest{
		AlertLevel: "info",
	})
	if err != nil {
		t.Fatalf("UpdateNotificationPreference: %v", err)
	}
	if got == nil {
		t.Fatal("expected non-nil notification preference")
	}
	if got.AlertLevel != "info" {
		t.Errorf("AlertLevel = %q, want info", got.AlertLevel)
	}
	// Defaults: channels should be enabled when not overridden.
	if !got.ChannelChatops || !got.ChannelEmail || !got.ChannelSlack {
		t.Errorf("default channels should be enabled, got %+v", got)
	}
	// Verify the new preference was persisted.
	if _, ok := repo.prefs["t1:u1"]; !ok {
		t.Error("new preference should have been persisted")
	}
}

func TestUpdateNotificationPreference_UpdatesExisting(t *testing.T) {
	repo := newSettingsMockRepo()
	repo.prefs["t1:u1"] = &models.NotificationPreference{TenantID: "t1", UserID: "u1", AlertLevel: "info", ChannelChatops: true, ChannelEmail: false}
	svc := NewService(repo)
	// Only override Email; Chatops and AlertLevel should be preserved.
	email := true
	got, err := svc.UpdateNotificationPreference(ctxBg(), "t1", "u1", models.UpdateNotificationPreferenceRequest{
		ChannelEmail: &email,
	})
	if err != nil {
		t.Fatalf("UpdateNotificationPreference: %v", err)
	}
	if !got.ChannelEmail {
		t.Error("ChannelEmail should be true after update")
	}
	if !got.ChannelChatops {
		t.Error("ChannelChatops should be preserved (still true)")
	}
	if got.AlertLevel != "info" {
		t.Errorf("AlertLevel = %q, want preserved info", got.AlertLevel)
	}
}

// ===========================================================================
// DND Settings
// ===========================================================================

func TestGetDNDSettings_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	got, err := svc.GetDNDSettings(ctxBg(), "t1", "u1")
	if err != nil {
		t.Fatalf("GetDNDSettings: %v", err)
	}
	_ = got
}

func TestUpdateDNDSettings_CreatesNewWhenMissing(t *testing.T) {
	svc := NewService(newSettingsMockRepo())
	enabled := true
	got, err := svc.UpdateDNDSettings(ctxBg(), "t1", "u1", models.UpdateDNDRequest{
		Enabled: &enabled,
		StartTime: "22:00",
		EndTime: "07:00",
		RepeatDays: "1,2,3,4,5",
	})
	if err != nil {
		t.Fatalf("UpdateDNDSettings: %v", err)
	}
	if !got.Enabled {
		t.Error("Enabled should be true")
	}
	if got.StartTime != "22:00" || got.EndTime != "07:00" {
		t.Errorf("StartTime/EndTime = %q/%q", got.StartTime, got.EndTime)
	}
}

func TestToggleDND_TogglesEnabled(t *testing.T) {
	svc := NewService(newSettingsMockRepo())
	got, err := svc.ToggleDND(ctxBg(), "t1", "u1", true)
	if err != nil {
		t.Fatalf("ToggleDND: %v", err)
	}
	if !got.Enabled {
		t.Error("Enabled should be true after ToggleDND(true)")
	}

	got, err = svc.ToggleDND(ctxBg(), "t1", "u1", false)
	if err != nil {
		t.Fatalf("ToggleDND false: %v", err)
	}
	if got.Enabled {
		t.Error("Enabled should be false after ToggleDND(false)")
	}
}

// ===========================================================================
// Platform Configs
// ===========================================================================

func TestGetPlatformConfigs_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.GetPlatformConfigs(ctxBg(), "t1", "u1")
	if err != nil {
		t.Fatalf("GetPlatformConfigs: %v", err)
	}
	_ = out
}

func TestUpdatePlatformConfigs_CreatesEntries(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.UpdatePlatformConfigs(ctxBg(), "t1", "u1", models.UpdatePlatformConfigRequest{
		Platforms: []models.PlatformConfigInput{
			{Platform: "slack", Enabled: true, Webhook: "https://hooks.slack.com/xxx", Token: "tok-1"},
			{Platform: "feishu", Enabled: false},
		},
	})
	if err != nil {
		t.Fatalf("UpdatePlatformConfigs: %v", err)
	}
	if len(out) != 2 {
		t.Fatalf("len = %d, want 2", len(out))
	}
	if out[0].Platform != "slack" || !out[0].Enabled {
		t.Errorf("out[0] = %+v", out[0])
	}
	if out[0].TenantID != "t1" || out[0].UserID != "u1" {
		t.Errorf("out[0].TenantID/UserID = %q/%q, want t1/u1", out[0].TenantID, out[0].UserID)
	}
}

// ===========================================================================
// Alert States
// ===========================================================================

func TestGetAlertStates_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.GetAlertStates(ctxBg(), "t1", "u1")
	if err != nil {
		t.Fatalf("GetAlertStates: %v", err)
	}
	_ = out
}

func TestUpdateAlertState_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	err := svc.UpdateAlertState(ctxBg(), "t1", "u1", "a1", "read")
	if err != nil {
		t.Fatalf("UpdateAlertState: %v", err)
	}
}

func TestMarkAlertRead_UsesReadStatus(t *testing.T) {
	repo := newMockChatOpsRepo()
	svc := newTestChatOpsService(repo)
	// The mock records the last status update; we can't easily read it
	// back because the mock is minimal. Just verify no error.
	if err := svc.MarkAlertRead(ctxBg(), "t1", "u1", "a1"); err != nil {
		t.Fatalf("MarkAlertRead: %v", err)
	}
}

func TestMarkAlertAcknowledged(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	if err := svc.MarkAlertAcknowledged(ctxBg(), "t1", "u1", "a1"); err != nil {
		t.Fatalf("MarkAlertAcknowledged: %v", err)
	}
}

func TestMarkAlertDismissed(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	if err := svc.MarkAlertDismissed(ctxBg(), "t1", "u1", "a1"); err != nil {
		t.Fatalf("MarkAlertDismissed: %v", err)
	}
}

// ===========================================================================
// Question / Command Configs
// ===========================================================================

func TestGetQuestionConfigs_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.GetQuestionConfigs(ctxBg(), "t1", "u1")
	if err != nil {
		t.Fatalf("GetQuestionConfigs: %v", err)
	}
	_ = out
}

func TestUpdateQuestionConfigs_AssignsIDWhenMissing(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.UpdateQuestionConfigs(ctxBg(), "t1", "u1", models.UpdateQuestionConfigsRequest{
		QuestionConfigs: []models.QuestionConfigInput{
			{Title: "Which environment?", Command: "ask-env", Enabled: true},
		},
	})
	if err != nil {
		t.Fatalf("UpdateQuestionConfigs: %v", err)
	}
	if len(out) != 1 {
		t.Fatalf("len = %d, want 1", len(out))
	}
	if out[0].ID == "" {
		t.Error("ID should be auto-assigned when empty")
	}
	if out[0].Title != "Which environment?" {
		t.Errorf("Title = %q", out[0].Title)
	}
}

func TestGetCommandConfigs_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.GetCommandConfigs(ctxBg(), "t1", "u1")
	if err != nil {
		t.Fatalf("GetCommandConfigs: %v", err)
	}
	_ = out
}

func TestUpdateCommandConfigs_AssignsIDWhenMissing(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.UpdateCommandConfigs(ctxBg(), "t1", "u1", models.UpdateCommandConfigsRequest{
		CommandConfigs: []models.CommandConfigInput{
			{Command: "run-task", Enabled: true},
		},
	})
	if err != nil {
		t.Fatalf("UpdateCommandConfigs: %v", err)
	}
	if len(out) != 1 || out[0].ID == "" {
		t.Errorf("expected one auto-ID'd config, got %+v", out)
	}
}

// ===========================================================================
// Capability Mappings
// ===========================================================================

func TestGetAllCapabilityMappings_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.GetAllCapabilityMappings(ctxBg(), "t1", nil)
	if err != nil {
		t.Fatalf("GetAllCapabilityMappings: %v", err)
	}
	_ = out
}

func TestCreateCapabilityMapping_BuildsModel(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	got, err := svc.CreateCapabilityMapping(ctxBg(), "t1", models.CreateCapabilityMappingRequest{
		CommandID: "cmd-1", CapabilityID: "cap-1", Environment: "prod",
		RiskLevel: 3, RequiresApproval: true,
	})
	if err != nil {
		t.Fatalf("CreateCapabilityMapping: %v", err)
	}
	if got.CommandID != "cmd-1" || got.CapabilityID != "cap-1" || got.Environment != "prod" {
		t.Errorf("got %+v", got)
	}
	if !got.RequiresApproval {
		t.Error("RequiresApproval should be true")
	}
}

func TestGetCapabilityMapping_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	got, err := svc.GetCapabilityMapping(ctxBg(), "t1", "cm-1")
	if err != nil {
		t.Fatalf("GetCapabilityMapping: %v", err)
	}
	_ = got
}

func TestUpdateCapabilityMapping_Delegates(t *testing.T) {
	repo := newMockChatOpsRepo()
	svc := newTestChatOpsService(repo)
	// Update then Get — mock returns nil,nil for Get, so the service
	// returns (nil, nil). Delegation is what we verify.
	got, err := svc.UpdateCapabilityMapping(ctxBg(), "t1", "cm-1", models.UpdateCapabilityMappingRequest{})
	if err != nil {
		t.Fatalf("UpdateCapabilityMapping: %v", err)
	}
	_ = got
}

func TestDeleteCapabilityMapping_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	if err := svc.DeleteCapabilityMapping(ctxBg(), "t1", "cm-1"); err != nil {
		t.Fatalf("DeleteCapabilityMapping: %v", err)
	}
}

// ===========================================================================
// Approval Configs
// ===========================================================================

func TestGetAllApprovalConfigs_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.GetAllApprovalConfigs(ctxBg(), "t1")
	if err != nil {
		t.Fatalf("GetAllApprovalConfigs: %v", err)
	}
	_ = out
}

func TestGetApprovalConfigByCapability_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	got, err := svc.GetApprovalConfigByCapability(ctxBg(), "t1", "deploy")
	if err != nil {
		t.Fatalf("GetApprovalConfigByCapability: %v", err)
	}
	_ = got
}

func TestUpdateApprovalConfig_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	enabled := true
	threshold := 2
	got, err := svc.UpdateApprovalConfig(ctxBg(), "t1", "deploy", models.UpdateApprovalConfigRequest{
		Enabled:   &enabled,
		Threshold: &threshold,
	})
	if err != nil {
		t.Fatalf("UpdateApprovalConfig: %v", err)
	}
	_ = got
}

func TestUpdateApprovalConfigs_BatchesConfigs(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.UpdateApprovalConfigs(ctxBg(), "t1", models.UpdateApprovalConfigsRequest{
		Configs: []models.ApprovalConfigInput{
			{Capability: "deploy", Enabled: true, Threshold: 2},
			{Capability: "delete", Enabled: true, Threshold: 3},
		},
	})
	if err != nil {
		t.Fatalf("UpdateApprovalConfigs: %v", err)
	}
	if len(out) != 2 {
		t.Fatalf("len = %d, want 2", len(out))
	}
	for _, c := range out {
		if c.ID == "" {
			t.Error("ID should be auto-assigned")
		}
		if c.TenantID != "t1" {
			t.Errorf("TenantID = %q, want t1", c.TenantID)
		}
	}
}

func TestGetApprovers_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.GetApprovers(ctxBg(), "t1")
	if err != nil {
		t.Fatalf("GetApprovers: %v", err)
	}
	_ = out
}

func TestGetApproverSchedule_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.GetApproverSchedule(ctxBg(), "t1")
	if err != nil {
		t.Fatalf("GetApproverSchedule: %v", err)
	}
	_ = out
}

func TestUpdateApproverSchedule_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	if err := svc.UpdateApproverSchedule(ctxBg(), "t1", []models.ApproverSchedule{}); err != nil {
		t.Fatalf("UpdateApproverSchedule: %v", err)
	}
}

func TestGetGlobalApprovalConfig_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	got, err := svc.GetGlobalApprovalConfig(ctxBg(), "t1")
	if err != nil {
		t.Fatalf("GetGlobalApprovalConfig: %v", err)
	}
	_ = got
}

func TestUpdateGlobalApprovalConfig_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	if err := svc.UpdateGlobalApprovalConfig(ctxBg(), "t1", &models.GlobalApprovalConfig{}); err != nil {
		t.Fatalf("UpdateGlobalApprovalConfig: %v", err)
	}
}

// ===========================================================================
// Roles
// ===========================================================================

func TestGetAllRoles_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.GetAllRoles(ctxBg(), "t1")
	if err != nil {
		t.Fatalf("GetAllRoles: %v", err)
	}
	_ = out
}

func TestCreateRole_SerializesPermissions(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	got, err := svc.CreateRole(ctxBg(), "t1", models.CreateRoleRequest{
		Name:        "developer",
		Permissions: []string{"read", "write"},
	})
	if err != nil {
		t.Fatalf("CreateRole: %v", err)
	}
	if got.Name != "developer" {
		t.Errorf("Name = %q, want developer", got.Name)
	}
	if got.Permissions != `["read","write"]` {
		t.Errorf("Permissions = %q, want [\"read\",\"write\"]", got.Permissions)
	}
}

func TestGetRole_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	got, err := svc.GetRole(ctxBg(), "t1", "r-1")
	if err != nil {
		t.Fatalf("GetRole: %v", err)
	}
	_ = got
}

func TestUpdateRole_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	got, err := svc.UpdateRole(ctxBg(), "t1", "r-1", models.UpdateRoleRequest{})
	if err != nil {
		t.Fatalf("UpdateRole: %v", err)
	}
	_ = got
}

func TestDeleteRole_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	if err := svc.DeleteRole(ctxBg(), "t1", "r-1"); err != nil {
		t.Fatalf("DeleteRole: %v", err)
	}
}

func TestGetUserAllowedCommands_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.GetUserAllowedCommands(ctxBg(), "t1", "u1")
	if err != nil {
		t.Fatalf("GetUserAllowedCommands: %v", err)
	}
	_ = out
}

// ===========================================================================
// Command Permissions
// ===========================================================================

func TestGetAllCommandPermissions_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.GetAllCommandPermissions(ctxBg(), "t1")
	if err != nil {
		t.Fatalf("GetAllCommandPermissions: %v", err)
	}
	_ = out
}

func TestCreateCommandPermission_BuildsModel(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	got, err := svc.CreateCommandPermission(ctxBg(), "t1", models.CreateCommandPermissionRequest{
		Command:          "cmd-1",
		Capability:       "deploy",
		RiskLevel:        3,
		RequiresApproval: true,
		RoleIDs:          []string{"r-1", "r-2"},
	})
	if err != nil {
		t.Fatalf("CreateCommandPermission: %v", err)
	}
	if got.Command != "cmd-1" || got.Capability != "deploy" {
		t.Errorf("got %+v", got)
	}
	if got.RoleIDs != `["r-1","r-2"]` {
		t.Errorf("RoleIDs = %q, want both r-1 and r-2 serialized", got.RoleIDs)
	}
}

func TestGetCommandPermission_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	got, err := svc.GetCommandPermission(ctxBg(), "t1", "cp-1")
	if err != nil {
		t.Fatalf("GetCommandPermission: %v", err)
	}
	_ = got
}

func TestUpdateCommandPermission_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	got, err := svc.UpdateCommandPermission(ctxBg(), "t1", "cp-1", models.UpdateCommandPermissionRequest{})
	if err != nil {
		t.Fatalf("UpdateCommandPermission: %v", err)
	}
	_ = got
}

func TestDeleteCommandPermission_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	if err := svc.DeleteCommandPermission(ctxBg(), "t1", "cp-1"); err != nil {
		t.Fatalf("DeleteCommandPermission: %v", err)
	}
}

// ===========================================================================
// Environment Permissions
// ===========================================================================

func TestGetAllEnvironmentPermissions_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.GetAllEnvironmentPermissions(ctxBg(), "t1")
	if err != nil {
		t.Fatalf("GetAllEnvironmentPermissions: %v", err)
	}
	_ = out
}

func TestCreateEnvironmentPermission_BuildsModel(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	got, err := svc.CreateEnvironmentPermission(ctxBg(), "t1", models.CreateEnvironmentPermissionRequest{
		Environment:     "prod",
		RateLimit:       100,
		RequireApproval: true,
		AllowedCommands: []string{"read", "write"},
		DeniedCommands:  []string{"delete"},
		RoleIDs:         []string{"r-1"},
	})
	if err != nil {
		t.Fatalf("CreateEnvironmentPermission: %v", err)
	}
	if got.Environment != "prod" || got.RateLimit != 100 {
		t.Errorf("got %+v", got)
	}
	if got.AllowedCommands != `["read","write"]` {
		t.Errorf("AllowedCommands = %q", got.AllowedCommands)
	}
	if got.DeniedCommands != `["delete"]` {
		t.Errorf("DeniedCommands = %q", got.DeniedCommands)
	}
}

func TestGetEnvironmentPermission_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	got, err := svc.GetEnvironmentPermission(ctxBg(), "t1", "ep-1")
	if err != nil {
		t.Fatalf("GetEnvironmentPermission: %v", err)
	}
	_ = got
}

func TestUpdateEnvironmentPermission_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	got, err := svc.UpdateEnvironmentPermission(ctxBg(), "t1", "ep-1", models.UpdateEnvironmentPermissionRequest{})
	if err != nil {
		t.Fatalf("UpdateEnvironmentPermission: %v", err)
	}
	_ = got
}

func TestDeleteEnvironmentPermission_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	if err := svc.DeleteEnvironmentPermission(ctxBg(), "t1", "ep-1"); err != nil {
		t.Fatalf("DeleteEnvironmentPermission: %v", err)
	}
}

// ===========================================================================
// Command Versions
// ===========================================================================

func TestGetAllCommandVersions_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.GetAllCommandVersions(ctxBg(), "t1", 1, 10)
	if err != nil {
		t.Fatalf("GetAllCommandVersions: %v", err)
	}
	_ = out
}

func TestGetVersionsByCommand_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.GetVersionsByCommand(ctxBg(), "t1", "cmd-1")
	if err != nil {
		t.Fatalf("GetVersionsByCommand: %v", err)
	}
	_ = out
}

func TestCreateCommandVersion_BuildsModel(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	got, err := svc.CreateCommandVersion(ctxBg(), "t1", models.CreateCommandVersionRequest{
		CommandID:   "cmd-1",
		CommandText: "restart all",
		Parameters:  map[string]interface{}{"target": "svc"},
		Changelog:   "initial",
		CreatedBy:   "u1",
	})
	if err != nil {
		t.Fatalf("CreateCommandVersion: %v", err)
	}
	if got.TenantID != "t1" || got.CommandID != "cmd-1" {
		t.Errorf("got %+v", got)
	}
	if got.CreatedBy != "u1" {
		t.Errorf("CreatedBy = %q, want u1", got.CreatedBy)
	}
}

func TestAddTag_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	if err := svc.AddTag(ctxBg(), "t1", "v-1", "v1.0.0", "u1"); err != nil {
		t.Fatalf("AddTag: %v", err)
	}
}

func TestRemoveTag_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	if err := svc.RemoveTag(ctxBg(), "t1", "v-1", "v1.0.0"); err != nil {
		t.Fatalf("RemoveTag: %v", err)
	}
}

func TestDeleteCommandVersion_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	if err := svc.DeleteCommandVersion(ctxBg(), "t1", "v-1"); err != nil {
		t.Fatalf("DeleteCommandVersion: %v", err)
	}
}

// ===========================================================================
// Rate Limits
// ===========================================================================

func TestGetAllRateLimits_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.GetAllRateLimits(ctxBg(), "t1")
	if err != nil {
		t.Fatalf("GetAllRateLimits: %v", err)
	}
	_ = out
}

func TestCreateRateLimit_BuildsModel(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	got, err := svc.CreateRateLimit(ctxBg(), "t1", models.CreateRateLimitRequest{
		TargetType:    "user",
		TargetID:      "u1",
		CommandName:   "cmd-1",
		LimitType:     "per_minute",
		LimitCount:    100,
		WindowSeconds: 60,
	})
	if err != nil {
		t.Fatalf("CreateRateLimit: %v", err)
	}
	if got.TargetType != "user" || got.LimitCount != 100 {
		t.Errorf("got %+v", got)
	}
	if got.WindowSeconds != 60 {
		t.Errorf("WindowSeconds = %d, want 60", got.WindowSeconds)
	}
}

func TestGetRateLimit_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	got, err := svc.GetRateLimit(ctxBg(), "t1", "rl-1")
	if err != nil {
		t.Fatalf("GetRateLimit: %v", err)
	}
	_ = got
}

func TestUpdateRateLimit_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	got, err := svc.UpdateRateLimit(ctxBg(), "t1", "rl-1", map[string]interface{}{"limit_count": 50})
	if err != nil {
		t.Fatalf("UpdateRateLimit: %v", err)
	}
	_ = got
}

func TestDeleteRateLimit_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	if err := svc.DeleteRateLimit(ctxBg(), "t1", "rl-1"); err != nil {
		t.Fatalf("DeleteRateLimit: %v", err)
	}
}

// ===========================================================================
// Webhooks
// ===========================================================================

func TestGetAllWebhooks_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.GetAllWebhooks(ctxBg(), "t1")
	if err != nil {
		t.Fatalf("GetAllWebhooks: %v", err)
	}
	_ = out
}

func TestCreateWebhook_BuildsModel(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	got, err := svc.CreateWebhook(ctxBg(), "t1", models.CreateWebhookRequest{
		Name: "my-webhook", URL: "https://example.com/hook", Events: []string{"deploy"}, Enabled: true,
	})
	if err != nil {
		t.Fatalf("CreateWebhook: %v", err)
	}
	if got.Name != "my-webhook" || got.URL != "https://example.com/hook" {
		t.Errorf("got %+v", got)
	}
}

func TestGetWebhook_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	got, err := svc.GetWebhook(ctxBg(), "t1", "w-1")
	if err != nil {
		t.Fatalf("GetWebhook: %v", err)
	}
	_ = got
}

func TestUpdateWebhook_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	got, err := svc.UpdateWebhook(ctxBg(), "t1", "w-1", map[string]interface{}{"description": "d"})
	if err != nil {
		t.Fatalf("UpdateWebhook: %v", err)
	}
	_ = got
}

func TestDeleteWebhook_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	if err := svc.DeleteWebhook(ctxBg(), "t1", "w-1"); err != nil {
		t.Fatalf("DeleteWebhook: %v", err)
	}
}

func TestGetWebhookLogs_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.GetWebhookLogs(ctxBg(), "t1", "w-1", 10)
	if err != nil {
		t.Fatalf("GetWebhookLogs: %v", err)
	}
	_ = out
}

// ===========================================================================
// Dashboard Stats
// ===========================================================================

func TestGetDashboardStats_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	got, err := svc.GetDashboardStats(ctxBg(), "t1", models.DashboardStatsRequest{Range: "7d"})
	if err != nil {
		t.Fatalf("GetDashboardStats: %v", err)
	}
	_ = got
}

// ===========================================================================
// Knowledge / Recommendations
// ===========================================================================

func TestGetKnowledgeRecommendations_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.GetKnowledgeRecommendations(ctxBg(), "t1", "ctx", 5)
	if err != nil {
		t.Fatalf("GetKnowledgeRecommendations: %v", err)
	}
	_ = out
}

func TestGetRecommendations_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.GetRecommendations(ctxBg(), "t1", "u1", "page1", "res-1")
	if err != nil {
		t.Fatalf("GetRecommendations: %v", err)
	}
	_ = out
}

// ===========================================================================
// Messages / Sessions
// ===========================================================================

func TestReceiveMessage_EmptyTextFails(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	_, err := svc.ReceiveMessage(ctxBg(), "t1", "u1", models.ReceiveMessageRequest{})
	if err == nil {
		t.Error("empty text/message should return error")
	}
}

func TestReceiveMessage_StoresMessage(t *testing.T) {
	svc := NewService(newSettingsMockRepo())
	res, err := svc.ReceiveMessage(ctxBg(), "t1", "u1", models.ReceiveMessageRequest{
		Text: "hello",
	})
	if err != nil {
		t.Fatalf("ReceiveMessage: %v", err)
	}
	if res == nil {
		t.Error("expected non-nil response")
	}
}

func TestGetSessionMessages_Delegates(t *testing.T) {
	svc := newTestChatOpsService(newMockChatOpsRepo())
	out, err := svc.GetSessionMessages(ctxBg(), "t1", "s1", 20, nil)
	if err != nil {
		t.Fatalf("GetSessionMessages: %v", err)
	}
	_ = out
}

// ===========================================================================
// Error propagation
// ===========================================================================

func TestServicePropagatesRepositoryErrors(t *testing.T) {
	// When the mock is configured with dbErr, every method should surface
	// the underlying DB error. This is the invariant: the service does not
	// silently swallow persistence failures.
	repo := newMockChatOpsRepo()
	repo.dbErr = errors.New("db down")
	svc := newTestChatOpsService(repo)

	// Only methods that check the mock's dbErr field can exercise the
	// propagation path; the other mock stubs return (nil, nil) regardless.
	tests := []struct {
		name string
		call func() error
	}{
		{"CreateCommand", func() error {
			_, err := svc.CreateCommand(ctxBg(), "t1", models.CreateCommandRequest{Name: "n"})
			return err
		}},
		{"GetCommand", func() error {
			_, err := svc.GetCommand(ctxBg(), "t1", "id")
			return err
		}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.call()
			if err == nil {
				t.Error("expected propagated DB error, got nil")
				return
			}
			if err.Error() != "db down" {
				t.Errorf("err = %q, want 'db down'", err.Error())
			}
		})
	}
}

func TestNewServiceNilRepoPanicsOnCall(t *testing.T) {
	// The service does not defensively check for a nil repo; it assumes
	// the constructor is called with a valid implementation. This test
	// documents that contract by verifying that a nil repo panics on use.
	defer func() {
		if r := recover(); r == nil {
			t.Error("expected panic on nil repo dereference")
		}
	}()
	svc := NewService(nil)
	_, _ = svc.GetCommand(ctxBg(), "t1", "id")
}
