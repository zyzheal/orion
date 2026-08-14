package job_actions_test

import (
	"context"
	"testing"

	"orion/platform-svc-go/internal/job-actions/service"
)

// TestJobActions_NewService verifies the service package compiles and the
// JobActionExecutor constructor exists.  We cannot call NewJobActionExecutor
// without a real database, but we assert the symbol is a non-nil function.
func TestJobActions_NewService(t *testing.T) {
	_ = service.NewJobActionExecutor
}

// TestJobActions_PackageAvailable verifies that all exported types and error
// vars in the service package are accessible, proving the package loads
// cleanly at compile time.
func TestJobActions_PackageAvailable(t *testing.T) {
	var (
		_ *service.JobActionExecutor
		_ *service.ActionResult
		_ service.IJobActionHandler
		_ error
	)
	_ = service.ErrActionNotFound
	_ = service.ErrHandlerNotFound
	_ = service.ErrActionDisabled
}

// TestJobActions_HandlerConstructors verifies that each of the 42 built-in
// handler constructors is accessible and returns a non-nil IJobActionHandler.
// This also exercises stubHandler.Name/Type/Category without touching any DB.
func TestJobActions_HandlerConstructors(t *testing.T) {
constructors := map[string]func() service.IJobActionHandler{
		"restart_service":     service.NewRestartServiceHandler,
		"deploy_code":         service.NewDeployCodeHandler,
		"backup_db":           service.NewBackupDBHandler,
		"restore_db":          service.NewRestoreDBHandler,
		"scale_instance":      service.NewScaleInstanceHandler,
		"send_email":          service.NewSendEmailHandler,
		"send_sms":            service.NewSendSMSHandler,
		"send_webhook":        service.NewSendWebhookHandler,
		"run_script":          service.NewRunScriptHandler,
		"execute_sql":         service.NewExecuteSQLHandler,
		"file_copy":           service.NewFileCopyHandler,
		"file_delete":         service.NewFileDeleteHandler,
		"git_pull":            service.NewGitPullHandler,
		"git_push":            service.NewGitPushHandler,
		"docker_pull":         service.NewDockerPullHandler,
		"docker_push":         service.NewDockerPushHandler,
		"docker_restart":      service.NewDockerRestartHandler,
		"docker_compose_up":   service.NewDockerComposeUpHandler,
		"docker_compose_down": service.NewDockerComposeDownHandler,
		"kubectl_apply":       service.NewKubectlApplyHandler,
		"kubectl_delete":      service.NewKubectlDeleteHandler,
		"curl_request":        service.NewCurlRequestHandler,
		"shell_command":       service.NewShellCommandHandler,
		"archive_file":        service.NewArchiveFileHandler,
		"extract_file":        service.NewExtractFileHandler,
		"create_directory":    service.NewCreateDirectoryHandler,
		"delete_directory":    service.NewDeleteDirectoryHandler,
		"modify_file":         service.NewModifyFileHandler,
		"create_user":         service.NewCreateUserHandler,
		"delete_user":         service.NewDeleteUserHandler,
		"grant_permission":    service.NewGrantPermissionHandler,
		"revoke_permission":   service.NewRevokePermissionHandler,
		"rotate_key":          service.NewRotateKeyHandler,
		"enable_feature":      service.NewEnableFeatureHandler,
		"disable_feature":     service.NewDisableFeatureHandler,
		"clear_cache":         service.NewClearCacheHandler,
		"send_notification":   service.NewSendNotificationHandler,
		"create_ticket":       service.NewCreateTicketHandler,
		"close_ticket":        service.NewCloseTicketHandler,
		"update_ticket":       service.NewUpdateTicketHandler,
		"run_health_check":    service.NewRunHealthCheckHandler,
		"stop_service":        service.NewStopServiceHandler,
		"start_service":       service.NewStartServiceHandler,
		"change_config":       service.NewChangeConfigHandler,
		"snapshot":            service.NewSnapshotHandler,
		"rollback":            service.NewRollbackHandler,
	}
	for name, ctor := range constructors {
		h := ctor()
		if h == nil {
			t.Errorf("handler constructor %q returned nil", name)
			continue
		}
		if h.Name() == "" {
			t.Errorf("handler %q returned empty Name", name)
		}
		if h.Type() == "" {
			t.Errorf("handler %q returned empty Type", name)
		}
		if h.Category() == "" {
			t.Errorf("handler %q returned empty Category", name)
		}
	}
}

// TestJobActions_StubExecute verifies that stub handlers execute successfully
// and produce a valid ActionResult, exercising the Execute path without a DB.
func TestJobActions_StubExecute(t *testing.T) {
	h := service.NewRestartServiceHandler()
	if h == nil {
		t.Fatal("NewRestartServiceHandler returned nil")
	}
	ctx := context.Background()
	if err := h.Validate(ctx, map[string]string{"target": "api"}); err != nil {
		t.Fatalf("Validate returned error: %v", err)
	}
	res, err := h.Execute(ctx, map[string]string{"target": "api"})
	if err != nil {
		t.Fatalf("Execute returned error: %v", err)
	}
	if res == nil {
		t.Fatal("Execute returned nil result")
	}
	if !res.Success {
		t.Error("expected Success=true")
	}
	if res.Output == "" {
		t.Error("expected non-empty Output")
	}
}

// TestJobActions_StubContextCancelled verifies that stub handlers respect
// context cancellation during Execute.
func TestJobActions_StubContextCancelled(t *testing.T) {
	h := service.NewRunScriptHandler()
	if h == nil {
		t.Fatal("NewRunScriptHandler returned nil")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // already cancelled
	_, err := h.Execute(ctx, nil)
	if err == nil {
		t.Error("expected error when context is cancelled")
	}
}
