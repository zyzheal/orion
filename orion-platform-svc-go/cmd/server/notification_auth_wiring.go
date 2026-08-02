package main

import (
	"orion/go-common/pkg/database"

	notification_handler "orion/platform-svc-go/internal/notification/notification-handler"
	notification_repo "orion/platform-svc-go/internal/notification/notification-repository"
	notification_service "orion/platform-svc-go/internal/notification/notification-service"

	notification_policy_handler "orion/platform-svc-go/internal/notification/notification-policy/handler"
	notification_policy_repo "orion/platform-svc-go/internal/notification/notification-policy/repository"
	notification_policy_service "orion/platform-svc-go/internal/notification/notification-policy/service"

	notification_template_handler "orion/platform-svc-go/internal/notification/notification-template/handler"
	notification_template_repo "orion/platform-svc-go/internal/notification/notification-template/repository"
	notification_template_service "orion/platform-svc-go/internal/notification/notification-template/service"

	scheduled_notification_handler "orion/platform-svc-go/internal/notification/scheduled-notification/handler"
	scheduled_notification_repo "orion/platform-svc-go/internal/notification/scheduled-notification/repository"
	scheduled_notification_service "orion/platform-svc-go/internal/notification/scheduled-notification/service"

	webhook_handler "orion/platform-svc-go/internal/webhook/handler"
	webhook_repo "orion/platform-svc-go/internal/webhook/repository"
	webhook_service "orion/platform-svc-go/internal/webhook/service"

	dd_handler "orion/platform-svc-go/internal/notification/do-not-disturb/handler"
	dd_repo "orion/platform-svc-go/internal/notification/do-not-disturb/repository"
	dd_service "orion/platform-svc-go/internal/notification/do-not-disturb/service"

	chan_handler "orion/platform-svc-go/internal/notification/channel/handler"
	chan_repo "orion/platform-svc-go/internal/notification/channel/repository"
	chan_service "orion/platform-svc-go/internal/notification/channel/service"

	workflow_handler "orion/platform-svc-go/internal/workflow/workflow/handler"
	workflow_repo "orion/platform-svc-go/internal/workflow/workflow/repository"
	workflow_service "orion/platform-svc-go/internal/workflow/workflow/service"

	workflow_trigger_handler "orion/platform-svc-go/internal/workflow/workflow-trigger/handler"
	workflow_trigger_repo "orion/platform-svc-go/internal/workflow/workflow-trigger/repository"
	workflow_trigger_service "orion/platform-svc-go/internal/workflow/workflow-trigger/service"

	workflow_task_handler "orion/platform-svc-go/internal/workflow/workflow-task/handler"
	workflow_task_repo "orion/platform-svc-go/internal/workflow/workflow-task/repository"
	workflow_task_service "orion/platform-svc-go/internal/workflow/workflow-task/service"

	workflow_dep_handler "orion/platform-svc-go/internal/workflow/workflow-dependency/handler"
	workflow_dep_repo "orion/platform-svc-go/internal/workflow/workflow-dependency/repository"
	workflow_dep_service "orion/platform-svc-go/internal/workflow/workflow-dependency/service"

	workflow_webhook_handler "orion/platform-svc-go/internal/workflow-webhook/handler"
	workflow_webhook_repo "orion/platform-svc-go/internal/workflow-webhook/repository"
	workflow_webhook_service "orion/platform-svc-go/internal/workflow-webhook/service"

	user_handler "orion/platform-svc-go/internal/user/handler"
	user_repo "orion/platform-svc-go/internal/user/repository"
	user_service "orion/platform-svc-go/internal/user/service"

	perm_handler "orion/platform-svc-go/internal/permission/handler"
	perm_repo "orion/platform-svc-go/internal/permission/repository"
	perm_service "orion/platform-svc-go/internal/permission/service"

	ae_handler "orion/platform-svc-go/internal/auth-enhanced/handler"
	ae_repo "orion/platform-svc-go/internal/auth-enhanced/repository"
	ae_service "orion/platform-svc-go/internal/auth-enhanced/service"

	amfa_handler "orion/platform-svc-go/internal/auth-mfa/handler"
	amfa_repo "orion/platform-svc-go/internal/auth-mfa/repository"
	amfa_service "orion/platform-svc-go/internal/auth-mfa/service"

	ssou_handler "orion/platform-svc-go/internal/sso-unified/handler"
	ssou_repo "orion/platform-svc-go/internal/sso-unified/repository"
	ssou_service "orion/platform-svc-go/internal/sso-unified/service"

	ssop_handler "orion/platform-svc-go/internal/sso-providers/handler"
	ssop_repo "orion/platform-svc-go/internal/sso-providers/repository"
	ssop_service "orion/platform-svc-go/internal/sso-providers/service"

	abac_handler "orion/platform-svc-go/internal/abac-policy/handler"
	abac_repo "orion/platform-svc-go/internal/abac-policy/repository"
	abac_service "orion/platform-svc-go/internal/abac-policy/service"

	paudit_handler "orion/platform-svc-go/internal/permission-audit/handler"
	paudit_repo "orion/platform-svc-go/internal/permission-audit/repository"
	paudit_service "orion/platform-svc-go/internal/permission-audit/service"
)

