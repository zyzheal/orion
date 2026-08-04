package schema

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

// Flow represents a parsed workflow graph for validation.
type Flow struct {
	Nodes []FlowNode `json:"nodes"`
	Edges []FlowEdge `json:"edges"`
}

// FlowNode is a concrete node in a workflow, referencing a node type schema.
type FlowNode struct {
	ID         string                 `json:"id"`
	Type       NodeType               `json:"type"`
	Name       string                 `json:"name"`
	Properties map[string]interface{} `json:"properties"`
}

// FlowEdge is a connection between two nodes in a workflow.
type FlowEdge struct {
	ID         string `json:"id"`
	SourceID   string `json:"source_id"`
	SourcePort string `json:"source_port"`
	TargetID   string `json:"target_id"`
	TargetPort string `json:"target_port"`
}

// ValidationError describes a single validation issue.
type ValidationError struct {
	Severity  string `json:"severity"` // "error" or "warning"
	NodeID    string `json:"node_id,omitempty"`
	EdgeID    string `json:"edge_id,omitempty"`
	Field     string `json:"field,omitempty"`
	Message   string `json:"message"`
}

// ValidationResult aggregates all validation issues.
type ValidationResult struct {
	Valid   bool              `json:"valid"`
	Errors  []ValidationError `json:"errors"`
	Warnings []ValidationError `json:"warnings"`
}

// Validator validates a Flow against NodeSchema definitions.
type Validator struct {
	schemas map[NodeType]NodeSchema
}

// NewValidator creates a validator with the default schema registry.
func NewValidator() *Validator {
	return &Validator{schemas: SchemaMap()}
}

// Validate runs all validation checks on the given Flow.
func (v *Validator) Validate(flow *Flow) *ValidationResult {
	result := &ValidationResult{}

	if flow == nil {
		result.Errors = append(result.Errors, ValidationError{
			Severity: "error",
			Message:  "flow cannot be null",
		})
		return result
	}

	// 1. 节点类型校验
	result.Errors = append(result.Errors, v.validateNodeTypes(flow)...)

	// 2. 节点属性必填校验
	for _, node := range flow.Nodes {
		attrs := v.validateRequiredAttributes(node)
		result.Errors = append(result.Errors, attrs...)
	}

	// 3. 开始/结束节点数量校验
	result.Errors = append(result.Errors, v.validateBoundaryNodes(flow)...)

	// 4. 端口连接有效性校验
	for _, edge := range flow.Edges {
		ports := v.validateEdgePorts(edge, flow)
		result.Errors = append(result.Errors, ports...)
	}

	// 5. 端口类型兼容性校验
	for _, edge := range flow.Edges {
		types := v.validatePortTypeCompatibility(edge, flow)
		result.Errors = append(result.Errors, types...)
	}

	// 6. 父/子数量约束校验
	result.Errors = append(result.Errors, v.validateParentChildConstraints(flow)...)

	// 7. 循环检测（DAG）
	cycles := v.detectCycles(flow)
	for _, c := range cycles {
		result.Errors = append(result.Errors, ValidationError{
			Severity: "error",
			Message:  c,
		})
	}

	result.Valid = len(result.Errors) == 0
	return result
}

// ---------- node type validation ----------

func (v *Validator) validateNodeTypes(flow *Flow) []ValidationError {
	var errs []ValidationError
	for _, node := range flow.Nodes {
		if !IsValidNodeType(node.Type) {
			errs = append(errs, ValidationError{
				Severity: "error",
				NodeID:   node.ID,
				Field:    "type",
				Message:  fmt.Sprintf("节点类型 '%s' 不存在"),
			})
		}
	}
	return errs
}

// ---------- required attribute validation ----------

func (v *Validator) validateRequiredAttributes(node FlowNode) []ValidationError {
	var errs []ValidationError
	s, ok := v.schemas[node.Type]
	if !ok {
		return errs
	}

	if node.Properties == nil {
		for _, attr := range s.RequiredAttrs {
			errs = append(errs, ValidationError{
				Severity: "error",
				NodeID:   node.ID,
				Field:    attr.Name,
				Message:  fmt.Sprintf("缺少必填属性 '%s'"),
			})
		}
		return errs
	}

	for _, attr := range s.RequiredAttrs {
		val, exists := node.Properties[attr.Name]
		if !exists {
			errs = append(errs, ValidationError{
				Severity: "error",
				NodeID:   node.ID,
				Field:    attr.Name,
				Message:  fmt.Sprintf("缺少必填属性 '%s'"),
			})
			continue
		}
		// Check for empty string in required fields
		if str, ok2 := val.(string); ok2 && strings.TrimSpace(str) == "" {
			errs = append(errs, ValidationError{
				Severity: "error",
				NodeID:   node.ID,
				Field:    attr.Name,
				Message:  fmt.Sprintf("必填属性 '%s' 不能为空"),
			})
		}
	}
	return errs
}

