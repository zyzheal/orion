package service

import (
	"context"
	"time"

	"orion-ticket-svc-go/internal/models"
	"orion-ticket-svc-go/internal/otel"
	"orion-ticket-svc-go/internal/repository"

	"github.com/google/uuid"
)

type AnalyticsService struct {
	analyticsRepo *repository.AnalyticsRepository
	dispatchRepo  *repository.DispatchRepository
	slaRepo       *repository.SLARepository
	transferRepo  *repository.TransferRepository
	ticketRepo    *repository.TicketRepository
}

func NewAnalyticsService(
	analyticsRepo *repository.AnalyticsRepository,
	dispatchRepo *repository.DispatchRepository,
	slaRepo *repository.SLARepository,
	transferRepo *repository.TransferRepository,
	ticketRepo *repository.TicketRepository,
) *AnalyticsService {
	return &AnalyticsService{
		analyticsRepo: analyticsRepo,
		dispatchRepo:  dispatchRepo,
		slaRepo:       slaRepo,
		transferRepo:  transferRepo,
		ticketRepo:    ticketRepo,
	}
}

// GetStatistics returns overall ticket statistics
func (s *AnalyticsService) GetStatistics(ctx context.Context, tenantID string) (*models.TicketStatistics, error) {
	_, span := otel.Tracer().Start(ctx, "AnalyticsService.GetStatistics")
	defer span.End()
	return s.analyticsRepo.GetTicketStats(tenantID)
}

// GetResolutionStats returns resolution statistics
func (s *AnalyticsService) GetResolutionStats(ctx context.Context, tenantID string) (*models.ResolutionStats, error) {
	return s.analyticsRepo.GetResolutionStats(tenantID)
}

// GetBacklogAnalysis returns backlog analysis
func (s *AnalyticsService) GetBacklogAnalysis(ctx context.Context, tenantID string) (*models.BacklogAnalysis, error) {
	return s.analyticsRepo.GetBacklogAnalysis(tenantID)
}

// GetTrendReport returns trend data
func (s *AnalyticsService) GetTrendReport(ctx context.Context, tenantID string, days int, granularity string) (*models.TrendReport, error) {
	if days <= 0 {
		days = 30
	}
	if granularity == "" {
		granularity = "day"
	}

	dataPoints, err := s.analyticsRepo.GetTrendData(tenantID, days, granularity)
	if err != nil {
		return nil, err
	}

	report := &models.TrendReport{
		Days:        days,
		Granularity: granularity,
		DataPoints:  dataPoints,
		Summary: models.TrendSummary{
			TotalCreated: len(dataPoints),
		},
	}

	// Determine trend direction
	if len(dataPoints) >= 2 {
		first := dataPoints[0].Value
		last := dataPoints[len(dataPoints)-1].Value
		if last > first*1.1 {
			report.Summary.Trend = "increasing"
		} else if last < first*0.9 {
			report.Summary.Trend = "decreasing"
		} else {
			report.Summary.Trend = "stable"
		}
		if first > 0 {
			report.Summary.ChangeRate = (last - first) / first * 100
		}
	}

	return report, nil
}

// GetExecutiveDashboard returns the executive dashboard
func (s *AnalyticsService) GetExecutiveDashboard(ctx context.Context, tenantID string, start, end time.Time) (*models.ExecutiveDashboard, error) {
	_, span := otel.Tracer().Start(ctx, "AnalyticsService.GetExecutiveDashboard")
	defer span.End()

	if start.IsZero() {
		start = time.Now().AddDate(0, -1, 0)
	}
	if end.IsZero() {
		end = time.Now()
	}

	return s.analyticsRepo.GetExecutiveDashboard(tenantID, start, end)
}

// GetManagerDashboard returns the manager dashboard
func (s *AnalyticsService) GetManagerDashboard(ctx context.Context, tenantID string, start, end time.Time) (*models.ManagerDashboard, error) {
	if start.IsZero() {
		start = time.Now().AddDate(0, -1, 0)
	}
	if end.IsZero() {
		end = time.Now()
	}

	stats, _ := s.analyticsRepo.GetTicketStats(tenantID)
	trendData, _ := s.analyticsRepo.GetTrendData(tenantID, int(end.Sub(start).Hours()/24), "day")

	return &models.ManagerDashboard{
		PeriodStart:     start,
		PeriodEnd:       end,
		TeamTickets:     stats.TotalTickets,
		TeamOpenTickets: stats.OpenTickets,
		TrendData:       trendData,
	}, nil
}

// GetEngineerDashboard returns an engineer's dashboard
func (s *AnalyticsService) GetEngineerDashboard(ctx context.Context, engineerID string, start, end time.Time) (*models.EngineerDashboard, error) {
	if start.IsZero() {
		start = time.Now().AddDate(0, -1, 0)
	}
	if end.IsZero() {
		end = time.Now()
	}

	eng, err := s.dispatchRepo.GetEngineer(engineerID)
	if err != nil {
		return nil, err
	}

	return &models.EngineerDashboard{
		EngineerID:      engineerID,
		PeriodStart:     start,
		PeriodEnd:       end,
		ResolvedTickets: eng.TotalResolved,
		AvgResolutionMs: eng.AvgResolutionMs,
		SLACompliance:   eng.SLACompliance,
	}, nil
}

