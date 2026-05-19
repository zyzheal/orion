package topology

import "github.com/orion-platform/orion-cmdb/internal/relation"

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

// RelationToEdge converts a relation to a TopologyEdge
func RelationToEdge(rel *relation.Relation) *TopologyEdge {
	return &TopologyEdge{
		ID:           rel.ID,
		Source:       rel.FromCiID,
		Target:       rel.ToCiID,
		RelationType: rel.RelationType,
	}
}