// ---------- boundary node validation ----------

func (v *Validator) validateBoundaryNodes(flow *Flow) []ValidationError {
	var errs []ValidationError
	startCount := 0
	endCount := 0

	for _, node := range flow.Nodes {
		switch node.Type {
		case NodeTypeStart:
			startCount++
		case NodeTypeEnd:
			endCount++
		}
	}

	if startCount == 0 {
		errs = append(errs, ValidationError{
			Severity: "error",
			Message:  "流程必须包含至少一个开始节点 (start)",
		})
	} else if startCount > 1 {
		errs = append(errs, ValidationError{
			Severity: "error",
			Message:  fmt.Sprintf("流程只能包含一个开始节点，当前有 %d 个", startCount),
		})
	}

	if endCount == 0 {
		errs = append(errs, ValidationError{
			Severity: "warning",
			Message:  "流程未包含结束节点 (end)，建议在流程末尾添加",
		})
	}

	return errs
}

// ---------- edge port validation ----------

func (v *Validator) validateEdgePorts(edge FlowEdge, flow *Flow) []ValidationError {
	var errs []ValidationError
	if edge.SourceID == "" {
		errs = append(errs, ValidationError{
			Severity: "error",
			EdgeID:   edge.ID,
			Message:  "边必须指定 source_id",
		})
	}
	if edge.TargetID == "" {
		errs = append(errs, ValidationError{
			Severity: "error",
			EdgeID:   edge.ID,
			Message:  "边必须指定 target_id",
		})
	}
	if edge.SourceID == edge.TargetID {
		errs = append(errs, ValidationError{
			Severity: "error",
			EdgeID:   edge.ID,
			Message:  "边不能连接同一节点",
		})
		return errs
	}

	source := v.findNode(edge.SourceID, flow)
	target := v.findNode(edge.TargetID, flow)

	if source == nil {
		errs = append(errs, ValidationError{
			Severity: "error",
			EdgeID:   edge.ID,
			Message:  fmt.Sprintf("引用了不存在的源节点 '%s'", edge.SourceID),
		})
	}
	if target == nil {
		errs = append(errs, ValidationError{
			Severity: "error",
			EdgeID:   edge.ID,
			Message:  fmt.Sprintf("引用了不存在的目标节点 '%s'", edge.TargetID),
		})
		return errs
	}

	if source == nil || target == nil {
		return errs
	}

	// Validate source port exists on source node
	if edge.SourcePort != "" && source != nil {
		sourceSchema := v.schemas[source.Type]
		portFound := false
		for _, p := range sourceSchema.OutputPorts {
			if p.Name == edge.SourcePort {
				portFound = true
				break
			}
		}
		if !portFound {
			errs = append(errs, ValidationError{
				Severity: "error",
				EdgeID:   edge.ID,
				NodeID:   source.ID,
				Message:  fmt.Sprintf("源节点类型 '%s' 不存在输出端口 '%s'", source.Type, edge.SourcePort),
			})
		}
	}

	// Validate target port exists on target node
	if edge.TargetPort != "" && target != nil {
		targetSchema := v.schemas[target.Type]
		portFound := false
		for _, p := range targetSchema.InputPorts {
			if p.Name == edge.TargetPort {
				portFound = true
				break
			}
		}
		if !portFound {
			errs = append(errs, ValidationError{
				Severity: "error",
				EdgeID:   edge.ID,
				NodeID:   target.ID,
				Message:  fmt.Sprintf("目标节点类型 '%s' 不存在输入端口 '%s'", target.Type, edge.TargetPort),
			})
		}
	}

	return errs
}

// ---------- port type compatibility ----------

