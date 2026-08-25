// ============================================================
// Plan 27 — DLP 数据防泄漏引擎
// ============================================================
// 优先级: P1
// 来源: v3.5 系统评审
// 本地证据:
//   - internal/data-masking/: 有 handler + repository + models + service (有测试)
//   - internal/data-classification/: 有完整模块
//   - internal/privacy/: 有完整模块
//   - 缺口: 无出站流量扫描 (API 响应、导出文件), 无实时拦截中间件
// 合并方案:
//   1. 本 Plan 的 DLPRule/Pattern 逻辑合并到 plan-40-dlp-middleware/dlp.go
//   2. DLP 中间件调用本地 data-masking service 执行脱敏
//   3. 出站响应体扫描 + 文件导出扫描
// 详细设计参见 docs/deliverables/README.md P1-10 小节
// ============================================================

package dlp

import (
    "context"
    "fmt"
    "regexp"
    "strings"
    "sync"
)

type DataType string

const (
    DataTypePhone   DataType = "phone"
    DataTypeEmail   DataType = "email"
    DataTypeIDCard  DataType = "id_card"
    DataTypeAPIKey  DataType = "api_key"
    DataTypePassword DataType = "password"
)

type DLPRuleAction string

const (
    ActionAlert   DLPRuleAction = "alert"
    ActionBlock   DLPRuleAction = "block"
    ActionMask    DLPRuleAction = "mask"
)

type Severity string

const (
    SeverityCritical Severity = "critical"
    SeverityHigh     Severity = "high"
    SeverityMedium   Severity = "medium"
    SeverityLow      Severity = "low"
)

type DLPRule struct {
    ID          string           `json:"id"`
    Name        string           `json:"name"`
    DataType    DataType         `json:"data_type"`
    Patterns    []*regexp.Regexp `json:"-"`
    RawPatterns []string         `json:"patterns"`
    Action      DLPRuleAction    `json:"action"`
    Severity    Severity         `json:"severity"`
    Enabled     bool             `json:"enabled"`
}

type DLPResult struct {
    RuleID   string `json:"rule_id"`
    DataType string `json:"data_type"`
    Match    string `json:"match"`
    Position int    `json:"position"`
    Action   string `json:"action"`
}

type DLPEngine struct {
    rules []DLPRule
    mu    sync.RWMutex
}

func NewDLPEngine() *DLPEngine {
    e := &DLPEngine{rules: make([]DLPRule, 0)}
    e.loadDefaultRules()
    return e
}

func (e *DLPEngine) loadDefaultRules() {
    e.rules = []DLPRule{
        {
            ID: "dlp-phone", Name: "phone", DataType: DataTypePhone,
            RawPatterns: []string{`1[3-9]\d{9}`},
            Action: ActionMask, Severity: SeverityHigh, Enabled: true,
        },
        {
            ID: "dlp-email", Name: "email", DataType: DataTypeEmail,
            RawPatterns: []string{`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`},
            Action: ActionMask, Severity: SeverityMedium, Enabled: true,
        },
        {
            ID: "dlp-idcard", Name: "id_card", DataType: DataTypeIDCard,
            RawPatterns: []string{`[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]`},
            Action: ActionMask, Severity: SeverityCritical, Enabled: true,
        },
        {
            ID: "dlp-apikey", Name: "api_key", DataType: DataTypeAPIKey,
            RawPatterns: []string{`(?:sk|api|key|secret)[-_]?[a-zA-Z0-9]{20,}`},
            Action: ActionBlock, Severity: SeverityCritical, Enabled: true,
        },
        {
            ID: "dlp-password", Name: "password", DataType: DataTypePassword,
            RawPatterns: []string{`password\s*[=:]\s*\S+`, `passwd\s*[=:]\s*\S+`},
            Action: ActionBlock, Severity: SeverityCritical, Enabled: true,
        },
    }
    e.compileRules()
}

func (e *DLPEngine) compileRules() {
    for i := range e.rules {
        e.rules[i].Patterns = make([]*regexp.Regexp, 0)
        for _, pattern := range e.rules[i].RawPatterns {
            if re, err := regexp.Compile(pattern); err == nil {
                e.rules[i].Patterns = append(e.rules[i].Patterns, re)
            }
        }
    }
}

func (e *DLPEngine) Scan(text string) []DLPResult {
    e.mu.RLock()
    defer e.mu.RUnlock()
    var results []DLPResult
    for _, rule := range e.rules {
        if !rule.Enabled { continue }
        for _, pattern := range rule.Patterns {
            matches := pattern.FindAllStringIndex(text, -1)
            for _, match := range matches {
                results = append(results, DLPResult{
                    RuleID: rule.ID, DataType: string(rule.DataType),
                    Match: text[match[0]:match[1]], Position: match[0],
                    Action: string(rule.Action),
                })
            }
        }
    }
    return results
}

func (e *DLPEngine) ScanAndMask(text string) (string, []DLPResult) {
    results := e.Scan(text)
    masked := text
    for _, r := range results {
        if r.Action == "mask" {
            masked = maskData(masked, r.Match, r.DataType)
        }
    }
    return masked, results
}

func (e *DLPEngine) ScanAndBlock(text string) ([]DLPResult, error) {
    results := e.Scan(text)
    for _, r := range results {
        if r.Action == "block" {
            return results, fmt.Errorf("DLP violation: %s at position %d", r.DataType, r.Position)
        }
    }
    return results, nil
}

func (e *DLPEngine) AddRule(rule DLPRule) {
    e.mu.Lock()
    defer e.mu.Unlock()
    e.rules = append(e.rules, rule)
    e.compileRules()
}

func (e *DLPEngine) RemoveRule(id string) {
    e.mu.Lock()
    defer e.mu.Unlock()
    for i, rule := range e.rules {
        if rule.ID == id {
            e.rules = append(e.rules[:i], e.rules[i+1:]...)
            return
        }
    }
}

func (e *DLPEngine) GetRules() []DLPRule {
    e.mu.RLock()
    defer e.mu.RUnlock()
    return e.rules
}

func (e *DLPEngine) ScanContext(ctx context.Context, text string) ([]DLPResult, error) {
    results := e.Scan(text)
    select {
    case <-ctx.Done():
        return nil, ctx.Err()
    default:
        return results, nil
    }
}

func maskData(text, match string, dataType string) string {
    switch DataType(dataType) {
    case DataTypePhone:
        if len(match) >= 11 {
            return strings.Replace(text, match, match[:3]+"****"+match[7:], -1)
        }
    case DataTypeEmail:
        if atIdx := strings.Index(match, "@"); atIdx > 0 {
            return strings.Replace(text, match, match[:2]+"***"+match[atIdx:], -1)
        }
    case DataTypeIDCard:
        if len(match) >= 18 {
            return strings.Replace(text, match, match[:6]+"************"+match[14:], -1)
        }
    case DataTypeAPIKey, DataTypePassword:
        if len(match) >= 8 {
            return strings.Replace(text, match, match[:4]+"****"+match[len(match)-4:], -1)
        }
    }
    return strings.Replace(text, match, "***", -1)
}
