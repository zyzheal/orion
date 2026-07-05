package integration

import (
	"github.com/gin-gonic/gin"
	"github.com/orion-platform/orion-cmdb/internal/cmdb"
	"github.com/orion-platform/orion-cmdb/internal/k8s"
	"github.com/orion-platform/orion-cmdb/internal/relation"
	"github.com/orion-platform/orion-cmdb/internal/topology"
	"strings"
	"time"
)

// HostResource represents host information from CMDB
type HostResource struct {
	Hostname string   `json:"hostname"`
	IP       string   `json:"ip"`
	OS       string   `json:"os"`
	CPU      int      `json:"cpu"`
	Memory   int      `json:"memory"`
	Disk     int      `json:"disk"`
	Status   string   `json:"status"`
	Tags     []string `json:"tags"`
	CIID     string   `json:"ci_id"`
	Name     string   `json:"name"`
}

// K8sResource represents K8s resource info from CMDB
type K8sResource struct {
	Kind        string            `json:"kind"`
	APIVersion  string            `json:"api_version"`
	Name        string            `json:"name"`
	Namespace   string            `json:"namespace"`
	UID         string            `json:"uid"`
	Labels      map[string]string `json:"labels"`
	Status      string            `json:"status"`
	CIID        string            `json:"ci_id"`
}