// GetEfficiencyScore returns an engineer's efficiency score
func (s *AnalyticsService) GetEfficiencyScore(ctx context.Context, engineerID string, start, end time.Time) (*models.EfficiencyScore, error) {
	eng, err := s.dispatchRepo.GetEngineer(engineerID)
	if err != nil {
		return nil, err
	}

	// Compute score from components
	components := map[string]float64{
		"resolution_speed": eng.AvgResolutionMs,
		"sla_compliance":   eng.SLACompliance,
		"success_rate":     eng.SuccessRate,
	}

	score := (eng.SLACompliance + eng.SuccessRate) / 2
	grade := "F"
	switch {
	case score >= 90:
		grade = "A"
	case score >= 80:
		grade = "B"
	case score >= 70:
		grade = "C"
	case score >= 60:
		grade = "D"
	}

	return &models.EfficiencyScore{
		EngineerID:  engineerID,
		Score:       score,
		Grade:       grade,
		Components:  components,
		PeriodStart: start,
		PeriodEnd:   end,
	}, nil
}

// ComparePeriods compares metrics between two time periods
func (s *AnalyticsService) ComparePeriods(ctx context.Context, tenantID string, currentStart, currentEnd, previousStart, previousEnd time.Time) (*models.PeriodComparison, error) {
	currentStats, _ := s.analyticsRepo.GetTicketStats(tenantID)
	// For a proper comparison we'd need per-period queries; simplified here
	current := models.PeriodStats{
		PeriodStart:     currentStart,
		PeriodEnd:       currentEnd,
		TotalTickets:    currentStats.TotalTickets,
		ResolvedTickets: currentStats.ResolvedTickets,
		AvgResolutionMs: currentStats.AvgResolutionMs,
	}

	previous := models.PeriodStats{
		PeriodStart: previousStart,
		PeriodEnd:   previousEnd,
	}

	delta := models.PeriodDelta{
		TicketsDelta: current.TotalTickets - previous.TotalTickets,
	}
	if previous.TotalTickets > 0 {
		delta.TicketsDeltaPct = float64(delta.TicketsDelta) / float64(previous.TotalTickets) * 100
	}

	return &models.PeriodComparison{
		Current:  current,
		Previous: previous,
		Delta:    delta,
	}, nil
}

// ExportBIData exports BI data for a dataset
func (s *AnalyticsService) ExportBIData(ctx context.Context, tenantID, dataset, granularity string, start, end time.Time) (map[string]any, error) {
	result := make(map[string]any)
	result["dataset"] = dataset
	result["granularity"] = granularity
	result["period_start"] = start
	result["period_end"] = end

	switch dataset {
	case "tickets":
		stats, _ := s.analyticsRepo.GetTicketStats(tenantID)
		result["data"] = stats
	case "sla":
		report, _ := s.slaRepo.GetComplianceReport(start, end)
		result["data"] = report
	case "dispatch":
		metrics, _ := s.dispatchRepo.GetMetrics(start, end)
		result["data"] = metrics
	case "efficiency":
		engineers, _ := s.dispatchRepo.ListEngineers()
		result["data"] = engineers
	}

	return result, nil
}

// GetTimeTrend returns time trend data for a metric
func (s *AnalyticsService) GetTimeTrend(ctx context.Context, tenantID, metric string, start, end time.Time, granularity string) ([]models.TrendPoint, error) {
	if start.IsZero() {
		start = time.Now().AddDate(0, -1, 0)
	}
	if end.IsZero() {
		end = time.Now()
	}
	if granularity == "" {
		granularity = "day"
	}

	days := int(end.Sub(start).Hours() / 24)
	if days <= 0 {
		days = 30
	}

	return s.analyticsRepo.GetTrendData(tenantID, days, granularity)
}

// Transfer operations

// TransferTicket transfers a ticket between engineers
func (s *AnalyticsService) TransferTicket(ctx context.Context, ticketID, tenantID, toEngineerID, initiatedBy, reason string) (*models.TransferRecord, int64, error) {
	_, span := otel.Tracer().Start(ctx, "AnalyticsService.TransferTicket")
	defer span.End()

	// Get current ticket
	ticket, err := s.ticketRepo.GetByID(ticketID, tenantID)
	if err != nil {
		return nil, 0, err
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

	if err := s.transferRepo.Create(record); err != nil {
		return nil, 0, err
	}

	return record, 0, nil
}

// GetTransferHistory returns transfer history for a ticket
func (s *AnalyticsService) GetTransferHistory(ctx context.Context, ticketID string) ([]models.TransferRecord, error) {
	return s.transferRepo.ListByTicket(ticketID)
}

// GetTransferStats returns transfer statistics
func (s *AnalyticsService) GetTransferStats(ctx context.Context, start, end time.Time) (map[string]any, error) {
	if start.IsZero() {
		start = time.Now().AddDate(0, -1, 0)
	}
	if end.IsZero() {
		end = time.Now()
	}
	return s.transferRepo.GetStats(start, end)
}
