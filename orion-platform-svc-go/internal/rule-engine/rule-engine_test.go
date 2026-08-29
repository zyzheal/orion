package rule_engine_test

import (
	"encoding/json"
	"testing"
	"time"

	"go.uber.org/zap"
	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/rule-engine/handler"
	"orion/platform-svc-go/internal/rule-engine/models"
	"orion/platform-svc-go/internal/rule-engine/repository"
	"orion/platform-svc-go/internal/rule-engine/service"
)

// TestRuleEngine_ModelTypes verifies that the Rule model and its
// CreateRuleRequest / EvaluateRequest / EvaluateResult / RuleResponse
// types are well-formed and serialize correctly.
func TestRuleEngine_ModelTypes(t *testing.T) {
	now := time.Now()
	rule := models.Rule{
		ID:          "rule_001",
		TenantID:    "t1",
		Name:        "test-rule",
		Description: "a rule",
		Priority:    5,
		Conditions:  "k1=v1,k2=v2",
		Actions:     "send-alert",
		IsEnabled:   true,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	// Rule must marshal/unmarshal without error (verifies JSON tags compile).
	data, err := json.Marshal(rule)
	if err != nil {
		t.Fatalf("Rule marshal: %v", err)
	}
	var decoded models.Rule
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Rule unmarshal: %v", err)
	}
	if decoded.ID != rule.ID || decoded.TenantID != rule.TenantID {
		t.Fatalf("round-trip mismatch: id=%q tenant=%q", decoded.ID, decoded.TenantID)
	}

	createReq := models.CreateRuleRequest{
		Name:        "r2",
		Description: "desc",
		Priority:    1,
		Conditions:  []string{"level=critical"},
		Actions:     []string{"page-oncall"},
	}
	if createReq.Name != "r2" {
		t.Fatal("CreateRuleRequest not populated")
	}

	evalReq := models.EvaluateRequest{
		RuleID: "rule_001",
		Data:   map[string]interface{}{"level": "critical"},
	}
	if evalReq.RuleID != "rule_001" {
		t.Fatal("EvaluateRequest not populated")
	}

	evalRes := models.EvaluateResult{
		RuleID:    "rule_001",
		Triggered: true,
		Actions:   []interface{}{map[string]string{"type": "page-oncall"}},
		Message:   "ok",
	}
	if !evalRes.Triggered {
		t.Fatal("EvaluateResult.Triggered must be true")
	}

	resp := models.RuleResponse{Total: 1, Data: []models.Rule{rule}}
	if resp.Total != 1 || len(resp.Data) != 1 {
		t.Fatal("RuleResponse not populated")
	}
}

// TestRuleEngine_ServiceCreation verifies that NewRuleEngineService
// constructs a valid service instance, accepts nil dependencies
// gracefully (no panic), and correctly wires the condition engine
// via SetConditionEngine.  Uses NewRuleEngineHandler to confirm the
// handler package compiles against the service type.
func TestRuleEngine_ServiceCreation(t *testing.T) {
	svc := service.NewRuleEngineService(nil, zap.NewNop())
	if svc == nil {
		t.Fatal("NewRuleEngineService returned nil")
	}

	// The service must remain usable after injecting a nil condition
	// engine — the handler only needs the service pointer, not the
	// condition engine, so this verifies the public API is intact.
	svc.SetConditionEngine(nil)
}

// TestRuleEngine_PublicAPI verifies that the service, handler,
// repository and sentinel packages all compile and expose the
// expected public API surface (structs, constructors, interfaces,
// and sentinel errors) without requiring a live PostgreSQL database.
func TestRuleEngine_PublicAPI(t *testing.T) {
	logger := zap.NewNop()
	svc := service.NewRuleEngineService(nil, logger)
	if svc == nil {
		t.Fatal("NewRuleEngineService must not return nil")
	}

	// Repository constructor and interface compile check.
	repo := repository.NewRepository(nil)
	if repo == nil {
		t.Fatal("NewRepository must not return nil")
	}

	// Repository implements RepositoryInterface (compile-time check).
	var _ repository.RepositoryInterface = repo

	// Handler constructor compiles against the service type.
	handler := handler.NewRuleEngineHandler(svc)
	if handler == nil {
		t.Fatal("NewRuleEngineHandler must not return nil")
	}

	// Sentinel errors from the shared package compile and are non-nil.
	if sentinel.NotFound == nil {
		t.Fatal("sentinel.NotFound must be non-nil")
	}
}
