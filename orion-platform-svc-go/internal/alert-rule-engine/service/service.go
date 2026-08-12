package service

import (
        "context"
        "fmt"
        "sync"
        "time"

        alertruleengine "orion/platform-svc-go/internal/alert-rule-engine"
        "orion/platform-svc-go/internal/alert-rule-engine/handler/models"
        "orion/platform-svc-go/internal/alert-rule-engine/repository"
)

type Service struct {
        mu      sync.RWMutex
        engines map[string]*alertruleengine.Engine
        repo    *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
        return &Service{engines: make(map[string]*alertruleengine.Engine), repo: repo}
}

func (s *Service) getEngine(tenantID string) *alertruleengine.Engine {
        s.mu.RLock()
        eng, ok := s.engines[tenantID]
        s.mu.RUnlock()
        if ok {
                return eng
        }
        s.mu.Lock()
        defer s.mu.Unlock()
        if eng, ok = s.engines[tenantID]; ok {
                return eng
        }
        eng = alertruleengine.NewEngine()
        s.engines[tenantID] = eng
        return eng
}

func (s *Service) CompileRule(ctx context.Context, tenantID string, req *models.RuleRequest) (*models.RuleResponse, error) {
        eng := s.getEngine(tenantID)
        raw := &alertruleengine.Rule{
                ID:         req.ID,
                Name:       req.Name,
                Group:      req.Group,
                Expression: req.Expr,
                Severity:   alertruleengine.Severity(req.Severity),
                Priority:   req.Priority,
                Labels:     req.Labels,
        }
        compiled, err := alertruleengine.CompileRule(raw)
        if err != nil {
                return nil, err
        }
        if err := eng.Register(compiled); err != nil {
                return nil, err
        }
        if s.repo != nil {
                if err := s.repo.Save(ctx, tenantID, compiled); err != nil {
                        return nil, fmt.Errorf("persist rule: %w", err)
                }
        }
        return toResponse(compiled), nil
}

func (s *Service) UnregisterRule(ctx context.Context, tenantID, id string) error {
        eng := s.getEngine(tenantID)
        if s.repo != nil {
                if err := s.repo.Delete(ctx, tenantID, id); err != nil {
                        return fmt.Errorf("delete rule: %w", err)
                }
        }
        return eng.Unregister(id)
}

func (s *Service) GetRule(ctx context.Context, tenantID, id string) (*models.RuleResponse, error) {
        eng := s.getEngine(tenantID)
        rule, err := eng.GetRule(id)
        if err != nil {
                return nil, err
        }
        return toResponse(rule), nil
}

func (s *Service) ListRules(ctx context.Context, tenantID, group string) ([]models.RuleResponse, error) {
        eng := s.getEngine(tenantID)
        var rules []*alertruleengine.Rule
        if group != "" {
                ids := eng.ListRulesByGroup(group)
                for _, id := range ids {
                        if r, err := eng.GetRule(id); err == nil {
                                rules = append(rules, r)
                        }
                }
        } else {
                for _, r := range eng.ListRules() {
                        rules = append(rules, r)
                }
        }
        resp := make([]models.RuleResponse, 0, len(rules))
        for _, r := range rules {
                resp = append(resp, *toResponse(r))
        }
        return resp, nil
}

func (s *Service) Evaluate(ctx context.Context, tenantID string, snapshot *alertruleengine.MetricSnapshot) ([]alertruleengine.RuleResult, error) {
        eng := s.getEngine(tenantID)
        ptrs := eng.Evaluate(snapshot)
	results := make([]alertruleengine.RuleResult, len(ptrs))
	for i, p := range ptrs { results[i] = *p }
        return results, nil
}

func (s *Service) UpdateRule(ctx context.Context, tenantID string, id string, req *models.RuleUpdateRequest) error {
        eng := s.getEngine(tenantID)
        updates := func(rule *alertruleengine.Rule) {
                if req.Expr != "" {
                        rule.Expression = req.Expr
                }
                if req.Severity != "" {
                        rule.Severity = alertruleengine.Severity(req.Severity)
                }
                rule.Priority = req.Priority
                if req.Labels != nil {
                        rule.Labels = req.Labels
                }
                if req.CooldownSec > 0 {
                        rule.Cooldown = time.Duration(req.CooldownSec) * time.Second
                }
        }
        return eng.UpdateRule(id, updates)
}

func (s *Service) Stats(ctx context.Context, tenantID string) (map[string]interface{}, error) {
        eng := s.getEngine(tenantID)
        return eng.Stats(), nil
}

func (s *Service) ResetCooldown(ctx context.Context, tenantID, id string) error {
        eng := s.getEngine(tenantID)
        return eng.ResetCooldown(id)
}

func (s *Service) PruneEngine(ctx context.Context, tenantID string) {
        s.mu.Lock()
        delete(s.engines, tenantID)
        s.mu.Unlock()
}

func toResponse(r *alertruleengine.Rule) *models.RuleResponse {
        return &models.RuleResponse{
                ID:       r.ID,
                Name:     r.Name,
                Group:    r.Group,
                Expr:     r.Expression,
                Severity: string(r.Severity),
                Priority: r.Priority,
                Labels:   r.Labels,
        }
}
