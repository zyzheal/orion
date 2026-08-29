package adapter

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"orion/platform-svc-go/internal/crossover/models"
	crossover_repo "orion/platform-svc-go/internal/crossover/repository"
	"orion/platform-svc-go/internal/crossover/service"
)

// RepositoryAdapter bridges the SQL-backed Repository (CallRecord)
// with the service.RepositoryInterface (CrossoverCall).
type RepositoryAdapter struct {
	repo *crossover_repo.Repository
}

func NewRepositoryAdapter(repo *crossover_repo.Repository) *RepositoryAdapter {
	return &RepositoryAdapter{repo: repo}
}

func (a *RepositoryAdapter) Create(ctx context.Context, call *models.CrossoverCall) error {
	record := &crossover_repo.CallRecord{
		ID:           call.ID,
		TenantID:     call.TenantID,
		SourceDomain: call.SourceModule,
		TargetDomain: call.TargetModule,
		Method:       call.Operation,
		Payload:      crossover_repo.JSONB(call.Parameters),
		Status:       call.Status,
		CreatedAt:    call.CreatedAt,
		UpdatedAt:    call.UpdatedAt,
	}
	if call.Result != nil {
		b, err := json.Marshal(call.Result)
		if err == nil {
			var resultMap map[string]interface{}
			json.Unmarshal(b, &resultMap)
			record.Response = crossover_repo.JSONB(resultMap)
		}
	}
	return a.repo.CreateCall(ctx, record)
}

func (a *RepositoryAdapter) Get(ctx context.Context, tenantID, id string) (*models.CrossoverCall, error) {
	uuidVal, err := uuid.Parse(id)
	if err != nil {
		return nil, err
	}
	record, err := a.repo.GetCall(ctx, tenantID, uuidVal)
	if err != nil {
		return nil, err
	}
	return fromCallRecord(record), nil
}

func (a *RepositoryAdapter) UpdateResult(ctx context.Context, tenantID, id string, result *models.CallResultObj) error {
	uuidVal, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	status := "succeeded"
	if result != nil && result.Error != "" {
		status = "failed"
	}
	return a.repo.UpdateStatus(ctx, tenantID, uuidVal, status)
}

func (a *RepositoryAdapter) List(ctx context.Context, tenantID string, opts *service.ListOptions) ([]models.CrossoverCall, error) {
	filter := crossover_repo.CallFilter{TenantID: tenantID}
	if opts != nil {
		filter.Offset = opts.Offset
		filter.Limit = opts.Limit
		if filter.Limit == 0 {
			filter.Limit = 20
		}
	}
	records, err := a.repo.ListCalls(ctx, filter)
	if err != nil {
		return nil, err
	}
	return recordsToCalls(records), nil
}

func (a *RepositoryAdapter) ListByTarget(ctx context.Context, tenantID, targetModule string, opts *service.ListOptions) ([]models.CrossoverCall, error) {
	filter := crossover_repo.CallFilter{TenantID: tenantID, TargetDomain: targetModule}
	if opts != nil {
		filter.Offset = opts.Offset
		filter.Limit = opts.Limit
		if filter.Limit == 0 {
			filter.Limit = 20
		}
	}
	records, err := a.repo.ListCalls(ctx, filter)
	if err != nil {
		return nil, err
	}
	return recordsToCalls(records), nil
}

func (a *RepositoryAdapter) Delete(ctx context.Context, tenantID, id string) error {
	uuidVal, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	return a.repo.DeleteCall(ctx, tenantID, uuidVal)
}

func fromCallRecord(rec *crossover_repo.CallRecord) *models.CrossoverCall {
	call := &models.CrossoverCall{
		ID:           rec.ID,
		TenantID:     rec.TenantID,
		SourceModule: rec.SourceDomain,
		TargetModule: rec.TargetDomain,
		Operation:    rec.Method,
		Parameters:   models.CallParameters(rec.Payload),
		Status:       rec.Status,
		CreatedAt:    rec.CreatedAt,
		UpdatedAt:    rec.UpdatedAt,
	}
	if rec.Response != nil {
		call.Result = &models.CallResultObj{
			Value:  map[string]interface{}(rec.Response),
			DoneAt: rec.UpdatedAt,
		}
	}
	return call
}

func recordsToCalls(records []crossover_repo.CallRecord) []models.CrossoverCall {
	calls := make([]models.CrossoverCall, len(records))
	for i := range records {
		calls[i] = *fromCallRecord(&records[i])
	}
	return calls
}

var _ service.RepositoryInterface = (*RepositoryAdapter)(nil)
