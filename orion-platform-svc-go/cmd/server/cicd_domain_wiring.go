package main

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
	"orion/go-common/pkg/database"

	assistant_models "orion/platform-svc-go/internal/assistant/models"
	assistant_handler "orion/platform-svc-go/internal/assistant/handler"
	assistant_service "orion/platform-svc-go/internal/assistant/service"
	agent_run_repo "orion/platform-svc-go/internal/ai-agent-run/repository"
	agent_run_service "orion/platform-svc-go/internal/ai-agent-run/service"
	agent_run_models "orion/platform-svc-go/internal/ai-agent-run/models"
	runbook_repo "orion/platform-svc-go/internal/runbook/repository"
	runbook_service "orion/platform-svc-go/internal/runbook/service"
	runbook_models "orion/platform-svc-go/internal/runbook/models"
	knowledge_models "orion/platform-svc-go/internal/knowledge/models"
	pipeline_models "orion/platform-svc-go/internal/pipeline/models"
	chatops_handler "orion/platform-svc-go/internal/chatops/handler"
	chatops_repo "orion/platform-svc-go/internal/chatops/repository"
	chatops_service "orion/platform-svc-go/internal/chatops/service"
	code_repo_handler "orion/platform-svc-go/internal/code-repo/handler"
	code_repo_repo "orion/platform-svc-go/internal/code-repo/repository"
	code_repo_service "orion/platform-svc-go/internal/code-repo/service"
	approval_handler "orion/platform-svc-go/internal/approval/handler"
	approval_repo "orion/platform-svc-go/internal/approval/repository"
	approval_service "orion/platform-svc-go/internal/approval/service"
	audit_handler "orion/platform-svc-go/internal/audit/handler"
	audit_repo "orion/platform-svc-go/internal/audit/repository"
	audit_service "orion/platform-svc-go/internal/audit/service"
	incident_handler "orion/platform-svc-go/internal/incident/handler"
	incident_repo "orion/platform-svc-go/internal/incident/repository"
	incident_service "orion/platform-svc-go/internal/incident/service"
	build_env_handler "orion/platform-svc-go/internal/build-env/handler"
	build_env_repo "orion/platform-svc-go/internal/build-env/repository"
	build_env_service "orion/platform-svc-go/internal/build-env/service"
	build_handler "orion/platform-svc-go/internal/build/handler"
	build_repo "orion/platform-svc-go/internal/build/repository"
	build_service "orion/platform-svc-go/internal/build/service"
	pipeline_handler "orion/platform-svc-go/internal/pipeline/handler"
	pipeline_repo "orion/platform-svc-go/internal/pipeline/repository"
	pipeline_service "orion/platform-svc-go/internal/pipeline/service"
	dba_handler "orion/platform-svc-go/internal/dba/handler"
	dba_repo "orion/platform-svc-go/internal/dba/repository"
	dba_service "orion/platform-svc-go/internal/dba/service"

	// runner services (CI task execution on worker agents)
	runner_handler "orion/platform-svc-go/internal/runner/handler"
	runner_repo "orion/platform-svc-go/internal/runner/repository"
	runner_service "orion/platform-svc-go/internal/runner/service"

	deploy_handler "orion/platform-svc-go/internal/deploy/handler"
	deploy_repo "orion/platform-svc-go/internal/deploy/repository"
	deploy_service "orion/platform-svc-go/internal/deploy/service"
	deploy_enhanced_handler "orion/platform-svc-go/internal/deploy-enhanced/handler"
	deploy_enhanced_repo "orion/platform-svc-go/internal/deploy-enhanced/repository"
	deploy_enhanced_service "orion/platform-svc-go/internal/deploy-enhanced/service"
	digital_twin_handler "orion/platform-svc-go/internal/digital-twin/handler"
	digital_twin_repo "orion/platform-svc-go/internal/digital-twin/repository"
	digital_twin_service "orion/platform-svc-go/internal/digital-twin/service"
	// Worker Dispatcher (N-12): IWorkerDispatcher + IWorkerPolicyHandler patterns
	worker_handler "orion/platform-svc-go/internal/worker-dispatcher/handler"

	// Domain modules
	finops_handler "orion/platform-svc-go/internal/finops/handler"
	finops_repo "orion/platform-svc-go/internal/finops/repository"
	finops_service "orion/platform-svc-go/internal/finops/service"
	finops_v2_handler "orion/platform-svc-go/internal/finops-v2/handler"
	finops_v2_repo "orion/platform-svc-go/internal/finops-v2/repository"
	finops_v2_service "orion/platform-svc-go/internal/finops-v2/service"
	knowledge_handler "orion/platform-svc-go/internal/knowledge/handler"
	knowledge_repo "orion/platform-svc-go/internal/knowledge/repository"
	knowledge_service "orion/platform-svc-go/internal/knowledge/service"
	security_compliance_handler "orion/platform-svc-go/internal/security-compliance/handler"
	security_compliance_repo "orion/platform-svc-go/internal/security-compliance/repository"
	security_compliance_service "orion/platform-svc-go/internal/security-compliance/service"
	tenant_handler "orion/platform-svc-go/internal/tenant/handler"
	tenant_repo "orion/platform-svc-go/internal/tenant/repository"
	tenant_service "orion/platform-svc-go/internal/tenant/service"
	ticketing_models "orion/platform-svc-go/internal/ticketing/models"
	ticketing_handler "orion/platform-svc-go/internal/ticketing/handler"
	ticketing_repo "orion/platform-svc-go/internal/ticketing/repository"
	ticketing_service "orion/platform-svc-go/internal/ticketing/service"
	change_handler "orion/platform-svc-go/internal/change/handler"
	change_repo "orion/platform-svc-go/internal/change/repository"
	change_service "orion/platform-svc-go/internal/change/service"
	sla_handler "orion/platform-svc-go/internal/sla/handler"
	sla_repo "orion/platform-svc-go/internal/sla/repository"
	sla_service "orion/platform-svc-go/internal/sla/service"
	cr_handler "orion/platform-svc-go/internal/change-request/handler"
	cr_repo "orion/platform-svc-go/internal/change-request/repository"
	cr_service "orion/platform-svc-go/internal/change-request/service"
	rd_handler "orion/platform-svc-go/internal/report-designer/handler"
	rd_repo "orion/platform-svc-go/internal/report-designer/repository"
	rd_service "orion/platform-svc-go/internal/report-designer/service"
	oncall_handler "orion/platform-svc-go/internal/oncall/handler"
	oncall_repo "orion/platform-svc-go/internal/oncall/repository"
	oncall_service "orion/platform-svc-go/internal/oncall/service"
	diagnostic_handler "orion/platform-svc-go/internal/diagnostic/handler"
	diagnostic_repo "orion/platform-svc-go/internal/diagnostic/repository"
	diagnostic_service "orion/platform-svc-go/internal/diagnostic/service"
	am_handler "orion/platform-svc-go/internal/api-market/handler"
	am_repo "orion/platform-svc-go/internal/api-market/repository"
	am_service "orion/platform-svc-go/internal/api-market/service"
	cit_handler "orion/platform-svc-go/internal/ci-type/handler"
	cit_repo "orion/platform-svc-go/internal/ci-type/repository"
	cit_service "orion/platform-svc-go/internal/ci-type/service"
	backup_handler "orion/platform-svc-go/internal/backup/handler"
	backup_repo "orion/platform-svc-go/internal/backup/repository"
	backup_service "orion/platform-svc-go/internal/backup/service"
	lowcode_handler "orion/platform-svc-go/internal/lowcode/handler"
	lowcode_models "orion/platform-svc-go/internal/lowcode/models"
	lowcode_repo "orion/platform-svc-go/internal/lowcode/repository"
	lowcode_service "orion/platform-svc-go/internal/lowcode/service"
)