// wireNotificationModules wires notification-related modules: notification,
// notification-policy, notification-template, scheduled-notification,
// webhook, do-not-disturb, channel.
func wireNotificationModules(db *database.DB) {
	// notification services
	notificationRepo := notification_repo.NewRepository(db.DB)
	notificationSvc := notification_service.NewService(notificationRepo)
	notificationH = notification_handler.NewHandler(notificationSvc)

	// notification-policy services
	notification_policyRepo := notification_policy_repo.NewRepository(db.DB)
	notification_policySvc := notification_policy_service.NewService(notification_policyRepo)
	notification_policyH = notification_policy_handler.NewHandler(notification_policySvc)

	// notification-template services
	notification_templateRepo := notification_template_repo.NewRepository(db.DB)
	notification_templateSvc := notification_template_service.NewService(notification_templateRepo)
	notification_templateH = notification_template_handler.NewHandler(notification_templateSvc)

	// scheduled-notification services
	scheduled_notificationRepo := scheduled_notification_repo.NewRepository(db.DB)
	scheduled_notificationSvc := scheduled_notification_service.NewService(scheduled_notificationRepo)
	scheduled_notificationH = scheduled_notification_handler.NewHandler(scheduled_notificationSvc)

	// webhook services
	webhookRepo := webhook_repo.NewRepository(db.DB)
	webhookSvc := webhook_service.NewService(webhookRepo)
	webhookH = webhook_handler.NewHandler(webhookSvc)

	// do-not-disturb services
	ddRepo := dd_repo.NewRepository(db.DB)
	ddSvc := dd_service.NewService(ddRepo)
	ddH = dd_handler.NewHandler(ddSvc)

	// channel services
	chanRepo := chan_repo.NewRepository(db.DB)
	chanSvc := chan_service.NewService(chanRepo)
	chanH = chan_handler.NewHandler(chanSvc)
}

// wireWorkflowModules wires workflow orchestration modules: workflow,
// workflow-trigger, workflow-task, workflow-dependency, workflow-webhook.
func wireWorkflowModules(db *database.DB) {
	// workflow services
	workflowRepo := workflow_repo.NewRepository(db.DB)
	workflowSvc := workflow_service.NewService(workflowRepo)
	workflowH = workflow_handler.NewHandler(workflowSvc)

	// workflow-trigger services
	workflow_triggerRepo := workflow_trigger_repo.NewRepository(db.DB)
	workflow_triggerSvc := workflow_trigger_service.NewService(workflow_triggerRepo)
	workflow_triggerH = workflow_trigger_handler.NewHandler(workflow_triggerSvc)

	// workflow-task services
	workflow_taskRepo := workflow_task_repo.NewRepository(db.DB)
	workflow_taskSvc := workflow_task_service.NewService(workflow_taskRepo)
	workflow_taskH = workflow_task_handler.NewHandler(workflow_taskSvc)

	// workflow-dependency services
	workflow_depRepo := workflow_dep_repo.NewRepository(db.DB)
	workflow_depSvc := workflow_dep_service.NewService(workflow_depRepo)
	workflow_depH = workflow_dep_handler.NewHandler(workflow_depSvc)

	// workflow-webhook services
	workflow_webhookRepo := workflow_webhook_repo.NewRepository(db.DB)
	workflow_webhookSvc := workflow_webhook_service.NewService(workflow_webhookRepo)
	workflow_webhookH = workflow_webhook_handler.NewHandler(workflow_webhookSvc, workflowSvc)
}

