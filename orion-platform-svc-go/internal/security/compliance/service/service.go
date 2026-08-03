package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/security/compliance/models"
)

type ComplianceService struct {
	frameworks      map[string]*models.ComplianceFramework
	requirements    map[string]*models.ComplianceRequirement
	evidence        map[string]*models.Evidence
	gapAnalyses     map[string]*models.GapAnalysis
	remediations    map[string]*models.RemediationPlan
}

func NewComplianceService() *ComplianceService {
	return &ComplianceService{
		frameworks:    make(map[string]*models.ComplianceFramework),
		requirements:  make(map[string]*models.ComplianceRequirement),
		evidence:      make(map[string]*models.Evidence),
		gapAnalyses:   make(map[string]*models.GapAnalysis),
		remediations:  make(map[string]*models.RemediationPlan),
	}
}

func (s *ComplianceService) CreateFramework(ctx context.Context, req *models.ComplianceFramework) (*models.ComplianceFramework, error) {
	req.ID = uuid.New().String()
	req.CreatedAt = time.Now()
	req.Enabled = true
	s.frameworks[req.ID] = req
	return req, nil
}

func (s *ComplianceService) ListFrameworks(ctx context.Context) ([]models.ComplianceFramework, error) {
	var out []models.ComplianceFramework
	for _, fw := range s.frameworks {
		out = append(out, *fw)
	}
	return out, nil
}

func (s *ComplianceService) CreateRequirement(ctx context.Context, req *models.ComplianceRequirement) (*models.ComplianceRequirement, error) {
	req.ID = uuid.New().String()
	req.Enabled = true
	s.requirements[req.ID] = req
	return req, nil
}

func (s *ComplianceService) ListRequirements(ctx context.Context, frameworkID string) ([]models.ComplianceRequirement, error) {
	var out []models.ComplianceRequirement
	for _, r := range s.requirements {
		if frameworkID == "" || r.FrameworkID == frameworkID {
			out = append(out, *r)
		}
	}
	return out, nil
}

func (s *ComplianceService) CreateEvidence(ctx context.Context, tenantID string, req *models.CreateEvidenceRequest) (*models.Evidence, error) {
	now := time.Now()
	ev := &models.Evidence{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		FrameworkID:   req.FrameworkID,
		RequirementID: req.RequirementID,
		Type:          req.Type,
		Title:         req.Title,
		Description:   req.Description,
		Source:        req.Source,
		Status:        "submitted",
		SubmittedAt:   &now,
		CreatedAt:     now,
	}
	if req.Data != nil {
		ev.Data = models.JSONB(req.Data)
	}
	s.evidence[ev.ID] = ev
	return ev, nil
}

func (s *ComplianceService) ListEvidence(ctx context.Context, tenantID, frameworkID string) ([]models.Evidence, error) {
	var out []models.Evidence
	for _, e := range s.evidence {
		if e.TenantID == tenantID {
			if frameworkID == "" || e.FrameworkID == frameworkID {
				out = append(out, *e)
			}
		}
	}
	return out, nil
}

func (s *ComplianceService) CreateGapAnalysis(ctx context.Context, tenantID string, req *models.CreateGapAnalysisRequest) (*models.GapAnalysis, error) {
	now := time.Now()
	ga := &models.GapAnalysis{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		FrameworkID:  req.FrameworkID,
		AnalysisDate: now,
		CreatedAt:    now,
	}
	s.gapAnalyses[ga.ID] = ga
	return ga, nil
}

func (s *ComplianceService) ListGapAnalyses(ctx context.Context, tenantID string) ([]models.GapAnalysis, error) {
	var out []models.GapAnalysis
	for _, g := range s.gapAnalyses {
		if g.TenantID == tenantID {
			out = append(out, *g)
		}
	}
	return out, nil
}

func (s *ComplianceService) CreateRemediation(ctx context.Context, tenantID string, req *models.CreateRemediationRequest) (*models.RemediationPlan, error) {
	now := time.Now()
	plan := &models.RemediationPlan{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		FrameworkID:   req.FrameworkID,
		RequirementID: req.RequirementID,
		Title:         req.Title,
		Description:   req.Description,
		Action:        req.Action,
		Assignee:      req.Assignee,
		DueDate:       req.DueDate,
		Status:        "planned",
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	s.remediations[plan.ID] = plan
	return plan, nil
}

func (s *ComplianceService) ListRemediations(ctx context.Context, tenantID, frameworkID string) ([]models.RemediationPlan, error) {
	var out []models.RemediationPlan
	for _, p := range s.remediations {
		if p.TenantID == tenantID {
			if frameworkID == "" || p.FrameworkID == frameworkID {
				out = append(out, *p)
			}
		}
	}
	return out, nil
}

func (s *ComplianceService) UpdateRemediationStatus(ctx context.Context, tenantID, id, status string) (*models.RemediationPlan, error) {
	p, ok := s.remediations[id]
	if !ok {
		return nil, fmt.Errorf("remediation not found: %s", id)
	}
	if p.TenantID != tenantID {
		return nil, fmt.Errorf("remediation not accessible: %s", id)
	}
	p.Status = status
	p.UpdatedAt = time.Now()
	return p, nil
}