func (v *Validator) validatePortTypeCompatibility(edge FlowEdge, flow *Flow) []ValidationError {
	var errs []ValidationError

	source := v.findNode(edge.SourceID, flow)
	target := v.findNode(edge.TargetID, flow)

	if source == nil || target == nil {
		return errs
	}

	sourceSchema := v.schemas[source.Type]
	targetSchema := v.schemas[target.Type]

	if edge.SourcePort == "" || edge.TargetPort == "" {
		return errs
	}

	sourcePort := v.findOutputPort(edge.SourcePort, sourceSchema)
	targetPort := v.findInputPort(edge.TargetPort, targetSchema)

	if sourcePort == nil || targetPort == nil {
		return errs
	}

	if !portsCompatible(sourcePort.Type, targetPort.Type) {
		errs = append(errs, ValidationError{
			Severity: "warning",
			EdgeID:   edge.ID,
			Message:  fmt.Sprintf("端口类型不兼容: 源端口类型 '%s' -> 目标端口类型 '%s'", sourcePort.Type, targetPort.Type),
		})
	}

	return errs
}

// ---------- parent/child constraint validation ----------

func (v *Validator) validateParentChildConstraints(flow *Flow) []ValidationError {
	var errs []ValidationError

	nodeMap := make(map[string]FlowNode)
	for _, n := range flow.Nodes {
		nodeMap[n.ID] = n
	}

	// Build adjacency
	children := make(map[string][]string)
	parents := make(map[string][]string)
	for _, e := range flow.Edges {
		children[e.SourceID] = append(children[e.SourceID], e.TargetID)
		parents[e.TargetID] = append(parents[e.TargetID], e.SourceID)
	}

	for _, node := range flow.Nodes {
		s := v.schemas[node.Type]

		// Check min_parents
		if s.MinParents > 0 && len(parents[node.ID]) < s.MinParents {
			errs = append(errs, ValidationError{
				Severity: "error",
				NodeID:   node.ID,
				Message:  fmt.Sprintf("节点 '%s' 需要至少 %d 个上游节点，当前有 %d 个", node.Name, s.MinParents, len(parents[node.ID])),
			})
		}

		// Check max_parents
		if s.MaxParents > 0 && len(parents[node.ID]) > s.MaxParents {
			errs = append(errs, ValidationError{
				Severity: "error",
				NodeID:   node.ID,
				Message:  fmt.Sprintf("节点 '%s' 最多允许 %d 个上游节点，当前有 %d 个", node.Name, s.MaxParents, len(parents[node.ID])),
			})
		}

		// Check min_children
		if s.MinChildren > 0 && len(children[node.ID]) < s.MinChildren {
			errs = append(errs, ValidationError{
				Severity: "error",
				NodeID:   node.ID,
				Message:  fmt.Sprintf("节点 '%s' 需要至少 %d 个下游节点，当前有 %d 个", node.Name, s.MinChildren, len(children[node.ID])),
			})
		}
	}

	return errs
}

// ---------- cycle detection (DFS) ----------

func (v *Validator) detectCycles(flow *Flow) []string {
	// Build adjacency list
	graph := make(map[string][]string)
	for _, n := range flow.Nodes {
		graph[n.ID] = nil
	}
	for _, e := range flow.Edges {
		graph[e.SourceID] = append(graph[e.SourceID], e.TargetID)
	}

	visited := make(map[string]int) // 0=unvisited, 1=in-progress, 2=done
	var path []string
	var result []string

	var dfs func(nodeID string)
	dfs = func(nodeID string) {
		if visited[nodeID] == 1 {
			// Found cycle
			cycle := cyclePath(path, nodeID)
			result = append(result, fmt.Sprintf("检测到循环依赖: %s", cycle))
			return
		}
		if visited[nodeID] == 2 {
			return
		}
		visited[nodeID] = 1
		path = append(path, nodeID)
		for _, neighbor := range graph[nodeID] {
			dfs(neighbor)
		}
		path = path[:len(path)-1]
		visited[nodeID] = 2
	}

	for _, node := range flow.Nodes {
		if visited[node.ID] == 0 {
			dfs(node.ID)
		}
	}

	return result
}

// cyclePath extracts the cycle nodes from the current DFS path.
func cyclePath(path []string, nodeID string) string {
	idx := -1
	for i, id := range path {
		if id == nodeID {
			idx = i
			break
		}
	}
	if idx < 0 {
		return nodeID
	}
	cycleNodes := path[idx:]
	cycleNodes = append(cycleNodes, nodeID)
	return strings.Join(cycleNodes, " -> ")
}

