// Package service 编排 Triage 业务逻辑。
package service

import (
	"context"
	"errors"
	"sort"
	"time"

	"go.uber.org/zap"

	"orion/platform-svc-go/internal/triage/models"
	"orion/platform-svc-go/internal/triage/reader"
)

// 服务层错误（供 handler 分类）。
var (
	ErrTriageInvalidParam   = errors.New("E_TRIAGE_INVALID_PARAM")
	ErrTriageNotFound       = errors.New("E_TRIAGE_NOT_FOUND")
	ErrTriageDuplicate      = errors.New("E_TRIAGE_DUPLICATE")
	ErrTriageConflict       = errors.New("E_TRIAGE_CONFLICT")
	ErrTriageNoPermission   = errors.New("E_TRIAGE_NO_PERMISSION")
	ErrTriageEmptyOnCall    = errors.New("E_TRIAGE_EMPTY_ONCALL")
	ErrTriageAlertMissing   = errors.New("E_TRIAGE_ALERT_MISSING")
	ErrTriageTicketMissing  = errors.New("E_TRIAGE_TICKET_MISSING")
	ErrTriageInternal       = errors.New("E_TRIAGE_INTERNAL")
)

// Service 编排 Triage 业务逻辑。
type Service struct {
	alerts      reader.AlertReader
	tickets     reader.TicketReader
	oncall      reader.OnCallReader
	notify      reader.NotificationReader
	log         *zap.Logger
}

// NewService 创建 Triage 服务。
func NewService(
	alerts reader.AlertReader,
	tickets reader.TicketReader,
	oncall reader.OnCallReader,
	notify reader.NotificationReader,
	log *zap.Logger,
) *Service {
	if log == nil {
		log = zap.NewNop()
	}
	return &Service{alerts: alerts, tickets: tickets, oncall: oncall, notify: notify, log: log}
}

// Overview 返回当前用户的总览视图数据。
//
// 组合数据源：
//   - 值班状态: oncall.CurrentDuty
//   - 我负责的: alerts/tickets 过滤 assigned_to = me
//   - 团队未分配: alerts/tickets 过滤 assigned_scope = unassigned
//   - 未读活动: alerts/tickets 按更新时间倒序 top N
func (s *Service) Overview(ctx context.Context, tenantID, userID string, req *models.OverviewRequest) (*models.MyOverview, error) {
	if tenantID == "" || userID == "" {
		return nil, ErrTriageInvalidParam
	}

	// 1. 值班状态
	oncallInfo := &models.OnCallInfo{UserID: userID}
	if s.oncall != nil {
		info, err := s.oncall.CurrentDuty(ctx, tenantID, userID)
		if err != nil {
			s.log.Warn("oncall lookup failed", zap.Error(err))
		} else if info != nil {
			oncallInfo = info
		}
	}

	// 2. 我负责的 & 团队未分配
	myFilter := &models.Filter{
		AssignedScope: ptr(models.ScopeMine),
	}
	teamFilter := &models.Filter{
		AssignedScope: ptr(models.ScopeTeam),
	}

	openBySeverity := make(map[models.Severity]int)
	openByStatus := make(map[models.Status]int)
	var assignedToMe int
	var teamOpen int

	if s.alerts != nil {
		items, total, err := s.alerts.List(ctx, tenantID, myFilter, 0, 200)
		if err != nil {
			s.log.Warn("alerts list for mine failed", zap.Error(err))
		} else {
			assignedToMe += total
			for _, it := range items {
				if it.Status != models.StatusResolved && it.Status != models.StatusCancelled {
					openBySeverity[it.Severity]++
					openByStatus[it.Status]++
				}
			}
		}
		_, teamTotal, teamErr := s.alerts.List(ctx, tenantID, teamFilter, 0, 200)
		if teamErr != nil {
			s.log.Warn("alerts list for team failed", zap.Error(teamErr))
		} else {
			teamOpen += teamTotal
		}
	}

	if s.tickets != nil {
		items, total, err := s.tickets.List(ctx, tenantID, myFilter, 0, 200)
		if err != nil {
			s.log.Warn("tickets list for mine failed", zap.Error(err))
		} else {
			assignedToMe += total
			for _, it := range items {
				if it.Status != models.StatusResolved && it.Status != models.StatusCancelled {
					openBySeverity[it.Severity]++
					openByStatus[it.Status]++
				}
			}
		}
		_, teamTotal, teamErr := s.tickets.List(ctx, tenantID, teamFilter, 0, 200)
		if teamErr != nil {
			s.log.Warn("tickets list for team failed", zap.Error(teamErr))
		} else {
			teamOpen += teamTotal
		}
	}

	// 3. 未读活动（top 20）
	limitActivity := req.LimitActivity
	if limitActivity <= 0 {
		limitActivity = 20
	}
	recent := []models.TriageItem{}
	if req.IncludeActivity {
		if s.alerts != nil {
			items, _, _ := s.alerts.List(ctx, tenantID, &models.Filter{
				Status: ptr(models.StatusOpen),
			}, 0, limitActivity)
			recent = append(recent, items...)
		}
		if s.tickets != nil {
			items, _, _ := s.tickets.List(ctx, tenantID, &models.Filter{
				Status: ptr(models.StatusOpen),
			}, 0, limitActivity)
			recent = append(recent, items...)
		}
		sort.Slice(recent, func(i, j int) bool {
			return recent[i].UpdatedAt.After(recent[j].UpdatedAt)
		})
		if len(recent) > limitActivity {
			recent = recent[:limitActivity]
		}
	}

	return &models.MyOverview{
		Me:             *oncallInfo,
		OpenBySeverity: openBySeverity,
		OpenByStatus:   openByStatus,
		AssignedToMe:   assignedToMe,
		TeamOpen:       teamOpen,
		RecentActivity: recent,
		GeneratedAt:    time.Now(),
	}, nil
}

