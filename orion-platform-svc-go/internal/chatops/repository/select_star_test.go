package repository

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/chatops/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

var ws = regexp.MustCompile(`\s+`)

func normSQL(s string) string {
	return strings.TrimSpace(ws.ReplaceAllString(s, " "))
}

// mockDB returns a sqlx.DB backed by sqlmock. The matcher compares the compiled
// statement after collapsing whitespace, so an expectation written against
// "SELECT id,tenant_id,name,..." will not quietly satisfy a call that sends
// "SELECT *". sqlx.NewDb never calls Unsafe, which matches how go-common builds
// the production handle, so the scans below run in the same safe mode the server
// does.
func mockDB(t *testing.T) (*sqlx.DB, sqlmock.Sqlmock) {
	t.Helper()
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		if normSQL(expected) != normSQL(actual) {
			return fmt.Errorf("sql mismatch: want %q got %q", expected, actual)
		}
		return nil
	})))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return sqlx.NewDb(raw, "postgres"), mock
}

// TestSelectStarIntoTypedModelFailsOnSoftDeleteColumn pins the mechanism the
// column lists below exist to avoid. 571 added deleted_at to every chatops
// table; no chatops model declares it. Scanning SELECT * into a typed model
// therefore fails on the very first row, and the error is not sql.ErrNoRows, so
// it walked out of the repository and out of the service and chatops answered
// 500 on every read endpoint.
func TestSelectStarIntoTypedModelFailsOnSoftDeleteColumn(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT * FROM chatops_commands WHERE id=$1 AND tenant_id=$2`).WithArgs("c-1", "t-1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "subcommand", "aliases", "description", "permission_level",
			"schema", "examples", "created_at", "updated_at", "deleted_at",
		}).AddRow("c-1", "t-1", "deploy", "", "", "deploy a service", "read", "", "", now, now, nil))

	// Scan the driver's SELECT * output straight into the model, bypassing the
	// repository, so this test cannot drift along with it and keep failing for the
	// wrong reason.
	var m models.ChatOpsCommand
	err := db.GetContext(context.Background(), &m,
		`SELECT * FROM chatops_commands WHERE id=$1 AND tenant_id=$2`, "c-1", "t-1")
	if err == nil || !strings.Contains(err.Error(), "missing destination name deleted_at") {
		t.Fatalf("expected the safe-mode missing-destination error, got %v", err)
	}
}

// --- regression: every read below selects the model's columns and still returns
// --- the row. Before the fix these same calls returned an error instead of data.

func TestGetCommand_SelectsTheModelColumns(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT `+commandColumns+` FROM chatops_commands WHERE id=$1 AND tenant_id=$2`).
		WithArgs("c-1", "t-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "subcommand", "aliases", "description", "permission_level",
		"schema", "examples", "created_at", "updated_at",
	}).AddRow("c-1", "t-1", "deploy", "service", "", "deploy a service", "read", "", "", now, now))

	got, err := NewRepository(db).GetCommand(context.Background(), "t-1", "c-1")
	if err != nil {
		t.Fatalf("GetCommand: %v", err)
	}
	if got.Name != "deploy" || got.PermissionLevel != "read" || got.Description != "deploy a service" {
		t.Errorf("unexpected row: %+v", got)
	}
}

