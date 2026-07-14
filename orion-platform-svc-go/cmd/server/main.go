package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	ff_config "orion/platform-svc-go/internal/feature-flag/config"
	ff_handler "orion/platform-svc-go/internal/feature-flag/handler"
	ff_repo "orion/platform-svc-go/internal/feature-flag/repository"
	ff_service "orion/platform-svc-go/internal/feature-flag/service"

	role_handler "orion/platform-svc-go/internal/role/handler"
	role_repo "orion/platform-svc-go/internal/role/repository"
	role_service "orion/platform-svc-go/internal/role/service"

	ag_handler "orion/platform-svc-go/internal/api-governance/handler"
	ag_repo "orion/platform-svc-go/internal/api-governance/repository"
	ag_service "orion/platform-svc-go/internal/api-governance/service"

	artifact_handler "orion/platform-svc-go/internal/artifact/handler"
	artifact_repo "orion/platform-svc-go/internal/artifact/repository"
	artifact_service "orion/platform-svc-go/internal/artifact/service"

	fed_handler "orion/platform-svc-go/internal/federation/handler"
	fed_repo "orion/platform-svc-go/internal/federation/repository"
	fed_service "orion/platform-svc-go/internal/federation/service"

	plugin_handler "orion/platform-svc-go/internal/plugin/handler"
	plugin_repo "orion/platform-svc-go/internal/plugin/repository"
	plugin_service "orion/platform-svc-go/internal/plugin/service"

	inc_handler "orion/platform-svc-go/internal/inception/handler"
	inc_repo "orion/platform-svc-go/internal/inception/repository"
	inc_service "orion/platform-svc-go/internal/inception/service"

	policy_handler "orion/platform-svc-go/internal/policy/handler"
	policy_repo "orion/platform-svc-go/internal/policy/repository"
	policy_service "orion/platform-svc-go/internal/policy/service"

	env_handler "orion/platform-svc-go/internal/environment/handler"
	env_repo "orion/platform-svc-go/internal/environment/repository"
	env_service "orion/platform-svc-go/internal/environment/service"

	capability_handler "orion/platform-svc-go/internal/capability/handler"
	capability_repo "orion/platform-svc-go/internal/capability/repository"
	capability_service "orion/platform-svc-go/internal/capability/service"
	chaos_handler "orion/platform-svc-go/internal/chaos/handler"
	chaos_repo "orion/platform-svc-go/internal/chaos/repository"
	chaos_service "orion/platform-svc-go/internal/chaos/service"
	cron_handler "orion/platform-svc-go/internal/cron/handler"
	cron_repo "orion/platform-svc-go/internal/cron/repository"
	cron_service "orion/platform-svc-go/internal/cron/service"
	developerportal_handler "orion/platform-svc-go/internal/developer-portal/handler"
	developerportal_repo "orion/platform-svc-go/internal/developer-portal/repository"
	developerportal_service "orion/platform-svc-go/internal/developer-portal/service"
	infra_handler "orion/platform-svc-go/internal/infrastructure/handler"
	infra_repo "orion/platform-svc-go/internal/infrastructure/repository"
	infra_service "orion/platform-svc-go/internal/infrastructure/service"
	internallibrary_handler "orion/platform-svc-go/internal/internal-library/handler"
	internallibrary_repo "orion/platform-svc-go/internal/internal-library/repository"
	internallibrary_service "orion/platform-svc-go/internal/internal-library/service"
	pageregistry_handler "orion/platform-svc-go/internal/page-registry/handler"
	pageregistry_repo "orion/platform-svc-go/internal/page-registry/repository"
	pageregistry_service "orion/platform-svc-go/internal/page-registry/service"
	productline_handler "orion/platform-svc-go/internal/product-line/handler"
	productline_repo "orion/platform-svc-go/internal/product-line/repository"
	productline_service "orion/platform-svc-go/internal/product-line/service"
	projectmember_handler "orion/platform-svc-go/internal/project-member/handler"
	projectmember_repo "orion/platform-svc-go/internal/project-member/repository"
	projectmember_service "orion/platform-svc-go/internal/project-member/service"
	proj_handler "orion/platform-svc-go/internal/project/handler"
	proj_repo "orion/platform-svc-go/internal/project/repository"
	proj_service "orion/platform-svc-go/internal/project/service"
	serviceregistry_handler "orion/platform-svc-go/internal/service-registry/handler"
	serviceregistry_repo "orion/platform-svc-go/internal/service-registry/repository"
	serviceregistry_service "orion/platform-svc-go/internal/service-registry/service"
	sprint_handler "orion/platform-svc-go/internal/sprint/handler"
	sprint_repo "orion/platform-svc-go/internal/sprint/repository"
	sprint_service "orion/platform-svc-go/internal/sprint/service"
	subapp_handler "orion/platform-svc-go/internal/subapp/handler"
	subapp_repo "orion/platform-svc-go/internal/subapp/repository"
	subapp_service "orion/platform-svc-go/internal/subapp/service"
	team_handler "orion/platform-svc-go/internal/team/handler"
	team_repo "orion/platform-svc-go/internal/team/repository"
	team_service "orion/platform-svc-go/internal/team/service"
	workbench_handler "orion/platform-svc-go/internal/workbench/handler"
	workbench_repo "orion/platform-svc-go/internal/workbench/repository"
	workbench_service "orion/platform-svc-go/internal/workbench/service"

	gatewaydynamic_handler "orion/platform-svc-go/internal/gateway-dynamic/handler"
	gatewaydynamic_repo "orion/platform-svc-go/internal/gateway-dynamic/repository"
	gatewaydynamic_service "orion/platform-svc-go/internal/gateway-dynamic/service"
	handlerregistry_handler "orion/platform-svc-go/internal/handler-registry/handler"
	handlerregistry_repo "orion/platform-svc-go/internal/handler-registry/repository"
	handlerregistry_service "orion/platform-svc-go/internal/handler-registry/service"
	i18n_handler "orion/platform-svc-go/internal/i18n/handler"
	i18n_repo "orion/platform-svc-go/internal/i18n/repository"
	i18n_service "orion/platform-svc-go/internal/i18n/service"
	iac_handler "orion/platform-svc-go/internal/iac/handler"
	iac_repo "orion/platform-svc-go/internal/iac/repository"
	iac_service "orion/platform-svc-go/internal/iac/service"
	multicloud_handler "orion/platform-svc-go/internal/multi-cloud/handler"
	multicloud_repo "orion/platform-svc-go/internal/multi-cloud/repository"
	multicloud_service "orion/platform-svc-go/internal/multi-cloud/service"
	serverless_handler "orion/platform-svc-go/internal/serverless/handler"
	serverless_repo "orion/platform-svc-go/internal/serverless/repository"
	serverless_service "orion/platform-svc-go/internal/serverless/service"

	alert_handler "orion/platform-svc-go/internal/alert/handler"
	alert_repo "orion/platform-svc-go/internal/alert/repository"
	alert_service "orion/platform-svc-go/internal/alert/service"
	cmdb_handler "orion/platform-svc-go/internal/cmdb/handler"
	cmdb_repo "orion/platform-svc-go/internal/cmdb/repository"
	cmdb_service "orion/platform-svc-go/internal/cmdb/service"
	monitoring_handler "orion/platform-svc-go/internal/monitoring/handler"
	monitoring_repo "orion/platform-svc-go/internal/monitoring/repository"
	monitoring_service "orion/platform-svc-go/internal/monitoring/service"

	artifactops_handler "orion/platform-svc-go/internal/artifact-ops/handler"
	artifactops_repo "orion/platform-svc-go/internal/artifact-ops/repository"
	artifactops_service "orion/platform-svc-go/internal/artifact-ops/service"

	config_handler "orion/platform-svc-go/internal/config/handler"
	config_repo "orion/platform-svc-go/internal/config/repository"
	config_service "orion/platform-svc-go/internal/config/service"

	approval_handler "orion/platform-svc-go/internal/approval/handler"
	approval_repo "orion/platform-svc-go/internal/approval/repository"
	approval_service "orion/platform-svc-go/internal/approval/service"

	chatops_handler "orion/platform-svc-go/internal/chatops/handler"
	chatops_repo "orion/platform-svc-go/internal/chatops/repository"
	chatops_service "orion/platform-svc-go/internal/chatops/service"

	session_handler "orion/platform-svc-go/internal/session/handler"
	session_repo "orion/platform-svc-go/internal/session/repository"
	session_service "orion/platform-svc-go/internal/session/service"

	apikey_handler "orion/platform-svc-go/internal/api-key/handler"
	apikey_repo "orion/platform-svc-go/internal/api-key/repository"
	apikey_service "orion/platform-svc-go/internal/api-key/service"

	eventbus_handler "orion/platform-svc-go/internal/eventbus/handler"
	eventbus_repo "orion/platform-svc-go/internal/eventbus/repository"
	eventbus_service "orion/platform-svc-go/internal/eventbus/service"

	trigger_handler "orion/platform-svc-go/internal/event-trigger/handler"
	trigger_repo "orion/platform-svc-go/internal/event-trigger/repository"
	trigger_service "orion/platform-svc-go/internal/event-trigger/service"

	hook_handler "orion/platform-svc-go/internal/hook-chain/handler"
	hook_repo "orion/platform-svc-go/internal/hook-chain/repository"
	hook_service "orion/platform-svc-go/internal/hook-chain/service"

	user_handler "orion/platform-svc-go/internal/user/handler"
	user_repo "orion/platform-svc-go/internal/user/repository"
	user_service "orion/platform-svc-go/internal/user/service"

	perm_handler "orion/platform-svc-go/internal/permission/handler"
	perm_repo "orion/platform-svc-go/internal/permission/repository"
	perm_service "orion/platform-svc-go/internal/permission/service"

	code_repo_handler "orion/platform-svc-go/internal/code-repo/handler"
	code_repo_repo "orion/platform-svc-go/internal/code-repo/repository"
	code_repo_service "orion/platform-svc-go/internal/code-repo/service"

	incident_handler "orion/platform-svc-go/internal/incident/handler"
	incident_repo "orion/platform-svc-go/internal/incident/repository"
	incident_service "orion/platform-svc-go/internal/incident/service"

	audit_handler "orion/platform-svc-go/internal/audit/handler"
	audit_repo "orion/platform-svc-go/internal/audit/repository"
	audit_service "orion/platform-svc-go/internal/audit/service"

	build_env_handler "orion/platform-svc-go/internal/build-env/handler"
	build_env_repo "orion/platform-svc-go/internal/build-env/repository"
	build_env_service "orion/platform-svc-go/internal/build-env/service"

	build_handler "orion/platform-svc-go/internal/build/handler"
	build_repo "orion/platform-svc-go/internal/build/repository"
	build_service "orion/platform-svc-go/internal/build/service"
	dba_handler "orion/platform-svc-go/internal/dba/handler"
	dba_repo "orion/platform-svc-go/internal/dba/repository"
	dba_service "orion/platform-svc-go/internal/dba/service"

	deploy_enhanced_handler "orion/platform-svc-go/internal/deploy-enhanced/handler"
	deploy_enhanced_repo "orion/platform-svc-go/internal/deploy-enhanced/repository"
	deploy_enhanced_service "orion/platform-svc-go/internal/deploy-enhanced/service"
	deploy_handler "orion/platform-svc-go/internal/deploy/handler"
	deploy_repo "orion/platform-svc-go/internal/deploy/repository"
	deploy_service "orion/platform-svc-go/internal/deploy/service"

	digital_twin_handler "orion/platform-svc-go/internal/digital-twin/handler"
	digital_twin_repo "orion/platform-svc-go/internal/digital-twin/repository"
	digital_twin_service "orion/platform-svc-go/internal/digital-twin/service"

	finops_v2_handler "orion/platform-svc-go/internal/finops-v2/handler"
	finops_v2_repo "orion/platform-svc-go/internal/finops-v2/repository"
	finops_v2_service "orion/platform-svc-go/internal/finops-v2/service"
	finops_handler "orion/platform-svc-go/internal/finops/handler"
	finops_repo "orion/platform-svc-go/internal/finops/repository"
	finops_service "orion/platform-svc-go/internal/finops/service"

	knowledge_handler "orion/platform-svc-go/internal/knowledge/handler"
	knowledge_repo "orion/platform-svc-go/internal/knowledge/repository"
	knowledge_service "orion/platform-svc-go/internal/knowledge/service"

	security_compliance_handler "orion/platform-svc-go/internal/security-compliance/handler"
	security_compliance_repo "orion/platform-svc-go/internal/security-compliance/repository"
	security_compliance_service "orion/platform-svc-go/internal/security-compliance/service"

	change_handler "orion/platform-svc-go/internal/change/handler"
	change_repo "orion/platform-svc-go/internal/change/repository"
	change_service "orion/platform-svc-go/internal/change/service"
	skill_handler "orion/platform-svc-go/internal/skill/handler"
	skill_service "orion/platform-svc-go/internal/skill/service"
	sla_handler "orion/platform-svc-go/internal/sla/handler"
	sla_repo "orion/platform-svc-go/internal/sla/repository"
	sla_service "orion/platform-svc-go/internal/sla/service"
	tenant_handler "orion/platform-svc-go/internal/tenant/handler"
	tenant_repo "orion/platform-svc-go/internal/tenant/repository"
	tenant_service "orion/platform-svc-go/internal/tenant/service"
	visor_handler "orion/platform-svc-go/internal/visor-exec/handler"
	visor_repo "orion/platform-svc-go/internal/visor-exec/repository"
	visor_service "orion/platform-svc-go/internal/visor-exec/service"

	cr_handler "orion/platform-svc-go/internal/change-request/handler"
	cr_repo "orion/platform-svc-go/internal/change-request/repository"
	cr_service "orion/platform-svc-go/internal/change-request/service"
	rd_handler "orion/platform-svc-go/internal/report-designer/handler"
	rd_repo "orion/platform-svc-go/internal/report-designer/repository"
	rd_service "orion/platform-svc-go/internal/report-designer/service"

	diagnostic_handler "orion/platform-svc-go/internal/diagnostic/handler"
	diagnostic_repo "orion/platform-svc-go/internal/diagnostic/repository"
	diagnostic_service "orion/platform-svc-go/internal/diagnostic/service"

	backup_handler "orion/platform-svc-go/internal/backup/handler"
	backup_repo "orion/platform-svc-go/internal/backup/repository"
	backup_service "orion/platform-svc-go/internal/backup/service"

	am_handler "orion/platform-svc-go/internal/api-market/handler"
	am_repo "orion/platform-svc-go/internal/api-market/repository"
	am_service "orion/platform-svc-go/internal/api-market/service"
	cit_handler "orion/platform-svc-go/internal/ci-type/handler"
	cit_repo "orion/platform-svc-go/internal/ci-type/repository"
	cit_service "orion/platform-svc-go/internal/ci-type/service"

	// ---- Wave 2: Auth + Permission modules ----
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

	oncall_handler "orion/platform-svc-go/internal/oncall/handler"
	oncall_repo "orion/platform-svc-go/internal/oncall/repository"
	oncall_service "orion/platform-svc-go/internal/oncall/service"

	notification_handler "orion/platform-svc-go/internal/notification/handler"
	notification_repo "orion/platform-svc-go/internal/notification/repository"
	notification_service "orion/platform-svc-go/internal/notification/service"

	notification_policy_handler "orion/platform-svc-go/internal/notification-policy/handler"
	notification_policy_repo "orion/platform-svc-go/internal/notification-policy/repository"
	notification_policy_service "orion/platform-svc-go/internal/notification-policy/service"

	notification_template_handler "orion/platform-svc-go/internal/notification-template/handler"
	notification_template_repo "orion/platform-svc-go/internal/notification-template/repository"
	notification_template_service "orion/platform-svc-go/internal/notification-template/service"

	scheduled_notification_handler "orion/platform-svc-go/internal/scheduled-notification/handler"
	scheduled_notification_repo "orion/platform-svc-go/internal/scheduled-notification/repository"
	scheduled_notification_service "orion/platform-svc-go/internal/scheduled-notification/service"

	webhook_handler "orion/platform-svc-go/internal/webhook/handler"
	webhook_repo "orion/platform-svc-go/internal/webhook/repository"
	webhook_service "orion/platform-svc-go/internal/webhook/service"

	dd_handler "orion/platform-svc-go/internal/do-not-disturb/handler"
	dd_repo "orion/platform-svc-go/internal/do-not-disturb/repository"
	dd_service "orion/platform-svc-go/internal/do-not-disturb/service"

	chan_handler "orion/platform-svc-go/internal/channel/handler"
	chan_repo "orion/platform-svc-go/internal/channel/repository"
	chan_service "orion/platform-svc-go/internal/channel/service"

	workflow_handler "orion/platform-svc-go/internal/workflow/handler"
	workflow_repo "orion/platform-svc-go/internal/workflow/repository"
	workflow_service "orion/platform-svc-go/internal/workflow/service"

	workflow_trigger_handler "orion/platform-svc-go/internal/workflow-trigger/handler"
	workflow_trigger_repo "orion/platform-svc-go/internal/workflow-trigger/repository"
	workflow_trigger_service "orion/platform-svc-go/internal/workflow-trigger/service"

	workflow_task_handler "orion/platform-svc-go/internal/workflow-task/handler"
	workflow_task_repo "orion/platform-svc-go/internal/workflow-task/repository"
	workflow_task_service "orion/platform-svc-go/internal/workflow-task/service"

	workflow_dep_handler "orion/platform-svc-go/internal/workflow-dependency/handler"
	workflow_dep_repo "orion/platform-svc-go/internal/workflow-dependency/repository"
	workflow_dep_service "orion/platform-svc-go/internal/workflow-dependency/service"

	workflow_webhook_handler "orion/platform-svc-go/internal/workflow-webhook/handler"
	workflow_webhook_repo "orion/platform-svc-go/internal/workflow-webhook/repository"
	workflow_webhook_service "orion/platform-svc-go/internal/workflow-webhook/service"

	lowcode_handler "orion/platform-svc-go/internal/lowcode/handler"
	lowcode_repo "orion/platform-svc-go/internal/lowcode/repository"
	lowcode_service "orion/platform-svc-go/internal/lowcode/service"

	ticketing_handler "orion/platform-svc-go/internal/ticketing/handler"
	ticketing_repo "orion/platform-svc-go/internal/ticketing/repository"
	ticketing_service "orion/platform-svc-go/internal/ticketing/service"

	// ---- Wave 5: Pipeline Assistant modules ----
	pb_handler "orion/platform-svc-go/internal/pipeline-batch/handler"
	pb_repo "orion/platform-svc-go/internal/pipeline-batch/repository"
	pb_service "orion/platform-svc-go/internal/pipeline-batch/service"

	pal_handler "orion/platform-svc-go/internal/pipeline-audit-log/handler"
	pal_repo "orion/platform-svc-go/internal/pipeline-audit-log/repository"
	pal_service "orion/platform-svc-go/internal/pipeline-audit-log/service"

	ptmpl_handler "orion/platform-svc-go/internal/pipeline-template/handler"
	ptmpl_repo "orion/platform-svc-go/internal/pipeline-template/repository"
	ptmpl_service "orion/platform-svc-go/internal/pipeline-template/service"

	pver_handler "orion/platform-svc-go/internal/pipeline-version/handler"
	pver_repo "orion/platform-svc-go/internal/pipeline-version/repository"
	pver_service "orion/platform-svc-go/internal/pipeline-version/service"

	phist_handler "orion/platform-svc-go/internal/pipeline-run-history/handler"
	phist_repo "orion/platform-svc-go/internal/pipeline-run-history/repository"
	phist_service "orion/platform-svc-go/internal/pipeline-run-history/service"

	pbo_handler "orion/platform-svc-go/internal/pipeline-batch-operations/handler"
	pbo_repo "orion/platform-svc-go/internal/pipeline-batch-operations/repository"
	pbo_service "orion/platform-svc-go/internal/pipeline-batch-operations/service"

	psse_handler "orion/platform-svc-go/internal/pipeline-sse/handler"
	psse_repo "orion/platform-svc-go/internal/pipeline-sse/repository"
	psse_service "orion/platform-svc-go/internal/pipeline-sse/service"

	pec_handler "orion/platform-svc-go/internal/pipeline-execution-control/handler"
	pec_repo "orion/platform-svc-go/internal/pipeline-execution-control/repository"
	pec_service "orion/platform-svc-go/internal/pipeline-execution-control/service"

	pgraph_handler "orion/platform-svc-go/internal/pipeline-graph/handler"
	pgraph_repo "orion/platform-svc-go/internal/pipeline-graph/repository"
	pgraph_service "orion/platform-svc-go/internal/pipeline-graph/service"

	ptrend_handler "orion/platform-svc-go/internal/pipeline-trend/handler"
	ptrend_repo "orion/platform-svc-go/internal/pipeline-trend/repository"
	ptrend_service "orion/platform-svc-go/internal/pipeline-trend/service"

	ci_handler "orion/platform-svc-go/internal/change-intelligence/handler"
	ci_repo "orion/platform-svc-go/internal/change-intelligence/repository"
	ci_service "orion/platform-svc-go/internal/change-intelligence/service"

	tracing_handler "orion/platform-svc-go/internal/tracing/handler"
	tracing_repo "orion/platform-svc-go/internal/tracing/repository"
	tracing_service "orion/platform-svc-go/internal/tracing/service"

	slo_handler "orion/platform-svc-go/internal/slo/handler"
	slo_repo "orion/platform-svc-go/internal/slo/repository"
	slo_service "orion/platform-svc-go/internal/slo/service"

	perf_handler "orion/platform-svc-go/internal/performance/handler"
	perf_repo "orion/platform-svc-go/internal/performance/repository"
	perf_service "orion/platform-svc-go/internal/performance/service"

	hc_handler "orion/platform-svc-go/internal/health-check/handler"
	hc_repo "orion/platform-svc-go/internal/health-check/repository"
	hc_service "orion/platform-svc-go/internal/health-check/service"

	// ---- Wave 7a: P2 modules ----
	compliance_handler "orion/platform-svc-go/internal/compliance/handler"
	compliance_repo "orion/platform-svc-go/internal/compliance/repository"
	compliance_service "orion/platform-svc-go/internal/compliance/service"

	supply_chain_handler "orion/platform-svc-go/internal/supply-chain/handler"
	supply_chain_repo "orion/platform-svc-go/internal/supply-chain/repository"
	supply_chain_service "orion/platform-svc-go/internal/supply-chain/service"

	secret_handler "orion/platform-svc-go/internal/secret/handler"
	secret_repo "orion/platform-svc-go/internal/secret/repository"
	secret_service "orion/platform-svc-go/internal/secret/service"

	chaos_enhanced_handler "orion/platform-svc-go/internal/chaos-enhanced/handler"
	chaos_enhanced_repo "orion/platform-svc-go/internal/chaos-enhanced/repository"
	chaos_enhanced_service "orion/platform-svc-go/internal/chaos-enhanced/service"

	ueba_handler "orion/platform-svc-go/internal/ueba/handler"
	ueba_repo "orion/platform-svc-go/internal/ueba/repository"
	ueba_service "orion/platform-svc-go/internal/ueba/service"

	// ---- problem module (missing handler/service) ----
	problem_handler "orion/platform-svc-go/internal/problem/handler"
	problem_repo "orion/platform-svc-go/internal/problem/repository"
	problem_service "orion/platform-svc-go/internal/problem/service"

	// ---- new blueprint modules ----
	billing_handler "orion/platform-svc-go/internal/billing/handler"
	billing_repo "orion/platform-svc-go/internal/billing/repository"
	billing_service "orion/platform-svc-go/internal/billing/service"

	costalloc_handler "orion/platform-svc-go/internal/cost-allocation/handler"
	costalloc_repo "orion/platform-svc-go/internal/cost-allocation/repository"
	costalloc_service "orion/platform-svc-go/internal/cost-allocation/service"

	efficiency_handler "orion/platform-svc-go/internal/efficiency/handler"
	efficiency_repo "orion/platform-svc-go/internal/efficiency/repository"
	efficiency_service "orion/platform-svc-go/internal/efficiency/service"

	dataLineage_handler "orion/platform-svc-go/internal/data-lineage/handler"
	dataLineage_repo "orion/platform-svc-go/internal/data-lineage/repository"
	dataLineage_service "orion/platform-svc-go/internal/data-lineage/service"

	dataQuality_handler "orion/platform-svc-go/internal/data-quality/handler"
	dataQuality_repo "orion/platform-svc-go/internal/data-quality/repository"
	dataQuality_service "orion/platform-svc-go/internal/data-quality/service"

	apiConsumption_handler "orion/platform-svc-go/internal/api-consumption/handler"
	apiConsumption_repo "orion/platform-svc-go/internal/api-consumption/repository"
	apiConsumption_service "orion/platform-svc-go/internal/api-consumption/service"

	contract_handler "orion/platform-svc-go/internal/contract/handler"
	contract_repo "orion/platform-svc-go/internal/contract/repository"
	contract_service "orion/platform-svc-go/internal/contract/service"

	pe_handler "orion/platform-svc-go/internal/pipeline-engine/handler"
	pe_repo "orion/platform-svc-go/internal/pipeline-engine/repository"
	pe_service "orion/platform-svc-go/internal/pipeline-engine/service"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/database"
	orionlog "orion/go-common/pkg/logger"
	"orion/go-common/pkg/middleware"
	"orion/go-common/pkg/otel"
	redis "orion/go-common/pkg/redis"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	alert_breaker_handler "orion/platform-svc-go/internal/alert-breaker/handler"
	alert_breaker_repo "orion/platform-svc-go/internal/alert-breaker/repository"
	alert_breaker_service "orion/platform-svc-go/internal/alert-breaker/service"
	apm_handler "orion/platform-svc-go/internal/apm/handler"
	apm_repo "orion/platform-svc-go/internal/apm/repository"
	apm_service "orion/platform-svc-go/internal/apm/service"
	bi_dashboard_handler "orion/platform-svc-go/internal/bi-dashboard/handler"
	bi_dashboard_repo "orion/platform-svc-go/internal/bi-dashboard/repository"
	bi_dashboard_service "orion/platform-svc-go/internal/bi-dashboard/service"
	canary_analysis_handler "orion/platform-svc-go/internal/canary-analysis/handler"
	canary_analysis_repo "orion/platform-svc-go/internal/canary-analysis/repository"
	canary_analysis_service "orion/platform-svc-go/internal/canary-analysis/service"
	canary_traffic_handler "orion/platform-svc-go/internal/canary-traffic/handler"
	canary_traffic_repo "orion/platform-svc-go/internal/canary-traffic/repository"
	canary_traffic_service "orion/platform-svc-go/internal/canary-traffic/service"
	cross_domain_handler "orion/platform-svc-go/internal/cross-domain/handler"
	cross_domain_repo "orion/platform-svc-go/internal/cross-domain/repository"
	cross_domain_service "orion/platform-svc-go/internal/cross-domain/service"
	decision_explanation_handler "orion/platform-svc-go/internal/decision-explanation/handler"
	decision_explanation_repo "orion/platform-svc-go/internal/decision-explanation/repository"
	decision_explanation_service "orion/platform-svc-go/internal/decision-explanation/service"
	degradation_handler "orion/platform-svc-go/internal/degradation/handler"
	degradation_repo "orion/platform-svc-go/internal/degradation/repository"
	degradation_service "orion/platform-svc-go/internal/degradation/service"
	dependency_coordination_handler "orion/platform-svc-go/internal/dependency-coordination/handler"
	dependency_coordination_repo "orion/platform-svc-go/internal/dependency-coordination/repository"
	dependency_coordination_service "orion/platform-svc-go/internal/dependency-coordination/service"
	dual_engine_handler "orion/platform-svc-go/internal/dual-engine/handler"
	dual_engine_repo "orion/platform-svc-go/internal/dual-engine/repository"
	dual_engine_service "orion/platform-svc-go/internal/dual-engine/service"
	env_lifecycle_handler "orion/platform-svc-go/internal/env-lifecycle/handler"
	env_lifecycle_repo "orion/platform-svc-go/internal/env-lifecycle/repository"
	env_lifecycle_service "orion/platform-svc-go/internal/env-lifecycle/service"
	env_profile_handler "orion/platform-svc-go/internal/env-profile/handler"
	env_profile_repo "orion/platform-svc-go/internal/env-profile/repository"
	env_profile_service "orion/platform-svc-go/internal/env-profile/service"
	global_param_handler "orion/platform-svc-go/internal/global-param/handler"
	global_param_repo "orion/platform-svc-go/internal/global-param/repository"
	global_param_service "orion/platform-svc-go/internal/global-param/service"
	integration_handler "orion/platform-svc-go/internal/integration/handler"
	integration_repo "orion/platform-svc-go/internal/integration/repository"
	integration_service "orion/platform-svc-go/internal/integration/service"
	maintenance_window_handler "orion/platform-svc-go/internal/maintenance-window/handler"
	maintenance_window_repo "orion/platform-svc-go/internal/maintenance-window/repository"
	maintenance_window_service "orion/platform-svc-go/internal/maintenance-window/service"
	message_queue_handler "orion/platform-svc-go/internal/message-queue/handler"
	message_queue_repo "orion/platform-svc-go/internal/message-queue/repository"
	message_queue_service "orion/platform-svc-go/internal/message-queue/service"
	metrics_handler "orion/platform-svc-go/internal/metrics/handler"
	metrics_repo "orion/platform-svc-go/internal/metrics/repository"
	metrics_service "orion/platform-svc-go/internal/metrics/service"
	multi_modal_trigger_handler "orion/platform-svc-go/internal/multi-modal-trigger/handler"
	multi_modal_trigger_repo "orion/platform-svc-go/internal/multi-modal-trigger/repository"
	multi_modal_trigger_service "orion/platform-svc-go/internal/multi-modal-trigger/service"
	notification_mgmt_handler "orion/platform-svc-go/internal/notification-management/handler"
	notification_mgmt_repo "orion/platform-svc-go/internal/notification-management/repository"
	notification_mgmt_service "orion/platform-svc-go/internal/notification-management/service"
	oci_registry_handler "orion/platform-svc-go/internal/oci-registry/handler"
	oci_registry_repo "orion/platform-svc-go/internal/oci-registry/repository"
	oci_registry_service "orion/platform-svc-go/internal/oci-registry/service"
	plugin_hotreload_handler "orion/platform-svc-go/internal/plugin-hotreload/handler"
	plugin_hotreload_repo "orion/platform-svc-go/internal/plugin-hotreload/repository"
	plugin_hotreload_service "orion/platform-svc-go/internal/plugin-hotreload/service"
	process_step_handler "orion/platform-svc-go/internal/process-step/handler"
	process_step_repo "orion/platform-svc-go/internal/process-step/repository"
	process_step_service "orion/platform-svc-go/internal/process-step/service"
	progessive_handler "orion/platform-svc-go/internal/progressive/handler"
	progessive_repo "orion/platform-svc-go/internal/progressive/repository"
	progessive_service "orion/platform-svc-go/internal/progressive/service"
	queue_mod_handler "orion/platform-svc-go/internal/queue/handler"
	queue_mod_repo "orion/platform-svc-go/internal/queue/repository"
	queue_mod_service "orion/platform-svc-go/internal/queue/service"
	risk_handler "orion/platform-svc-go/internal/risk/handler"
	risk_repo "orion/platform-svc-go/internal/risk/repository"
	risk_service "orion/platform-svc-go/internal/risk/service"
	runbook_handler "orion/platform-svc-go/internal/runbook/handler"
	runbook_repo "orion/platform-svc-go/internal/runbook/repository"
	runbook_service "orion/platform-svc-go/internal/runbook/service"
	script_mod_handler "orion/platform-svc-go/internal/script/handler"
	script_mod_repo "orion/platform-svc-go/internal/script/repository"
	script_mod_service "orion/platform-svc-go/internal/script/service"
	script_library_handler "orion/platform-svc-go/internal/script-library/handler"
	script_library_repo "orion/platform-svc-go/internal/script-library/repository"
	script_library_service "orion/platform-svc-go/internal/script-library/service"
	script_version_handler "orion/platform-svc-go/internal/script-version/handler"
	script_version_repo "orion/platform-svc-go/internal/script-version/repository"
	script_version_service "orion/platform-svc-go/internal/script-version/service"
	self_service_handler "orion/platform-svc-go/internal/self-service/handler"
	self_service_repo "orion/platform-svc-go/internal/self-service/repository"
	self_service_service "orion/platform-svc-go/internal/self-service/service"
	service_catalog_handler "orion/platform-svc-go/internal/service-catalog/handler"
	service_catalog_repo "orion/platform-svc-go/internal/service-catalog/repository"
	service_catalog_service "orion/platform-svc-go/internal/service-catalog/service"
	service_health_handler "orion/platform-svc-go/internal/service-health/handler"
	service_health_repo "orion/platform-svc-go/internal/service-health/repository"
	service_health_service "orion/platform-svc-go/internal/service-health/service"
	service_topology_handler "orion/platform-svc-go/internal/service-topology/handler"
	service_topology_repo "orion/platform-svc-go/internal/service-topology/repository"
	service_topology_service "orion/platform-svc-go/internal/service-topology/service"
	ticket_knowledge_handler "orion/platform-svc-go/internal/ticket-knowledge/handler"
	ticket_knowledge_repo "orion/platform-svc-go/internal/ticket-knowledge/repository"
	ticket_knowledge_service "orion/platform-svc-go/internal/ticket-knowledge/service"
	topology_handler "orion/platform-svc-go/internal/topology/handler"
	topology_repo "orion/platform-svc-go/internal/topology/repository"
	topology_service "orion/platform-svc-go/internal/topology/service"
	unified_config_handler "orion/platform-svc-go/internal/unified-config/handler"
	unified_config_repo "orion/platform-svc-go/internal/unified-config/repository"
	unified_config_service "orion/platform-svc-go/internal/unified-config/service"
	vector_store_handler "orion/platform-svc-go/internal/vector-store/handler"
	vector_store_repo "orion/platform-svc-go/internal/vector-store/repository"
	vector_store_service "orion/platform-svc-go/internal/vector-store/service"
	vectorize_rules_handler "orion/platform-svc-go/internal/vectorize-rules/handler"
	vectorize_rules_repo "orion/platform-svc-go/internal/vectorize-rules/repository"
	vectorize_rules_service "orion/platform-svc-go/internal/vectorize-rules/service"
	version_archive_handler "orion/platform-svc-go/internal/version-archive/handler"
	version_archive_repo "orion/platform-svc-go/internal/version-archive/repository"
	version_archive_service "orion/platform-svc-go/internal/version-archive/service"

	// ---- Wave 7b-j: Webhook + automation modules ----
	webhook_approval_handler "orion/platform-svc-go/internal/webhook-approval/handler"
	webhook_approval_repo "orion/platform-svc-go/internal/webhook-approval/repository"
	webhook_approval_service "orion/platform-svc-go/internal/webhook-approval/service"
	webhook_auth_handler "orion/platform-svc-go/internal/webhook-auth/handler"
	webhook_auth_repo "orion/platform-svc-go/internal/webhook-auth/repository"
	webhook_auth_service "orion/platform-svc-go/internal/webhook-auth/service"
	webhook_database_handler "orion/platform-svc-go/internal/webhook-database/handler"
	webhook_database_repo "orion/platform-svc-go/internal/webhook-database/repository"
	webhook_database_service "orion/platform-svc-go/internal/webhook-database/service"
	webhook_file_handler "orion/platform-svc-go/internal/webhook-file/handler"
	webhook_file_repo "orion/platform-svc-go/internal/webhook-file/repository"
	webhook_file_service "orion/platform-svc-go/internal/webhook-file/service"
	webhook_integration_handler "orion/platform-svc-go/internal/webhook-integration/handler"
	webhook_integration_repo "orion/platform-svc-go/internal/webhook-integration/repository"
	webhook_integration_service "orion/platform-svc-go/internal/webhook-integration/service"
	webhook_logic_handler "orion/platform-svc-go/internal/webhook-logic/handler"
	webhook_logic_repo "orion/platform-svc-go/internal/webhook-logic/repository"
	webhook_logic_service "orion/platform-svc-go/internal/webhook-logic/service"
	webhook_notification_handler "orion/platform-svc-go/internal/webhook-notification/handler"
	webhook_notification_repo "orion/platform-svc-go/internal/webhook-notification/repository"
	webhook_notification_service "orion/platform-svc-go/internal/webhook-notification/service"
	webhook_security_handler "orion/platform-svc-go/internal/webhook-security/handler"
	webhook_security_repo "orion/platform-svc-go/internal/webhook-security/repository"
	webhook_security_service "orion/platform-svc-go/internal/webhook-security/service"
	webhook_variable_handler "orion/platform-svc-go/internal/webhook-variable/handler"
	webhook_variable_repo "orion/platform-svc-go/internal/webhook-variable/repository"
	webhook_variable_service "orion/platform-svc-go/internal/webhook-variable/service"
	webhook_workflow_handler "orion/platform-svc-go/internal/webhook-workflow/handler"
	webhook_workflow_repo "orion/platform-svc-go/internal/webhook-workflow/repository"
	webhook_workflow_service "orion/platform-svc-go/internal/webhook-workflow/service"
	webhook_trigger_handler "orion/platform-svc-go/internal/webhook-trigger/handler"
	webhook_trigger_repo "orion/platform-svc-go/internal/webhook-trigger/repository"
	webhook_trigger_service "orion/platform-svc-go/internal/webhook-trigger/service"
	webhook_webapp_handler "orion/platform-svc-go/internal/webhook-webapp/handler"
	webhook_webapp_repo "orion/platform-svc-go/internal/webhook-webapp/repository"
	webhook_webapp_service "orion/platform-svc-go/internal/webhook-webapp/service"
	webhook_pipeline_handler "orion/platform-svc-go/internal/webhook-pipeline/handler"
	webhook_pipeline_repo "orion/platform-svc-go/internal/webhook-pipeline/repository"
	webhook_pipeline_service "orion/platform-svc-go/internal/webhook-pipeline/service"
	webhook_deployment_handler "orion/platform-svc-go/internal/webhook-deployment/handler"
	webhook_deployment_repo "orion/platform-svc-go/internal/webhook-deployment/repository"
	webhook_deployment_service "orion/platform-svc-go/internal/webhook-deployment/service"
	webhook_config_handler "orion/platform-svc-go/internal/webhook-config/handler"
	webhook_config_repo "orion/platform-svc-go/internal/webhook-config/repository"
	webhook_config_service "orion/platform-svc-go/internal/webhook-config/service"
	webhook_secret_handler "orion/platform-svc-go/internal/webhook-secret/handler"
	webhook_secret_repo "orion/platform-svc-go/internal/webhook-secret/repository"
	webhook_secret_service "orion/platform-svc-go/internal/webhook-secret/service"
	webhook_monitor_handler "orion/platform-svc-go/internal/webhook-monitor/handler"
	webhook_monitor_repo "orion/platform-svc-go/internal/webhook-monitor/repository"
	webhook_monitor_service "orion/platform-svc-go/internal/webhook-monitor/service"
	webhook_incident_handler "orion/platform-svc-go/internal/webhook-incident/handler"
	webhook_incident_repo "orion/platform-svc-go/internal/webhook-incident/repository"
	webhook_incident_service "orion/platform-svc-go/internal/webhook-incident/service"
	webhook_ticket_handler "orion/platform-svc-go/internal/webhook-ticket/handler"
	webhook_ticket_repo "orion/platform-svc-go/internal/webhook-ticket/repository"
	webhook_ticket_service "orion/platform-svc-go/internal/webhook-ticket/service"
	webhook_workorder_handler "orion/platform-svc-go/internal/webhook-workorder/handler"
	webhook_workorder_repo "orion/platform-svc-go/internal/webhook-workorder/repository"
	webhook_workorder_service "orion/platform-svc-go/internal/webhook-workorder/service"
	webhook_notify_handler "orion/platform-svc-go/internal/webhook-notify/handler"
	webhook_notify_repo "orion/platform-svc-go/internal/webhook-notify/repository"
	webhook_notify_service "orion/platform-svc-go/internal/webhook-notify/service"
	webhook_event_handler "orion/platform-svc-go/internal/webhook-event/handler"
	webhook_event_repo "orion/platform-svc-go/internal/webhook-event/repository"
	webhook_event_service "orion/platform-svc-go/internal/webhook-event/service"
	webhook_queue_handler "orion/platform-svc-go/internal/webhook-queue/handler"
	webhook_queue_repo "orion/platform-svc-go/internal/webhook-queue/repository"
	webhook_queue_service "orion/platform-svc-go/internal/webhook-queue/service"
	webhook_cache_handler "orion/platform-svc-go/internal/webhook-cache/handler"
	webhook_cache_repo "orion/platform-svc-go/internal/webhook-cache/repository"
	webhook_cache_service "orion/platform-svc-go/internal/webhook-cache/service"
	webhook_db_sync_handler "orion/platform-svc-go/internal/webhook-db-sync/handler"
	webhook_db_sync_repo "orion/platform-svc-go/internal/webhook-db-sync/repository"
	webhook_db_sync_service "orion/platform-svc-go/internal/webhook-db-sync/service"
	webhook_transform_handler "orion/platform-svc-go/internal/webhook-transform/handler"
	webhook_transform_repo "orion/platform-svc-go/internal/webhook-transform/repository"
	webhook_transform_service "orion/platform-svc-go/internal/webhook-transform/service"
	webhook_validate_handler "orion/platform-svc-go/internal/webhook-validate/handler"
	webhook_validate_repo "orion/platform-svc-go/internal/webhook-validate/repository"
	webhook_validate_service "orion/platform-svc-go/internal/webhook-validate/service"
	webhook_log_handler "orion/platform-svc-go/internal/webhook-log/handler"
	webhook_log_repo "orion/platform-svc-go/internal/webhook-log/repository"
	webhook_log_service "orion/platform-svc-go/internal/webhook-log/service"
	webhook_metric_handler "orion/platform-svc-go/internal/webhook-metric/handler"
	webhook_metric_repo "orion/platform-svc-go/internal/webhook-metric/repository"
	webhook_metric_service "orion/platform-svc-go/internal/webhook-metric/service"
	webhook_trace_handler "orion/platform-svc-go/internal/webhook-trace/handler"
	webhook_trace_repo "orion/platform-svc-go/internal/webhook-trace/repository"
	webhook_trace_service "orion/platform-svc-go/internal/webhook-trace/service"
	deployment_trigger_handler "orion/platform-svc-go/internal/deployment-trigger/handler"
	deployment_trigger_repo "orion/platform-svc-go/internal/deployment-trigger/repository"
	deployment_trigger_service "orion/platform-svc-go/internal/deployment-trigger/service"
	incident_action_handler "orion/platform-svc-go/internal/incident-action/handler"
	incident_action_repo "orion/platform-svc-go/internal/incident-action/repository"
	incident_action_service "orion/platform-svc-go/internal/incident-action/service"
	ticket_automation_handler "orion/platform-svc-go/internal/ticket-automation/handler"
	ticket_automation_repo "orion/platform-svc-go/internal/ticket-automation/repository"
	ticket_automation_service "orion/platform-svc-go/internal/ticket-automation/service"

	// Phase 4: Gateway business logic migration
	ai_decisions_handler "orion/platform-svc-go/internal/ai-decisions/handler"
	ai_decisions_repo "orion/platform-svc-go/internal/ai-decisions/repository"
	ai_decisions_service "orion/platform-svc-go/internal/ai-decisions/service"
	ai_degradation_handler "orion/platform-svc-go/internal/ai-degradation/handler"
	ai_degradation_repo "orion/platform-svc-go/internal/ai-degradation/repository"
	ai_degradation_service "orion/platform-svc-go/internal/ai-degradation/service"
	ai_models_handler "orion/platform-svc-go/internal/ai-models/handler"
	ai_models_repo "orion/platform-svc-go/internal/ai-models/repository"
	ai_models_service "orion/platform-svc-go/internal/ai-models/service"
	chaos_gw_handler "orion/platform-svc-go/internal/chaos-gateway/handler"
	chaos_gw_repo "orion/platform-svc-go/internal/chaos-gateway/repository"
	chaos_gw_service "orion/platform-svc-go/internal/chaos-gateway/service"
	dt_sim_handler "orion/platform-svc-go/internal/digital-twin-simulation/handler"
	dt_sim_repo "orion/platform-svc-go/internal/digital-twin-simulation/repository"
	dt_sim_service "orion/platform-svc-go/internal/digital-twin-simulation/service"
	gov_handler "orion/platform-svc-go/internal/governance/handler"
	gov_repo "orion/platform-svc-go/internal/governance/repository"
	gov_service "orion/platform-svc-go/internal/governance/service"
	pv_handler "orion/platform-svc-go/internal/pipeline-versions/handler"
	pv_repo "orion/platform-svc-go/internal/pipeline-versions/repository"
	pv_service "orion/platform-svc-go/internal/pipeline-versions/service"
	rs_handler "orion/platform-svc-go/internal/resilience-score/handler"
	rs_repo "orion/platform-svc-go/internal/resilience-score/repository"
	rs_service "orion/platform-svc-go/internal/resilience-score/service"
	sbom_handler "orion/platform-svc-go/internal/sbom/handler"
	sbom_repo "orion/platform-svc-go/internal/sbom/repository"
	sbom_service "orion/platform-svc-go/internal/sbom/service"
	tenant_gw_handler "orion/platform-svc-go/internal/tenant-gateway/handler"
	tenant_gw_repo "orion/platform-svc-go/internal/tenant-gateway/repository"
	tenant_gw_service "orion/platform-svc-go/internal/tenant-gateway/service"
)


