package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"strconv"
	"time"

	"orion/platform-svc-go/internal/digital-twin-simulation/models"
	dt_repo "orion/platform-svc-go/internal/digital-twin-simulation/repository"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreateSimulation(ctx context.Context, tenantID string, sim models.Simulation) (*models.Simulation, error)
	CreateState(ctx context.Context, state models.TwinState) (*models.TwinState, error)
	CreateTwin(ctx context.Context, tenantID string, req models.CreateTwinRequest) (*models.DigitalTwin, error)
	DeleteTwin(ctx context.Context, tenantID, id string) error
	FindTwinByID(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error)
	GetLatestState(ctx context.Context, twinID string) (*models.TwinState, error)
	ListSimulations(ctx context.Context, twinID string, q models.ListQuery) ([]models.Simulation, int64, error)
	ListTwins(ctx context.Context, tenantID string, q models.ListQuery) ([]models.DigitalTwin, int64, error)
	UpdateSimulation(ctx context.Context, id string, status string, endTime *int64, duration *int64, results models.JSON) (*models.Simulation, error)
	UpdateTwin(ctx context.Context, tenantID, id string, req models.UpdateTwinRequest) (*models.DigitalTwin, error)
	UpdateTwinStatusAndSync(ctx context.Context, tenantID, id string, status string, lastSync *int64, updatedAt int64) (*models.DigitalTwin, error)
}

// Service orchestrates Digital Twin simulation business logic.
type Service struct {
	repo    RepositoryInterface
	clock   func() int64
	randSrc *rand.Rand
}