func TestListCommands_NoFilterBranch(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT `+commandColumns+` FROM chatops_commands WHERE tenant_id=$1 ORDER BY name LIMIT $2 OFFSET $3`).
		WithArgs("t-1", 50, 0).WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "subcommand", "aliases", "description", "permission_level",
		"schema", "examples", "created_at", "updated_at",
	}).AddRow("c-1", "t-1", "deploy", "", "", "d", "read", "", "", now, now))

	got, err := NewRepository(db).ListCommands(context.Background(), "t-1", nil, nil, 0, 0)
	if err != nil {
		t.Fatalf("ListCommands: %v", err)
	}
	if len(got) != 1 || got[0].Name != "deploy" {
		t.Errorf("unexpected rows: %+v", got)
	}
}

func TestGetExecution_SelectsTheModelColumns(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT `+executionColumns+` FROM chatops_executions WHERE id=$1 AND tenant_id=$2`).
		WithArgs("e-1", "t-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "command_id", "user_id", "status", "params", "result", "milestones",
		"start_time", "end_time", "created_at",
	}).AddRow("e-1", "t-1", "c-1", "u-1", "completed", "", "ok", "", now, nil, now))

	got, err := NewRepository(db).GetExecution(context.Background(), "t-1", "e-1")
	if err != nil {
		t.Fatalf("GetExecution: %v", err)
	}
	if got.Status != "completed" || got.Result != "ok" || got.CommandID != "c-1" {
		t.Errorf("unexpected row: %+v", got)
	}
}

func TestListAuditLogs_NoFilterBranch(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT `+auditLogColumns+` FROM chatops_audit_logs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`).
		WithArgs("t-1", 50, 0).WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "user_id", "action", "command", "details", "created_at",
	}).AddRow("l-1", "t-1", "u-1", "execute", "deploy", "", now))

	got, err := NewRepository(db).ListAuditLogs(context.Background(), "t-1", &models.AuditLogQuery{})
	if err != nil {
		t.Fatalf("ListAuditLogs: %v", err)
	}
	if len(got) != 1 || got[0].Command != "deploy" || got[0].Action != "execute" {
		t.Errorf("unexpected rows: %+v", got)
	}
}

func TestGetNotificationPreference_SelectsTheModelColumns(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT `+notificationColumns+` FROM chatops_notification_preferences WHERE tenant_id=$1 AND user_id=$2`).
		WithArgs("t-1", "u-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "user_id", "alert_level", "channel_chatops", "channel_email",
		"channel_slack", "channel_feishu", "channel_dingtalk",
	}).AddRow("n-1", "t-1", "u-1", "high", true, false, true, false, false))

	got, err := NewRepository(db).GetNotificationPreference(context.Background(), "t-1", "u-1")
	if err != nil {
		t.Fatalf("GetNotificationPreference: %v", err)
	}
	if !got.ChannelChatops || !got.ChannelSlack || got.ChannelEmail || got.AlertLevel != "high" {
		t.Errorf("unexpected row: %+v", got)
	}
}

func TestGetDNDSettings_SelectsTheModelColumns(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT `+dndColumns+` FROM chatops_dnd_settings WHERE tenant_id=$1 AND user_id=$2`).
		WithArgs("t-1", "u-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "user_id", "enabled", "start_time", "end_time", "repeat_days", "allow_critical",
	}).AddRow("d-1", "t-1", "u-1", true, "22:00", "08:00", "MON-FRI", false))

	got, err := NewRepository(db).GetDNDSettings(context.Background(), "t-1", "u-1")
	if err != nil {
		t.Fatalf("GetDNDSettings: %v", err)
	}
	if !got.Enabled || got.StartTime != "22:00" || got.RepeatDays != "MON-FRI" {
		t.Errorf("unexpected row: %+v", got)
	}
}

func TestGetPlatformConfigs_SelectsTheModelColumns(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT `+platformConfigColumns+` FROM chatops_platform_configs WHERE tenant_id=$1 AND user_id=$2`).
		WithArgs("t-1", "u-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "user_id", "platform", "enabled", "webhook", "token",
	}).AddRow("p-1", "t-1", "u-1", "slack", true, "https://hooks.example/1", "s3cr3t"))

	got, err := NewRepository(db).GetPlatformConfigs(context.Background(), "t-1", "u-1")
	if err != nil {
		t.Fatalf("GetPlatformConfigs: %v", err)
	}
	if len(got) != 1 || got[0].Platform != "slack" || !got[0].Enabled || got[0].Token != "s3cr3t" {
		t.Errorf("unexpected rows: %+v", got)
	}
}