// pipelineSvc is set in wireCICDModules and consumed by wirePipelineAssistantModules
// to pass the pipeline service dependency to pipeline-batch-operations.
var pipelineSvc *pipeline_service.Service

// lowcodeSvc is set in wireDomainModules and consumed by the assistant LowcodeGeneratorExecutor (TR-10).
var lowcodeSvc *lowcode_service.Service

// runnerH is set in wireCICDModules for runner service.
var runnerH *runner_handler.Handler

// workerH is set in wireCICDModules for worker-dispatcher (N-12).
var workerH *worker_handler.Handler

// incidentSvc is set in wireCICDModules and consumed by the NATS subscriber
// wiring in wiring.go to drive event-driven incident handling.
var incidentSvc *incident_service.Service

// wireCICDModules wires the CI/CD and deployment modules: chatops, code-repo,
// approval, audit, incident, build-env, build, pipeline, dba, runner, deploy,
// deploy-enhanced, digital-twin.
func wireCICDModules(db *database.DB) {
	chatopsRepo := chatops_repo.NewRepository(db.DB)
	chatopsSvc := chatops_service.NewService(chatopsRepo)
	chatopsH = chatops_handler.NewHandler(chatopsSvc)

	// code-repo services
	code_repoRepo := code_repo_repo.NewRepository(db.DB)
	code_repoSvc := code_repo_service.NewService(code_repoRepo, db.DB)
	code_repoH = code_repo_handler.NewHandler(code_repoSvc)

	// approval services
	approvalRepo := approval_repo.NewRepository(db.DB)
	approvalSvc := approval_service.NewService(approvalRepo)
	approvalH = approval_handler.NewHandler(approvalSvc)

	// audit services
	auditRepo := audit_repo.NewRepository(db.DB)
	auditSvc := audit_service.NewService(auditRepo)
	auditH = audit_handler.NewHandler(auditSvc)

	// incident services
	incidentRepo := incident_repo.NewRepository(db.DB)
	incidentSvc = incident_service.NewService(incidentRepo)
	incidentH = incident_handler.NewHandler(incidentSvc)

	// build-env services
	build_envRepo := build_env_repo.NewRepository(db.DB)
	build_envSvc := build_env_service.NewService(build_envRepo, db.DB.DB)
	build_envH = build_env_handler.NewHandler(build_envSvc)

	// Build service
	buildRepo := build_repo.NewRepository(db.DB)
	buildSvc := build_service.NewService(buildRepo)
	buildH = build_handler.NewHandler(buildSvc)

	// Pipeline service
	pipelineRepo := pipeline_repo.NewRepository(db.DB)
	pipelineServiceInstance := pipeline_service.NewService(pipelineRepo)
	// Store for cross-module injection (pipeline-batch-operations).
	pipelineSvc = pipelineServiceInstance
	pipelineH = pipeline_handler.NewHandler(pipelineServiceInstance)

	// dba services
	dbaRepo := dba_repo.NewRepository(db.DB)
	dbaSvc := dba_service.NewService(dbaRepo)
	dbaH = dba_handler.NewHandler(dbaSvc)

	// Runner services (CI task execution on worker agents)
	runnerRepo := runner_repo.NewRepository(db.DB)
	runnerSvc := runner_service.NewService(runnerRepo)
	runnerH = runner_handler.NewHandler(runnerSvc)

	// deploy services
	deployRepo := deploy_repo.NewRepository(db.DB)
	deploySvc := deploy_service.NewService(deployRepo)
	deployH = deploy_handler.NewHandler(deploySvc)

	// deploy-enhanced services
	deploy_enhancedRepo := deploy_enhanced_repo.NewRepository(db.DB)
	deploy_enhancedSvc := deploy_enhanced_service.NewService(deploy_enhancedRepo)
	deploy_enhancedH = deploy_enhanced_handler.NewHandler(deploy_enhancedSvc)

	// digital-twin services
	digital_twinRepo := digital_twin_repo.NewRepository(db.DB)
	digital_twinSvc := digital_twin_service.NewService(digital_twinRepo)
	digital_twinH = digital_twin_handler.NewHandler(digital_twinSvc)
}

