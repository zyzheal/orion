package models

type RuleRequest struct {
        ID         string            `json:"id" binding:"required"`
        Name       string            `json:"name" binding:"required"`
        Group      string            `json:"group"`
        Expr       string            `json:"expr" binding:"required"`
        Severity   string            `json:"severity"`
        Priority   int               `json:"priority"`
        Labels     map[string]string `json:"labels"`
        CooldownSec int              `json:"cooldown_sec"`
}

type RuleUpdateRequest struct {
        Expr       string            `json:"expr"`
        Severity   string            `json:"severity"`
        Priority   int               `json:"priority"`
        Labels     map[string]string `json:"labels"`
        CooldownSec int              `json:"cooldown_sec"`
}

type RuleResponse struct {
        ID       string            `json:"id"`
        Name     string            `json:"name"`
        Group    string            `json:"group"`
        Expr     string            `json:"expr"`
        Severity string            `json:"severity"`
        Priority int               `json:"priority"`
        Labels   map[string]string `json:"labels"`
}