func TestGetWebhook_SelectsTheModelColumns(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT `+webhookColumns+` FROM chatops_webhooks WHERE id=$1 AND tenant_id=$2`).
		WithArgs("w-1", "t-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "url", "events", "secret_key", "enabled", "retry_count",
		"timeout_seconds", "headers", "description", "created_by", "created_at",
	}).AddRow("w-1", "t-1", "ci-done", "https://example.test/hook", `["ci_done"]`,
		"shh", true, 3, 15, `{"X-Team":"ci"}`, "ci webhook", "u-1", now))

	got, err := NewRepository(db).GetWebhook(context.Background(), "t-1", "w-1")
	if err != nil {
		t.Fatalf("GetWebhook: %v", err)
	}
	if got.URL != "https://example.test/hook" || got.SecretKey != "shh" ||
		got.TimeoutSeconds != 15 || !got.Enabled || got.Headers != `{"X-Team":"ci"}` {
		t.Errorf("unexpected row: %+v", got)
	}
}

func TestGetSessionMessages_NoCursor(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT `+messageColumns+` FROM chatops_messages WHERE tenant_id=$1 AND session_id=$2 ORDER BY created_at DESC LIMIT $3`).
		WithArgs("t-1", "s-1", 20).WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "session_id", "user_id", "text", "platform", "created_at",
	}).AddRow("m-1", "t-1", "s-1", "u-1", "deploy svc", "chatops", now))

	got, err := NewRepository(db).GetSessionMessages(context.Background(), "t-1", "s-1", 20, nil)
	if err != nil {
		t.Fatalf("GetSessionMessages: %v", err)
	}
	if len(got) != 1 || got[0].Text != "deploy svc" || got[0].Platform != "chatops" {
		t.Errorf("unexpected rows: %+v", got)
	}
}

func TestGetCommandPermission_SelectsTheModelColumns(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT `+commandPermissionColumns+` FROM chatops_command_permissions WHERE id=$1 AND tenant_id=$2`).
		WithArgs("cp-1", "t-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "command", "description", "capability", "risk_level", "requires_approval", "role_ids",
	}).AddRow("cp-1", "t-1", "deploy", "deploy a service", "deploy_service", 3, true, ""))

	got, err := NewRepository(db).GetCommandPermission(context.Background(), "t-1", "cp-1")
	if err != nil {
		t.Fatalf("GetCommandPermission: %v", err)
	}
	if got.Capability != "deploy_service" || got.RiskLevel != 3 || !got.RequiresApproval {
		t.Errorf("unexpected row: %+v", got)
	}
}

// TestGetRole_UsesTheTable020Created pins the second half of the missing-table
// defect: the repository pointed at chatops_roles, which no migration creates,
// while 020 already created chatops_permission_roles with the same five columns.
func TestGetRole_UsesTheTable020Created(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT `+roleColumns+` FROM chatops_permission_roles WHERE id=$1 AND tenant_id=$2`).
		WithArgs("r-1", "t-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "description", "permissions",
	}).AddRow("r-1", "t-1", "admin", "chatops admin", `["chatops:*"]`))

	got, err := NewRepository(db).GetRole(context.Background(), "t-1", "r-1")
	if err != nil {
		t.Fatalf("GetRole: %v", err)
	}
	if got.Name != "admin" || got.Permissions != `["chatops:*"]` {
		t.Errorf("unexpected row: %+v", got)
	}
}

func TestGetAllRoles_SelectsTheModelColumns(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT ` + roleColumns + ` FROM chatops_permission_roles WHERE tenant_id=$1 ORDER BY name`).
		WithArgs("t-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "description", "permissions",
	}).AddRow("r-1", "t-1", "admin", "chatops admin", `["chatops:*"]`))

	got, err := NewRepository(db).GetAllRoles(context.Background(), "t-1")
	if err != nil {
		t.Fatalf("GetAllRoles: %v", err)
	}
	if len(got) != 1 || got[0].Name != "admin" {
		t.Errorf("unexpected rows: %+v", got)
	}
}

func TestGetApprovers_SelectsTheModelColumns(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT ` + approverColumns + ` FROM chatops_approvers WHERE tenant_id=$1`).
		WithArgs("t-1").WillReturnRows(sqlmock.NewRows([]string{
		"user_id", "enabled",
	}).AddRow("u-1", true))

	got, err := NewRepository(db).GetApprovers(context.Background(), "t-1")
	if err != nil {
		t.Fatalf("GetApprovers: %v", err)
	}
	if len(got) != 1 || got[0].UserID != "u-1" || !got[0].Enabled {
		t.Errorf("unexpected rows: %+v", got)
	}
}

