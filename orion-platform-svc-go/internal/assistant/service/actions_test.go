package service

import (
	"context"
	"testing"

	"orion/platform-svc-go/internal/assistant/models"
)

func Test_ResolveActionKind_Explicit(t *testing.T) {
	cases := map[models.ActionKind]string{
		models.ActionCreateTicket:   "create_ticket",
		models.ActionTriggerPipeline: "trigger_pipeline",
		models.ActionCreateChange:   "create_change",
	}
	for want, given := range cases {
		req := &models.ActionRequest{Prompt: "x", Kind: given}
		if got := resolveActionKind(req); got != want {
			t.Errorf("resolveActionKind(%q) = %s, want %s", given, got, want)
		}
	}
}

func Test_ResolveActionKind_Auto(t *testing.T) {
	cases := []struct {
		prompt string
		want   models.ActionKind
	}{
		{"帮我创建工单处理支付问题", models.ActionCreateTicket},
		{"バグ 提交一个 bug 工单", models.ActionCreateTicket},
		{"帮我触发构建流水线", models.ActionTriggerPipeline},
		{"发布 v2.1 到生产", models.ActionTriggerPipeline},
		{"发起变更申请", models.ActionCreateChange},
		{"例行变更上线", models.ActionCreateChange},
		{"undefined 请求", models.ActionCreateTicket},
	}
	for _, c := range cases {
		req := &models.ActionRequest{Prompt: c.prompt}
		if got := resolveActionKind(req); got != c.want {
			t.Errorf("resolveActionKind(%q) = %s, want %s", c.prompt, got, c.want)
		}
	}
}

func Test_InferTitle(t *testing.T) {
	cases := []struct {
		prompt string
		want   string
	}{
		{"帮我创建一个工单处理支付超时", "创建一个工单处理支付超时"}, // 去"帮我"，保留"创建"
		{"请发布 v2.1", "发布 v2.1"},
		{"需要扩容订单服务", "扩容订单服务"},
		{"", ""},
	}
	for _, c := range cases {
		got, ok := inferTitle(c.prompt, models.ActionCreateTicket)
		if c.want == "" {
			if ok || got != "" {
				t.Errorf("inferTitle(%q) = %q, want empty", c.prompt, got)
			}
			continue
		}
		if !ok {
			t.Errorf("inferTitle(%q) failed", c.prompt)
		}
		if got != c.want {
			t.Errorf("inferTitle(%q) = %q, want %q", c.prompt, got, c.want)
		}
	}
}

func Test_ExecuteAction_Unsupported_NoExecutor(t *testing.T) {
	s := NewService(nil)
	res, err := s.ExecuteAction(context.Background(), "t1", &models.ActionRequest{
		Prompt: "帮我创建工单", Title: "test ticket",
	}, "u1")
	if err != nil {
		t.Fatal(err)
	}
	if res.Status != "unsupported" {
		t.Fatalf("status = %s, want unsupported (no executor registered)", res.Status)
	}
	if res.Summary == "" {
		t.Fatal("unsupported result should have a summary")
	}
}

func Test_ExecuteAction_WithExecutor(t *testing.T) {
	s := NewService(nil)
	s.AddExecutor(NewFuncActionExecutor(models.ActionCreateTicket,
		func(ctx context.Context, tenantID string, req *models.ActionRequest) (*models.ActionResult, error) {
			return &models.ActionResult{
				Kind:       models.ActionCreateTicket,
				Status:     "executed",
				Summary:    "created: " + req.Title,
				EntityID:   "tkt-1",
				EntityName: req.Title,
				ExecutedAt: nowUTC(),
			}, nil
		}))

	res, err := s.ExecuteAction(context.Background(), "t1", &models.ActionRequest{
		Prompt: "帮我创建工单", Title: "支付超时",
	}, "u1")
	if err != nil {
		t.Fatal(err)
	}
	if res.Status != "executed" {
		t.Fatalf("status = %s, want executed", res.Status)
	}
	if res.EntityName != "支付超时" {
		t.Fatalf("entity = %s", res.EntityName)
	}
}

func Test_ExecuteAction_TitleFallback(t *testing.T) {
	s := NewService(nil)
	s.AddExecutor(NewFuncActionExecutor(models.ActionCreateTicket,
		func(ctx context.Context, tenantID string, req *models.ActionRequest) (*models.ActionResult, error) {
			return &models.ActionResult{
				Kind: models.ActionCreateTicket, Status: "executed",
				Summary: "created: " + req.Title, EntityID: "x", ExecutedAt: nowUTC(),
			}, nil
		}))

	// Empty prompt → no title → error
	_, err := s.ExecuteAction(context.Background(), "t1", &models.ActionRequest{Prompt: ""}, "u1")
	if err == nil {
		t.Fatal("expected error when title cannot be inferred")
	}
}