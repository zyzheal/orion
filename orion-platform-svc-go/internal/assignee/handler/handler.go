// Package handler provides HTTP route handlers for the assignee dispatcher API.
//
// Routes are registered under /api/v1/assignee-dispatcher/ and cover the full
// CRUD lifecycle for rules plus dispatch execution endpoints.
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"orion/platform-svc-go/internal/assignee/repository"
	"orion/platform-svc-go/internal/assignee/service"
	"orion/platform-svc-go/internal/assignee/types"
	"orion/platform-svc-go/internal/tenantutil"

	"go.uber.org/zap"
)

// Handler owns the HTTP request lifecycle for the assignee dispatcher.
type Handler struct {
	svc    *service.Service
	repo   *repository.AssigneeRuleRepository
	logger *zap.Logger
}

// NewHandler creates a new handler with the given service and logger.
func NewHandler(svc *service.Service, repo *repository.AssigneeRuleRepository, logger *zap.Logger) *Handler {
	return &Handler{
		svc:    svc,
		repo:   repo,
		logger: logger,
	}
}

// --- Routes ---

type routeDef struct {
	Method  string
	Path    string
	Handler func(http.ResponseWriter, *http.Request)
}

// Routes returns the handler's route definitions.
func (h *Handler) Routes() []routeDef {
	return []routeDef{
		{http.MethodPost, "/rules", h.handleCreateRule},
		{http.MethodGet, "/rules", h.handleListRules},
		{http.MethodGet, "/rules/:id", h.handleGetRule},
		{http.MethodPut, "/rules/:id", h.handleUpdateRule},
		{http.MethodDelete, "/rules/:id", h.handleDeleteRule},
		{http.MethodPost, "/dispatch", h.handleDispatch},
		{http.MethodPost, "/escalation/check", h.handleCheckEscalation},
		{http.MethodGet, "/capabilities", h.handleCapabilities},
		{http.MethodGet, "/strategies", h.handleStrategies},
	}
}

// --- Handlers ---

