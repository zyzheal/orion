package topology

import "github.com/orion-platform/orion-cmdb/internal/relation"

// ImpactLevel represents the severity of impact
type ImpactLevel string

const (
	ImpactLevelCritical ImpactLevel = "CRITICAL"
	ImpactLevelHigh     ImpactLevel = "HIGH"
	ImpactLevelMedium   ImpactLevel = "MEDIUM"
	ImpactLevelLow      ImpactLevel = "LOW"
)

// TopologyNode represents a node in the CMDB topology graph
type TopologyNode struct {
	ID       string                 `json:"id"`
	CiID     string                 `json:"ci_id"`
	CiType   string                 `json:"ci_type"`
	Name     string                 `json:"name"`
	Status   string                 `json:"status"`
	Metadata map[string]interface{} `json:"metadata"`
}

// TopologyEdge represents an edge (relationship) in the CMDB topology graph
type TopologyEdge struct {
	ID            string `json:"id"`
	Source        string `json:"source"`
	Target        string `json:"target"`
	RelationType  string `json:"relation_type"`
}

// Topology represents the complete topology graph
type Topology struct {
	Nodes []TopologyNode `json:"nodes"`
	Edges []TopologyEdge `json:"edges"`
}

// ImpactAnalysis represents the result of impact analysis for a CI
type ImpactAnalysis struct {
	CiID             string          `json:"ci_id"`
	AffectedCIs      []TopologyNode  `json:"affected_cis"`
	WarningMessages []string        `json:"warning_messages"`
	CanProceed       bool            `json:"can_proceed"`
}

// ImpactReport represents a detailed impact analysis report for a CI change
type ImpactReport struct {
	CiID             string          `json:"ci_id"`
	Operation        string          `json:"operation"`
	ImpactLevel      ImpactLevel     `json:"impact_level"`
	DirectAffected   []TopologyNode  `json:"direct_affected"`
	IndirectAffected []TopologyNode  `json:"indirect_affected"`
	CriticalPaths    [][]string      `json:"critical_paths"`
	Recommendations  []string        `json:"recommendations"`
	CanProceed       bool            `json:"can_proceed"`
	RequiresApproval bool            `json:"requires_approval"`
}

// ChangeOperation represents the type of change operation
type ChangeOperation string

const (
	ChangeOperationCreate  ChangeOperation = "create"
	ChangeOperationUpdate  ChangeOperation = "update"
	ChangeOperationDelete  ChangeOperation = "delete"
)

// CriticalComponent represents a critical component in the topology
type CriticalComponent struct {
	CiID           string       `json:"ci_id"`
	CiType         string       `json:"ci_type"`
	Name           string       `json:"name"`
	CriticalType   string       `json:"critical_type"` // "SINGLE_POINT_OF_FAILURE", "HIGH_DEPENDENCY"
	DependencyCount int         `json:"dependency_count"`
	AffectedServices []string   `json:"affected_services"`
}

// RelationToEdge converts a relation to a TopologyEdge
func RelationToEdge(rel *relation.Relation) *TopologyEdge {
	return &TopologyEdge{
		ID:           rel.ID,
		Source:       rel.FromCiID,
		Target:       rel.ToCiID,
		RelationType: rel.RelationType,
	}
}