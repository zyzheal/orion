package service

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strings"

	"orion-ticket-svc-go/internal/models"
	"orion-ticket-svc-go/internal/otel"
	"orion-ticket-svc-go/internal/repository"
	"time"

	"github.com/google/uuid"
)

type DispatchService struct {
	engineerRepo *repository.DispatchRepository
	ticketRepo   *repository.TicketRepository
	slaRepo      *repository.SLARepository
	weights      models.DispatchWeights
}

func NewDispatchService(engineerRepo *repository.DispatchRepository, ticketRepo *repository.TicketRepository, slaRepo *repository.SLARepository) *DispatchService {
	return &DispatchService{
		engineerRepo: engineerRepo,
		ticketRepo:   ticketRepo,
		slaRepo:      slaRepo,
		weights:      models.DefaultWeights(),
	}
}

// RegisterEngineer adds a new engineer to the dispatch pool
func (s *DispatchService) RegisterEngineer(ctx context.Context, req *models.RegisterEngineerRequest) (*models.EngineerProfile, error) {
	_, span := otel.Tracer().Start(ctx, "DispatchService.RegisterEngineer")
	defer span.End()

	avail := req.Availability
	if avail == "" {
		avail = models.AvailabilityAvailable
	}

	ep := &models.EngineerProfile{
		ID:           req.ID,
		Name:         req.Name,
		Expertise:    req.Expertise,
		CurrentLoad:  req.CurrentLoad,
		MaxCapacity:  req.MaxCapacity,
		Availability: avail,
		Skills:       req.Skills,
		Team:         req.Team,
		OnCall:       req.OnCall,
	}

	if err := s.engineerRepo.CreateEngineer(ep); err != nil {
		return nil, fmt.Errorf("failed to register engineer: %w", err)
	}
	return ep, nil
}

// ListEngineers returns all registered engineers
func (s *DispatchService) ListEngineers(ctx context.Context) ([]models.EngineerProfile, error) {
	return s.engineerRepo.ListEngineers()
}

// GetEngineer returns a single engineer
func (s *DispatchService) GetEngineer(ctx context.Context, id string) (*models.EngineerProfile, error) {
	return s.engineerRepo.GetEngineer(id)
}

// AutoDispatch finds the best engineer for a ticket and assigns it
func (s *DispatchService) AutoDispatch(ctx context.Context, ticketID, tenantID, assignedBy string) (*models.DispatchRecord, error) {
	_, span := otel.Tracer().Start(ctx, "DispatchService.AutoDispatch")
	defer span.End()

	ticket, err := s.ticketRepo.GetByID(ticketID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("ticket not found: %w", err)
	}

	match, err := s.FindBestEngineer(ctx, ticket)
	if err != nil {
		// Enqueue for later
		s.engineerRepo.Enqueue(ticketID, tenantID, ticket.Priority)
		return nil, fmt.Errorf("no available engineer, enqueued: %w", err)
	}

	record := &models.DispatchRecord{
		ID:         uuid.New().String(),
		TicketID:   ticketID,
		EngineerID: match.EngineerID,
		AssignedBy: assignedBy,
		Method:     "auto",
		Score:      match.Score,
	}

	if err := s.engineerRepo.CreateRecord(record); err != nil {
		return nil, err
	}

	// Update ticket assignment
	s.ticketRepo.UpdateAssignee(ticketID, tenantID, match.EngineerID)
	s.ticketRepo.UpdateStatus(ticketID, tenantID, models.StatusAssigned)
	s.engineerRepo.IncrementLoad(match.EngineerID)
	s.engineerRepo.RemoveFromQueue(ticketID)

	return record, nil
}

// ManualDispatch assigns a ticket to a specific engineer
func (s *DispatchService) ManualDispatch(ctx context.Context, ticketID, tenantID, engineerID, assignedBy, reason string) (*models.DispatchRecord, error) {
	_, span := otel.Tracer().Start(ctx, "DispatchService.ManualDispatch")
	defer span.End()

	// Verify engineer exists
	_, err := s.engineerRepo.GetEngineer(engineerID)
	if err != nil {
		return nil, fmt.Errorf("engineer not found: %w", err)
	}

	record := &models.DispatchRecord{
		ID:         uuid.New().String(),
		TicketID:   ticketID,
		EngineerID: engineerID,
		AssignedBy: assignedBy,
		Method:     "manual",
		Reason:     reason,
	}

	if err := s.engineerRepo.CreateRecord(record); err != nil {
		return nil, err
	}

	s.ticketRepo.UpdateAssignee(ticketID, tenantID, engineerID)
	s.ticketRepo.UpdateStatus(ticketID, tenantID, models.StatusAssigned)
	s.engineerRepo.IncrementLoad(engineerID)
	s.engineerRepo.RemoveFromQueue(ticketID)

	return record, nil
}