func (h *Handler) handleCreateRule(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantutil.FromContext(r.Context())

	var req CreateRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	rule := &types.AssigneeRule{
		Name:        req.Name,
		Strategy:    req.Strategy,
		Priority:    req.Priority,
		Enabled:     req.Enabled,
		Capacity:    req.Capacity,
		Weight:      req.Weight,
		CooldownSec: req.CooldownSec,
		Conditions:  req.Conditions,
		TargetIDs:   req.TargetIDs,
	}

	if err := h.svc.CreateRule(r.Context(), tenantID, rule); err != nil {
		h.logger.Error("create rule failed",
			zap.String("tenant_id", tenantID),
			zap.String("name", req.Name),
			zap.Error(err))
		h.respondJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	h.respondJSON(w, http.StatusCreated, rule)
}

func (h *Handler) handleListRules(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantutil.FromContext(r.Context())

	enabledStr := r.URL.Query().Get("enabled")
	var enabled *bool
	if enabledStr != "" {
		v := enabledStr == "true"
		enabled = &v
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	rules, err := h.svc.ListRules(r.Context(), tenantID, enabled, limit, offset)
	if err != nil {
		h.logger.Error("list rules failed",
			zap.String("tenant_id", tenantID),
			zap.Error(err))
		h.respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	h.respondJSON(w, http.StatusOK, rules)
}

func (h *Handler) handleGetRule(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantutil.FromContext(r.Context())

	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		h.respondJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid rule id"})
		return
	}

	rule, err := h.svc.GetRule(r.Context(), tenantID, id)
	if err != nil {
		if types.IsNotFound(err) {
			h.respondJSON(w, http.StatusNotFound, map[string]string{"error": "rule not found"})
			return
		}
		h.logger.Error("get rule failed",
			zap.String("tenant_id", tenantID),
			zap.Int("id", id),
			zap.Error(err))
		h.respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	h.respondJSON(w, http.StatusOK, rule)
}

func (h *Handler) handleUpdateRule(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantutil.FromContext(r.Context())

	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		h.respondJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid rule id"})
		return
	}

	var req UpdateRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	updates := make(map[string]interface{})
	if req.Strategy != nil {
		updates["strategy"] = *req.Strategy
	}
	if req.Priority != nil {
		updates["priority"] = *req.Priority
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}
	if req.Capacity != nil {
		updates["capacity"] = *req.Capacity
	}
	if req.Weight != nil {
		updates["weight"] = *req.Weight
	}
	if req.CooldownSec != nil {
		updates["cooldown_sec"] = *req.CooldownSec
	}

	if err := h.svc.UpdateRule(r.Context(), tenantID, id, updates); err != nil {
		h.logger.Error("update rule failed",
			zap.String("tenant_id", tenantID),
			zap.Int("id", id),
			zap.Error(err))
		h.respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) handleDeleteRule(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantutil.FromContext(r.Context())

	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		h.respondJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid rule id"})
		return
	}

	if err := h.svc.DeleteRule(r.Context(), tenantID, id); err != nil {
		h.logger.Error("delete rule failed",
			zap.String("tenant_id", tenantID),
			zap.Int("id", id),
			zap.Error(err))
		h.respondJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *Handler) handleDispatch(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantutil.FromContext(r.Context())

	var req DispatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	item := &types.WorkItem{
		ID:             req.ID,
		TenantID:       tenantID,
		TargetType:     req.TargetType,
		Category:       req.Category,
		Priority:       req.Priority,
		Type:           req.Type,
		Source:         req.Source,
		Status:         req.Status,
		RequiredSkills: req.RequiredSkills,
		Metadata:       req.Metadata,
		IsEscalated:    req.IsEscalated,
		PriorityWeight: req.PriorityWeight,
	}

	result, err := h.svc.Dispatch(r.Context(), item, req.Candidates)
	if err != nil {
		if types.IsNotFound(err) {
			h.respondJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
			return
		}
		h.logger.Error("dispatch failed",
			zap.String("tenant_id", tenantID),
			zap.String("item_id", req.ID),
			zap.Error(err))
		h.respondJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}

	h.respondJSON(w, http.StatusOK, result)
}

func (h *Handler) handleCheckEscalation(w http.ResponseWriter, r *http.Request) {
	tenantID := tenantutil.FromContext(r.Context())

	var req EscalationCheckRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	item := &types.WorkItem{
		ID:       req.ItemID,
		TenantID: tenantID,
		CreatedAt: req.CreatedAt,
	}

	esc := h.svc.CheckEscalation(r.Context(), item, req.CurrentLevel)
	if esc == nil {
		h.respondJSON(w, http.StatusOK, map[string]string{"status": "no_escalation"})
		return
	}

	h.respondJSON(w, http.StatusOK, esc)
}

func (h *Handler) handleCapabilities(w http.ResponseWriter, r *http.Request) {
	caps := h.svc.Capabilities()
	h.respondJSON(w, http.StatusOK, caps)
}

func (h *Handler) handleStrategies(w http.ResponseWriter, r *http.Request) {
	strategies := h.svc.GetAvailableStrategies()
	h.respondJSON(w, http.StatusOK, strategies)
}

// --- Helpers ---

func (h *Handler) respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}

// --- Request types ---

type CreateRuleRequest struct {
	Name        string            `json:"name" binding:"required"`
	Strategy    string            `json:"strategy" binding:"required"`
	Priority    int               `json:"priority"`
	Enabled     bool              `json:"enabled"`
	Capacity    int               `json:"capacity"`
	Weight      float64           `json:"weight"`
	CooldownSec int               `json:"cooldown_sec"`
	Conditions  []types.Condition `json:"conditions"`
	TargetIDs   []string          `json:"target_ids"`
}

type UpdateRuleRequest struct {
	Strategy    *string   `json:"strategy"`
	Priority    *int      `json:"priority"`
	Enabled     *bool     `json:"enabled"`
	Capacity    *int      `json:"capacity"`
	Weight      *float64  `json:"weight"`
	CooldownSec *int      `json:"cooldown_sec"`
}

type DispatchRequest struct {
	ID             string                  `json:"id" binding:"required"`
	TargetType     string                  `json:"target_type" binding:"required"`
	Category       string                  `json:"category"`
	Priority       string                  `json:"priority"`
	Type           string                  `json:"type"`
	Source         string                  `json:"source"`
	Status         string                  `json:"status"`
	RequiredSkills []string                `json:"required_skills"`
	Metadata       map[string]string       `json:"metadata"`
	IsEscalated    bool                    `json:"is_escalated"`
	PriorityWeight int                     `json:"priority_weight"`
	Candidates     []*types.AssignmentTarget `json:"candidates"`
}

type EscalationCheckRequest struct {
	ItemID       string    `json:"item_id" binding:"required"`
	CreatedAt    time.Time `json:"created_at"`
	CurrentLevel int       `json:"current_level"`
}