// NewService constructs the service.
func NewService(repo RepositoryInterface) *Service {
	return &Service{
		repo:    repo,
		clock:   func() int64 { return time.Now().Unix() },
		randSrc: rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// --- CRUD ---

func (s *Service) CreateTwin(ctx context.Context, tenantID string, req models.CreateTwinRequest) (*models.DigitalTwin, error) {
	// Apply defaults for config and syncPolicy if not provided.
	cfg := models.JSON(json.RawMessage(fmt.Sprintf(`%v`, defaultTwinConfig(req.Config))))
	syncP := models.JSON(json.RawMessage(fmt.Sprintf(`%v`, defaultSyncPolicy(req.SyncPolicy))))
	var err error
	if req.Config == nil {
		c, e := json.Marshal(defaultTwinConfig(nil))
		if e != nil {
			return nil, e
		}
		cfg = models.JSON(c)
	}
	if req.SyncPolicy == nil {
		s, e := json.Marshal(defaultSyncPolicy(nil))
		if e != nil {
			return nil, e
		}
		syncP = models.JSON(s)
	}
	metadata := models.JSON([]byte("{}"))
	if req.Metadata != nil {
		metadata = *req.Metadata
	}
	updatedReq := req
	updatedReq.Config = &cfg
	updatedReq.SyncPolicy = &syncP
	updatedReq.Metadata = &metadata
	twin, err := s.repo.CreateTwin(ctx, tenantID, updatedReq)
	if err != nil {
		return nil, err
	}
	// Initialize state.
	_, _ = s.initState(ctx, twin.ID)
	return twin, nil
}

func (s *Service) ListTwins(ctx context.Context, tenantID string, q models.ListQuery) ([]models.DigitalTwin, int64, error) {
	if q.Offset < 0 {
		q.Offset = 0
	}
	items, total, err := s.repo.ListTwins(ctx, tenantID, q)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (s *Service) GetTwin(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error) {
	twin, err := s.repo.FindTwinByID(ctx, tenantID, id)
	if err != nil {
		return nil, dt_repo.ErrNotFoundMsg("digital twin not found")
	}
	return twin, nil
}

func (s *Service) UpdateTwin(ctx context.Context, tenantID, id string, req models.UpdateTwinRequest) (*models.DigitalTwin, error) {
	// Build JSON payloads for any provided fields.
	if req.Config != nil {
		merged := mergeJSONWithDefaults(req.Config, defaultTwinConfig(nil))
		j := models.JSON(merged)
		req.Config = &j
	}
	if req.SyncPolicy != nil {
		merged := mergeJSONWithDefaults(req.SyncPolicy, defaultSyncPolicy(nil))
		j := models.JSON(merged)
		req.SyncPolicy = &j
	}
	_, err := s.GetTwin(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	return s.repo.UpdateTwin(ctx, tenantID, id, req)
}

func (s *Service) DeleteTwin(ctx context.Context, tenantID, id string) error {
	_, err := s.GetTwin(ctx, tenantID, id)
	if err != nil {
		return err
	}
	return s.repo.DeleteTwin(ctx, tenantID, id)
}

// --- Sync ---

func (s *Service) SyncTwin(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error) {
	_, err := s.GetTwin(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	// Set syncing.
	updatedAt := s.clock()
	_, err = s.repo.UpdateTwinStatusAndSync(ctx, tenantID, id, models.TwinStatusSyncing, nil, updatedAt)
	if err != nil {
		return nil, err
	}
	// Generate and persist state.
	state := s.generateState(id)
	_, _ = s.repo.CreateState(ctx, state)
	// Set active with last sync.
	now := s.clock()
	twin, err := s.repo.UpdateTwinStatusAndSync(ctx, tenantID, id, models.TwinStatusActive, &now, now)
	if err != nil {
		return nil, err
	}
	return twin, nil
}

// --- State ---

func (s *Service) GetState(ctx context.Context, twinID string) (*TwinStateResponse, error) {
	st, err := s.repo.GetLatestState(ctx, twinID)
	if err != nil {
		return nil, err
	}
	return twinStateToResponse(st), nil
}

// --- Simulate ---

func (s *Service) Simulate(ctx context.Context, tenantID, twinID string, req models.SimulateRequest) (*models.Simulation, error) {
	_, err := s.GetTwin(ctx, tenantID, twinID)
	if err != nil {
		return nil, err
	}
	now := s.clock()
	params, err := json.Marshal(req.Parameters)
	if err != nil {
		return nil, err
	}
	paramsJSON := models.JSON(params)
	dur := req.Duration
	if dur == nil {
		d := int64(60000)
		dur = &d
	}
	sim := models.Simulation{
		ID:          "sim_" + strconv.FormatInt(s.clock(), 10) + "_" + strconv.Itoa(s.randSrc.Intn(10000)),
		TenantID:    tenantID,
		TwinID:      twinID,
		Type:        req.Type,
		Name:        req.Name,
		Description: req.Description,
		Parameters:  paramsJSON,
		Status:      models.SimulationStatusRunning,
		StartTime:   now,
		Duration:    dur,
	}
	simPtr, err := s.repo.CreateSimulation(ctx, tenantID, sim)
	if err != nil {
		return nil, err
	}
	// Set simulating.
	_, err = s.repo.UpdateTwinStatusAndSync(ctx, tenantID, twinID, models.TwinStatusSimulating, nil, s.clock())
	if err != nil {
		return simPtr, err // partial success, still return simulation
	}
	// Complete simulation.
	endTime := s.clock()
	results := s.generateSimulationResults(req.Type)
	resultsJSON, err := json.Marshal(results)
	if err != nil {
		return simPtr, err
	}
	resultsJ := models.JSON(resultsJSON)
	simPtr, err = s.repo.UpdateSimulation(ctx, simPtr.ID, models.SimulationStatusCompleted, &endTime, dur, resultsJ)
	if err != nil {
		return simPtr, err
	}
	// Reset twin to active.
	_, err = s.repo.UpdateTwinStatusAndSync(ctx, tenantID, twinID, models.TwinStatusActive, nil, s.clock())
	if err != nil {
		return simPtr, err
	}
	return simPtr, nil
}

// --- Simulation History ---

func (s *Service) ListSimulations(ctx context.Context, twinID string, q models.ListQuery) ([]models.Simulation, int64, error) {
	if q.Offset < 0 {
		q.Offset = 0
	}
	sims, total, err := s.repo.ListSimulations(ctx, twinID, q)
	if err != nil {
		return nil, 0, err
	}
	return sims, total, err
}

// --- Comparison ---

func (s *Service) GetComparison(ctx context.Context, twinID string) (*TwinComparison, error) {
	state, err := s.repo.GetLatestState(ctx, twinID)
	if err != nil {
		return nil, dt_repo.ErrNotFoundMsg("twin state not found")
	}
	_ = ctx
	resources := parseJSONFloatMap(state.Resources)
	performance := parseJSONFloatMap(state.Performance)
	metrics := []ComparisonMetric{
		{Name: "cpu", RealValue: 65, TwinValue: resources["cpu"], Unit: "%"},
		{Name: "memory", RealValue: 78, TwinValue: resources["memory"], Unit: "%"},
		{Name: "throughput", RealValue: 1200, TwinValue: performance["throughput"], Unit: "req/s"},
		{Name: "latency", RealValue: 45, TwinValue: performance["latency"], Unit: "ms"},
	}
	overallAccuracy := 0.0
	for i := range metrics {
		if metrics[i].TwinValue == 0 {
			metrics[i].TwinValue = metrics[i].RealValue
		}
		metrics[i].Deviation = metrics[i].RealValue - metrics[i].TwinValue
		if metrics[i].Deviation < 0 {
			metrics[i].Deviation = -metrics[i].Deviation
		}
		if metrics[i].RealValue > 0 {
			metrics[i].Accuracy = 100 - (metrics[i].Deviation/metrics[i].RealValue)*100
		}
		overallAccuracy += metrics[i].Accuracy
	}
	overallAccuracy /= float64(len(metrics))
	discrepancies := []Discrepancy{}
	_ = discrepancies
	for _, m := range metrics {
		if m.Deviation > 5 {
			discrepancies = append(discrepancies, Discrepancy{
				Metric:         m.Name,
				Deviation:      m.Deviation,
				Cause:          "数据采集延迟或模型精度不足",
				Recommendation: "调整更新频率或提高模型精度",
			})
		}
	}
	return &TwinComparison{
		TwinID:          twinID,
		Timestamp:       s.clock(),
		Metrics:         metrics,
		OverallAccuracy: overallAccuracy,
		Discrepancies:   discrepancies,
	}, nil
}

// --- Predict ---

func (s *Service) Predict(ctx context.Context, twinID string, req models.PredictRequest) (*PredictionResult, error) {
	_ = ctx
	metrics := req.Metrics
	if metrics == nil || len(*metrics) == 0 {
		m := []string{"cpu", "memory", "throughput", "latency"}
		metrics = &m
	}
	now := time.Now().UnixMilli()
	predictions := make([]PredictionSeries, len(*metrics))
	for i, metric := range *metrics {
		baseValue := 50.0 + float64(s.randSrc.Intn(3000))/100.0
		values := make([]PredictionValue, 7)
		for j := 0; j < 7; j++ {
			timestamp := now + int64(j+1)*24*60*60*1000
			predicted := baseValue + float64(s.randSrc.Intn(2000))/100.0*float64(j+1)
			confidence := 0.9 - 0.05*float64(j+1)
			values[j] = PredictionValue{
				Timestamp:  timestamp,
				Predicted:  predicted,
				Confidence: confidence,
				LowerBound: predicted * (1 - (1-confidence)/2),
				UpperBound: predicted * (1 + (1-confidence)/2),
			}
		}
		trend := models.TrendStable
		if len(values) > 1 && values[len(values)-1].Predicted > baseValue {
			trend = models.TrendIncreasing
		}
		anomalyProb := float64(s.randSrc.Intn(1000)) / 10000.0
		predictions[i] = PredictionSeries{
			Metric:             metric,
			Values:             values,
			Trend:              trend,
			AnomalyProbability: anomalyProb,
		}
	}
	warnings := []string{}
	for _, p := range predictions {
		if p.AnomalyProbability > 0.05 {
			warnings = append(warnings, "部分指标存在异常风险，建议关注")
			break
		}
	}
	return &PredictionResult{
		TwinID:         twinID,
		PredictionType: req.PredictionType,
		Timestamp:      s.clock(),
		ForecastPeriod: req.ForecastPeriod,
		Predictions:    predictions,
		Confidence:     0.85,
		Assumptions: []string{
			"假设当前负载模式保持稳定",
			"假设没有重大配置变更",
			"假设硬件资源不受限",
		},
		Warnings: warnings,
	}, nil
}

// --- Internal helpers ---

func (s *Service) initState(ctx context.Context, twinID string) (*models.TwinState, error) {
	state := s.generateState(twinID)
	return s.repo.CreateState(ctx, state)
}

func (s *Service) generateState(twinID string) models.TwinState {
	_ = twinID
	cpu := 40 + s.randSrc.Float64()*30
	mem := 50 + s.randSrc.Float64()*30
	storage := 30 + s.randSrc.Float64()*20
	network := 20 + s.randSrc.Float64()*40
	throughput := 800 + s.randSrc.Float64()*400
	latency := 30 + s.randSrc.Float64()*50
	errorRate := s.randSrc.Float64() * 0.05
	availability := 0.99 + s.randSrc.Float64()*0.01
	return models.TwinState{
		TwinID:       twinID,
		Timestamp:    s.clock(),
		Status:       models.TwinStatusActive,
		Resources:    models.JSON([]byte(fmt.Sprintf(`{"cpu":%.1f,"memory":%.1f,"storage":%.1f,"network":%.1f}`, cpu, mem, storage, network))),
		Performance:  models.JSON([]byte(fmt.Sprintf(`{"throughput":%.1f,"latency":%.1f,"errorRate":%.4f,"availability":%.4f}`, throughput, latency, errorRate, availability))),
		Dependencies: models.JSON([]byte(`[{"name":"database","health":"healthy"},{"name":"cache","health":"healthy"},{"name":"api-gateway","health":"healthy"}]`)),
		Events:       models.JSON([]byte("[]")),
	}
}

func (s *Service) generateSimulationResults(simType string) SimulationResult {
	success := s.randSrc.Float64() > 0.2
	metrics := []SimResultMetric{
		{Name: "throughput", Baseline: 1000, Simulated: 1200, Unit: "req/s"},
		{Name: "latency", Baseline: 50, Simulated: 40, Unit: "ms"},
		{Name: "cpu", Baseline: 60, Simulated: 75, Unit: "%"},
		{Name: "memory", Baseline: 70, Simulated: 85, Unit: "%"},
	}
	for i := range metrics {
		metrics[i].Delta = metrics[i].Simulated - metrics[i].Baseline
	}
	risks := []SimResultRisk{
		{
			Description: "资源使用可能超出阈值",
			Probability: 0.3,
			Impact:      models.RiskImpactMedium,
			Mitigation:  "增加资源配置或优化性能",
		},
	}
	recommendations := []string{
		"建议在实施前进行小规模测试",
		"监控关键指标变化",
		"准备回滚方案",
	}
	var latencyImprovement float64
	if metrics[1].Delta < 0 {
		latencyImprovement = -metrics[1].Delta
	}
	var throughputImprovement float64
	if metrics[0].Delta > 0 {
		throughputImprovement = metrics[0].Delta
	}
	insights := []string{
		fmt.Sprintf("%s 模拟完成", simType),
		fmt.Sprintf("吞吐量提升 %.0f req/s", throughputImprovement),
		fmt.Sprintf("延迟降低 %.0f ms", latencyImprovement),
	}
	return SimulationResult{
		Success:         success,
		Metrics:         metrics,
		Insights:        insights,
		Risks:           risks,
		Recommendations: recommendations,
		Visualizations: []SimVisualization{
			{
				Type: "chart",
				Data: map[string]any{
					"metrics": func() []ginH {
						out := make([]ginH, len(metrics))
						for i, m := range metrics {
							out[i] = ginH{"name": m.Name, "values": []float64{m.Baseline, m.Simulated}}
						}
						return out
					}(),
				},
			},
		},
	}
}

func defaultTwinConfig(provided *models.JSON) map[string]any {
	cfg := map[string]any{
		"modelType":       models.ModelTypeDynamic,
		"updateFrequency": 60000,
		"precision":       models.PrecisionMedium,
		"components":      []any{},
		"dataSource": map[string]any{
			"type":      models.DataSourceTypeHybrid,
			"endpoints": []string{},
			"metrics":   []string{"cpu", "memory", "latency", "throughput"},
		},
	}
	if provided != nil {
		_ = json.Unmarshal(*provided, &cfg)
	}
	return cfg
}

func defaultSyncPolicy(provided *models.JSON) map[string]any {
	policy := map[string]any{
		"autoSync":         true,
		"interval":         30000,
		"fullSyncInterval": 300000,
		"retryCount":       3,
		"timeout":          10000,
	}
	if provided != nil {
		_ = json.Unmarshal(*provided, &policy)
	}
	return policy
}

func mergeJSONWithDefaults(provided *models.JSON, defaults map[string]any) []byte {
	merged := make(map[string]any)
	_ = json.Unmarshal(*provided, &merged)
	for k, v := range defaults {
		if _, ok := merged[k]; !ok {
			merged[k] = v
		}
	}
	b, _ := json.Marshal(merged)
	return b
}

func parseJSONFloatMap(j models.JSON) map[string]float64 {
	m := make(map[string]float64)
	_ = json.Unmarshal(j, &m)
	return m
}

// --- Response types ---

type TwinStateResponse struct {
	TwinID       string             `json:"twinId"`
	Timestamp    int64              `json:"timestamp"`
	Status       string             `json:"status"`
	Resources    map[string]float64 `json:"resources"`
	Performance  map[string]float64 `json:"performance"`
	Dependencies []Dependency       `json:"dependencies"`
	Events       []Event            `json:"events"`
}

type Dependency struct {
	Name   string `json:"name"`
	Health string `json:"health"`
}

type Event struct {
	Type      string `json:"type"`
	Timestamp int64  `json:"timestamp"`
	Severity  string `json:"severity"`
}

func twinStateToResponse(st *models.TwinState) *TwinStateResponse {
	var deps []Dependency
	_ = json.Unmarshal(st.Dependencies, &deps)
	var events []Event
	_ = json.Unmarshal(st.Events, &events)
	return &TwinStateResponse{
		TwinID:       st.TwinID,
		Timestamp:    st.Timestamp,
		Status:       st.Status,
		Resources:    parseJSONFloatMap(st.Resources),
		Performance:  parseJSONFloatMap(st.Performance),
		Dependencies: deps,
		Events:       events,
	}
}

type SimulationResult struct {
	Success         bool               `json:"success"`
	Metrics         []SimResultMetric  `json:"metrics"`
	Insights        []string           `json:"insights"`
	Risks           []SimResultRisk    `json:"risks"`
	Recommendations []string           `json:"recommendations"`
	Visualizations  []SimVisualization `json:"visualizations"`
}

type SimResultMetric struct {
	Name      string  `json:"name"`
	Baseline  float64 `json:"baseline"`
	Simulated float64 `json:"simulated"`
	Delta     float64 `json:"delta"`
	Unit      string  `json:"unit"`
}

type SimResultRisk struct {
	Description string  `json:"description"`
	Probability float64 `json:"probability"`
	Impact      string  `json:"impact"`
	Mitigation  string  `json:"mitigation"`
}

type SimVisualization struct {
	Type string         `json:"type"`
	Data map[string]any `json:"data"`
}

type ginH map[string]any

type TwinComparison struct {
	TwinID          string             `json:"twinId"`
	Timestamp       int64              `json:"timestamp"`
	Metrics         []ComparisonMetric `json:"metrics"`
	OverallAccuracy float64            `json:"overallAccuracy"`
	Discrepancies   []Discrepancy      `json:"discrepancies"`
}

type ComparisonMetric struct {
	Name      string  `json:"name"`
	RealValue float64 `json:"realValue"`
	TwinValue float64 `json:"twinValue"`
	Deviation float64 `json:"deviation"`
	Accuracy  float64 `json:"accuracy"`
	Unit      string  `json:"unit"`
}

type Discrepancy struct {
	Metric         string  `json:"metric"`
	Deviation      float64 `json:"deviation"`
	Cause          string  `json:"cause"`
	Recommendation string  `json:"recommendation"`
}

type PredictionResult struct {
	TwinID         string             `json:"twinId"`
	PredictionType string             `json:"predictionType"`
	Timestamp      int64              `json:"timestamp"`
	ForecastPeriod string             `json:"forecastPeriod"`
	Predictions    []PredictionSeries `json:"predictions"`
	Confidence     float64            `json:"confidence"`
	Assumptions    []string           `json:"assumptions"`
	Warnings       []string           `json:"warnings"`
}

type PredictionSeries struct {
	Metric             string            `json:"metric"`
	Values             []PredictionValue `json:"values"`
	Trend              string            `json:"trend"`
	AnomalyProbability float64           `json:"anomalyProbability"`
}

type PredictionValue struct {
	Timestamp  int64   `json:"timestamp"`
	Predicted  float64 `json:"predicted"`
	Confidence float64 `json:"confidence"`
	LowerBound float64 `json:"lowerBound"`
	UpperBound float64 `json:"upperBound"`
}

// --- Sentinel errors ---

func IsNotFound(err error) bool {
	return errors.Is(err, dt_repo.sentinel.NotFound)
}