func TestGetWebhookLogs_SelectsTheModelColumns(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT `+webhookLogColumns+` FROM chatops_webhook_logs WHERE tenant_id=$1 AND webhook_id=$2 ORDER BY created_at DESC LIMIT $3`).
		WithArgs("t-1", "w-1", 20).WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "webhook_id", "status", "response_body", "error", "duration_ms", "created_at",
	}).AddRow("wl-1", "t-1", "w-1", "delivered", "ok", "", int64(42), time.Now().UTC()))

	got, err := NewRepository(db).GetWebhookLogs(context.Background(), "t-1", "w-1", 20)
	if err != nil {
		t.Fatalf("GetWebhookLogs: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected one log, got %d", len(got))
	}
	if got[0]["status"] != "delivered" || got[0]["duration_ms"] != int64(42) {
		t.Errorf("unexpected row: %v", got[0])
	}
}

func TestGetKnowledgeRecommendations_SelectsTheModelColumns(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT `+knowledgeColumns+` FROM chatops_knowledge_recommendations WHERE tenant_id=$1 AND (context=$2 OR context='general') ORDER BY created_at DESC LIMIT $3`).
		WithArgs("t-1", "deploy", 10).WillReturnRows(sqlmock.NewRows([]string{
		"id", "title", "context", "description",
	}).AddRow("k-1", "deploy blue-green", "deploy", "use the blue-green template"))

	got, err := NewRepository(db).GetKnowledgeRecommendations(context.Background(), "t-1", "deploy", 10)
	if err != nil {
		t.Fatalf("GetKnowledgeRecommendations: %v", err)
	}
	if len(got) != 1 || got[0].Title != "deploy blue-green" || got[0].Context != "deploy" {
		t.Errorf("unexpected rows: %+v", got)
	}
}

// TestInsertWebhookLog_WritesTheDeliveryRow pins the only writer the relation
// has: before it existed chatops_webhook_logs was read but never written, so the
// logs endpoint could only ever return an empty slice.
func TestInsertWebhookLog_WritesTheDeliveryRow(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`INSERT INTO chatops_webhook_logs (id, tenant_id, webhook_id, status, response_body, error, duration_ms, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`).
		WithArgs(sqlmock.AnyArg(), "t-1", "w-1", "delivered", "ok", "", int64(42)).
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := NewRepository(db).InsertWebhookLog(context.Background(), "t-1", "w-1", "delivered", "ok", "", 42); err != nil {
		t.Fatalf("InsertWebhookLog: %v", err)
	}
}

// --- source-level pins -------------------------------------------------------

// loadSQL strips Go line comments without touching backtick string literals, so
// a mention of a table in prose cannot satisfy the migration pin below.
func loadSQL(t *testing.T, path string) string {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	var out strings.Builder
	inBack := false
	for _, line := range strings.Split(string(b), "\n") {
		if inBack {
			out.WriteString(line + "\n")
			if strings.Contains(line, "`") {
				inBack = false
			}
			continue
		}
		idx := strings.Index(line, "//")
		if idx >= 0 {
			line = line[:idx]
		}
		if strings.Contains(line, "`") {
			inBack = true
		}
		out.WriteString(line + "\n")
	}
	return out.String()
}

