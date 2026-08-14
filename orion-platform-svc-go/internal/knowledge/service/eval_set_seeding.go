package service

import (
	"context"

	"orion/platform-svc-go/internal/knowledge/models"
)

// SeedEvalSetForScenario creates (or returns existing) an eval set for a
// specific TR requirement, with ground-truth cases that validate the
// P2 business linkage works end-to-end.
//
// This is the P3 delivery of TR-05 (评测集基线覆盖 TR-09/10/11):
//   - TR-09 研发流程 Agent → eval cases for pipeline-trigger prompts
//   - TR-10 LowCode AI 生成 → eval cases for flow-generation prompts
//   - TR-11 Ops 问答助手 → eval cases for ops-command prompts
type ScenarioSeed struct {
	Scenario string   // e.g. "TR-09", "TR-10", "TR-11"
	Tag      string   // e.g. "dev-agent", "lowcode-ai", "ops-qa"
	Cases    []models.EvalSetCaseInput
}

var defaultScenarioSeeds = []ScenarioSeed{
	{
		Scenario: "TR-09",
		Tag:      "dev-agent",
		Cases: []models.EvalSetCaseInput{
			{Query: "帮我触发研发流程 Agent 实现登录接口", GoldAnswer: "trigger_pipeline", GoldSources: []string{"assistant", "ai-agent-run"}},
			{Query: "创建 agent run 执行代码评审任务", GoldAnswer: "agent run", GoldSources: []string{"assistant", "ai-agent-run"}},
			{Query: "触发流水线自动化构建", GoldAnswer: "trigger_pipeline", GoldSources: []string{"assistant", "pipeline"}},
			{Query: "帮我创建工单处理支付超时", GoldAnswer: "create_ticket", GoldSources: []string{"assistant", "ticketing"}},
		},
	},
	{
		Scenario: "TR-10",
		Tag:      "lowcode-ai",
		Cases: []models.EvalSetCaseInput{
			{Query: "创建一个审批流程，包含提交、审批、通知节点", GoldAnswer: "approval", GoldSources: []string{"lowcode", "ai-generate"}},
			{Query: "发布服务到生产环境的流程", GoldAnswer: "deployment", GoldSources: []string{"lowcode", "ai-generate"}},
			{Query: "数据同步 ETL 流程", GoldAnswer: "data_sync", GoldSources: []string{"lowcode", "ai-generate"}},
			{Query: "定时任务调度 cron 流程", GoldAnswer: "scheduled", GoldSources: []string{"lowcode", "ai-generate"}},
		},
	},
	{
		Scenario: "TR-11",
		Tag:      "ops-qa",
		Cases: []models.EvalSetCaseInput{
			{Query: "ops 服务器 CPU 使用率飙升建议什么命令排查", GoldAnswer: "suggest_command", GoldSources: []string{"assistant", "runbook"}},
			{Query: "运维 runbook 磁盘满排查", GoldAnswer: "suggest_command", GoldSources: []string{"assistant", "runbook"}},
			{Query: "查询操作手册网络延迟", GoldAnswer: "suggest_command", GoldSources: []string{"assistant", "runbook"}},
			{Query: "服务器内存泄漏建议什么命令", GoldAnswer: "suggest_command", GoldSources: []string{"assistant", "runbook"}},
		},
	},
}

// SeedEvalSetsForAllScenarios seeds eval sets for all default TR-09/10/11
// scenarios. If a set already exists (by name), it is skipped.
func (s *Service) SeedEvalSetsForAllScenarios(ctx context.Context, tenantID string, userID string) ([]models.EvalSet, error) {
	var seeded []models.EvalSet
	for _, seed := range defaultScenarioSeeds {
		existing, err := s.ListEvalSets(ctx, tenantID)
		if err != nil {
			continue
		}
		found := false
		for _, es := range existing {
			if es.Name == seed.Scenario {
				found = true
				seeded = append(seeded, es)
				break
			}
		}
		if found {
			continue
		}
		set, err := s.CreateEvalSet(ctx, tenantID, models.CreateEvalSetRequest{
			Name:        seed.Scenario,
			Description: "P3 基线评测集：" + seed.Tag,
			Cases:       seed.Cases,
		}, userID)
		if err != nil {
			continue
		}
		seeded = append(seeded, *set)
	}
	return seeded, nil
}

// SeedEvalSetForScenario seeds a single eval set for one scenario.
// Returns existing set if already seeded.
func (s *Service) SeedEvalSetForScenario(ctx context.Context, tenantID string, userID string, scenario string) (*models.EvalSet, error) {
	for _, seed := range defaultScenarioSeeds {
		if seed.Scenario != scenario {
			continue
		}
		existing, err := s.ListEvalSets(ctx, tenantID)
		if err != nil {
			return nil, err
		}
		for _, es := range existing {
			if es.Name == seed.Scenario {
				return &es, nil
			}
		}
		set, err := s.CreateEvalSet(ctx, tenantID, models.CreateEvalSetRequest{
			Name:        seed.Scenario,
			Description: "P3 基线评测集：" + seed.Tag,
			Cases:       seed.Cases,
		}, userID)
		return set, err
	}
	return nil, nil
}
