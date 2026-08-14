package service

import (
	"testing"
)

// ============================================================
// P3: TR-08 成本面板扩展 — 模块级成本归因
// ============================================================

func TestModuleNameMap_CoversTR09(t *testing.T) {
	if _, ok := ModuleNameMap["dev-agent"]; !ok {
		t.Error("ModuleNameMap missing dev-agent (TR-09)")
	}
	if _, ok := ModuleNameMap["pipeline"]; !ok {
		t.Error("ModuleNameMap missing pipeline (TR-09)")
	}
}

func TestModuleNameMap_CoversTR10(t *testing.T) {
	if _, ok := ModuleNameMap["lowcode"]; !ok {
		t.Error("ModuleNameMap missing lowcode (TR-10)")
	}
	if _, ok := ModuleNameMap["ai-generate"]; !ok {
		t.Error("ModuleNameMap missing ai-generate (TR-10)")
	}
}

func TestModuleNameMap_CoversTR11(t *testing.T) {
	if _, ok := ModuleNameMap["ops"]; !ok {
		t.Error("ModuleNameMap missing ops (TR-11)")
	}
	if _, ok := ModuleNameMap["runbook"]; !ok {
		t.Error("ModuleNameMap missing runbook (TR-11)")
	}
}

func TestModuleNameMap_EvalAndChatops(t *testing.T) {
	if _, ok := ModuleNameMap["eval"]; !ok {
		t.Error("ModuleNameMap missing eval (TR-05)")
	}
	if _, ok := ModuleNameMap["chatops"]; !ok {
		t.Error("ModuleNameMap missing chatops")
	}
}

func TestModuleNameMap_UnknownFallback(t *testing.T) {
	label, ok := ModuleNameMap["unknown"]
	if !ok || label == "" {
		t.Error("ModuleNameMap should have 'unknown' fallback")
	}
}
