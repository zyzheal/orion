package tool_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"orion/platform-svc-go/internal/tool/models"
	"orion/platform-svc-go/internal/tool/service"
)

func TestTool_NewService_Nil(t *testing.T) {
	// NewToolService accepts nil repositories; construction must not panic.
	svc := service.NewToolService(nil, nil, nil)
	if svc == nil {
		t.Fatal("NewToolService returned nil")
	}
}

func TestTool_ContextDeadline(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	deadline, ok := ctx.Deadline()
	if !ok {
		t.Fatal("expected context to have deadline")
	}
	if deadline.IsZero() {
		t.Fatal("expected non-zero deadline")
	}

	// Verify ToolStats struct fields compile and are accessible.
	stats := models.ToolStats{
		TotalInvocations: 100,
		SuccessfulCalls:  95,
		FailedCalls:      5,
		SuccessRate:      0.95,
		AvgDurationMs:    120.5,
		P95DurationMs:    250.0,
		P99DurationMs:    500.0,
		ActiveUsers:      10,
	}
	if stats.TotalInvocations != 100 {
		t.Errorf("expected 100 total invocations, got %d", stats.TotalInvocations)
	}
	if stats.SuccessRate != 0.95 {
		t.Errorf("expected success rate 0.95, got %f", stats.SuccessRate)
	}
	if stats.P95DurationMs != 250.0 {
		t.Errorf("expected p95 250.0, got %f", stats.P95DurationMs)
	}
}

func TestTool_PackageAvailable(t *testing.T) {
	// Sentinel error
	if models.ErrToolNotFound == nil {
		t.Fatal("ErrToolNotFound must not be nil")
	}
	if !errors.Is(models.ErrToolNotFound, models.ErrToolNotFound) {
		t.Error("ErrToolNotFound must satisfy errors.Is")
	}
	if models.ErrToolNotFound.Error() != "tool not found" {
		t.Errorf("unexpected error message: %q", models.ErrToolNotFound.Error())
	}

	// StatsPeriod constants
	if models.StatsPeriodDay != "day" {
		t.Errorf("StatsPeriodDay = %q", models.StatsPeriodDay)
	}
	if models.StatsPeriodWeek != "week" {
		t.Errorf("StatsPeriodWeek = %q", models.StatsPeriodWeek)
	}
	if models.StatsPeriodMonth != "month" {
		t.Errorf("StatsPeriodMonth = %q", models.StatsPeriodMonth)
	}

	// Tool struct
	tool := models.Tool{
		ID:        "tool-1",
		Name:      "test-tool",
		Category:  "category-1",
		Type:      "api",
		Status:    "active",
		CreatedBy: "user-1",
	}
	if tool.Name != "test-tool" || tool.Status != "active" {
		t.Error("Tool struct field assignment failed")
	}

	// CreateToolRequest
	createReq := models.CreateToolRequest{
		Name:     "req-tool",
		Category: "cat",
		Type:     "cli",
		Version:  "1.0.0",
	}
	if createReq.Type != "cli" {
		t.Errorf("CreateToolRequest type mismatch: %s", createReq.Type)
	}

	// UpdateToolRequest with pointer fields
	displayName := "Updated Name"
	updateReq := models.UpdateToolRequest{
		DisplayName: &displayName,
	}
	if updateReq.DisplayName == nil || *updateReq.DisplayName != "Updated Name" {
		t.Error("UpdateToolRequest DisplayName pointer not set correctly")
	}

	// ToolListParams
	params := models.ToolListParams{
		Category: "ci",
		Type:     "cli",
		Page:     2,
		PageSize: 50,
	}
	if params.Category != "ci" || params.PageSize != 50 {
		t.Error("ToolListParams field assignment failed")
	}

	// MarketSearchParams
	market := models.MarketSearchParams{
		Query:    "search term",
		Category: "cat",
		Type:     "api",
	}
	if market.Query != "search term" {
		t.Errorf("MarketSearchParams query mismatch: %s", market.Query)
	}

	// ToolUsageRank
	rank := models.ToolUsageRank{
		ToolID:          "tool-1",
		ToolName:        "My Tool",
		Category:        "ci",
		InvocationCount: 42,
	}
	if rank.InvocationCount != 42 {
		t.Errorf("ToolUsageRank count mismatch: %d", rank.InvocationCount)
	}

	// ToolInvocation
	inv := models.ToolInvocation{
		ID:       "inv-1",
		ToolID:   "tool-1",
		Status:   "success",
		Duration: 150,
		CalledBy: "user-1",
	}
	if inv.Duration != 150 {
		t.Errorf("ToolInvocation duration mismatch: %d", inv.Duration)
	}

	// ToolVersion
	ver := models.ToolVersion{
		ToolID:    "tool-1",
		Version:   "2.0.0",
		Changelog: "Added feature X",
	}
	if ver.Version != "2.0.0" {
		t.Errorf("ToolVersion version mismatch: %s", ver.Version)
	}

	// ToolCategory
	cat := models.ToolCategory{
		Name:      "ci",
		SortOrder: 3,
	}
	if cat.SortOrder != 3 {
		t.Errorf("ToolCategory sortOrder mismatch: %d", cat.SortOrder)
	}

	// InvokeToolRequest
	invReq := models.InvokeToolRequest{
		Input: `{"action": "run"}`,
	}
	if invReq.Input != `{"action": "run"}` {
		t.Error("InvokeToolRequest input mismatch")
	}
}
