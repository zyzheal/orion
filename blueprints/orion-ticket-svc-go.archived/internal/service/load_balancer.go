package service

import (
	"context"
	"fmt"
	"math"
	"sort"

	"orion-ticket-svc-go/internal/models"
	"orion-ticket-svc-go/internal/repository"

	"go.uber.org/zap"
)

const (
	overloadThreshold   = 85.0 // percent utilization considered overloaded
	underutilThreshold  = 25.0 // percent utilization considered underutilized
)

// LoadBalancer provides advanced load balancing and reassignment capabilities
type LoadBalancer struct {
	dispatchRepo repository.DispatchRepositoryInterface
	logger       *zap.Logger
}

func NewLoadBalancer(dispatchRepo repository.DispatchRepositoryInterface) *LoadBalancer {
	return &LoadBalancer{
		dispatchRepo: dispatchRepo,
		logger:       zap.NewNop(),
	}
}

// GetBalancingReport generates a detailed load balancing report
func (lb *LoadBalancer) GetBalancingReport(ctx context.Context) (*models.LoadBalanceReport, error) {
	engineers, err := lb.dispatchRepo.ListEngineers(ctx)
	if err != nil {
		return nil, err
	}

	report := &models.LoadBalanceReport{}
	var totalLoad float64
	var utilizations []float64

	for _, eng := range engineers {
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
		utilizations = append(utilizations, utilization)
	}

	if len(engineers) > 0 {
		report.AvgLoad = totalLoad / float64(len(engineers))
	}

	// Find max/min
	for i, eng := range engineers {
		if i == 0 || eng.CurrentLoad > report.MaxLoad {
			report.MaxLoad = eng.CurrentLoad
		}
		if i == 0 || eng.CurrentLoad < report.MinLoad {
			report.MinLoad = eng.CurrentLoad
		}
	}

	// Calculate imbalance score (standard deviation of utilization)
	report.ImbalanceScore = calculateStdDev(utilizations)

	return report, nil
}

// SuggestReassignments suggests ticket reassignments to balance load
func (lb *LoadBalancer) SuggestReassignments(ctx context.Context) ([]models.ReassignmentSuggestion, error) {
	engineers, err := lb.dispatchRepo.ListEngineers(ctx)
	if err != nil {
		return nil, err
	}

	var suggestions []models.ReassignmentSuggestion

	// Find overloaded and underutilized engineers
	var overloaded, underutilized []models.EngineerProfile
	for _, eng := range engineers {
		if eng.MaxCapacity == 0 {
			continue
		}
		util := float64(eng.CurrentLoad) / float64(eng.MaxCapacity) * 100
		if util >= overloadThreshold {
			overloaded = append(overloaded, eng)
		} else if util <= underutilThreshold && eng.Availability != models.AvailabilityUnavailable {
			underutilized = append(underutilized, eng)
		}
	}

	if len(overloaded) == 0 || len(underutilized) == 0 {
		return suggestions, nil
	}

	// Sort overloaded by utilization (highest first)
	sort.Slice(overloaded, func(i, j int) bool {
		utilI := float64(overloaded[i].CurrentLoad) / float64(overloaded[i].MaxCapacity)
		utilJ := float64(overloaded[j].CurrentLoad) / float64(overloaded[j].MaxCapacity)
		return utilI > utilJ
	})

	// Sort underutilized by utilization (lowest first)
	sort.Slice(underutilized, func(i, j int) bool {
		utilI := float64(underutilized[i].CurrentLoad) / float64(underutilized[i].MaxCapacity)
		utilJ := float64(underutilized[j].CurrentLoad) / float64(underutilized[j].MaxCapacity)
		return utilI < utilJ
	})

	// Generate suggestions
	ui := 0
	for _, over := range overloaded {
		excess := over.CurrentLoad - (over.MaxCapacity * 80 / 100) // target 80%
		if excess <= 0 {
			continue
		}

		for excess > 0 && ui < len(underutilized) {
			under := underutilized[ui]
			available := under.MaxCapacity - under.CurrentLoad
			if available <= 0 {
				ui++
				continue
			}

			urgency := "medium"
			overUtil := float64(over.CurrentLoad) / float64(over.MaxCapacity) * 100
			if overUtil >= 95 {
				urgency = "high"
			}

			suggestions = append(suggestions, models.ReassignmentSuggestion{
				TicketID:          fmt.Sprintf("suggest-%s-%d", over.ID, len(suggestions)),
				CurrentEngineer:   over.ID,
				SuggestedEngineer: under.ID,
				Reason:            fmt.Sprintf("%.0f%% utilization -> %.0f%%", overUtil, float64(under.CurrentLoad)/float64(under.MaxCapacity)*100),
				Urgency:           urgency,
				CurrentLoad:       over.CurrentLoad,
				SuggestedLoad:     under.CurrentLoad + 1,
			})

			excess--
			underutilized[ui].CurrentLoad++
		}
	}

	return suggestions, nil
}

