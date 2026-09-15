package repository

import (
	"context"
	"errors"
	"testing"

	"orion/go-common/pkg/sentinel"

	"github.com/DATA-DOG/go-sqlmock"
)

// A NamedExecContext call compiles its named arguments to $1..$N in the order
// they appear in the query. A literal $N left next to them is not renumbered,
// so this shape
//
//	UPDATE t SET name=COALESCE(:name, name) WHERE id=$1 AND tenant_id=$2
//
// arrives at the driver as
//
//	UPDATE t SET name=COALESCE($1, name) WHERE id=$1 AND tenant_id=$2
//
// id and tenant_id are bound to the *new column value*, the map entries for
// them are ignored, and oneRow turns the zero affected rows into
// sentinel.NotFound. Every chatops PUT /admin/* route answered 404 on a row
// that existed and silently dropped the write. The expectations below are the
// compiled statements sqlx actually sends, and they assert that id and
// tenant_id sit in their own placeholder slots at the end.

func TestUpdateWebhook_BindsIdentityInItsOwnSlots(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`UPDATE chatops_webhooks SET
			name=COALESCE($1, name),
			url=COALESCE($2, url),
			events=COALESCE($3, events),
			secret_key=COALESCE($4, secret_key),
			enabled=COALESCE($5, enabled),
			retry_count=COALESCE($6, retry_count),
			timeout_seconds=COALESCE($7, timeout_seconds),
			headers=COALESCE($8, headers),
			description=COALESCE($9, description)
		 WHERE id=$10 AND tenant_id=$11`).
		WithArgs("ci-done", "https://example.test/hook", `["ci_done"]`, "shh", true, 3, 15,
			`{"X-Team":"ci"}`, "ci webhook", "w-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := NewRepository(db).UpdateWebhook(context.Background(), "t-1", "w-1", map[string]interface{}{
		"name":            "ci-done",
		"url":             "https://example.test/hook",
		"events":          `["ci_done"]`,
		"secret_key":      "shh",
		"enabled":         true,
		"retry_count":     3,
		"timeout_seconds": 15,
		"headers":         `{"X-Team":"ci"}`,
		"description":     "ci webhook",
	})
	if err != nil {
		t.Fatalf("UpdateWebhook: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestUpdateRateLimit_BindsIdentityInItsOwnSlots(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`UPDATE chatops_rate_limits SET
			target_type=COALESCE($1, target_type),
			target_id=COALESCE($2, target_id),
			command_name=COALESCE($3, command_name),
			limit_type=COALESCE($4, limit_type),
			limit_count=COALESCE($5, limit_count),
			window_seconds=COALESCE($6, window_seconds),
			description=COALESCE($7, description)
		 WHERE id=$8 AND tenant_id=$9`).
		WithArgs("command", "cmd-9", "deploy", "user_per_min", 5, 60, "per user", "rl-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := NewRepository(db).UpdateRateLimit(context.Background(), "t-1", "rl-1", map[string]interface{}{
		"target_type":    "command",
		"target_id":      "cmd-9",
		"command_name":   "deploy",
		"limit_type":     "user_per_min",
		"limit_count":    5,
		"window_seconds": 60,
		"description":    "per user",
	})
	if err != nil {
		t.Fatalf("UpdateRateLimit: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

// The handler hands the JSON body straight to the repository, so a partial
// update arrives as a map with most keys absent. The repository must bind NULL
// for those, letting COALESCE keep the stored value, while still binding the
// identity.
func TestUpdateRateLimit_APartialBodyLeavesTheOtherColumnsAlone(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`UPDATE chatops_rate_limits SET
			target_type=COALESCE($1, target_type),
			target_id=COALESCE($2, target_id),
			command_name=COALESCE($3, command_name),
			limit_type=COALESCE($4, limit_type),
			limit_count=COALESCE($5, limit_count),
			window_seconds=COALESCE($6, window_seconds),
			description=COALESCE($7, description)
		 WHERE id=$8 AND tenant_id=$9`).
		WithArgs(nil, nil, nil, nil, 99, nil, nil, "rl-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := NewRepository(db).UpdateRateLimit(context.Background(), "t-1", "rl-1",
		map[string]interface{}{"limit_count": 99})
	if err != nil {
		t.Fatalf("UpdateRateLimit: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestUpdateRole_BindsIdentityInItsOwnSlots(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`UPDATE chatops_permission_roles SET name=COALESCE($1, name), description=COALESCE($2, description), permissions=COALESCE($3, permissions)
		 WHERE id=$4 AND tenant_id=$5`).
		WithArgs("gold", "release approver", `["*"]`, "r-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := NewRepository(db).UpdateRole(context.Background(), "t-1", "r-1", map[string]interface{}{
		"name":        "gold",
		"description": "release approver",
		"permissions": `["*"]`,
	})
	if err != nil {
		t.Fatalf("UpdateRole: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

// A zero-row update means the row is gone or belongs to another tenant. Both
// must read as NotFound, never as success.
func TestUpdateRole_AZeroRowUpdateIsNotFound(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`UPDATE chatops_permission_roles SET name=COALESCE($1, name), description=COALESCE($2, description), permissions=COALESCE($3, permissions)
		 WHERE id=$4 AND tenant_id=$5`).
		WithArgs("gold", nil, nil, "r-other", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := NewRepository(db).UpdateRole(context.Background(), "t-1", "r-other",
		map[string]interface{}{"name": "gold"})
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("expected sentinel.NotFound, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestUpdateCommandPermission_BindsIdentityInItsOwnSlots(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`UPDATE chatops_command_permissions SET
			description=COALESCE($1, description),
			capability=COALESCE($2, capability),
			risk_level=COALESCE($3, risk_level),
			requires_approval=COALESCE($4, requires_approval),
			role_ids=COALESCE($5, role_ids)
		 WHERE id=$6 AND tenant_id=$7`).
		WithArgs("runs a deploy", "deploy.run", "medium", true, `["r-1"]`, "cp-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := NewRepository(db).UpdateCommandPermission(context.Background(), "t-1", "cp-1", map[string]interface{}{
		"description":       "runs a deploy",
		"capability":        "deploy.run",
		"risk_level":        "medium",
		"requires_approval": true,
		"role_ids":          `["r-1"]`,
	})
	if err != nil {
		t.Fatalf("UpdateCommandPermission: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestUpdateEnvironmentPermission_BindsIdentityInItsOwnSlots(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`UPDATE chatops_environment_permissions SET
			description=COALESCE($1, description),
			rate_limit=COALESCE($2, rate_limit),
			require_approval=COALESCE($3, require_approval),
			allowed_commands=COALESCE($4, allowed_commands),
			denied_commands=COALESCE($5, denied_commands),
			role_ids=COALESCE($6, role_ids)
		 WHERE id=$7 AND tenant_id=$8`).
		WithArgs("prod", 100, true, `["deploy"]`, `["wipe"]`, `["gold"]`, "ep-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := NewRepository(db).UpdateEnvironmentPermission(context.Background(), "t-1", "ep-1", map[string]interface{}{
		"description":      "prod",
		"rate_limit":       100,
		"require_approval": true,
		"allowed_commands": `["deploy"]`,
		"denied_commands":  `["wipe"]`,
		"role_ids":         `["gold"]`,
	})
	if err != nil {
		t.Fatalf("UpdateEnvironmentPermission: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

// This method used to be positional-only: SET updated_at=$1 with a map
// argument. A map with no named placeholder binds zero values, so the
// statement reached the driver with no arguments at all. The compiled SQL
// looks identical to the fixed form, so only the argument count separates them.
func TestUpdateCapabilityMapping_BindsAllThreeArguments(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`UPDATE chatops_capability_mappings SET updated_at=$1 WHERE id=$2 AND tenant_id=$3`).
		WithArgs(sqlmock.AnyArg(), "cm-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := NewRepository(db).UpdateCapabilityMapping(context.Background(), "t-1", "cm-1",
		map[string]interface{}{"command_id": "c-1"})
	if err != nil {
		t.Fatalf("UpdateCapabilityMapping: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

// The updates map used to be dropped: the statement only touched updated_at and
// the six columns the caller named were ignored. With an empty map every
// column binds NULL, so the stored values survive the call.
func TestUpdateCommand_AppliesTheCallerNamedColumns(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`UPDATE chatops_commands SET
			name=COALESCE($1, name),
			subcommand=COALESCE($2, subcommand),
			description=COALESCE($3, description),
			permission_level=COALESCE($4, permission_level),
			schema=COALESCE($5, schema),
			examples=COALESCE($6, examples),
			updated_at=NOW()
		 WHERE id=$7 AND tenant_id=$8`).
		WithArgs("deploy svc", "start", "roll out one service", "read", `{"step":"1"}`,
			`[{"cmd":"deploy svc start"}]`, "c-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := NewRepository(db).UpdateCommand(context.Background(), "t-1", "c-1", map[string]interface{}{
		"name":             "deploy svc",
		"subcommand":       "start",
		"description":      "roll out one service",
		"permission_level": "read",
		"schema":           `{"step":"1"}`,
		"examples":         `[{"cmd":"deploy svc start"}]`,
	})
	if err != nil {
		t.Fatalf("UpdateCommand: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}

func TestUpdateCommand_AnEmptyUpdatesMapClearsNothing(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`UPDATE chatops_commands SET
			name=COALESCE($1, name),
			subcommand=COALESCE($2, subcommand),
			description=COALESCE($3, description),
			permission_level=COALESCE($4, permission_level),
			schema=COALESCE($5, schema),
			examples=COALESCE($6, examples),
			updated_at=NOW()
		 WHERE id=$7 AND tenant_id=$8`).
		WithArgs(nil, nil, nil, nil, nil, nil, "c-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := NewRepository(db).UpdateCommand(context.Background(), "t-1", "c-1",
		map[string]interface{}{})
	if err != nil {
		t.Fatalf("UpdateCommand: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations not met: %v", err)
	}
}