// ---------- port type compatibility ----------

// portsCompatible checks if two PortType values can be connected.
func portsCompatible(sourceType, targetType PortType) bool {
	// "any" accepts and sends everything
	if sourceType == PortTypeAny || targetType == PortTypeAny {
		return true
	}
	// Same type always compatible
	if sourceType == targetType {
		return true
	}
	// Trigger can go to any input
	if sourceType == PortTypeTrigger && targetType != PortTypeJSON && targetType != PortTypeEvent {
		return true
	}
	// JSON can flow to any
	if sourceType == PortTypeJSON {
		return true
	}
	return false
}

// ---------- helper functions ----------

func (v *Validator) findNode(id string, flow *Flow) *FlowNode {
	for _, n := range flow.Nodes {
		if n.ID == id {
			return &n
		}
	}
	return nil
}

func (v *Validator) findOutputPort(portName string, s NodeSchema) *Port {
	for _, p := range s.OutputPorts {
		if p.Name == portName {
			return &p
		}
	}
	return nil
}

func (v *Validator) findInputPort(portName string, s NodeSchema) *Port {
	for _, p := range s.InputPorts {
		if p.Name == portName {
			return &p
		}
	}
	return nil
}

// ValidateSingleNode checks a single node against its schema, useful for
// property panel validation.
func (v *Validator) ValidateSingleNode(nodeID string, nodeType NodeType,
	properties map[string]interface{},
) []ValidationError {
	var errs []ValidationError
	s, ok := v.schemas[nodeType]
	if !ok {
		return []ValidationError{
			{Severity: "error", NodeID: nodeID, Message: fmt.Sprintf("未知节点类型 '%s'", nodeType)},
		}
	}

	for _, attr := range s.RequiredAttrs {
		val, exists := properties[attr.Name]
		if !exists {
			errs = append(errs, ValidationError{
				Severity: "error",
				NodeID:   nodeID,
				Field:    attr.Name,
				Message:  fmt.Sprintf("缺少必填属性 '%s'", attr.Name),
			})
		} else if str, ok := val.(string); ok && strings.TrimSpace(str) == "" {
			errs = append(errs, ValidationError{
				Severity: "error",
				NodeID:   nodeID,
				Field:    attr.Name,
				Message:  fmt.Sprintf("必填属性 '%s' 不能为空", attr.Name),
			})
		}
	}
	return errs
}

// IsDAG checks whether the flow is a directed acyclic graph.
func (v *Validator) IsDAG(flow *Flow) bool {
	cycles := v.detectCycles(flow)
	return len(cycles) == 0
}

// ValidateNodesJSON parses a JSON string of nodes and validates.
func (v *Validator) ValidateNodesJSON(nodesJSON, edgesJSON string) *ValidationResult {
	flow, parseErr := ParseFlowJSON(nodesJSON, edgesJSON)
	result := &ValidationResult{}
	if parseErr != nil {
		result.Errors = append(result.Errors, ValidationError{
			Severity: "error",
			Message:  fmt.Sprintf("JSON 解析失败: %v", parseErr),
		})
		return result
	}
	return v.Validate(flow)
}

// ParseFlowJSON parses the flow nodes and edges from JSON strings.
func ParseFlowJSON(nodesJSON, edgesJSON string) (*Flow, error) {
	var nodes []FlowNode
	var edges []FlowEdge

	if nodesJSON != "" {
		data := []byte(nodesJSON)
		if err := json.Unmarshal(data, &nodes); err != nil {
			return nil, fmt.Errorf("解析节点失败: %w", err)
		}
	}

	if edgesJSON != "" {
		data := []byte(edgesJSON)
		if err := json.Unmarshal(data, &edges); err != nil {
			return nil, fmt.Errorf("解析边失败: %w", err)
		}
	}

	return &Flow{Nodes: nodes, Edges: edges}, nil
}

// ValidateError wraps any validation error for the service layer.
type ValidateError struct {
	Message  string `json:"message"`
	NodeID   string `json:"node_id,omitempty"`
	Field    string `json:"field,omitempty"`
	Severity string `json:"severity"`
}

var (
	ErrFlowHasCycle     = errors.New("flow contains cycles")
	ErrMissingStartNode = errors.New("flow missing start node")
	ErrInvalidNodeType  = errors.New("invalid node type")
	ErrMissingAttribute = errors.New("missing required attribute")
)