// GetTeamCapacity returns capacity metrics for a team
func (lb *LoadBalancer) GetTeamCapacity(ctx context.Context, teamName string) (*models.TeamCapacity, error) {
	engineers, err := lb.dispatchRepo.ListEngineers(ctx)
	if err != nil {
		return nil, err
	}

	capacity := &models.TeamCapacity{TeamName: teamName}
	for _, eng := range engineers {
		if eng.Team != teamName {
			continue
		}
		capacity.TotalEngineers++
		capacity.TotalCapacity += eng.MaxCapacity
		capacity.CurrentLoad += eng.CurrentLoad
		if eng.Availability != models.AvailabilityUnavailable {
			capacity.AvailableCount++
		}
	}

	if capacity.TotalCapacity > 0 {
		capacity.Utilization = float64(capacity.CurrentLoad) / float64(capacity.TotalCapacity) * 100
	}
	capacity.CanAcceptMore = capacity.CurrentLoad < capacity.TotalCapacity

	return capacity, nil
}

// CheckEngineerCapacity checks if a specific engineer can accept more tickets
func (lb *LoadBalancer) CheckEngineerCapacity(ctx context.Context, engineerID string) (*models.EngineerCapacityCheck, error) {
	eng, err := lb.dispatchRepo.GetEngineer(ctx, engineerID)
	if err != nil {
		return nil, fmt.Errorf("engineer not found: %w", err)
	}

	available := eng.MaxCapacity - eng.CurrentLoad
	utilization := 0.0
	if eng.MaxCapacity > 0 {
		utilization = float64(eng.CurrentLoad) / float64(eng.MaxCapacity) * 100
	}

	return &models.EngineerCapacityCheck{
		EngineerID:  eng.ID,
		CanAccept:   available > 0 && eng.Availability != models.AvailabilityUnavailable,
		CurrentLoad: eng.CurrentLoad,
		MaxCapacity: eng.MaxCapacity,
		Available:   available,
		Utilization: utilization,
	}, nil
}

// GetAvailableEngineers returns engineers that can accept more tickets
func (lb *LoadBalancer) GetAvailableEngineers(ctx context.Context) ([]models.EngineerProfile, error) {
	engineers, err := lb.dispatchRepo.ListEngineers(ctx)
	if err != nil {
		return nil, err
	}

	var available []models.EngineerProfile
	for _, eng := range engineers {
		if eng.Availability != models.AvailabilityUnavailable && eng.CurrentLoad < eng.MaxCapacity {
			available = append(available, eng)
		}
	}

	return available, nil
}

func calculateStdDev(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	var sum float64
	for _, v := range values {
		sum += v
	}
	mean := sum / float64(len(values))

	var sumSqDiff float64
	for _, v := range values {
		diff := v - mean
		sumSqDiff += diff * diff
	}
	return math.Sqrt(sumSqDiff / float64(len(values)))
}
