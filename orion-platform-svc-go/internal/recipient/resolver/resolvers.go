package resolver

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/recipient/models"
)

// UserResolver: 显式指定用户列表。
type UserResolver struct{}

func NewUserResolver() *UserResolver { return &UserResolver{} }
func (r *UserResolver) Kind() models.Kind { return models.KindUser }

func (r *UserResolver) Resolve(ctx context.Context, spec models.RecipientSpec) ([]models.ResolvedUser, error) {
	ids := spec.ParamStringSlice("user_ids")
	if len(ids) == 0 {
		return nil, fmt.Errorf("E_RECIP_PARAM_MISSING: user_ids is required for user kind")
	}
	users := make([]models.ResolvedUser, 0, len(ids))
	for _, id := range ids {
		users = append(users, models.ResolvedUser{UserID: id, Role: "member"})
	}
	return users, nil
}

// RoleResolver: 展开为拥有该角色的用户。
type RoleResolver struct {
	roles UserRoleReader
}

func NewRoleResolver(r UserRoleReader) *RoleResolver { return &RoleResolver{roles: r} }
func (r *RoleResolver) Kind() models.Kind { return models.KindRole }

func (r *RoleResolver) Resolve(ctx context.Context, spec models.RecipientSpec) ([]models.ResolvedUser, error) {
	role := spec.ParamString("role")
	if role == "" {
		return nil, fmt.Errorf("E_RECIP_PARAM_MISSING: role is required for role kind")
	}
	if r.roles == nil {
		return nil, fmt.Errorf("E_RECIP_RESOLVER_INTERNAL: user role reader not configured")
	}
	ids, err := r.roles.UsersWithRole(spec.TenantID, role)
	if err != nil {
		return nil, fmt.Errorf("E_RECIP_RESOLVER_INTERNAL: %w", err)
	}
	users := make([]models.ResolvedUser, 0, len(ids))
	for _, id := range ids {
		users = append(users, models.ResolvedUser{UserID: id, Role: role})
	}
	return users, nil
}

// TeamResolver: 展开为团队全部成员。
type TeamResolver struct {
	team TeamReader
}

func NewTeamResolver(t TeamReader) *TeamResolver { return &TeamResolver{team: t} }
func (r *TeamResolver) Kind() models.Kind { return models.KindTeam }

func (r *TeamResolver) Resolve(ctx context.Context, spec models.RecipientSpec) ([]models.ResolvedUser, error) {
	teamID := spec.ParamString("team_id")
	if teamID == "" {
		return nil, fmt.Errorf("E_RECIP_PARAM_MISSING: team_id is required for team kind")
	}
	if r.team == nil {
		return nil, fmt.Errorf("E_RECIP_RESOLVER_INTERNAL: team reader not configured")
	}
	members, err := r.team.MembersOf(spec.TenantID, teamID)
	if err != nil {
		return nil, fmt.Errorf("E_RECIP_RESOLVER_INTERNAL: %w", err)
	}
	users := make([]models.ResolvedUser, 0, len(members))
	for _, m := range members {
		users = append(users, models.ResolvedUser{UserID: m.UserID, Role: m.Role})
	}
	return users, nil
}

// OncallDutyResolver: 展开当班主/备人员。
type OncallDutyResolver struct {
	oncall OncallReader
}

func NewOncallDutyResolver(o OncallReader) *OncallDutyResolver { return &OncallDutyResolver{oncall: o} }
func (r *OncallDutyResolver) Kind() models.Kind { return models.KindOncallDuty }

func (r *OncallDutyResolver) Resolve(ctx context.Context, spec models.RecipientSpec) ([]models.ResolvedUser, error) {
	rotationID := spec.ParamString("rotation_id")
	if rotationID == "" {
		return nil, fmt.Errorf("E_RECIP_PARAM_MISSING: rotation_id is required for oncall-duty kind")
	}
	if r.oncall == nil {
		return nil, fmt.Errorf("E_RECIP_RESOLVER_INTERNAL: oncall reader not configured")
	}

	var asOf interface{} = time.Now()
	if asOfParam := spec.ParamString("as_of"); asOfParam != "" {
		if t, err := time.Parse(time.RFC3339, asOfParam); err == nil {
			asOf = t
		}
	}

	duty, err := r.oncall.DutyAt(spec.TenantID, rotationID, asOf)
	if err != nil {
		return nil, fmt.Errorf("E_RECIP_RESOLVER_INTERNAL: %w", err)
	}
	users := make([]models.ResolvedUser, 0, len(duty))
	for _, d := range duty {
		users = append(users, models.ResolvedUser{UserID: d.UserID, Role: d.Role})
	}
	return users, nil
}

// EscalationResolver: 展开升级策略某级别接收人。
type EscalationResolver struct {
	esc EscalationReader
}

func NewEscalationResolver(e EscalationReader) *EscalationResolver { return &EscalationResolver{esc: e} }
func (r *EscalationResolver) Kind() models.Kind { return models.KindEscalation }

func (r *EscalationResolver) Resolve(ctx context.Context, spec models.RecipientSpec) ([]models.ResolvedUser, error) {
	policyID := spec.ParamString("policy_id")
	if policyID == "" {
		return nil, fmt.Errorf("E_RECIP_PARAM_MISSING: policy_id is required for escalation kind")
	}
	if r.esc == nil {
		return nil, fmt.Errorf("E_RECIP_RESOLVER_INTERNAL: escalation reader not configured")
	}
	level, ok := spec.ParamInt("level")
	if !ok || level < 1 {
		level = 1
	}
	ids, err := r.esc.RecipientsAtLevel(spec.TenantID, policyID, level)
	if err != nil {
		return nil, fmt.Errorf("E_RECIP_RESOLVER_INTERNAL: %w", err)
	}
	users := make([]models.ResolvedUser, 0, len(ids))
	for _, id := range ids {
		users = append(users, models.ResolvedUser{UserID: id, Role: fmt.Sprintf("level-%d", level)})
	}
	return users, nil
}

// BroadcastResolver: 广播到全体/某范围。
type BroadcastResolver struct {
	users UserReader
}

func NewBroadcastResolver(u UserReader) *BroadcastResolver { return &BroadcastResolver{users: u} }
func (r *BroadcastResolver) Kind() models.Kind { return models.KindBroadcast }

func (r *BroadcastResolver) Resolve(ctx context.Context, spec models.RecipientSpec) ([]models.ResolvedUser, error) {
	if r.users == nil {
		return nil, fmt.Errorf("E_RECIP_RESOLVER_INTERNAL: user reader not configured")
	}
	scope := spec.ParamString("scope")
	if scope == "" {
		scope = "all"
	}
	ids, err := r.users.AllActiveUsers(spec.TenantID)
	if err != nil {
		return nil, fmt.Errorf("E_RECIP_RESOLVER_INTERNAL: %w", err)
	}
	users := make([]models.ResolvedUser, 0, len(ids))
	for _, id := range ids {
		users = append(users, models.ResolvedUser{UserID: id, Role: "member"})
	}
	return users, nil
}
