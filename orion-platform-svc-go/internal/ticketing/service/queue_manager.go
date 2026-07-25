package service

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"

	"orion/platform-svc-go/internal/ticketing/models"
	"orion/platform-svc-go/internal/ticketing/repository"

	"go.uber.org/zap"
)

// QueueManager provides SLA-aware dispatch queue management
type QueueManager struct {
	dispatchRepo repository.DispatchRepositoryInterface
	slaRepo      repository.SLARepositoryInterface
	logger       *zap.Logger
}

func NewQueueManager(dispatchRepo repository.DispatchRepositoryInterface, slaRepo repository.SLARepositoryInterface) *QueueManager {
	return &QueueManager{
		dispatchRepo: dispatchRepo,
		slaRepo:      slaRepo,
		logger:       zap.NewNop(),
	}
}

// GetSLAQueueStatus returns queue status with SLA-aware entries
func (qm *QueueManager) GetSLAQueueStatus(ctx context.Context) (*models.DispatchQueueStatus, error) {
	return qm.dispatchRepo.GetQueueStatus(ctx)
}

// GetSLAQueueEntries returns queue entries with SLA priority scoring
func (qm *QueueManager) GetSLAQueueEntries(ctx context.Context) ([]models.SLAQueueEntry, error) {
	entries, err := qm.dispatchRepo.Dequeue(ctx, 100)
	if err != nil {
		return nil, err
	}

	var slaEntries []models.SLAQueueEntry
	now := time.Now()

	for _, entry := range entries {
		slaEntry := models.SLAQueueEntry{
			DispatchQueueEntry: entry,
		}

		// Calculate SLA priority
		slaEntry.SLAPriority = qm.calculateSLAPriority(entry, now)
		slaEntry.Age = formatDuration(now.Sub(entry.EnqueuedAt))

		// Get SLA deadline if available
		slaEntry.IsBreached = now.Sub(entry.EnqueuedAt) > 24*time.Hour
		if slaEntry.IsBreached {
			slaEntry.SLAStatus = "breached"
		} else {
			slaEntry.SLAStatus = "active"
		}

		slaEntries = append(slaEntries, slaEntry)
	}

	// Sort by SLA priority (highest first)
	sort.Slice(slaEntries, func(i, j int) bool {
		return slaEntries[i].SLAPriority > slaEntries[j].SLAPriority
	})

	return slaEntries, nil
}

// GetSLAAlerts returns alerts for tickets at risk of SLA breach
func (qm *QueueManager) GetSLAAlerts(ctx context.Context, alertType string, limit int) ([]models.QueueAlert, error) {
	entries, err := qm.GetSLAQueueEntries(ctx)
	if err != nil {
		return nil, err
	}

	var alerts []models.QueueAlert
	now := time.Now()

	for _, entry := range entries {
		elapsed := now.Sub(entry.EnqueuedAt)
		percent := math.Min(elapsed.Hours()/24.0*100, 100)

		alert := models.QueueAlert{
			Type:      models.SLAAlertType(""),
			Message:   fmt.Sprintf("Ticket %s: %.0f%% elapsed", entry.TicketID, percent),
			CreatedAt: now,
		}

		alerts = append(alerts, alert)

		if limit > 0 && len(alerts) >= limit {
			break
		}
	}

	return alerts, nil
}

// ReprioritizeAll recalculates priority for all queue entries
func (qm *QueueManager) ReprioritizeAll(ctx context.Context) (int, error) {
	entries, err := qm.dispatchRepo.Dequeue(ctx, 1000)
	if err != nil {
		return 0, err
	}

	now := time.Now()
	reprioritized := 0

	for _, entry := range entries {
		newPriority := qm.calculateSLAPriority(entry, now)
		// In a full implementation, we'd update the queue entry's priority
		// For now, we just count what would be reprioritized
		if newPriority > 0 {
			reprioritized++
		}
	}

	return reprioritized, nil
}

// calculateSLAPriority computes a priority score for a queue entry
func (qm *QueueManager) calculateSLAPriority(entry models.DispatchQueueEntry, now time.Time) float64 {
	baseScore := priorityToScore(entry.Priority)

	// Age boost: older tickets get higher priority
	ageHours := now.Sub(entry.EnqueuedAt).Hours()
	ageBoost := math.Min(ageHours/24.0, 2.0) // max 2.0 boost

	// Attempt boost: tickets with more failed attempts get priority
	attemptBoost := float64(0) * 0.5

	return baseScore + ageBoost + attemptBoost
}

func priorityToScore(priority string) float64 {
	switch priority {
	case "critical":
		return 10.0
	case "high":
		return 7.0
	case "medium":
		return 4.0
	case "low":
		return 1.0
	default:
		return 4.0
	}
}

func formatDuration(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	}
	if d < time.Hour {
		return fmt.Sprintf("%dm", int(d.Minutes()))
	}
	if d < 24*time.Hour {
		return fmt.Sprintf("%dh", int(d.Hours()))
	}
	return fmt.Sprintf("%dd", int(d.Hours()/24))
}