// wireDomainModules wires domain-specific modules: finops, finops-v2,
// knowledge, security-compliance, tenant, ticketing, change, skill, sla,
// visor, change-request, report-designer, oncall, diagnostic, api-market,
// ci-type, backup, lowcode, session.
func wireDomainModules(db *database.DB) {
	// finops services
	finopsRepo := finops_repo.NewRepository(db.DB)
	finopsSvc := finops_service.NewService(finopsRepo)
	finopsH = finops_handler.NewHandler(finopsSvc)

	// finops-v2 services
	finops_v2Repo := finops_v2_repo.NewRepository(db.DB)
	finops_v2Svc := finops_v2_service.NewService(finops_v2Repo)
	finops_v2H = finops_v2_handler.NewHandler(finops_v2Svc)

	// knowledge services
	knowledgeRepo := knowledge_repo.NewRepository(db.DB.DB)
	knowledgeSvc := knowledge_service.NewService(knowledgeRepo)
	knowledgeH = knowledge_handler.NewHandler(knowledgeSvc)

	// assistant services (global AI copilot — plugs into knowledge RAG + pipeline)
	assistantProviders := []assistant_service.SourceProvider{
		assistant_service.NewKnowledgeProvider(func(ctx context.Context, tenantID, query, spaceID string, topK int) ([]assistant_service.RetrievedDoc, error) {
			results, err := knowledgeSvc.Retrieve(ctx, tenantID, query, knowledge_models.RetrieveRequest{SpaceID: spaceID, TopK: &topK})
			if err != nil {
				return nil, err
			}
			docs := make([]assistant_service.RetrievedDoc, 0, len(results))
			for _, r := range results {
				docs = append(docs, assistant_service.RetrievedDoc{
					Title: r.Title, Content: r.Content, SpaceID: r.SpaceID, Similarity: r.Similarity,
				})
			}
			return docs, nil
		}),
		assistant_service.NewPipelineProvider(func(ctx context.Context, tenantID, query string, limit int) ([]assistant_service.PipelineRef, error) {
			if pipelineSvc == nil {
				return nil, nil
			}
			pls, _, err := pipelineSvc.ListPipelines(ctx, tenantID, pipeline_models.ListPipelinesOptions{Name: query, Limit: limit})
			if err != nil {
				return nil, err
			}
			refs := make([]assistant_service.PipelineRef, 0, len(pls))
			for _, p := range pls {
				refs = append(refs, assistant_service.PipelineRef{ID: p.ID, Title: p.Name})
			}
			return refs, nil
		}),
	}
	assistantSvc := assistant_service.NewService(assistantProviders)
	assistantH = assistant_handler.NewHandler(assistantSvc)

	// security-compliance services
	security_complianceRepo := security_compliance_repo.NewRepository(db.DB)
	security_complianceSvc := security_compliance_service.NewService(security_complianceRepo)
	security_complianceH = security_compliance_handler.NewHandler(security_complianceSvc)

	// tenant services
	tenantRepo := tenant_repo.NewRepository(db.DB)
	tenantSvc := tenant_service.NewService(tenantRepo)
	tenantH = tenant_handler.NewHandler(tenantSvc)

	// ticketing services
	ticketingRepo := ticketing_repo.NewRepository(db.DB)
	ticketingSvc := ticketing_service.NewService(ticketingRepo)
	ticketingH = ticketing_handler.NewHandler(ticketingSvc)

	// Wire assistant action executors (TR-09 tool-calling): natural language → workflow
	if assistantSvc != nil {
		assistantSvc.AddExecutor(assistant_service.NewFuncActionExecutor(
			assistant_models.ActionCreateTicket,
			func(ctx context.Context, tenantID string, req *assistant_models.ActionRequest) (*assistant_models.ActionResult, error) {
				t, err := ticketingSvc.CreateTicket(ctx, tenantID, ticketing_models.CreateTicketRequest{
					Title:       req.Title,
					Description: req.Description,
					Priority:    req.Priority,
				}, "assistant")
				if err != nil {
					return nil, err
				}
				return &assistant_models.ActionResult{
					Kind:       assistant_models.ActionCreateTicket,
					Status:     "executed",
					Summary:    "已创建工单：" + t.Title,
					EntityID:   t.ID,
					EntityName: t.Title,
					Steps:      []string{"创建工单并进入 open 状态", "可继续补充审批与处理人"},
					ExecutedAt: time.Now().UTC(),
				}, nil
			},
		))
		if pipelineSvc != nil {
			// Existing: pipeline creation (kept as-is)
		}
		// TR-09: 研发流程 Agent — Assistant → ai-agent-run → AgentRun
		aiAgentRunRepo := agent_run_repo.NewRepository(db.DB)
		aiAgentRunSvc := agent_run_service.NewService(aiAgentRunRepo)
		assistantSvc.AddExecutor(assistant_service.NewFuncActionExecutor(
			assistant_models.ActionTriggerPipeline,
			func(ctx context.Context, tenantID string, req *assistant_models.ActionRequest) (*assistant_models.ActionResult, error) {
				agentProfileID := "dev-agent"
				if p := req.Metadata; p != nil {
					if v, ok := p["agentProfileId"].(string); ok && v != "" {
						agentProfileID = v
					}
				}
				totalSteps := 3
				if p := req.Metadata; p != nil {
					if v, ok := p["totalSteps"].(int); ok && v > 0 {
						totalSteps = v
					}
				}
				run, err := aiAgentRunSvc.TriggerRun(ctx, tenantID, &agent_run_models.TriggerRunRequest{
					AgentProfileID: agentProfileID,
					TriggerPayload: map[string]interface{}{
						"task":  req.Prompt,
						"title": req.Title,
						"desc":  req.Description,
					},
					TotalSteps: &totalSteps,
				})
				if err != nil {
					return nil, err
				}
				return &assistant_models.ActionResult{
					Kind:       assistant_models.ActionTriggerPipeline,
					Status:     "executed",
					Summary:    "已触发研发流程 Agent Run",
					EntityID:   run.ID,
					EntityName: agentProfileID,
					Steps: []string{
						"识别意图：触发研发流程 Agent",
						"Agent Profile: " + agentProfileID,
						"创建 AgentRun: " + run.ID,
					},
					ExecutedAt: time.Now().UTC(),
				}, nil
			},
		))
		// TR-11: Ops 问答助手 — Assistant → Runbook → executable commands
		runbookRepo := runbook_repo.NewRepository(db.DB)
		runbookSvc := runbook_service.NewService(runbookRepo)
		assistantSvc.AddExecutor(assistant_service.NewFuncActionExecutor(
			assistant_models.ActionSuggestCommand,
			func(ctx context.Context, tenantID string, req *assistant_models.ActionRequest) (*assistant_models.ActionResult, error) {
				rbs, _, err := runbookSvc.List(ctx, tenantID, runbook_models.ListQuery{
					Limit: func() *int { i := 5; return &i }(),
				})
				var commands []string
				steps := []string{"Runbook 检索完成"}
				for _, rb := range rbs {
					steps = append(steps, "["+rb.ID+"] "+rb.Title+" (category="+rb.Category+")")
					for _, step := range rb.Steps {
						if step.Command != "" {
							commands = append(commands, step.Command)
						}
					}
				}
				if len(rbs) == 0 {
					steps = append(steps, "未找到匹配的 Runbook")
				}
				result := &assistant_models.ActionResult{
					Kind:       assistant_models.ActionSuggestCommand,
					Status:     "executed",
					Summary:    "找到 " + fmt.Sprintf("%d", len(rbs)) + " 个相关 Runbook",
					Steps:      steps,
					ExecutedAt: time.Now().UTC(),
				}
				if len(commands) > 0 {
					cJSON, _ := json.Marshal(commands)
					result.Metadata = map[string]interface{}{
						"suggestedCommands": string(cJSON),
						"runbookCount":      len(rbs),
					}
				}
				return result, err
			},
		))
		// TR-10: LowCode AI 生成流程 — Assistant → lowcode → GenerateFlowFromPrompt
		if lowcodeSvc != nil {
			assistantSvc.AddExecutor(assistant_service.NewFuncActionExecutor(
				assistant_models.ActionGenerateFlow,
				func(ctx context.Context, tenantID string, req *assistant_models.ActionRequest) (*assistant_models.ActionResult, error) {
					workflowName := req.Title
					if p := req.Metadata; p != nil {
						if v, ok := p["workflowName"].(string); ok && v != "" {
							workflowName = v
						}
					}
					resp, err := lowcodeSvc.GenerateFlowFromPrompt(ctx, tenantID, &lowcode_models.FlowGenerateRequest{
						Prompt:       req.Prompt,
						WorkflowName: workflowName,
						Description:  req.Description,
					})
					if err != nil {
						return &assistant_models.ActionResult{
							Kind:       assistant_models.ActionGenerateFlow,
							Status:     "executed",
							Summary:    "流程生成失败：" + err.Error(),
							Steps:      []string{"识别意图：AI 生成流程"},
							Error:      err.Error(),
							ExecutedAt: time.Now().UTC(),
						}, nil
					}
					return &assistant_models.ActionResult{
						Kind:       assistant_models.ActionGenerateFlow,
						Status:     "executed",
						Summary:    "已生成流程：" + resp.Name + " (意图=" + resp.Intent + ")",
						EntityName: resp.Name,
						Steps: []string{
							"识别意图：AI 生成流程",
							"流程名称: " + resp.Name,
							"意图分类: " + resp.Intent,
							"已构建节点/连线定义",
						},
						Metadata: map[string]interface{}{
							"intent": resp.Intent,
							"nodes":  resp.Nodes,
							"edges":  resp.Edges,
						},
						ExecutedAt: time.Now().UTC(),
					}, nil
				},
			))
		}
	}

	// change services
	changeRepo := change_repo.NewRepository(db.DB)
	changeSvc := change_service.NewService(changeRepo)
	changeH = change_handler.NewHandler(changeSvc)


	// sla services
	slaRepo := sla_repo.NewRepository(db.DB)
	slaSvc := sla_service.NewService(slaRepo)
	slaH = sla_handler.NewHandler(slaSvc)

	// visor-exec services
	// visorRepo := visor_repo.NewRepository(db.DB)// FIXME: interface mismatch
	// visorSvc := visor_service.NewService(visorRepo)// FIXME
	// visorH = visor_handler.NewHandler(visorSvc)// FIXME

	// change-request services
	crRepo := cr_repo.NewRepository(db.DB)
	crSvc := cr_service.NewService(crRepo)
	crH = cr_handler.NewHandler(crSvc)

	// report-designer services
	rdRepo := rd_repo.NewRepository(db.DB)
	rdSvc := rd_service.NewService(rdRepo)
	rdH = rd_handler.NewHandler(rdSvc)

	// oncall services
	oncallRepo := oncall_repo.NewOnCallRepository(db.DB, nil)
	oncallSvc := oncall_service.NewOnCallService(oncallRepo, nil)
	oncallH = oncall_handler.NewOnCallHandler(oncallSvc)

	// diagnostic services
	diagnosticRepo := diagnostic_repo.NewRepository(db.DB)
	diagnosticSvc := diagnostic_service.NewService(diagnosticRepo)
	diagnosticH = diagnostic_handler.NewHandler(diagnosticSvc)

	// api-market services
	amRepo := am_repo.NewRepository(db.DB)
	amSvc := am_service.NewService(amRepo)
	amH = am_handler.NewHandler(amSvc)

	// ci-type services
	citRepo := cit_repo.NewRepository(db.DB)
	citSvc := cit_service.NewService(citRepo)
	citH = cit_handler.NewHandler(citSvc)

	// backup services
	backupRepo := backup_repo.NewRepository(db.DB)
	backupSvc := backup_service.NewService(backupRepo)
	backupH = backup_handler.NewHandler(backupSvc)

	// lowcode services
	lowcodeRepo := lowcode_repo.NewRepository(db.DB)
	lowcodeSvc = lowcode_service.NewService(lowcodeRepo)
	lowcodeH = lowcode_handler.NewHandler(lowcodeSvc)
}