// CICDResource represents CI/CD pipeline info from CMDB
type CICDResource struct {
	PipelineID  string    `json:"pipeline_id"`
	Name        string    `json:"name"`
	Status      string    `json:"status"`
	Duration    int64     `json:"duration,omitempty"`
	TriggeredBy string    `json:"triggered_by,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// K8sSyncState represents the overall K8s sync health
type K8sSyncState struct {
	OverallStatus  string         `json:"overall_status"`
	WatchStatus    *WatchStatus   `json:"watch_status"`
	ReconcileState *k8s.SyncStatus `json:"reconciliation_status"`
	HealthScore    int            `json:"health_score"`
}

// WatchStatus represents the K8s watch connection health
type WatchStatus struct {
	Connected         bool     `json:"connected"`
	LastConnectedAt   string   `json:"last_connected_at,omitempty"`
	LastError         string   `json:"last_error,omitempty"`
	ResourcesWatched  []string `json:"resources_watched"`
}

// Service integrates CMDB with external systems
type Service struct {
	cmdbSvc       *cmdb.Service
	relationSvc   *relation.Service
	topologySvc   *topology.Service
	k8sReconciler *k8s.Reconciler
}

// NewService creates a new integration service
func NewService(
	cmdbSvc *cmdb.Service,
	relationSvc *relation.Service,
	topologySvc *topology.Service,
	k8sReconciler *k8s.Reconciler,
) *Service {
	return &Service{
		cmdbSvc:       cmdbSvc,
		relationSvc:   relationSvc,
		topologySvc:   topologySvc,
		k8sReconciler: k8sReconciler,
	}
}

// ListHosts lists SERVER-type CIs as host resources
func (s *Service) ListHosts(tenantID int64, page, pageSize int) ([]HostResource, int64, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	cis, total, err := s.cmdbSvc.ListCIs("SERVER", "", "", page, pageSize, tenantID)
	if err != nil {
		return nil, 0, err
	}

	hosts := make([]HostResource, 0, len(cis))
	for _, ci := range cis {
		hosts = append(hosts, ciToHost(ci))
	}

	return hosts, total, nil
}

// GetHost retrieves a single host by CI ID
func (s *Service) GetHost(ciID string, tenantID int64) (*HostResource, error) {
	ci, err := s.cmdbSvc.GetCIByCiID(ciID, tenantID)
	if err != nil {
		return nil, err
	}
	if ci.CiType != "SERVER" {
		return nil, nil
	}
	host := ciToHost(*ci)
	return &host, nil
}

func ciToHost(ci cmdb.CI) HostResource {
	attrs := ci.Attributes
	if attrs == nil {
		attrs = make(map[string]string)
	}

	return HostResource{
		Hostname: attrs["hostname"],
		IP:       attrs["ip"],
		OS:       attrs["os"],
		CPU:      parseInt(attrs["cpu"]),
		Memory:   parseInt(attrs["memory"]),
		Disk:     parseInt(attrs["disk"]),
		Status:   mapCiStatus(ci.Status),
		Tags:     ci.Tags,
		CIID:     ci.CiID,
		Name:     ci.Name,
	}
}

func mapCiStatus(status string) string {
	switch status {
	case "ACTIVE":
		return "online"
	case "MAINTENANCE":
		return "maintenance"
	default:
		return "offline"
	}
}

func parseInt(s string) int {
	var n int
	if s != "" {
		// Simple int parse
		for _, c := range s {
			if c >= '0' && c <= '9' {
				n = n*10 + int(c-'0')
			}
		}
	}
	return n
}

// ListK8sResources lists K8s-type CIs
func (s *Service) ListK8sResources(tenantID int64, kind, namespace string, page, pageSize int) ([]K8sResource, int64, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}

	ciTypeMap := map[string]string{
		"Cluster":    "K8S_CLUSTER",
		"Deployment": "K8S_DEPLOYMENT",
		"Pod":        "K8S_POD",
	}

	ciType := ""
	if kind != "" {
		ciType = ciTypeMap[kind]
	}

	cis, total, err := s.cmdbSvc.ListCIs(ciType, "", "", page, pageSize, tenantID)
	if err != nil {
		return nil, 0, err
	}

	resources := make([]K8sResource, 0, len(cis))
	for _, ci := range cis {
		if namespace != "" {
			if ns := ci.Attributes["k8s_namespace"]; ns != namespace {
				continue
			}
		}
		resources = append(resources, ciToK8sResource(ci))
	}

	return resources, total, nil
}

func ciToK8sResource(ci cmdb.CI) K8sResource {
	attrs := ci.Attributes
	if attrs == nil {
		attrs = make(map[string]string)
	}

	kind := ci.CiType
	switch kind {
	case "K8S_CLUSTER":
		kind = "Cluster"
	case "K8S_DEPLOYMENT":
		kind = "Deployment"
	case "K8S_POD":
		kind = "Pod"
	}

	labels := make(map[string]string)
	for _, tag := range ci.Tags {
		// Tags stored as "key=value"
		parts := strings.SplitN(tag, "=", 2)
		if len(parts) == 2 {
			labels[parts[0]] = parts[1]
		}
	}

	return K8sResource{
		Kind:       kind,
		APIVersion: attrs["k8s_api_version"],
		Name:       ci.Name,
		Namespace:  attrs["k8s_namespace"],
		UID:        attrs["k8s_uid"],
		Labels:     labels,
		Status:     attrs["k8s_status"],
		CIID:       ci.CiID,
	}
}

// ListCICDResources lists PIPELINE-type CIs
func (s *Service) ListCICDResources(tenantID int64, status string, page, pageSize int) ([]CICDResource, int64, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}

	cis, total, err := s.cmdbSvc.ListCIs("PIPELINE", status, "", page, pageSize, tenantID)
	if err != nil {
		return nil, 0, err
	}

	resources := make([]CICDResource, 0, len(cis))
	for _, ci := range cis {
		resources = append(resources, ciToCICDResource(ci))
	}

	return resources, total, nil
}

func ciToCICDResource(ci cmdb.CI) CICDResource {
	attrs := ci.Attributes
	if attrs == nil {
		attrs = make(map[string]string)
	}

	return CICDResource{
		PipelineID:  ci.CiID,
		Name:        ci.Name,
		Status:      attrs["last_run_status"],
		TriggeredBy: attrs["last_triggered_by"],
		CreatedAt:   ci.CreatedAt,
		UpdatedAt:   ci.UpdatedAt,
	}
}

// GetTopology builds and returns the topology graph
func (s *Service) GetTopology(tenantID int64, ciType string) (interface{}, error) {
	return s.topologySvc.BuildTopology(tenantID, ciType)
}

// GetSyncState returns the current K8s sync state
func (s *Service) GetSyncState() *K8sSyncState {
	state := &K8sSyncState{
		OverallStatus: "L2_PAUSED",
		WatchStatus: &WatchStatus{
			Connected: false,
		},
		HealthScore: 0,
	}

	if s.k8sReconciler != nil {
		status := s.k8sReconciler.GetStatus()
		state.ReconcileState = status
		state.WatchStatus.Connected = true
		state.HealthScore = computeHealthScore(status)
		state.OverallStatus = statusToLevel(status)
	}

	return state
}

// StartSync starts K8s synchronization for a tenant
func (s *Service) StartSync(tenantID int64) gin.H {
	// TODO: Wire up real K8s reconciler start with tenant context
	return gin.H{
		"message":   "K8s sync start requested",
		"tenant_id": tenantID,
		"status":    "pending_implementation",
	}
}

// StopSync stops K8s synchronization for a tenant
func (s *Service) StopSync(tenantID int64) gin.H {
	// TODO: Wire up real K8s reconciler stop with tenant context
	return gin.H{
		"message":   "K8s sync stop requested",
		"tenant_id": tenantID,
		"status":    "pending_implementation",
	}
}

// computeHealthScore calculates a health score (0-100) from sync status
func computeHealthScore(status *k8s.SyncStatus) int {
	if status == nil {
		return 0
	}
	score := 100
	if status.Errors > 0 {
		score -= status.Errors * 10
	}
	if status.Deleted > 0 {
		score -= status.Deleted * 5
	}
	if score < 0 {
		score = 0
	}
	return score
}

// statusToLevel maps sync status to a health level string
func statusToLevel(status *k8s.SyncStatus) string {
	if status == nil {
		return "L2_PAUSED"
	}
	if status.Errors > 5 {
		return "L3_DEGRADED"
	}
	if status.Errors > 0 {
		return "L1_REDUCED"
	}
	return "L0_NORMAL"
}