// FindBestEngineer scores all available engineers and returns the best match
func (s *DispatchService) FindBestEngineer(ctx context.Context, ticket *models.Ticket) (*models.DispatchMatch, error) {
	engineers, err := s.engineerRepo.ListEngineers()
	if err != nil {
		return nil, err
	}

	if len(engineers) == 0 {
		return nil, fmt.Errorf("no engineers registered")
	}

	var matches []models.DispatchMatch
	for _, eng := range engineers {
		if eng.Availability == models.AvailabilityUnavailable {
			continue
		}
		if eng.CurrentLoad >= eng.MaxCapacity {
			continue
		}

		score := s.calculateScore(ticket, &eng)
		matches = append(matches, models.DispatchMatch{
			EngineerID:   eng.ID,
			EngineerName: eng.Name,
			Score:        score,
			Reasons:      s.getMatchReasons(ticket, &eng, score),
		})
	}

	if len(matches) == 0 {
		return nil, fmt.Errorf("no available engineers")
	}

	sort.Slice(matches, func(i, j int) bool {
		return matches[i].Score > matches[j].Score
	})

	return &matches[0], nil
}

// CalculateDispatchScore calculates the dispatch score for a ticket-engineer pair
func (s *DispatchService) CalculateDispatchScore(ctx context.Context, ticketID, tenantID, engineerID string) (*models.DispatchMatch, error) {
	ticket, err := s.ticketRepo.GetByID(ticketID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("ticket not found: %w", err)
	}

	engineer, err := s.engineerRepo.GetEngineer(engineerID)
	if err != nil {
		return nil, fmt.Errorf("engineer not found: %w", err)
	}

	score := s.calculateScore(ticket, engineer)
	return &models.DispatchMatch{
		EngineerID:   engineer.ID,
		EngineerName: engineer.Name,
		Score:        score,
		Reasons:      s.getMatchReasons(ticket, engineer, score),
	}, nil
}

func (s *DispatchService) calculateScore(ticket *models.Ticket, eng *models.EngineerProfile) float64 {
	// Expertise match
	expertiseScore := 0.0
	for _, exp := range eng.Expertise {
		if strings.EqualFold(exp, ticket.Type) || strings.EqualFold(exp, ticket.Priority) {
			expertiseScore = 1.0
			break
		}
	}

	// Workload score (inverse of utilization)
	workloadScore := 1.0
	if eng.MaxCapacity > 0 {
		workloadScore = 1.0 - float64(eng.CurrentLoad)/float64(eng.MaxCapacity)
	}

	// Availability score
	availabilityScore := 1.0
	if eng.Availability == models.AvailabilityBusy {
		availabilityScore = 0.5
	}

	// Success rate
	successScore := eng.SuccessRate / 100.0
	if successScore == 0 {
		successScore = 0.5 // default for new engineers
	}

	// SLA urgency (critical tickets get higher urgency weight)
	slaUrgency := 0.5
	switch ticket.Priority {
	case "critical":
		slaUrgency = 1.0
	case "high":
		slaUrgency = 0.8
	case "medium":
		slaUrgency = 0.5
	case "low":
		slaUrgency = 0.3
	}

	score := s.weights.Expertise*expertiseScore +
		s.weights.Workload*workloadScore +
		s.weights.Availability*availabilityScore +
		s.weights.SuccessRate*successScore +
		s.weights.SLAUrgency*slaUrgency

	return math.Round(score*1000) / 1000
}

func (s *DispatchService) getMatchReasons(ticket *models.Ticket, eng *models.EngineerProfile, score float64) []string {
	var reasons []string
	for _, exp := range eng.Expertise {
		if strings.EqualFold(exp, ticket.Type) {
			reasons = append(reasons, "expertise match: "+ticket.Type)
			break
		}
	}
	if eng.MaxCapacity > 0 {
		util := float64(eng.CurrentLoad) / float64(eng.MaxCapacity) * 100
		reasons = append(reasons, fmt.Sprintf("utilization: %.0f%%", util))
	}
	reasons = append(reasons, fmt.Sprintf("overall score: %.3f", score))
	return reasons
}