// Handler variables for cicd_domain_wiring (moved from central wiring.go var block)
var (
	amH                 *am_handler.Handler
	approvalH           *approval_handler.Handler
	auditH              *audit_handler.Handler
	backupH             *backup_handler.Handler
	build_envH          *build_env_handler.Handler
	buildH              *build_handler.Handler
	changeH             *change_handler.Handler
	chatopsH            *chatops_handler.Handler
	citH                *cit_handler.Handler
	code_repoH          *code_repo_handler.Handler
	crH                 *cr_handler.Handler
	dbaH                *dba_handler.Handler
	deploy_enhancedH    *deploy_enhanced_handler.Handler
	deployH             *deploy_handler.Handler
	diagnosticH         *diagnostic_handler.Handler
	digital_twinH       *digital_twin_handler.Handler
	finops_v2H          *finops_v2_handler.Handler
	finopsH             *finops_handler.Handler
	incidentH           *incident_handler.Handler
	assistantH          *assistant_handler.Handler
	knowledgeH          *knowledge_handler.Handler
	lowcodeH            *lowcode_handler.Handler
	oncallH             *oncall_handler.OnCallHandler
	pipelineH           *pipeline_handler.Handler
	rdH                 *rd_handler.Handler
	security_complianceH *security_compliance_handler.Handler
	slaH                *sla_handler.Handler
	tenantH             *tenant_handler.Handler
	ticketingH          *ticketing_handler.Handler
//	visorH              *visor_handler.Handler // FIXME: visor_handler import missing
)