// TestSource_NoStarSelectForTypedModels refuses a return to SELECT * for the
// tables whose rows are scanned into a struct. The one statement that may keep
// it reads into []map[string]interface{}, which accepts any column set.
func TestSource_NoStarSelectForTypedModels(t *testing.T) {
	src := loadSQL(t, "repository.go")

	var offenders []string
	for _, m := range regexp.MustCompile("(?s)`([^`]*SELECT \\* FROM [^`]*)`").FindAllStringSubmatch(src, -1) {
		if strings.Contains(m[1], "permission_requests") {
			continue
		}
		offenders = append(offenders, strings.TrimSpace(m[1]))
	}
	if len(offenders) > 0 {
		t.Fatalf("%d SELECT * statement(s) scan into a typed model: %v", len(offenders), offenders)
	}
}

// TestSource_EveryTableTheRepositoryNamesIsCreatedByAMigration mirrors what
// database.LoadMigrations actually loads - top level of migrations/, three-digit
// versions, no subdirectories - and requires each relation the repository names
// to be created by one of them. This is the check that would have caught the six
// chatops tables no migration ever defined.
func TestSource_EveryTableTheRepositoryNamesIsCreatedByAMigration(t *testing.T) {
	created := map[string]bool{}
	entries, err := os.ReadDir("../../../migrations")
	if err != nil {
		t.Fatalf("read migrations dir: %v", err)
	}
	reCreate := regexp.MustCompile(`(?i)CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?([A-Za-z_][A-Za-z0-9_]*)["']?`)
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") || strings.Contains(e.Name(), "_down.") {
			continue
		}
		if _, err := fmt.Sscanf(e.Name(), "%03d_", new(int)); err != nil {
			continue
		}
		b, err := os.ReadFile(filepath.Join("../../../migrations", e.Name()))
		if err != nil {
			t.Fatalf("read %s: %v", e.Name(), err)
		}
		for _, m := range reCreate.FindAllStringSubmatch(string(b), -1) {
			created[m[1]] = true
		}
	}

	src := loadSQL(t, "repository.go")
	reTable := regexp.MustCompile(`(?i)\b(?:FROM|INTO|UPDATE|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)`)
	// token the keywords above can be followed by that is not a relation name
	sqlKeywords := map[string]bool{
		"ONLY": true, "SET": true, "VALUES": true, "NULL": true, "DEFAULT": true, "NOW": true,
		"EXCLUDED": true, "TRUE": true, "FALSE": true, "ROW": true, "RETURNING": true,
		"WHERE": true, "SELECT": true, "ALL": true, "DISTINCT": true,
	}
	missing := []string{}
	seen := map[string]bool{}
	for _, m := range reTable.FindAllStringSubmatch(src, -1) {
		name := m[1]
		if seen[name] || sqlKeywords[name] {
			continue
		}
		seen[name] = true
		if !created[name] {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		t.Fatalf("repository references %d relation(s) that no forward migration creates: %v", len(missing), missing)
	}
}

// --- regression: map destinations ---------------------------------------------------

// TestSelectMaps_ReturnsRowsSelectContextCannot pins the sqlx limitation
// selectMaps works around. sqlx's isScannable returns true for a map because a
// map is not a struct, so SelectContext treats []map[string]interface{} as a
// scannable slice - and then scanAll refuses a non-struct destination that has
// more than one column. Issuing the same query through both paths shows it is the
// library, not the repository, that draws the line.
func TestSelectMaps_ReturnsRowsSelectContextCannot(t *testing.T) {
	ctx := context.Background()
	const query = `SELECT status, duration_ms FROM chatops_webhook_logs WHERE tenant_id=$1`

	db, mock := mockDB(t)
	rows := func() *sqlmock.Rows {
		return sqlmock.NewRows([]string{"status", "duration_ms"}).AddRow("delivered", int64(42))
	}
	mock.ExpectQuery(query).WithArgs("t-1").WillReturnRows(rows())
	mock.ExpectQuery(query).WithArgs("t-1").WillReturnRows(rows())

	var viaSelect []map[string]interface{}
	err := db.SelectContext(ctx, &viaSelect, query, "t-1")
	if err == nil || !strings.Contains(err.Error(), "non-struct dest type map with >1 columns") {
		t.Fatalf("SelectContext into []map[string]interface{}: want the sqlx limitation, got %v", err)
	}

	got, err := NewRepository(db).selectMaps(ctx, query, "t-1")
	if err != nil {
		t.Fatalf("selectMaps: %v", err)
	}
	if len(got) != 1 || got[0]["status"] != "delivered" || got[0]["duration_ms"] != int64(42) {
		t.Fatalf("unexpected rows: %v", got)
	}
}