// UpdateWeights updates the dispatch scoring weights
func (s *DispatchService) UpdateWeights(w models.DispatchWeights) {
	if w.Expertise > 0 {
		s.weights.Expertise = w.Expertise
	}
	if w.Workload > 0 {
		s.weights.Workload = w.Workload
	}
	if w.Availability > 0 {
		s.weights.Availability = w.Availability
	}
	if w.SuccessRate > 0 {
		s.weights.SuccessRate = w.SuccessRate
	}
	if w.SLAUrgency > 0 {
		s.weights.SLAUrgency = w.SLAUrgency
	}
}

// GetWeights returns the current dispatch weights
func (s *DispatchService) GetWeights() models.DispatchWeights {
	return s.weights
}

// Queue management

func (s *DispatchService) GetQueueStatus(ctx context.Context) (*models.DispatchQueueStatus, error) {
	return s.engineerRepo.GetQueueStatus()
}

func (s *DispatchService) GetQueueEntries(ctx context.Context) ([]models.DispatchQueueEntry, error) {
	return s.engineerRepo.Dequeue(100)
}

func (s *DispatchService) GetMetrics(ctx context.Context, start, end time.Time) (*models.DispatchMetrics, error) {
	if start.IsZero() {
		start = time.Now().AddDate(0, -1, 0)
	}
	if end.IsZero() {
		end = time.Now()
	}
	return s.engineerRepo.GetMetrics(start, end)
}

func (s *DispatchService) GetLoadBalanceReport(ctx context.Context) (*models.LoadBalanceReport, error) {
	engineers, err := s.engineerRepo.ListEngineers()
	if err != nil {
		return nil, err
	}

	report := &models.LoadBalanceReport{}
	var totalLoad float64
	var maxLoad, minLoad int

	for i, eng := range engineers {
		utilization := 0.0
		if eng.MaxCapacity > 0 {
			utilization = float64(eng.CurrentLoad) / float64(eng.MaxCapacity) * 100
		}
		report.Engineers = append(report.Engineers, models.EngineerLoad{
			EngineerID:  eng.ID,
			Name:        eng.Name,
			CurrentLoad: eng.CurrentLoad,
			MaxCapacity: eng.MaxCapacity,
			Utilization: utilization,
		})
		totalLoad += float64(eng.CurrentLoad)
		if i == 0 || eng.CurrentLoad > maxLoad {
			maxLoad = eng.CurrentLoad
		}
		if i == 0 || eng.CurrentLoad < minLoad {
			minLoad = eng.CurrentLoad
		}
	}

	if len(engineers) > 0 {
		report.AvgLoad = totalLoad / float64(len(engineers))
	}
	report.MaxLoad = maxLoad
	report.MinLoad = minLoad
	report.ImbalanceScore = float64(maxLoad - minLoad)

	return report, nil
}

// Rules

func (s *DispatchService) AddRule(rule *models.DispatchRule) error {
	return s.engineerRepo.CreateRule(rule)
}

func (s *DispatchService) GetRules() ([]models.DispatchRule, error) {
	return s.engineerRepo.ListRules()
}

func (s *DispatchService) RemoveRule(id string) error {
	return s.engineerRepo.DeleteRule(id)
}

// Performance

func (s *DispatchService) GetEngineerPerformance(ctx context.Context, engineerID string) (*models.EngineerPerformance, error) {
	eng, err := s.engineerRepo.GetEngineer(engineerID)
	if err != nil {
		return nil, err
	}

	return &models.EngineerPerformance{
		EngineerID:      eng.ID,
		Name:            eng.Name,
		TotalResolved:   eng.TotalResolved,
		AvgResolutionMs: eng.AvgResolutionMs,
		SLACompliance:   eng.SLACompliance,
		SuccessRate:     eng.SuccessRate,
	}, nil
}

func (s *DispatchService) GetAllPerformances(ctx context.Context) ([]models.EngineerPerformance, error) {
	engineers, err := s.engineerRepo.ListEngineers()
	if err != nil {
		return nil, err
	}

	var perfs []models.EngineerPerformance
	for _, eng := range engineers {
		perfs = append(perfs, models.EngineerPerformance{
			EngineerID:      eng.ID,
			Name:            eng.Name,
			TotalResolved:   eng.TotalResolved,
			AvgResolutionMs: eng.AvgResolutionMs,
			SLACompliance:   eng.SLACompliance,
			SuccessRate:     eng.SuccessRate,
		})
	}
	return perfs, nil
}