// ListAlerts 列出告警子集。
func (s *Service) ListAlerts(ctx context.Context, tenantID string, req *models.SubsetRequest) (*models.SubsetResponse, error) {
	if s.alerts == nil {
		return nil, ErrTriageAlertMissing
	}
	page, pageSize := normalizePage(req.Page, req.PageSize)
	items, total, err := s.alerts.List(ctx, tenantID, req.Filter, (page-1)*pageSize, pageSize)
	if err != nil {
		return nil, err
	}
	return &models.SubsetResponse{
		Data:     items,
		Page:     page,
		PageSize: pageSize,
		Total:    total,
		HasMore:  page*pageSize < total,
	}, nil
}

// ListTickets 列出租单子集。
func (s *Service) ListTickets(ctx context.Context, tenantID string, req *models.SubsetRequest) (*models.SubsetResponse, error) {
	if s.tickets == nil {
		return nil, ErrTriageTicketMissing
	}
	page, pageSize := normalizePage(req.Page, req.PageSize)
	items, total, err := s.tickets.List(ctx, tenantID, req.Filter, (page-1)*pageSize, pageSize)
	if err != nil {
		return nil, err
	}
	return &models.SubsetResponse{
		Data:     items,
		Page:     page,
		PageSize: pageSize,
		Total:    total,
		HasMore:  page*pageSize < total,
	}, nil
}

// Acknowledge 确认一条 Triage 项目。
func (s *Service) Acknowledge(ctx context.Context, req *models.AcknowledgeRequest) error {
	if req.TenantID == "" || req.ItemID == "" {
		return ErrTriageInvalidParam
	}
	switch req.Type {
	case "alert":
		if s.alerts == nil {
			return ErrTriageAlertMissing
		}
		return s.alerts.Acknowledge(ctx, req.TenantID, req.ItemID, req.ItemID)
	case "ticket":
		if s.tickets == nil {
			return ErrTriageTicketMissing
		}
		return s.tickets.Acknowledge(ctx, req.TenantID, req.ItemID, req.ItemID)
	default:
		return ErrTriageInvalidParam
	}
}

// Assign 分配一条 Triage 项目。
func (s *Service) Assign(ctx context.Context, req *models.AssignRequest) error {
	if req.TenantID == "" || req.ItemID == "" || req.ToUserID == "" {
		return ErrTriageInvalidParam
	}
	switch req.Type {
	case "alert":
		if s.alerts == nil {
			return ErrTriageAlertMissing
		}
		return s.alerts.Assign(ctx, req.TenantID, req.ItemID, req.ToUserID)
	case "ticket":
		if s.tickets == nil {
			return ErrTriageTicketMissing
		}
		return s.tickets.Assign(ctx, req.TenantID, req.ItemID, req.ToUserID)
	default:
		return ErrTriageInvalidParam
	}
}

// Handoff 值班交接。
func (s *Service) Handoff(ctx context.Context, req *models.HandoffRequest) (*models.HandoffResponse, error) {
	if s.oncall == nil {
		return nil, errors.New("E_TRIAGE_ONCALL_MISSING")
	}
	return s.oncall.Handoff(ctx, req)
}

func normalizePage(page, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 200 {
		pageSize = 50
	}
	return page, pageSize
}

func ptr[T any](v T) *T {
	return &v
}