// TestSelectMaps_EmptyResultIsAnEmptySliceNotNil: the callers marshal the slice
// straight into a response, and [] and null are different answers to a frontend
// that length-checks the body.
func TestSelectMaps_EmptyResultIsAnEmptySliceNotNil(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT status, duration_ms FROM chatops_webhook_logs WHERE tenant_id=$1`).
		WithArgs("t-1").WillReturnRows(sqlmock.NewRows([]string{"status", "duration_ms"}))

	got, err := NewRepository(db).selectMaps(context.Background(),
		`SELECT status, duration_ms FROM chatops_webhook_logs WHERE tenant_id=$1`, "t-1")
	if err != nil {
		t.Fatalf("selectMaps: %v", err)
	}
	if got == nil || len(got) != 0 {
		t.Fatalf("want an empty, non-nil slice, got %v", got)
	}
}

// mapScanOffenders reports every SELECT whose rows sqlx would be asked to scan
// into a map - the call it refuses for a result with two or more columns. The
// window is one declaration to the next top-level func, so a var declared in one
// method cannot justify a call made in another.
func mapScanOffenders(src string) []string {
	reVar := regexp.MustCompile(`\bvar\s+(\w+)\s+\[\]?map\[string\](?:interface\{\}|any)`)
	reCall := regexp.MustCompile(`\.(?:Select|SelectContext|Get|GetContext)\s*\([^)]*?&(\w+)\s*,`)
	nextFunc := regexp.MustCompile(`\nfunc `)
	var offenders []string
	for _, m := range reVar.FindAllStringSubmatchIndex(src, -1) {
		name := src[m[2]:m[3]]
		end := len(src)
		if at := nextFunc.FindStringIndex(src[m[0]:]); at != nil {
			end = m[0] + at[0]
		}
		for _, c := range reCall.FindAllStringSubmatchIndex(src[m[0]:end], -1) {
			if src[m[0]+c[2]:m[0]+c[3]] == name {
				offenders = append(offenders, "var "+name+" -> "+strings.TrimSpace(src[m[0]+c[0]:m[0]+c[1]]))
			}
		}
	}
	return offenders
}

// TestSource_NoSelectIntoMapSlice refuses a return to handing a SELECT into a map
// destination. The fixture below is run through the same detector: without it the
// test would also pass on a file where every map reader had been deleted.
func TestSource_NoSelectIntoMapSlice(t *testing.T) {
	src := loadSQL(t, "repository.go")

	if off := mapScanOffenders(src); len(off) > 0 {
		t.Fatalf("sqlx cannot scan these into a map, %d site(s): %v", len(off), off)
	}

	// the four readers must still be routed through the helper - deleting them
	// would make the detector above pass for the wrong reason
	if n := strings.Count(src, "r.selectMaps(ctx,"); n < 4 {
		t.Fatalf("expected at least 4 selectMaps call sites, found %d", n)
	}

	const fixture = `
func (r *Repository) ListThing(db *sqlx.DB) ([]map[string]interface{}, error) {
	var items []map[string]interface{}
	err := db.SelectContext(ctx, &items, "SELECT a, b FROM t")
	if err != nil {
		return nil, err
	}
	return items, nil
}
`
	off := mapScanOffenders(fixture)
	if len(off) != 1 || !strings.Contains(off[0], "items") {
		t.Fatalf("detector missed the fixture offender, got %v", off)
	}
}