// wireAuthModules wires authentication & authorization modules: user, auth,
// permission, auth-enhanced, auth-mfa, sso-unified, sso-providers, abac-policy,
// permission-audit, and the auth-related CQRS commands (activate/deactivate
// pipeline, approval commands, feature flag toggles).
//
// NOTE: CQRS command registration is not moved here because it depends on
// eventStore/composedPublisher which remain in config.go.
func wireAuthModules(db *database.DB) {
	// user services
	userRepo := user_repo.NewRepository(db.DB)
	userSvc := user_service.NewService(userRepo)
	userH = user_handler.NewHandler(userSvc)

	// permission services
	permRepo := perm_repo.NewRepository(db.DB)
	permSvc := perm_service.NewService(permRepo)
	permH = perm_handler.NewHandler(permSvc)

	// auth services — handled inline in wiring.go (requires ffCfg.JWTSecret)

	// Wave 2: Auth + Permission services
	aeRepo := ae_repo.NewRepository(db.DB)
	aeSvc := ae_service.NewService(aeRepo)
	aeH = ae_handler.NewHandler(aeSvc)

	amfaRepo := amfa_repo.NewRepository(db.DB)
	amfaSvc := amfa_service.NewService(amfaRepo)
	amfaH = amfa_handler.NewHandler(amfaSvc)

	ssouRepo := ssou_repo.NewRepository(db.DB)
	ssouSvc := ssou_service.NewService(ssouRepo)
	ssouH = ssou_handler.NewHandler(ssouSvc)

	ssopRepo := ssop_repo.NewRepository(db.DB)
	ssopSvc := ssop_service.NewService(ssopRepo)
	ssopH = ssop_handler.NewHandler(ssopSvc)

	abacRepo := abac_repo.NewRepository(db.DB)
	abacSvc := abac_service.NewService(abacRepo)
	abacH = abac_handler.NewHandler(abacSvc)

	pauditRepo := paudit_repo.NewRepository(db.DB)
	pauditSvc := paudit_service.NewService(pauditRepo)
	pauditH = paudit_handler.NewHandler(pauditSvc)
}

// Handler variables for notification_auth_wiring (moved from central wiring.go var block)
var (
	abacH               *abac_handler.Handler
	aeH                 *ae_handler.Handler
	amfaH               *amfa_handler.Handler
	chanH               *chan_handler.Handler
	ddH                 *dd_handler.Handler
	notification_policyH *notification_policy_handler.Handler
	notification_templateH *notification_template_handler.Handler
	notificationH       *notification_handler.Handler
	pauditH             *paudit_handler.Handler
	permH               *perm_handler.Handler
	scheduled_notificationH *scheduled_notification_handler.Handler
	ssopH               *ssop_handler.Handler
	ssouH               *ssou_handler.Handler
	userH               *user_handler.Handler
	webhookH            *webhook_handler.Handler
	workflow_depH       *workflow_dep_handler.Handler
	workflow_taskH      *workflow_task_handler.Handler
	workflow_triggerH   *workflow_trigger_handler.Handler
	workflow_webhookH   *workflow_webhook_handler.Handler
	workflowH           *workflow_handler.Handler
)
