package service

import (
	"context"
	"fmt"
	"time"

	"orion/workflow-svc-go/internal/ticket/models"
	"orion/go-common/pkg/otel"
	"orion/workflow-svc-go/internal/ticket/repository"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// TransferService handles ticket transfer operations including auto-transfer
type TransferService struct {
	transferRepo repository.TransferRepositoryInterface
	ticketRepo   repository.TicketRepositoryInterface
	dispatchRepo repository.DispatchRepositoryInterface
	suspendRepo  repository.SuspendRepositoryInterface
	config       models.AutoTransferConfig
	logger       *zap.Logger
}

func NewTransferService(
	transferRepo repository.TransferRepositoryInterface,
	ticketRepo repository.TicketRepositoryInterface,
	dispatchRepo repository.DispatchRepositoryInterface,
	suspendRepo repository.SuspendRepositoryInterface,
) *TransferService {
	return &TransferService{
		transferRepo: transferRepo,
		ticketRepo:   ticketRepo,
		dispatchRepo: dispatchRepo,
		suspendRepo:  suspendRepo,
		config:       models.DefaultAutoTransferConfig(),
		logger:       zap.NewNop(),
	}
}

// ManualTransfer transfers a ticket from one engineer to another
func (s *TransferService) ManualTransfer(ctx context.Context, ticketID, tenantID, toEngineerID, initiatedBy, reason string) (*models.TransferRecord, error) {
	_, span := otel.Tracer("orion-ticket-svc").Start(ctx, "TransferService.ManualTransfer")
	defer span.End()

	ticket, err := s.ticketRepo.GetByID(ctx, ticketID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("ticket not found: %w", err)
	}

	// Check max transfers
	transfers, _ := s.transferRepo.ListByTicket(ctx, ticketID)
	if len(transfers) >= s.config.MaxTransfers {
		return nil, fmt.Errorf("ticket %s has reached max transfers (%d)", ticketID, s.config.MaxTransfers)
	}

	// Verify target engineer exists and has capacity
	targetEng, err := s.dispatchRepo.GetEngineer(ctx, toEngineerID)
	if err != nil {
		return nil, fmt.Errorf("target engineer not found: %w", err)
	}
	if targetEng.CurrentLoad >= targetEng.MaxCapacity {
		return nil, fmt.Errorf("engineer %s is at full capacity (%d/%d)", toEngineerID, targetEng.CurrentLoad, targetEng.MaxCapacity)
	}

	fromEngineerID := ticket.AssignedTo

	// Create transfer record
	record := &models.TransferRecord{
		ID:             uuid.New().String(),
		TicketID:       ticketID,
		FromEngineerID: fromEngineerID,
		ToEngineerID:   toEngineerID,
		InitiatedBy:    initiatedBy,
		Reason:         reason,
	}
	if err := s.transferRepo.Create(ctx, record); err != nil {
		return nil, fmt.Errorf("create transfer record: %w", err)
	}

	// Update ticket assignment
	if err := s.ticketRepo.UpdateAssignee(ctx, ticketID, tenantID, toEngineerID); err != nil {
		return nil, fmt.Errorf("update assignee: %w", err)
	}

	// Update engineer loads
	if fromEngineerID != "" {
		s.dispatchRepo.DecrementLoad(ctx, fromEngineerID)
	}
	s.dispatchRepo.IncrementLoad(ctx, toEngineerID)

	// Create dispatch record for the transfer
	s.dispatchRepo.CreateRecord(ctx, &models.DispatchRecord{
		ID:         uuid.New().String(),
		TicketID:   ticketID,
		EngineerID: toEngineerID,
		AssignedBy: initiatedBy,
		Method:     "transfer",
		Reason:     reason,
	})

	return record, nil
}

// CheckAndAutoTransfer checks for tickets that exceed hold time and auto-transfers them
func (s *TransferService) CheckAndAutoTransfer(ctx context.Context, tenantID string) ([]models.TransferRecord, error) {
	_, span := otel.Tracer("orion-ticket-svc").Start(ctx, "TransferService.CheckAndAutoTransfer")
	defer span.End()

	var results []models.TransferRecord

	// Get all tickets that are assigned but not started
	// We check tickets by looking at queue entries and dispatch records
	queueEntries, err := s.dispatchRepo.Dequeue(ctx, 100)
	if err != nil {
		return nil, fmt.Errorf("dequeue: %w", err)
	}

	now := time.Now()

	for _, entry := range queueEntries {
		// Check if ticket has been in queue too long
		maxHold, ok := s.config.NotStarted[entry.Priority]
		if !ok {
			maxHold = s.config.NotStarted["medium"]
		}

		if now.Sub(entry.EnqueuedAt) > maxHold {
			// Try to auto-transfer to least loaded engineer
			transfer, err := s.autoTransferTicket(ctx, entry.TicketID, entry.TenantID, entry.Priority, "timeout")
			if err != nil {
				s.logger.Warn("auto-transfer failed",
					zap.String("ticket_id", entry.TicketID),
					zap.Error(err))
				continue
			}
			if transfer != nil {
				results = append(results, *transfer)
			}
		}
	}

	return results, nil
}

// TransferDueToSuspend transfers all active tickets from a suspended engineer
func (s *TransferService) TransferDueToSuspend(ctx context.Context, suspendID string) ([]models.TransferRecord, error) {
	_, span := otel.Tracer("orion-ticket-svc").Start(ctx, "TransferService.TransferDueToSuspend")
	defer span.End()

	suspend, err := s.suspendRepo.GetByID(ctx, suspendID)
	if err != nil {
		return nil, fmt.Errorf("suspend not found: %w", err)
	}
	if suspend.Status != "active" {
		return nil, fmt.Errorf("suspend %s is not active", suspendID)
	}

	// Get pending tickets for this engineer
	pendingCount, _ := s.suspendRepo.CountPendingByEngineer(ctx, suspend.EngineerID)
	if pendingCount == 0 {
		return nil, nil
	}

	var results []models.TransferRecord

	// If backup engineer is set, transfer to backup
	if suspend.BackupEngineerID != "" {
		backupEng, err := s.dispatchRepo.GetEngineer(ctx, suspend.BackupEngineerID)
		if err == nil && backupEng.CurrentLoad < backupEng.MaxCapacity {
			// Transfer pending tickets to backup
			for i := 0; i < pendingCount && backupEng.CurrentLoad < backupEng.MaxCapacity; i++ {
				transfer := &models.TransferRecord{
					ID:             uuid.New().String(),
					TicketID:       fmt.Sprintf("pending-%s-%d", suspend.EngineerID, i),
					FromEngineerID: suspend.EngineerID,
					ToEngineerID:   suspend.BackupEngineerID,
					InitiatedBy:    "system",
					Reason:         fmt.Sprintf("Auto-transfer due to suspension %s (%s)", suspendID, suspend.Reason),
				}
				if err := s.transferRepo.Create(ctx, transfer); err == nil {
					results = append(results, *transfer)
					backupEng.CurrentLoad++
				}
			}
		}
	}

	return results, nil
}

// GetTransferHistory returns transfer history for a ticket
func (s *TransferService) GetTransferHistory(ctx context.Context, ticketID string) ([]models.TransferRecord, error) {
	return s.transferRepo.ListByTicket(ctx, ticketID)
}

// GetTransferStats returns transfer statistics for a time period
func (s *TransferService) GetTransferStats(ctx context.Context, start, end time.Time) (*models.TransferStats, error) {
	if start.IsZero() {
		start = time.Now().AddDate(0, -1, 0)
	}
	if end.IsZero() {
		end = time.Now()
	}

	rawStats, err := s.transferRepo.GetStats(ctx, start, end)
	if err != nil {
		return nil, err
	}

	stats := &models.TransferStats{
		TotalTransfers: int(rawStats["total_transfers"].(int)),
		ByType:         make(map[models.TransferType]int),
		ByPriority:     make(map[string]int),
	}

	if avg, ok := rawStats["avg_hold_duration_ms"].(float64); ok {
		stats.AvgHoldDuration = avg
	}
	if topReceivers, ok := rawStats["top_receivers"].(map[string]int); ok {
		for eid, count := range topReceivers {
			stats.TopReceivers = append(stats.TopReceivers, models.EngineerTransferCount{
				EngineerID: eid,
				Count:      count,
			})
		}
	}

	return stats, nil
}

// GetMostTransferredTickets returns tickets with the most transfers
func (s *TransferService) GetMostTransferredTickets(ctx context.Context, limit int) ([]string, error) {
	// This would require a more complex query; return empty for now
	// In production, this would query: SELECT ticket_id, COUNT(*) FROM ticket_transfers GROUP BY ticket_id ORDER BY COUNT(*) DESC LIMIT $1
	return nil, nil
}

// autoTransferTicket finds the best available engineer and transfers the ticket
func (s *TransferService) autoTransferTicket(ctx context.Context, ticketID, tenantID, priority, reason string) (*models.TransferRecord, error) {
	engineers, err := s.dispatchRepo.ListEngineers(ctx)
	if err != nil {
		return nil, err
	}

	// Find least loaded available engineer
	var bestEngineer *models.EngineerProfile
	for i, eng := range engineers {
		if eng.Availability == models.AvailabilityUnavailable {
			continue
		}
		if eng.CurrentLoad >= eng.MaxCapacity {
			continue
		}
		if bestEngineer == nil || eng.CurrentLoad < bestEngineer.CurrentLoad {
			bestEngineer = &engineers[i]
		}
	}

	if bestEngineer == nil {
		return nil, fmt.Errorf("no available engineers for auto-transfer")
	}

	return s.ManualTransfer(ctx, ticketID, tenantID, bestEngineer.ID, "system", fmt.Sprintf("Auto-transfer (%s): ticket held too long", reason))
}

// UpdateConfig updates the auto-transfer configuration
func (s *TransferService) UpdateConfig(config models.AutoTransferConfig) {
	s.config = config
}

// GetConfig returns the current auto-transfer configuration
func (s *TransferService) GetConfig() models.AutoTransferConfig {
	return s.config
}
