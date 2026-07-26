package service

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ticketing/models"
	"orion/go-common/pkg/otel"
	"orion/platform-svc-go/internal/ticketing/repository"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

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

func (s *TransferService) ManualTransfer(ctx context.Context, ticketID, tenantID, toEngineerID, initiatedBy, reason string) (*models.TransferRecord, error) {
	_, span := otel.Tracer("orion-ticket-svc").Start(ctx, "TransferService.ManualTransfer")
	defer span.End()
	ticket, err := s.ticketRepo.GetByID(ctx, ticketID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("ticket not found: %w", err)
	}
	transfers, _ := s.transferRepo.ListByTicket(ctx, ticketID)
	if len(transfers) >= s.config.MaxTransfers {
		return nil, fmt.Errorf("ticket %s has reached max transfers (%d)", ticketID, s.config.MaxTransfers)
	}
	targetEng, err := s.dispatchRepo.GetEngineer(ctx, tenantID, toEngineerID)
	if err != nil {
		return nil, fmt.Errorf("target engineer not found: %w", err)
	}
	if targetEng.CurrentLoad >= targetEng.MaxCapacity {
		return nil, fmt.Errorf("engineer %s is at full capacity (%d/%d)", toEngineerID, targetEng.CurrentLoad, targetEng.MaxCapacity)
	}
	fromEngineerID := ticket.AssignedTo
	transferID := uuid.New().String()
	record := &models.TransferRecord{
		ID: transferID, TicketID: ticketID, FromEngineerID: fromEngineerID,
		ToEngineerID: toEngineerID, InitiatedBy: initiatedBy, Reason: reason,
	}
	if err := s.transferRepo.Create(ctx, record); err != nil {
		return nil, fmt.Errorf("create transfer record: %w", err)
	}
	if err := s.ticketRepo.UpdateAssignee(ctx, ticketID, tenantID, toEngineerID); err != nil {
		return nil, fmt.Errorf("update assignee: %w", err)
	}
	if fromEngineerID != "" {
		s.dispatchRepo.DecrementLoad(ctx, fromEngineerID)
	}
	s.dispatchRepo.IncrementLoad(ctx, toEngineerID)
	s.dispatchRepo.CreateRecord(ctx, &models.DispatchRecord{
		ID: uuid.New().String(), TicketID: ticketID, EngineerID: toEngineerID,
		AssignedBy: initiatedBy, Method: "transfer", Reason: reason,
	})
	return record, nil
}

func (s *TransferService) CheckAndAutoTransfer(ctx context.Context, tenantID string) ([]models.TransferRecord, error) {
	_, span := otel.Tracer("orion-ticket-svc").Start(ctx, "TransferService.CheckAndAutoTransfer")
	defer span.End()
	var results []models.TransferRecord
	queueEntries, err := s.dispatchRepo.Dequeue(ctx, 100)
	if err != nil {
		return nil, fmt.Errorf("dequeue: %w", err)
	}
	now := time.Now()
	for _, entry := range queueEntries {
		maxHold, ok := s.config.NotStarted[entry.Priority]
		if !ok {
			maxHold = s.config.NotStarted["medium"]
		}
		if now.Sub(entry.EnqueuedAt) > maxHold {
			transfer, err := s.autoTransferTicket(ctx, entry.TicketID, tenantID, entry.Priority, "timeout")
			if err != nil {
				s.logger.Warn("auto-transfer failed", zap.String("ticket_id", entry.TicketID), zap.Error(err))
				continue
			}
			if transfer != nil {
				results = append(results, *transfer)
			}
		}
	}
	return results, nil
}

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
	pendingCount, _ := s.suspendRepo.CountPendingByEngineer(ctx, suspend.EngineerID)
	if pendingCount == 0 {
		return nil, nil
	}
	var results []models.TransferRecord
	if suspend.BackupEngineerID != "" {
		backupEng, err := s.dispatchRepo.GetEngineer(ctx, "", suspend.BackupEngineerID)
		if err == nil && backupEng.CurrentLoad < backupEng.MaxCapacity {
			for i := 0; i < pendingCount && backupEng.CurrentLoad < backupEng.MaxCapacity; i++ {
				transfer := &models.TransferRecord{
					ID: uuid.New().String(),
					TicketID: fmt.Sprintf("pending-%s-%d", suspend.EngineerID, i),
					FromEngineerID: suspend.EngineerID, ToEngineerID: suspend.BackupEngineerID,
					InitiatedBy: "system",
					Reason: fmt.Sprintf("Auto-transfer due to suspension %s (%s)", suspendID, suspend.Reason),
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

func (s *TransferService) GetTransferHistory(ctx context.Context, ticketID string) ([]models.TransferRecord, error) {
	return s.transferRepo.ListByTicket(ctx, ticketID)
}

func (s *TransferService) GetTransferStats(ctx context.Context, start, end time.Time) (*models.TransferStats, error) {
	if start.IsZero() { start = time.Now().AddDate(0, -1, 0) }
	if end.IsZero() { end = time.Now() }
	rawStats, err := s.transferRepo.GetStats(ctx, start, end)
	if err != nil { return nil, err }
	stats := &models.TransferStats{TotalTransfers: 0, ActiveTransfers: 0, AvgTransfers: 0}
	if total, ok := rawStats["total_transfers"]; ok {
		switch v := total.(type) {
		case int: stats.TotalTransfers = v
		case float64: stats.TotalTransfers = int(v)
		}
	}
	if avg, ok := rawStats["avg_hold_duration_ms"]; ok {
		switch v := avg.(type) {
		case float64: stats.AvgTransfers = v
		case int: stats.AvgTransfers = float64(v)
		}
	}
	return stats, nil
}

func (s *TransferService) GetMostTransferredTickets(ctx context.Context, limit int) ([]string, error) {
	return nil, nil
}

func (s *TransferService) autoTransferTicket(ctx context.Context, ticketID, tenantID, priority, reason string) (*models.TransferRecord, error) {
	engineers, err := s.dispatchRepo.ListEngineers(ctx, tenantID)
	if err != nil { return nil, err }
	var bestEngineer *models.DispatchEngineer
	for i := range engineers {
		eng := &engineers[i]
		if eng.Availability == models.AvailabilityUnavailable { continue }
		if eng.CurrentLoad >= eng.MaxCapacity { continue }
		if bestEngineer == nil || eng.CurrentLoad < bestEngineer.CurrentLoad { bestEngineer = eng }
	}
	if bestEngineer == nil { return nil, fmt.Errorf("no available engineers for auto-transfer") }
	return s.ManualTransfer(ctx, ticketID, tenantID, bestEngineer.ID, "system", fmt.Sprintf("Auto-transfer (%s): ticket held too long", reason))
}

func (s *TransferService) UpdateConfig(config models.AutoTransferConfig) { s.config = config }
func (s *TransferService) GetConfig() models.AutoTransferConfig { return s.config }