func main() {
	logger := orionlog.Must(orionlog.DefaultConfig("orion-platform-svc"))
	defer logger.Sync()

	ffCfg := ff_config.Load()

	// OpenTelemetry tracing (0.1)
	if otelShutdown, err := otel.Init(otel.Config{
		ServiceName: "orion-platform-svc",
		Endpoint:    ffCfg.OTELExporterEndpoint,
		Insecure:    ffCfg.OTELInsecure,
	}); err != nil {
		logger.Warn("OpenTelemetry init failed (tracing disabled)", zap.Error(err))
	} else if otelShutdown != nil {
		defer otelShutdown(context.Background())
	}

	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		ffCfg.DBHost, ffCfg.DBPort, ffCfg.DBUser, ffCfg.DBPassword, ffCfg.DBName, ffCfg.DBSSLMode)
	dbCfg := database.DefaultConfig(dsn)

	db, err := database.Connect(context.Background(), dbCfg)
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	migrationsDir := "migrations"
	if _, err := os.Stat(migrationsDir); err == nil {
		if err := database.RunMigrations(db, migrationsDir); err != nil {
			log.Printf("warning: failed to run migrations: %v", err)
		}
	}

	rdb := redis.NewClient(redis.Config{Addr: ffCfg.RedisAddr})
	defer rdb.Close()

	// Feature-flag services
	ffRepo := ff_repo.NewRepository(db.DB)
	ffSvc := ff_service.NewService(ffRepo)
	ffH := ff_handler.NewHandler(ffSvc)

	// Role services
	roleRepo := role_repo.NewRepository(db.DB)
	roleSvc := role_service.NewService(roleRepo)
	roleH := role_handler.NewHandler(roleSvc)

	// API Governance services
	agRepo := ag_repo.NewRepository(db.DB)
	agSvc := ag_service.NewService(agRepo)
	agH := ag_handler.NewHandler(agSvc)

	// ---- Wave 2: Auth + Permission services ----
	aeRepo := ae_repo.NewRepository(db.DB)
	aeSvc := ae_service.NewService(aeRepo)
	aeH := ae_handler.NewHandler(aeSvc)
	amfaRepo := amfa_repo.NewRepository(db.DB)
	amfaSvc := amfa_service.NewService(amfaRepo)
	amfaH := amfa_handler.NewHandler(amfaSvc)
	ssouRepo := ssou_repo.NewRepository(db.DB)
	ssouSvc := ssou_service.NewService(ssouRepo)
	ssouH := ssou_handler.NewHandler(ssouSvc)
	ssopRepo := ssop_repo.NewRepository(db.DB)
	ssopSvc := ssop_service.NewService(ssopRepo)
	ssopH := ssop_handler.NewHandler(ssopSvc)
	abacRepo := abac_repo.NewRepository(db.DB)
	abacSvc := abac_service.NewService(abacRepo)
	abacH := abac_handler.NewHandler(abacSvc)
	pauditRepo := paudit_repo.NewRepository(db.DB)
	pauditSvc := paudit_service.NewService(pauditRepo)
	pauditH := paudit_handler.NewHandler(pauditSvc)

	// Federation services
	fedRepo := fed_repo.NewRepository(db.DB)
	fedSvc := fed_service.NewService(fedRepo)
	fedH := fed_handler.NewHandler(fedSvc)

	// Artifact services
	artifactRepo := artifact_repo.NewRepository(db.DB)
	artifactSvc := artifact_service.NewService(artifactRepo)
	artifactH := artifact_handler.NewHandler(artifactSvc)

	// Plugin services
	pluginRepo := plugin_repo.NewRepository(db.DB)
	pluginSvc := plugin_service.NewService(pluginRepo)
	pluginH := plugin_handler.NewHandler(pluginSvc)

	// Inception services
	incRepo := inc_repo.NewRepository(db.DB)
	incSvc := inc_service.NewService(incRepo)
	incH := inc_handler.NewHandler(incSvc)

	// Environment services
	envRepo := env_repo.NewRepository(db.DB)
	envSvc := env_service.NewService(envRepo)
	envH := env_handler.NewHandler(envSvc)

	// Policy services
	policyRepo := policy_repo.NewRepository(db.DB)
	policySvc := policy_service.NewService(policyRepo)
	policyH := policy_handler.NewHandler(policySvc)

	// Project services
	projRepo := proj_repo.NewRepository(db.DB)
	projSvc := proj_service.NewService(projRepo)
	projH := proj_handler.NewHandler(projSvc)

	// project-member services
	projectmemberRepo := projectmember_repo.NewRepository(db.DB)
	projectmemberSvc := projectmember_service.NewService(projectmemberRepo)
	projectmemberH := projectmember_handler.NewHandler(projectmemberSvc)

	// product-line services
	productlineRepo := productline_repo.NewRepository(db.DB)
	productlineSvc := productline_service.NewService(productlineRepo)
	productlineH := productline_handler.NewHandler(productlineSvc)

	// team services
	teamRepo := team_repo.NewRepository(db.DB)
	teamSvc := team_service.NewService(teamRepo)
	teamH := team_handler.NewHandler(teamSvc)

	// subapp services
	subappRepo := subapp_repo.NewRepository(db.DB)
	subappSvc := subapp_service.NewService(subappRepo)
	subappH := subapp_handler.NewHandler(subappSvc)

	// workbench services
	workbenchRepo := workbench_repo.NewRepository(db.DB)
	workbenchSvc := workbench_service.NewService(workbenchRepo)
	workbenchH := workbench_handler.NewHandler(workbenchSvc)

	// sprint services
	sprintRepo := sprint_repo.NewRepository(db.DB)
	sprintSvc := sprint_service.NewService(sprintRepo)
	sprintH := sprint_handler.NewHandler(sprintSvc)

	// internal-library services
	internallibraryRepo := internallibrary_repo.NewRepository(db.DB)
	internallibrarySvc := internallibrary_service.NewService(internallibraryRepo)
	internallibraryH := internallibrary_handler.NewHandler(internallibrarySvc)

	// developer-portal services
	developerportalRepo := developerportal_repo.NewRepository(db.DB)
	developerportalSvc := developerportal_service.NewService(developerportalRepo, db.DB)
	developerportalH := developerportal_handler.NewHandler(developerportalSvc)

	// service-registry services
	serviceregistryRepo := serviceregistry_repo.NewRepository(db.DB)
	serviceregistrySvc := serviceregistry_service.NewService(serviceregistryRepo)
	serviceregistryH := serviceregistry_handler.NewHandler(serviceregistrySvc)

	// page-registry services
	pageregistryRepo := pageregistry_repo.NewRepository(db.DB)
	pageregistrySvc := pageregistry_service.NewService(pageregistryRepo)
	pageregistryH := pageregistry_handler.NewHandler(pageregistrySvc)

	// capability services
	capabilityRepo := capability_repo.NewRepository(db.DB)
	capabilitySvc := capability_service.NewService(capabilityRepo)
	capabilityH := capability_handler.NewHandler(capabilitySvc)

	// chaos services
	chaosRepo := chaos_repo.NewRepository(db.DB)
	chaosSvc := chaos_service.NewService(chaosRepo)
	chaosH := chaos_handler.NewHandler(chaosSvc)

	// infrastructure services
	infraRepo := infra_repo.NewRepository(db.DB)
	infraSvc := infra_service.NewService(infraRepo)
	infraH := infra_handler.NewHandler(infraSvc)

	// iac services
	iacRepo := iac_repo.NewRepository(db.DB)
	iacSvc := iac_service.NewService(iacRepo)
	iacH := iac_handler.NewHandler(iacSvc)

	// cron services
	cronRepo := cron_repo.NewRepository(db.DB)
	cronSvc := cron_service.NewService(cronRepo)
	cronH := cron_handler.NewHandler(cronSvc)

	// gateway-dynamic services
	gatewaydynamicRepo := gatewaydynamic_repo.NewRepository(db.DB)
	gatewaydynamicSvc := gatewaydynamic_service.NewService(gatewaydynamicRepo)
	gatewaydynamicH := gatewaydynamic_handler.NewHandler(gatewaydynamicSvc)

	// gateway-dynamic gray release services (P0-4 Gateway 灰度)
	gdGrayRepo := gatewaydynamic_repo.NewGrayReleaseRepository(db.DB)
	gdGraySvc := gatewaydynamic_service.NewGrayReleaseService(gdGrayRepo, nil)
	gdGrayH := gatewaydynamic_handler.NewGrayReleaseHandler(gdGraySvc)

	// handler-registry services
	handlerregistryRepo := handlerregistry_repo.NewRepository(db.DB)
	handlerregistrySvc := handlerregistry_service.NewService(handlerregistryRepo)
	handlerregistryH := handlerregistry_handler.NewHandler(handlerregistrySvc)

	// i18n services
	i18nRepo := i18n_repo.NewRepository(db.DB)
	i18nSvc := i18n_service.NewService(i18nRepo)
	i18nH := i18n_handler.NewHandler(i18nSvc)

	// multi-cloud services

	// serverless services
	serverlessRepo := serverless_repo.NewRepository(db.DB)
	serverlessSvc := serverless_service.NewService(serverlessRepo)
	serverlessH := serverless_handler.NewHandler(serverlessSvc)
	multicloudRepo := multicloud_repo.NewRepository(db.DB)
	multicloudSvc := multicloud_service.NewService(multicloudRepo)
	multicloudH := multicloud_handler.NewHandler(multicloudSvc)

	// cmdb services
	cmdbRepo := cmdb_repo.NewRepository(db.DB)
	cmdbSvc := cmdb_service.NewService(cmdbRepo)
	cmdbH := cmdb_handler.NewHandler(cmdbSvc)

	// monitoring services
	monitoringRepo := monitoring_repo.NewRepository(db.DB)
	monitoringSvc := monitoring_service.NewService(monitoringRepo)
	monitoringH := monitoring_handler.NewHandler(monitoringSvc)

	// alert services
	alertRepo := alert_repo.NewRepository(db.DB)
	alertSvc := alert_service.NewService(alertRepo, db.DB)
	alertH := alert_handler.NewHandler(alertSvc)

	// artifact-ops services
	artifactopsRepo := artifactops_repo.NewRepository(db.DB)
	artifactopsSvc := artifactops_service.NewService(artifactopsRepo, db.DB)
	artifactopsH := artifactops_handler.NewHandler(artifactopsSvc)

	// config services
	configRepo := config_repo.NewRepository(db.DB)
	configSvc := config_service.NewService(configRepo)
	configH := config_handler.NewHandler(configSvc)

	// chatops services
	chatopsRepo := chatops_repo.NewRepository(db.DB)
	chatopsSvc := chatops_service.NewService(chatopsRepo)
	chatopsH := chatops_handler.NewHandler(chatopsSvc)

	// code-repo services
	code_repoRepo := code_repo_repo.NewRepository(db.DB)
	code_repoSvc := code_repo_service.NewService(code_repoRepo, db.DB)
	code_repoH := code_repo_handler.NewHandler(code_repoSvc)

	// approval services
	approvalRepo := approval_repo.NewRepository(db.DB)
	approvalSvc := approval_service.NewService(approvalRepo)
	approvalH := approval_handler.NewHandler(approvalSvc)

	// audit services
	auditRepo := audit_repo.NewRepository(db.DB)
	auditSvc := audit_service.NewService(auditRepo)
	auditH := audit_handler.NewHandler(auditSvc)

	// incident services
	incidentRepo := incident_repo.NewRepository(db.DB)
	incidentSvc := incident_service.NewService(incidentRepo)
	incidentH := incident_handler.NewHandler(incidentSvc)
	// build-env services
	build_envRepo := build_env_repo.NewRepository(db.DB)
	build_envSvc := build_env_service.NewService(build_envRepo, db.DB.DB)
	build_envH := build_env_handler.NewHandler(build_envSvc)

	// Build service
	buildRepo := build_repo.NewRepository(db.DB)
	buildSvc := build_service.NewService(buildRepo)
	buildH := build_handler.NewHandler(buildSvc)
	// dba services
	dbaRepo := dba_repo.NewRepository(db.DB)
	dbaSvc := dba_service.NewService(dbaRepo)
	dbaH := dba_handler.NewHandler(dbaSvc)

	// deploy services
	deployRepo := deploy_repo.NewRepository(db.DB)
	deploySvc := deploy_service.NewService(deployRepo)
	deployH := deploy_handler.NewHandler(deploySvc)

	// deploy-enhanced services
	deploy_enhancedRepo := deploy_enhanced_repo.NewRepository(db.DB)
	deploy_enhancedSvc := deploy_enhanced_service.NewService(deploy_enhancedRepo)
	deploy_enhancedH := deploy_enhanced_handler.NewHandler(deploy_enhancedSvc)

	// digital-twin services
	digital_twinRepo := digital_twin_repo.NewRepository(db.DB)
	digital_twinSvc := digital_twin_service.NewService(digital_twinRepo)
	digital_twinH := digital_twin_handler.NewHandler(digital_twinSvc)

	// finops services
	finopsRepo := finops_repo.NewRepository(db.DB)
	finopsSvc := finops_service.NewService(finopsRepo)
	finopsH := finops_handler.NewHandler(finopsSvc)

	// finops-v2 services
	finops_v2Repo := finops_v2_repo.NewRepository(db.DB)
	finops_v2Svc := finops_v2_service.NewService(finops_v2Repo)
	finops_v2H := finops_v2_handler.NewHandler(finops_v2Svc)

	// knowledge services
	knowledgeRepo := knowledge_repo.NewRepository(db.DB.DB)
	knowledgeSvc := knowledge_service.NewService(knowledgeRepo)
	knowledgeH := knowledge_handler.NewHandler(knowledgeSvc)

	// security-compliance services
	security_complianceRepo := security_compliance_repo.NewRepository(db.DB)
	security_complianceSvc := security_compliance_service.NewService(security_complianceRepo)
	security_complianceH := security_compliance_handler.NewHandler(security_complianceSvc)

	// tenant services
	tenantRepo := tenant_repo.NewRepository(db.DB.DB)
	tenantSvc := tenant_service.NewService(tenantRepo)
	tenantH := tenant_handler.NewHandler(tenantSvc)

	// ticketing services
	ticketingRepo := ticketing_repo.NewRepository(db.DB)
	ticketingSvc := ticketing_service.NewService(ticketingRepo)
	ticketingH := ticketing_handler.NewHandler(ticketingSvc)

	// change services
	changeRepo := change_repo.NewRepository(db.DB)
	changeSvc := change_service.NewService(changeRepo)
	changeH := change_handler.NewHandler(changeSvc)

	// skill services
	skillSvc := skill_service.NewService()
	skillH := skill_handler.NewHandler(skillSvc)

	// sla services
	slaRepo := sla_repo.NewRepository(db.DB)
	slaSvc := sla_service.NewService(slaRepo)
	slaH := sla_handler.NewHandler(slaSvc)

	// visor-exec services
	visorRepo := visor_repo.NewRepository(db.DB)
	visorSvc := visor_service.NewService(visorRepo)
	visorH := visor_handler.NewHandler(visorSvc)

	// change-request services
	crRepo := cr_repo.NewRepository(db.DB)
	crSvc := cr_service.NewService(crRepo)
	crH := cr_handler.NewHandler(crSvc)

	// report-designer services
	rdRepo := rd_repo.NewRepository(db.DB)
	rdSvc := rd_service.NewService(rdRepo)
	rdH := rd_handler.NewHandler(rdSvc)

	// oncall services
	oncallRepo := oncall_repo.NewRepository(db.DB)
	oncallSvc := oncall_service.NewService(oncallRepo)
	oncallH := oncall_handler.NewHandler(oncallSvc)

	// diagnostic services
	diagnosticRepo := diagnostic_repo.NewRepository(db.DB)
	diagnosticSvc := diagnostic_service.NewService(diagnosticRepo)
	diagnosticH := diagnostic_handler.NewHandler(diagnosticSvc)

	// api-market services
	amRepo := am_repo.NewRepository(db.DB)
	amSvc := am_service.NewService(amRepo)
	amH := am_handler.NewHandler(amSvc)

	// ci-type services
	citRepo := cit_repo.NewRepository(db.DB)
	citSvc := cit_service.NewService(citRepo)
	citH := cit_handler.NewHandler(citSvc)

	// backup services
	backupRepo := backup_repo.NewRepository(db.DB)
	backupSvc := backup_service.NewService(backupRepo)
	backupH := backup_handler.NewHandler(backupSvc)

	// notification services
	notificationRepo := notification_repo.NewRepository(db.DB)
	notificationSvc := notification_service.NewService(notificationRepo)
	notificationH := notification_handler.NewHandler(notificationSvc)

	// notification-policy services
	notification_policyRepo := notification_policy_repo.NewRepository(db.DB)
	notification_policySvc := notification_policy_service.NewService(notification_policyRepo)
	notification_policyH := notification_policy_handler.NewHandler(notification_policySvc)

	// notification-template services
	notification_templateRepo := notification_template_repo.NewRepository(db.DB)
	notification_templateSvc := notification_template_service.NewService(notification_templateRepo)
	notification_templateH := notification_template_handler.NewHandler(notification_templateSvc)

	// scheduled-notification services
	scheduled_notificationRepo := scheduled_notification_repo.NewRepository(db.DB)
	scheduled_notificationSvc := scheduled_notification_service.NewService(scheduled_notificationRepo)
	scheduled_notificationH := scheduled_notification_handler.NewHandler(scheduled_notificationSvc)

	// webhook services
	webhookRepo := webhook_repo.NewRepository(db.DB)
	webhookSvc := webhook_service.NewService(webhookRepo)
	webhookH := webhook_handler.NewHandler(webhookSvc)

	// do-not-disturb services
	ddRepo := dd_repo.NewRepository(db.DB)
	ddSvc := dd_service.NewService(ddRepo)
	ddH := dd_handler.NewHandler(ddSvc)

	// channel services
	chanRepo := chan_repo.NewRepository(db.DB)
	chanSvc := chan_service.NewService(chanRepo)
	chanH := chan_handler.NewHandler(chanSvc)

	// workflow services
	workflowRepo := workflow_repo.NewRepository(db.DB)
	workflowSvc := workflow_service.NewService(workflowRepo)
	workflowH := workflow_handler.NewHandler(workflowSvc)

	// workflow-trigger services
	workflow_triggerRepo := workflow_trigger_repo.NewRepository(db.DB)
	workflow_triggerSvc := workflow_trigger_service.NewService(workflow_triggerRepo)
	workflow_triggerH := workflow_trigger_handler.NewHandler(workflow_triggerSvc)

	// workflow-task services
	workflow_taskRepo := workflow_task_repo.NewRepository(db.DB)
	workflow_taskSvc := workflow_task_service.NewService(workflow_taskRepo)
	workflow_taskH := workflow_task_handler.NewHandler(workflow_taskSvc)

	// workflow-dependency services
	workflow_depRepo := workflow_dep_repo.NewRepository(db.DB)
	workflow_depSvc := workflow_dep_service.NewService(workflow_depRepo)
	workflow_depH := workflow_dep_handler.NewHandler(workflow_depSvc)

	// workflow-webhook services
	workflow_webhookRepo := workflow_webhook_repo.NewRepository(db.DB)
	workflow_webhookSvc := workflow_webhook_service.NewService(workflow_webhookRepo)
	workflow_webhookH := workflow_webhook_handler.NewHandler(workflow_webhookSvc)

	// lowcode services
	lowcodeRepo := lowcode_repo.NewRepository(db.DB)
	lowcodeSvc := lowcode_service.NewService(lowcodeRepo)
	lowcodeH := lowcode_handler.NewHandler(lowcodeSvc)

	// session services
	sessionRepo := session_repo.NewRepository(db.DB)
	sessionSvc := session_service.NewService(sessionRepo, 72*time.Hour)
	sessionH := session_handler.NewHandler(sessionSvc)

	// api-key services
	apikeyRepo := apikey_repo.NewRepository(db.DB)
	apikeySvc := apikey_service.NewService(apikeyRepo)
	apikeyH := apikey_handler.NewHandler(apikeySvc)

	// eventbus services
	eventbusRepo := eventbus_repo.NewRepository(db.DB)
	eventbusSvc := eventbus_service.NewService(eventbusRepo)
	eventbusH := eventbus_handler.NewHandler(eventbusSvc)

	// event-trigger services
	triggerRepo := trigger_repo.NewRepository(db.DB)
	triggerSvc := trigger_service.NewService(triggerRepo)
	triggerH := trigger_handler.NewHandler(triggerSvc)

	// hook-chain services
	hookRepo := hook_repo.NewRepository(db.DB)
	hookSvc := hook_service.NewService(hookRepo)
	hookH := hook_handler.NewHandler(hookSvc)

	// ---- Wave 5: Pipeline Assistant ----
	pbRepo := pb_repo.NewRepository(db.DB)
	pbSvc := pb_service.NewService(pbRepo)
	pbH := pb_handler.NewHandler(pbSvc)

	palRepo := pal_repo.NewRepository(db.DB)
	palSvc := pal_service.NewService(palRepo)
	palH := pal_handler.NewHandler(palSvc)

	ptmplRepo := ptmpl_repo.NewRepository(db.DB)
	ptmplSvc := ptmpl_service.NewService(ptmplRepo)
	ptmplH := ptmpl_handler.NewHandler(ptmplSvc)

	pverRepo := pver_repo.NewRepository(db.DB)
	pverSvc := pver_service.NewService(pverRepo)
	pverH := pver_handler.NewHandler(pverSvc)

	phistRepo := phist_repo.NewRepository(db.DB)
	phistSvc := phist_service.NewService(phistRepo)
	phistH := phist_handler.NewHandler(phistSvc)

	pboRepo := pbo_repo.NewRepository(db.DB)
	pboSvc := pbo_service.NewService(pboRepo)
	pboH := pbo_handler.NewHandler(pboSvc)

	psseRepo := psse_repo.NewRepository(db.DB)
	psseSvc := psse_service.NewSSEHub(psseRepo)
	psseH := psse_handler.NewHandler(psseSvc)

	pecRepo := pec_repo.NewRepository(db.DB)
	pecSvc := pec_service.NewService(pecRepo)
	pecH := pec_handler.NewHandler(pecSvc)

	pgraphRepo := pgraph_repo.NewRepository(db.DB)
	pgraphSvc := pgraph_service.NewService(pgraphRepo)
	pgraphH := pgraph_handler.NewHandler(pgraphSvc)

	ptrendRepo := ptrend_repo.NewRepository(db.DB)
	ptrendSvc := ptrend_service.NewService(ptrendRepo)
	ptrendH := ptrend_handler.NewHandler(ptrendSvc)

	ciRepo := ci_repo.NewRepository(db.DB)
	ciSvc := ci_service.NewService(ciRepo)
	ciH := ci_handler.NewHandler(ciSvc)

	// ---- Wave 6: Observability ----
	tracingRepo := tracing_repo.NewRepository(db.DB)
	tracingSvc := tracing_service.NewService(tracingRepo)
	tracingH := tracing_handler.NewHandler(tracingSvc)

	sloRepo := slo_repo.NewRepository(db.DB)
	sloSvc := slo_service.NewService(sloRepo)
	sloH := slo_handler.NewHandler(sloSvc)

	perfRepo := perf_repo.NewRepository(db.DB)
	perfSvc := perf_service.NewService(perfRepo)
	perfH := perf_handler.NewHandler(perfSvc)

	hcRepo := hc_repo.NewRepository(db.DB)
	hcSvc := hc_service.NewService(hcRepo)
	hcH := hc_handler.NewHandler(hcSvc)

	// ---- Wave 7a: P2 modules ----
	complianceRepo := compliance_repo.NewRepository(db.DB)
	complianceSvc := compliance_service.NewService(complianceRepo)
	complianceH := compliance_handler.NewHandler(complianceSvc)

	supply_chainRepo := supply_chain_repo.NewRepository(db.DB)
	supply_chainSvc := supply_chain_service.NewService(supply_chainRepo)
	supply_chainH := supply_chain_handler.NewHandler(supply_chainSvc)

	secretRepo := secret_repo.NewRepository(db.DB)
	secretSvc := secret_service.NewService(secretRepo)
	secretH := secret_handler.NewHandler(secretSvc)

	chaos_enhancedRepo := chaos_enhanced_repo.NewRepository(db.DB)
	chaos_enhancedSvc := chaos_enhanced_service.NewService(chaos_enhancedRepo)

	chaos_enhancedH := chaos_enhanced_handler.NewHandler(chaos_enhancedSvc)

	uebaRepo := ueba_repo.NewRepository(db.DB)
	uebaSvc := ueba_service.NewService(uebaRepo)
	uebaH := ueba_handler.NewHandler(uebaSvc)

	// problem services
	problemRepo := problem_repo.NewRepository(db.DB)
	problemSvc := problem_service.NewService(problemRepo)
	problemH := problem_handler.NewHandler(problemSvc)

	// new blueprint modules
	billingRepo := billing_repo.NewRepository(db.DB)
	billingSvc := billing_service.NewService(billingRepo)
	billingH := billing_handler.NewHandler(billingSvc)

	costallocRepo := costalloc_repo.NewRepository(db.DB)
	costallocSvc := costalloc_service.NewService(costallocRepo)
	costallocH := costalloc_handler.NewHandler(costallocSvc)

	efficiencyRepo := efficiency_repo.NewRepository(db.DB)
	efficiencySvc := efficiency_service.NewService(efficiencyRepo)
	efficiencyH := efficiency_handler.NewHandler(efficiencySvc)

	dataLineageRepo := dataLineage_repo.NewRepository(db.DB)
	dataLineageSvc := dataLineage_service.NewService(dataLineageRepo)
	dataLineageH := dataLineage_handler.NewHandler(dataLineageSvc)

	dataQualityRepo := dataQuality_repo.NewRepository(db.DB)
	dataQualitySvc := dataQuality_service.NewService(dataQualityRepo)
	dataQualityH := dataQuality_handler.NewHandler(dataQualitySvc)

	// ---- Wave 7: P2 module services (batch 1-2) ----
	canary_trafficRepo := canary_traffic_repo.NewRepository(db.DB)
	canary_trafficSvc := canary_traffic_service.NewService(canary_trafficRepo)
	canary_trafficH := canary_traffic_handler.NewHandler(canary_trafficSvc)
	cross_domainRepo := cross_domain_repo.NewRepository(db.DB)
	cross_domainSvc := cross_domain_service.NewService(cross_domainRepo)
	cross_domainH := cross_domain_handler.NewHandler(cross_domainSvc)
	decision_explanationRepo := decision_explanation_repo.NewRepository(db.DB)
	decision_explanationSvc := decision_explanation_service.NewService(decision_explanationRepo)
	decision_explanationH := decision_explanation_handler.NewHandler(decision_explanationSvc)
	degradationRepo := degradation_repo.NewRepository(db.DB)
	degradationSvc := degradation_service.NewService(degradationRepo)
	degradationH := degradation_handler.NewHandler(degradationSvc)
	dependency_coordinationRepo := dependency_coordination_repo.NewRepository(db.DB)
	dependency_coordinationSvc := dependency_coordination_service.NewService(dependency_coordinationRepo)
	dependency_coordinationH := dependency_coordination_handler.NewHandler(dependency_coordinationSvc)
	dual_engineRepo := dual_engine_repo.NewRepository(db.DB)
	dual_engineSvc := dual_engine_service.NewService(dual_engineRepo)
	dual_engineH := dual_engine_handler.NewHandler(dual_engineSvc)
	env_lifecycleRepo := env_lifecycle_repo.NewRepository(db.DB)
	env_lifecycleSvc := env_lifecycle_service.NewService(env_lifecycleRepo)
	env_lifecycleH := env_lifecycle_handler.NewHandler(env_lifecycleSvc)
	env_profileRepo := env_profile_repo.NewRepository(db.DB)
	env_profileSvc := env_profile_service.NewService(env_profileRepo)
	env_profileH := env_profile_handler.NewHandler(env_profileSvc)
	global_paramRepo := global_param_repo.NewRepository(db.DB)
	global_paramSvc := global_param_service.NewService(global_paramRepo)
	global_paramH := global_param_handler.NewHandler(global_paramSvc)
	integrationRepo := integration_repo.NewRepository(db.DB)
	integrationSvc := integration_service.NewService(integrationRepo)
	integrationH := integration_handler.NewHandler(integrationSvc)
	maintenance_windowRepo := maintenance_window_repo.NewRepository(db.DB)
	maintenance_windowSvc := maintenance_window_service.NewService(maintenance_windowRepo)
	maintenance_windowH := maintenance_window_handler.NewHandler(maintenance_windowSvc)
	message_queueRepo := message_queue_repo.NewRepository(db.DB)
	message_queueSvc := message_queue_service.NewService(message_queueRepo)
	message_queueH := message_queue_handler.NewHandler(message_queueSvc)
	metricsRepo := metrics_repo.NewRepository(db.DB)
	metricsSvc := metrics_service.NewService(metricsRepo)
	metricsH := metrics_handler.NewHandler(metricsSvc)
	multi_modal_triggerRepo := multi_modal_trigger_repo.NewRepository(db.DB)
	multi_modal_triggerSvc := multi_modal_trigger_service.NewService(multi_modal_triggerRepo)
	multi_modal_triggerH := multi_modal_trigger_handler.NewHandler(multi_modal_triggerSvc)
	notification_mgmtRepo := notification_mgmt_repo.NewRepository(db.DB)
	notification_mgmtSvc := notification_mgmt_service.NewService(notification_mgmtRepo)
	notification_mgmtH := notification_mgmt_handler.NewHandler(notification_mgmtSvc)
	oci_registryRepo := oci_registry_repo.NewRepository(db.DB)
	oci_registrySvc := oci_registry_service.NewService(oci_registryRepo)
	oci_registryH := oci_registry_handler.NewHandler(oci_registrySvc)
	plugin_hotreloadRepo := plugin_hotreload_repo.NewRepository(db.DB)
	plugin_hotreloadSvc := plugin_hotreload_service.NewService(plugin_hotreloadRepo)
	plugin_hotreloadH := plugin_hotreload_handler.NewHandler(plugin_hotreloadSvc)
	process_stepRepo := process_step_repo.NewRepository(db.DB)
	process_stepSvc := process_step_service.NewService(process_stepRepo)
	process_stepH := process_step_handler.NewHandler(process_stepSvc)
	progessiveRepo := progessive_repo.NewRepository(db.DB)
	progessiveSvc := progessive_service.NewService(progessiveRepo)
	progessiveH := progessive_handler.NewHandler(progessiveSvc)
	queue_modRepo := queue_mod_repo.NewRepository(db.DB)
	queue_modSvc := queue_mod_service.NewService(queue_modRepo)
	queue_modH := queue_mod_handler.NewHandler(queue_modSvc)
	riskRepo := risk_repo.NewRepository(db.DB)
	riskSvc := risk_service.NewService(riskRepo)
	riskH := risk_handler.NewHandler(riskSvc)
	runbookRepo := runbook_repo.NewRepository(db.DB)
	runbookSvc := runbook_service.NewService(runbookRepo)
	runbookH := runbook_handler.NewHandler(runbookSvc)
	script_libraryRepo := script_library_repo.NewRepository(db.DB)
	script_librarySvc := script_library_service.NewService(script_libraryRepo)
	script_libraryH := script_library_handler.NewHandler(script_librarySvc)
	script_modRepo := script_mod_repo.NewRepository(db.DB)
	script_modSvc := script_mod_service.NewService(script_modRepo)
	script_modH := script_mod_handler.NewHandler(script_modSvc)
	script_versionRepo := script_version_repo.NewRepository(db.DB)
	script_versionSvc := script_version_service.NewService(script_versionRepo)
	script_versionH := script_version_handler.NewHandler(script_versionSvc)
	self_serviceRepo := self_service_repo.NewRepository(db.DB)
	self_serviceSvc := self_service_service.NewService(self_serviceRepo)
	self_serviceH := self_service_handler.NewHandler(self_serviceSvc)
	service_catalogRepo := service_catalog_repo.NewRepository(db.DB)
	service_catalogSvc := service_catalog_service.NewService(service_catalogRepo)
	service_catalogH := service_catalog_handler.NewHandler(service_catalogSvc)
	service_healthRepo := service_health_repo.NewRepository(db.DB)
	service_healthSvc := service_health_service.NewService(service_healthRepo)
	service_healthH := service_health_handler.NewHandler(service_healthSvc)
	service_topologyRepo := service_topology_repo.NewRepository(db.DB)
	service_topologySvc := service_topology_service.NewService(service_topologyRepo)
	service_topologyH := service_topology_handler.NewHandler(service_topologySvc)
	ticket_knowledgeRepo := ticket_knowledge_repo.NewRepository(db.DB)
	ticket_knowledgeSvc := ticket_knowledge_service.NewService(ticket_knowledgeRepo)
	ticket_knowledgeH := ticket_knowledge_handler.NewHandler(ticket_knowledgeSvc)
	topologyRepo := topology_repo.NewRepository(db.DB)
	topologySvc := topology_service.NewService(topologyRepo)
	topologyH := topology_handler.NewHandler(topologySvc)
	unified_configRepo := unified_config_repo.NewRepository(db.DB)
	unified_configSvc := unified_config_service.NewService(unified_configRepo)
	unified_configH := unified_config_handler.NewHandler(unified_configSvc)
	vector_storeRepo := vector_store_repo.NewRepository(db.DB)
	vector_storeSvc := vector_store_service.NewService(vector_storeRepo)
	vector_storeH := vector_store_handler.NewHandler(vector_storeSvc)
	vectorize_rulesRepo := vectorize_rules_repo.NewRepository(db.DB)
	vectorize_rulesSvc := vectorize_rules_service.NewService(vectorize_rulesRepo)
	vectorize_rulesH := vectorize_rules_handler.NewHandler(vectorize_rulesSvc)
	version_archiveRepo := version_archive_repo.NewRepository(db.DB)
	version_archiveSvc := version_archive_service.NewService(version_archiveRepo)
	version_archiveH := version_archive_handler.NewHandler(version_archiveSvc)

	apiConsumptionRepo := apiConsumption_repo.NewRepository(db.DB)
	apiConsumptionSvc := apiConsumption_service.NewService(apiConsumptionRepo)
	apiConsumptionH := apiConsumption_handler.NewHandler(apiConsumptionSvc)

	// alert-breaker services
	alert_breakerRepo := alert_breaker_repo.NewRepository(db.DB)
	alert_breakerSvc := alert_breaker_service.NewService(alert_breakerRepo)
	alert_breakerH := alert_breaker_handler.NewHandler(alert_breakerSvc)
	// apm services
	apmRepo := apm_repo.NewRepository(db.DB)
	apmSvc := apm_service.NewService(apmRepo)
	apmH := apm_handler.NewHandler(apmSvc)
	// bi-dashboard services
	bi_dashboardRepo := bi_dashboard_repo.NewRepository(db.DB)
	bi_dashboardSvc := bi_dashboard_service.NewService(bi_dashboardRepo)
	bi_dashboardH := bi_dashboard_handler.NewHandler(bi_dashboardSvc)
	// canary-analysis services
	canary_analysisRepo := canary_analysis_repo.NewRepository(db.DB)
	canary_analysisSvc := canary_analysis_service.NewService(canary_analysisRepo)
	canary_analysisH := canary_analysis_handler.NewHandler(canary_analysisSvc)

	// ---- Wave 7b-j: Webhook + automation services ----

	// webhook-approval services
	webhook_approvalRepo := webhook_approval_repo.NewRepository(db.DB)
	webhook_approvalSvc := webhook_approval_service.NewService(webhook_approvalRepo)
	webhook_approvalH := webhook_approval_handler.NewHandler(webhook_approvalSvc)

	// webhook-auth services
	webhook_authRepo := webhook_auth_repo.NewRepository(db.DB)
	webhook_authSvc := webhook_auth_service.NewService(webhook_authRepo)
	webhook_authH := webhook_auth_handler.NewHandler(webhook_authSvc)

	// webhook-database services
	webhook_databaseRepo := webhook_database_repo.NewRepository(db.DB)
	webhook_databaseSvc := webhook_database_service.NewService(webhook_databaseRepo)
	webhook_databaseH := webhook_database_handler.NewHandler(webhook_databaseSvc)

	// webhook-file services
	webhook_fileRepo := webhook_file_repo.NewRepository(db.DB)
	webhook_fileSvc := webhook_file_service.NewService(webhook_fileRepo)
	webhook_fileH := webhook_file_handler.NewHandler(webhook_fileSvc)

	// webhook-integration services
	webhook_integrationRepo := webhook_integration_repo.NewRepository(db.DB)
	webhook_integrationSvc := webhook_integration_service.NewService(webhook_integrationRepo)
	webhook_integrationH := webhook_integration_handler.NewHandler(webhook_integrationSvc)

	// webhook-logic services
	webhook_logicRepo := webhook_logic_repo.NewRepository(db.DB)
	webhook_logicSvc := webhook_logic_service.NewService(webhook_logicRepo)
	webhook_logicH := webhook_logic_handler.NewHandler(webhook_logicSvc)

	// webhook-notification services
	webhook_notificationRepo := webhook_notification_repo.NewRepository(db.DB)
	webhook_notificationSvc := webhook_notification_service.NewService(webhook_notificationRepo)
	webhook_notificationH := webhook_notification_handler.NewHandler(webhook_notificationSvc)

	// webhook-security services
	webhook_securityRepo := webhook_security_repo.NewRepository(db.DB)
	webhook_securitySvc := webhook_security_service.NewService(webhook_securityRepo)
	webhook_securityH := webhook_security_handler.NewHandler(webhook_securitySvc)

	// webhook-variable services
	webhook_variableRepo := webhook_variable_repo.NewRepository(db.DB)
	webhook_variableSvc := webhook_variable_service.NewService(webhook_variableRepo)
	webhook_variableH := webhook_variable_handler.NewHandler(webhook_variableSvc)

	// webhook-workflow services
	webhook_workflowRepo := webhook_workflow_repo.NewRepository(db.DB)
	webhook_workflowSvc := webhook_workflow_service.NewService(webhook_workflowRepo)
	webhook_workflowH := webhook_workflow_handler.NewHandler(webhook_workflowSvc)

	// webhook-trigger services
	webhook_triggerRepo := webhook_trigger_repo.NewRepository(db.DB)
	webhook_triggerSvc := webhook_trigger_service.NewService(webhook_triggerRepo)
	webhook_triggerH := webhook_trigger_handler.NewHandler(webhook_triggerSvc)

	// webhook-webapp services
	webhook_webappRepo := webhook_webapp_repo.NewRepository(db.DB)
	webhook_webappSvc := webhook_webapp_service.NewService(webhook_webappRepo)
	webhook_webappH := webhook_webapp_handler.NewHandler(webhook_webappSvc)

	// webhook-pipeline services
	webhook_pipelineRepo := webhook_pipeline_repo.NewRepository(db.DB)
	webhook_pipelineSvc := webhook_pipeline_service.NewService(webhook_pipelineRepo)
	webhook_pipelineH := webhook_pipeline_handler.NewHandler(webhook_pipelineSvc)

	// webhook-deployment services
	webhook_deploymentRepo := webhook_deployment_repo.NewRepository(db.DB)
	webhook_deploymentSvc := webhook_deployment_service.NewService(webhook_deploymentRepo)
	webhook_deploymentH := webhook_deployment_handler.NewHandler(webhook_deploymentSvc)

	// webhook-config services
	webhook_configRepo := webhook_config_repo.NewRepository(db.DB)
	webhook_configSvc := webhook_config_service.NewService(webhook_configRepo)
	webhook_configH := webhook_config_handler.NewHandler(webhook_configSvc)

	// webhook-secret services
	webhook_secretRepo := webhook_secret_repo.NewRepository(db.DB)
	webhook_secretSvc := webhook_secret_service.NewService(webhook_secretRepo)
	webhook_secretH := webhook_secret_handler.NewHandler(webhook_secretSvc)

	// webhook-monitor services
	webhook_monitorRepo := webhook_monitor_repo.NewRepository(db.DB)
	webhook_monitorSvc := webhook_monitor_service.NewService(webhook_monitorRepo)
	webhook_monitorH := webhook_monitor_handler.NewHandler(webhook_monitorSvc)

	// webhook-incident services
	webhook_incidentRepo := webhook_incident_repo.NewRepository(db.DB)
	webhook_incidentSvc := webhook_incident_service.NewService(webhook_incidentRepo)
	webhook_incidentH := webhook_incident_handler.NewHandler(webhook_incidentSvc)

	// webhook-ticket services
	webhook_ticketRepo := webhook_ticket_repo.NewRepository(db.DB)
	webhook_ticketSvc := webhook_ticket_service.NewService(webhook_ticketRepo)
	webhook_ticketH := webhook_ticket_handler.NewHandler(webhook_ticketSvc)

	// webhook-workorder services
	webhook_workorderRepo := webhook_workorder_repo.NewRepository(db.DB)
	webhook_workorderSvc := webhook_workorder_service.NewService(webhook_workorderRepo)
	webhook_workorderH := webhook_workorder_handler.NewHandler(webhook_workorderSvc)

	// webhook-notify services
	webhook_notifyRepo := webhook_notify_repo.NewRepository(db.DB)
	webhook_notifySvc := webhook_notify_service.NewService(webhook_notifyRepo)
	webhook_notifyH := webhook_notify_handler.NewHandler(webhook_notifySvc)

	// webhook-event services
	webhook_eventRepo := webhook_event_repo.NewRepository(db.DB)
	webhook_eventSvc := webhook_event_service.NewService(webhook_eventRepo)
	webhook_eventH := webhook_event_handler.NewHandler(webhook_eventSvc)

	// webhook-queue services
	webhook_queueRepo := webhook_queue_repo.NewRepository(db.DB)
	webhook_queueSvc := webhook_queue_service.NewService(webhook_queueRepo)
	webhook_queueH := webhook_queue_handler.NewHandler(webhook_queueSvc)

	// webhook-cache services
	webhook_cacheRepo := webhook_cache_repo.NewRepository(db.DB)
	webhook_cacheSvc := webhook_cache_service.NewService(webhook_cacheRepo)
	webhook_cacheH := webhook_cache_handler.NewHandler(webhook_cacheSvc)

	// webhook-db-sync services
	webhook_db_syncRepo := webhook_db_sync_repo.NewRepository(db.DB)
	webhook_db_syncSvc := webhook_db_sync_service.NewService(webhook_db_syncRepo)
	webhook_db_syncH := webhook_db_sync_handler.NewHandler(webhook_db_syncSvc)

	// webhook-transform services
	webhook_transformRepo := webhook_transform_repo.NewRepository(db.DB)
	webhook_transformSvc := webhook_transform_service.NewService(webhook_transformRepo)
	webhook_transformH := webhook_transform_handler.NewHandler(webhook_transformSvc)

	// webhook-validate services
	webhook_validateRepo := webhook_validate_repo.NewRepository(db.DB)
	webhook_validateSvc := webhook_validate_service.NewService(webhook_validateRepo)
	webhook_validateH := webhook_validate_handler.NewHandler(webhook_validateSvc)

	// webhook-log services
	webhook_logRepo := webhook_log_repo.NewRepository(db.DB)
	webhook_logSvc := webhook_log_service.NewService(webhook_logRepo)
	webhook_logH := webhook_log_handler.NewHandler(webhook_logSvc)

	// webhook-metric services
	webhook_metricRepo := webhook_metric_repo.NewRepository(db.DB)
	webhook_metricSvc := webhook_metric_service.NewService(webhook_metricRepo)
	webhook_metricH := webhook_metric_handler.NewHandler(webhook_metricSvc)

	// webhook-trace services
	webhook_traceRepo := webhook_trace_repo.NewRepository(db.DB)
	webhook_traceSvc := webhook_trace_service.NewService(webhook_traceRepo)
	webhook_traceH := webhook_trace_handler.NewHandler(webhook_traceSvc)

	// deployment-trigger services
	deployment_triggerRepo := deployment_trigger_repo.NewRepository(db.DB)
	deployment_triggerSvc := deployment_trigger_service.NewService(deployment_triggerRepo)
	deployment_triggerH := deployment_trigger_handler.NewHandler(deployment_triggerSvc)

	// incident-action services
	incident_actionRepo := incident_action_repo.NewRepository(db.DB)
	incident_actionSvc := incident_action_service.NewService(incident_actionRepo)
	incident_actionH := incident_action_handler.NewHandler(incident_actionSvc)

	// ticket-automation services
	ticket_automationRepo := ticket_automation_repo.NewRepository(db.DB)
	ticket_automationSvc := ticket_automation_service.NewService(ticket_automationRepo)
	ticket_automationH := ticket_automation_handler.NewHandler(ticket_automationSvc)

	contractRepo := contract_repo.NewRepository(db.DB)
	contractSvc := contract_service.NewService(contractRepo)
	contractH := contract_handler.NewHandler(contractSvc)

	// user services
	userRepo := user_repo.NewRepository(db.DB)
	userSvc := user_service.NewService(userRepo)
	userH := user_handler.NewHandler(userSvc)

	// permission services
	permRepo := perm_repo.NewRepository(db.DB)
	permSvc := perm_service.NewService(permRepo)
	permH := perm_handler.NewHandler(permSvc)

	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS(middleware.DefaultCORSConfig()))
	rg := r.Group("/api/v1")
	rg.Use(auth.Auth(auth.AuthConfig{JWTSecret: ffCfg.JWTSecret, RedisClient: rdb, SkipPaths: []string{"/healthz", "/metrics", "/health"}}))

	// Register routes
	ffH.RegisterRoutes(rg)
	roleH.RegisterRoutes(rg)
	// Wave 2: Auth + Permission
	aeH.RegisterRoutes(rg)
	amfaH.RegisterRoutes(rg)
	ssouH.RegisterRoutes(rg)
	ssopH.RegisterRoutes(rg)
	abacH.RegisterRoutes(rg)
	pauditH.RegisterRoutes(rg)
	sessionH.RegisterRoutes(rg)
	apikeyH.RegisterRoutes(rg)
	eventbusH.RegisterRoutes(rg)
	triggerH.RegisterRoutes(rg)
	hookH.RegisterRoutes(rg)
	userH.RegisterRoutes(rg)
	permH.RegisterRoutes(rg)
	fedH.RegisterRoutes(rg)
	pluginH.RegisterRoutes(rg)
	artifactH.RegisterRoutes(rg)
	incH.RegisterRoutes(rg)
	envH.RegisterRoutes(rg)
	policyH.RegisterRoutes(rg)
	projH.RegisterRoutes(rg)
	projectmemberH.RegisterRoutes(rg)
	productlineH.RegisterRoutes(rg)
	teamH.RegisterRoutes(rg)
	subappH.RegisterRoutes(rg)
	workbenchH.RegisterRoutes(rg)
	sprintH.RegisterRoutes(rg)
	internallibraryH.RegisterRoutes(rg)
	developerportalH.RegisterRoutes(rg)
	serviceregistryH.RegisterRoutes(rg)
	pageregistryH.RegisterRoutes(rg)
	capabilityH.RegisterRoutes(rg)
	chaosH.RegisterRoutes(rg)
	infraH.RegisterRoutes(rg)
	iacH.RegisterRoutes(rg)
	cronH.RegisterRoutes(rg)
	gatewaydynamicH.RegisterRoutes(rg)
	gdGrayH.RegisterRoutes(rg)
	handlerregistryH.RegisterRoutes(rg)
	i18nH.RegisterRoutes(rg)
	cmdbH.RegisterRoutes(rg)
	monitoringH.RegisterRoutes(rg)
	alertH.RegisterRoutes(rg)
	artifactopsH.RegisterRoutes(rg)
	chatopsH.RegisterRoutes(rg)
	approvalH.RegisterRoutes(rg)
	configH.RegisterRoutes(rg)
	auditH.RegisterRoutes(rg)
	incidentH.RegisterRoutes(rg)
	code_repoH.RegisterRoutes(rg)
	multicloudH.RegisterRoutes(rg)
	serverlessH.RegisterRoutes(rg)
	ticketingH.RegisterRoutes(rg)
	build_envH.RegisterRoutes(rg)
	buildH.RegisterRoutes(rg)
	dbaH.RegisterRoutes(rg)
	deployH.RegisterRoutes(rg)
	deploy_enhancedH.RegisterRoutes(rg)
	digital_twinH.RegisterRoutes(rg)
	finopsH.RegisterRoutes(rg)
	finops_v2H.RegisterRoutes(rg)
	knowledgeH.RegisterRoutes(rg)
	security_complianceH.RegisterRoutes(rg)
	tenantH.RegisterRoutes(rg)
	changeH.RegisterRoutes(rg)
	skillH.RegisterRoutes(rg)
	slaH.RegisterRoutes(rg)
	visorH.RegisterRoutes(rg)
	crH.RegisterRoutes(rg)
	agH.RegisterRoutes(rg)
	rdH.RegisterRoutes(rg)
	oncallH.RegisterRoutes(rg)
	diagnosticH.RegisterRoutes(rg)
	amH.RegisterRoutes(rg)
	citH.RegisterRoutes(rg)
	backupH.RegisterRoutes(rg)
	notificationH.RegisterRoutes(rg)
	notification_policyH.RegisterRoutes(rg)
	notification_templateH.RegisterRoutes(rg)
	scheduled_notificationH.RegisterRoutes(rg)
	webhookH.RegisterRoutes(rg)
	ddH.RegisterRoutes(rg)
	chanH.RegisterRoutes(rg)
	workflowH.RegisterRoutes(rg)
	workflow_triggerH.RegisterRoutes(rg)
	workflow_taskH.RegisterRoutes(rg)
	workflow_depH.RegisterRoutes(rg)
	workflow_webhookH.RegisterRoutes(rg)
	lowcodeH.RegisterRoutes(rg)
	tracingH.RegisterRoutes(rg)
	sloH.RegisterRoutes(rg)
	perfH.RegisterRoutes(rg)
	hcH.RegisterRoutes(rg)

	// ---- Wave 7a: P2 modules ----
	complianceH.RegisterRoutes(rg)
	supply_chainH.RegisterRoutes(rg)
	secretH.RegisterRoutes(rg)
	chaos_enhancedH.RegisterRoutes(rg)

	uebaH.RegisterRoutes(rg)
	problemH.RegisterRoutes(rg)
	billingH.RegisterRoutes(rg)
	costallocH.RegisterRoutes(rg)
	efficiencyH.RegisterRoutes(rg)
	dataLineageH.RegisterRoutes(rg)
	dataQualityH.RegisterRoutes(rg)
	apiConsumptionH.RegisterRoutes(rg)
	contractH.RegisterRoutes(rg)

	pbH.RegisterRoutes(rg)
	palH.RegisterRoutes(rg)
	ptmplH.RegisterRoutes(rg)
	pverH.RegisterRoutes(rg)
	phistH.RegisterRoutes(rg)
	pboH.RegisterRoutes(rg)
	psseH.RegisterRoutes(rg)
	pecH.RegisterRoutes(rg)
	pgraphH.RegisterRoutes(rg)
	ptrendH.RegisterRoutes(rg)
	ciH.RegisterRoutes(rg)

	alert_breakerH.RegisterRoutes(rg)
	apmH.RegisterRoutes(rg)
	bi_dashboardH.RegisterRoutes(rg)
	canary_analysisH.RegisterRoutes(rg)

	// ---- Wave 7b-j: Webhook + automation routes ----
	webhook_approvalH.RegisterRoutes(rg)
	webhook_authH.RegisterRoutes(rg)
	webhook_databaseH.RegisterRoutes(rg)
	webhook_fileH.RegisterRoutes(rg)
	webhook_integrationH.RegisterRoutes(rg)
	webhook_logicH.RegisterRoutes(rg)
	webhook_notificationH.RegisterRoutes(rg)
	webhook_securityH.RegisterRoutes(rg)
	webhook_variableH.RegisterRoutes(rg)
	webhook_workflowH.RegisterRoutes(rg)
	webhook_triggerH.RegisterRoutes(rg)
	webhook_webappH.RegisterRoutes(rg)
	webhook_pipelineH.RegisterRoutes(rg)
	webhook_deploymentH.RegisterRoutes(rg)
	webhook_configH.RegisterRoutes(rg)
	webhook_secretH.RegisterRoutes(rg)
	webhook_monitorH.RegisterRoutes(rg)
	webhook_incidentH.RegisterRoutes(rg)
	webhook_ticketH.RegisterRoutes(rg)
	webhook_workorderH.RegisterRoutes(rg)
	webhook_notifyH.RegisterRoutes(rg)
	webhook_eventH.RegisterRoutes(rg)
	webhook_queueH.RegisterRoutes(rg)
	webhook_cacheH.RegisterRoutes(rg)
	webhook_db_syncH.RegisterRoutes(rg)
	webhook_transformH.RegisterRoutes(rg)
	webhook_validateH.RegisterRoutes(rg)
	webhook_logH.RegisterRoutes(rg)
	webhook_metricH.RegisterRoutes(rg)
	webhook_traceH.RegisterRoutes(rg)
	deployment_triggerH.RegisterRoutes(rg)
	incident_actionH.RegisterRoutes(rg)
	ticket_automationH.RegisterRoutes(rg)

	// ---- Wave 7: P2 module routes (batch 1-2) ----
	canary_trafficH.RegisterRoutes(rg)
	cross_domainH.RegisterRoutes(rg)
	decision_explanationH.RegisterRoutes(rg)
	degradationH.RegisterRoutes(rg)
	dependency_coordinationH.RegisterRoutes(rg)
	dual_engineH.RegisterRoutes(rg)
	env_lifecycleH.RegisterRoutes(rg)
	env_profileH.RegisterRoutes(rg)
	global_paramH.RegisterRoutes(rg)
	integrationH.RegisterRoutes(rg)
	maintenance_windowH.RegisterRoutes(rg)
	message_queueH.RegisterRoutes(rg)
	metricsH.RegisterRoutes(rg)
	multi_modal_triggerH.RegisterRoutes(rg)
	notification_mgmtH.RegisterRoutes(rg)
	oci_registryH.RegisterRoutes(rg)
	plugin_hotreloadH.RegisterRoutes(rg)
	process_stepH.RegisterRoutes(rg)
	progessiveH.RegisterRoutes(rg)
	queue_modH.RegisterRoutes(rg)
	riskH.RegisterRoutes(rg)
	runbookH.RegisterRoutes(rg)
	script_libraryH.RegisterRoutes(rg)
	script_modH.RegisterRoutes(rg)
	script_versionH.RegisterRoutes(rg)
	self_serviceH.RegisterRoutes(rg)
	service_catalogH.RegisterRoutes(rg)
	service_healthH.RegisterRoutes(rg)
	service_topologyH.RegisterRoutes(rg)
	ticket_knowledgeH.RegisterRoutes(rg)
	topologyH.RegisterRoutes(rg)
	unified_configH.RegisterRoutes(rg)
	vector_storeH.RegisterRoutes(rg)
	vectorize_rulesH.RegisterRoutes(rg)
	version_archiveH.RegisterRoutes(rg)

	// Pipeline Engine (Phase 3.1)
	peRepo := pe_repo.NewRepository(db.DB)
	peEngine := pe_service.NewPipelineEngine(peRepo)
	peH := pe_handler.NewHandler(peEngine)
	peH.RegisterRoutes(rg)

	// Phase 4: Gateway business logic migration
	ai_decisionsSvc := ai_decisions_service.NewService(ai_decisions_repo.NewRepository(db.DB))
	ai_decisionsH := ai_decisions_handler.NewHandler(ai_decisionsSvc)
	ai_decisionsH.RegisterRoutes(rg)

	ai_degradationSvc := ai_degradation_service.NewDegradationService(ai_degradation_repo.NewRepository(db.DB))
	ai_degradationH := ai_degradation_handler.NewHandler(ai_degradationSvc)
	ai_degradationH.RegisterRoutes(rg)

	ai_modelsSvc := ai_models_service.NewService(ai_models_repo.NewRepository(db.DB), logger)
	ai_modelsH := ai_models_handler.NewHandler(ai_modelsSvc)
	ai_modelsH.RegisterRoutes(rg)

	chaos_gwSvc := chaos_gw_service.NewService(chaos_gw_repo.NewRepository(db.DB))
	chaos_gwH := chaos_gw_handler.NewHandler(chaos_gwSvc)
	chaos_gwH.RegisterRoutes(rg)

	dt_simSvc := dt_sim_service.NewService(dt_sim_repo.NewRepository(db.DB))
	dt_simH := dt_sim_handler.NewHandler(dt_simSvc)
	dt_simH.RegisterRoutes(rg)

	govSvc := gov_service.NewService(gov_repo.NewRepository(db.DB))
	govH := gov_handler.NewHandler(govSvc)
	govH.RegisterRoutes(rg)

	// pipeline-budget already registered above (line 1714)

	pvSvc := pv_service.NewService(pv_repo.NewRepository(db.DB))
	pvH := pv_handler.NewHandler(pvSvc)
	pvH.RegisterRoutes(rg)

	rsRepo := rs_repo.NewRepository(db.DB)
	rsSvc := rs_service.NewService(rsRepo, db.DB)
	rsH := rs_handler.NewHandler(rsSvc)
	rsH.RegisterRoutes(rg)

	sbomSvc := sbom_service.NewService(sbom_repo.NewRepository(db.DB))
	sbomH := sbom_handler.NewHandler(sbomSvc)
	sbomH.RegisterRoutes(rg)

	tenant_gwSvc := tenant_gw_service.NewService(tenant_gw_repo.NewRepository(db.DB))
	tenant_gwH := tenant_gw_handler.NewHandler(tenant_gwSvc)
	tenant_gwH.RegisterRoutes(rg)

	// === Global error handlers (standard error envelope) ===
	respondJSON := func(c *gin.Context, status int, code string, msg string) {
		c.JSON(status, gin.H{
			"error": gin.H{
				"code":    status,
				"type":    code,
				"message": msg,
			},
		})
	}

	r.NoRoute(func(c *gin.Context) {
		respondJSON(c, http.StatusNotFound, "NotFound", "api endpoint not found")
	})
	r.NoMethod(func(c *gin.Context) {
		respondJSON(c, http.StatusMethodNotAllowed, "MethodNotAllowed", "method not allowed")
	})

	// === Public endpoints (no auth) ===
	r.GET("/healthz", middleware.HealthCheck("orion-platform-svc"))
	r.GET("/metrics", middleware.MetricsHandler())

	// Dependency health check (0.4)
	r.GET("/health", middleware.DepHealthCheck("orion-platform-svc", map[string]middleware.HealthCheckFn{
		"database": db.Health,
		"redis":    func(ctx context.Context) error { return redis.Health(ctx, rdb) },
	}))

	addr := fmt.Sprintf(":%d", ffCfg.Port)
	logger.Info("platform-svc listening", zap.String("addr", addr))

	srv := &http.Server{Addr: addr, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server error", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down platform-svc...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Fatal("server forced to shutdown", zap.Error(err))
	}
}
