package service

import (
	"context"
	"strings"
	"testing"

	"orion/platform-svc-go/internal/assistant/models"
)

// fakeProvider returns canned results for its domain.
type fakeProvider struct {
	name string
	rows []models.SourceResult
}

func (f *fakeProvider) Name() string                { return f.name }
func (f *fakeProvider) Search(ctx context.Context, tenantID string, q models.QueryRequest) ([]models.SourceResult, error) {
	return f.rows, nil
}

func mustProvider(name string, rows []models.SourceResult) SourceProvider {
	return &fakeProvider{name: name, rows: rows}
}

func Test_DetectIntent(t *testing.T) {
	s := NewService(nil)
	cases := []struct{ q, want string }{
		{"为什么我的服务一直告警", "alert"},
		{"帮我查一下这个工单的进度", "ticket"},
		{"流水线构建失败了怎么办", "pipeline"},
		{"这个变更风险评估怎么样", "change"},
		{"如何创建知识库文档", "knowledge"},
		{"今天天气怎么样", ""},
	}
	for _, c := range cases {
		if got := s.detectIntent(models.QueryRequest{Question: c.q}); got != c.want {
			t.Errorf("detectIntent(%q) = %q, want %q", c.q, got, c.want)
		}
	}
}

func Test_Query_RoutesToMatchedIntent(t *testing.T) {
	ctx := context.Background()
	providers := []SourceProvider{
		mustProvider("alert", []models.SourceResult{{Source: "alert", Title: "CPU高", Content: "cpu 超出阈值"}}),
		mustProvider("ticket", []models.SourceResult{{Source: "ticket", Title: "SLA工单", Content: "sla 即将到期"}}),
	}
	s := NewService(providers)

	resp, err := s.Query(ctx, "t1", models.QueryRequest{Question: "为什么一直告警 cpu 高"})
	if err != nil {
		t.Fatal(err)
	}
	if resp.Intent != "alert" {
		t.Fatalf("intent = %q, want alert", resp.Intent)
	}
	if len(resp.Sources) == 0 {
		t.Fatal("expected sources to be retrieved")
	}
	for _, r := range resp.Sources {
		if r.Source == "ticket" {
			t.Fatalf("intent alert should not consult ticket provider, got %+v", resp.Sources)
		}
	}
}

func Test_Query_NoResultsTemplate(t *testing.T) {
	s := NewService(nil)
	resp, err := s.Query(context.Background(), "t1", models.QueryRequest{Question: "完全无关的问题 abc"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(resp.Answer, "未找到") {
		t.Fatalf("expected no-result template, got %q", resp.Answer)
	}
}

func Test_Query_KnowledgeSupplementEveryIntent(t *testing.T) {
	ctx := context.Background()
	providers := []SourceProvider{
		mustProvider("knowledge", []models.SourceResult{{Source: "knowledge", Title: "runbook", Content: "重启方法"}}),
		mustProvider("alert", []models.SourceResult{{Source: "alert", Title: "A", Content: "告警内容"}}),
	}
	s := NewService(providers)
	resp, _ := s.Query(ctx, "t1", models.QueryRequest{Question: "服务异常如何排查"})
	if len(resp.Sources) == 0 {
		t.Fatal("expected sources")
	}
	// pipeline-only question should still allow knowledge supplement
	hasKnowledge := false
	for _, r := range resp.Sources {
		if r.Source == "knowledge" {
			hasKnowledge = true
		}
	}
	if !hasKnowledge {
		t.Fatalf("knowledge provider should supplement every intent, sources=%+v", resp.Sources)
	}
}

func Test_TemplateAnswer_CitedSources(t *testing.T) {
	res := []models.SourceResult{
		{Source: "alert", Title: "CPU高", Content: "cpu 超过 90%"},
	}
	answer := templateAnswer("who", "alert", res)
	if !strings.Contains(answer, "[alert] CPU高") {
		t.Fatalf("answer missing citation marker: %q", answer)
	}
}

func Test_ContainsAny(t *testing.T) {
	if !containsAny("出现告警", "告警", "alert") {
		t.Fatal("containsAny should match 告警")
	}
	if containsAny("无关", "告警", "alert") {
		t.Fatal("containsAny should not match unrelated")
	}
}

func Test_Truncate(t *testing.T) {
	if got := truncate("abc", 10); got != "abc" {
		t.Fatalf("truncate short = %q", got)
	}
	if got := truncate("abcdefghij", 5); got != "abcde" {
		t.Fatalf("truncate long = %q", got)
	}
}