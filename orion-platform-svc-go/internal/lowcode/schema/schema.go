package schema

import (
	"encoding/json"
	"fmt"
)

// NodeCategory groups node types by their execution semantics.
type NodeCategory string

const (
	CategoryControl  NodeCategory = "control"   // 流程控制
	CategoryCompute  NodeCategory = "compute"   // 计算/操作
	CategoryIO       NodeCategory = "io"        // 输入/输出
	CategoryBoundary NodeCategory = "boundary"  // 开始/结束
)

// NodeType identifies the kind of a lowcode node.
type NodeType string

const (
	NodeTypeAction  NodeType = "action"   // 执行动作
	NodeTypeCondition NodeType = "condition" // 条件分支
	NodeTypeParallel NodeType = "parallel"   // 并行分支
	NodeTypeLoop    NodeType = "loop"     // 循环
	NodeTypeDelay   NodeType = "delay"    // 延时
	NodeTypeNotify  NodeType = "notify"   // 通知
	NodeTypeHttp    NodeType = "http"     // HTTP 请求
	NodeTypeWebhook NodeType = "webhook"  // Webhook 回调
	NodeTypeError   NodeType = "error"    // 异常捕获
	NodeTypeStart   NodeType = "start"    // 流程起点
	NodeTypeEnd     NodeType = "end"      // 流程终点
)

var validNodeTypes = map[NodeType]struct{}{
	NodeTypeAction:    {},
	NodeTypeCondition: {},
	NodeTypeParallel:  {},
	NodeTypeLoop:      {},
	NodeTypeDelay:     {},
	NodeTypeNotify:    {},
	NodeTypeHttp:      {},
	NodeTypeWebhook:   {},
	NodeTypeError:     {},
	NodeTypeStart:     {},
	NodeTypeEnd:       {},
}

// IsValidNodeTyp checks whether the given NodeType is registered.
func IsValidNodeType(t NodeType) bool {
	_, ok := validNodeTypes[t]
	return ok
}

// String constants for node display names.
var nodeLabels = map[NodeType]string{
	NodeTypeAction:    "执行动作",
	NodeTypeCondition: "条件分支",
	NodeTypeParallel:  "并行分支",
	NodeTypeLoop:      "循环",
	NodeTypeDelay:     "延时",
	NodeTypeNotify:    "通知",
	NodeTypeHttp:      "HTTP 请求",
	NodeTypeWebhook:   "Webhook 回调",
	NodeTypeError:     "异常捕获",
	NodeTypeStart:     "开始",
	NodeTypeEnd:       "结束",
}

// NodeLabel returns the human-readable Chinese label for a NodeType.
func NodeLabel(t NodeType) string {
	if label, ok := nodeLabels[t]; ok {
		return label
	}
	return string(t)
}

// NodeCategory returns the category of a NodeType.
func NodeCategoryOf(t NodeType) NodeCategory {
	switch t {
	case NodeTypeStart, NodeTypeEnd:
		return CategoryBoundary
	case NodeTypeCondition, NodeTypeParallel, NodeTypeLoop, NodeTypeDelay:
		return CategoryControl
	case NodeTypeAction, NodeTypeHttp, NodeTypeWebhook, NodeTypeNotify:
		return CategoryCompute
	case NodeTypeError:
		return CategoryControl
	default:
		return CategoryCompute
	}
}

// Option defines a selectable option for a node attribute.
type Option struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

// PortDirection distinguishes input from output ports.
type PortDirection string

const (
	PortIn  PortDirection = "input"
	PortOut PortDirection = "output"
)

// PortType identifies the data shape flowing through a port.
type PortType string

const (
	PortTypeAny      PortType = "any"
	PortTypeBool     PortType = "boolean"
	PortTypeNumber   PortType = "number"
	PortTypeString   PortType = "string"
	PortTypeJSON     PortType = "json"
	PortTypeEvent    PortType = "event"
	PortTypeTrigger  PortType = "trigger"
)

// Port defines a typed connection point on a node.
type Port struct {
	Name        string        `json:"name"`
	DisplayName string        `json:"display_name"`
	Direction   PortDirection `json:"direction"`
	Type        PortType      `json:"type"`
	Required    bool          `json:"required"`
	Description string        `json:"description,omitempty"`
}

// Attribute defines a node's configurable property.
type Attribute struct {
	Name        string                 `json:"name"`
	DisplayName string                 `json:"display_name"`
	Type        string                 `json:"type"`
	Required    bool                   `json:"required"`
	Default     *json.RawMessage       `json:"default,omitempty"`
	Description string                 `json:"description,omitempty"`
	Options     []Option `json:"options,omitempty"`
}

// NodeSchema describes the shape, ports, and allowed attributes for a node type.
type NodeSchema struct {
	NodeType      NodeType      `json:"node_type"`
	Label         string        `json:"label"`
	Category      NodeCategory  `json:"category"`
	Description   string        `json:"description"`
	InputPorts    []Port        `json:"input_ports"`
	OutputPorts   []Port        `json:"output_ports"`
	RequiredAttrs []Attribute   `json:"required_attributes"`
	OptionalAttrs []Attribute   `json:"optional_attributes"`

	// MaxParents / MinParents constrain graph wiring.
	MaxParents int `json:"max_parents"`
	MinParents int `json:"min_parents"`

	// MaxChildren / MinChildren constrain graph wiring.
	MaxChildren int `json:"max_children"`
	MinChildren int `json:"min_children"`
}

// AllSchemas returns the complete registry of NodeSchema definitions.
func AllSchemas() []NodeSchema {
	return []NodeSchema{
		schemaStart(),
		schemaEnd(),
		schemaAction(),
		schemaCondition(),
		schemaParallel(),
		schemaLoop(),
		schemaDelay(),
		schemaNotify(),
		schemaHttp(),
		schemaWebhook(),
		schemaError(),
	}
}

// SchemaByID returns the schema for a given NodeType, or nil if unknown.
func SchemaByID(t NodeType) *NodeSchema {
	schemas := AllSchemas()
	for i := range schemas {
		if schemas[i].NodeType == t {
			return &schemas[i]
		}
	}
	return nil
}

// SchemaMap returns a keyed map of NodeSchema.
func SchemaMap() map[NodeType]NodeSchema {
	schemas := AllSchemas()
	m := make(map[NodeType]NodeSchema, len(schemas))
	for i := range schemas {
		m[schemas[i].NodeType] = schemas[i]
	}
	return m
}

// SchemaTypeList returns all registered node types, sorted.
func SchemaTypeList() []NodeType {
	schemas := AllSchemas()
	types := make([]NodeType, len(schemas))
	for i := range schemas {
		types[i] = schemas[i].NodeType
	}
	return types
}

// ---------- individual schema builders ----------

func schemaStart() NodeSchema {
	return NodeSchema{
		NodeType:    NodeTypeStart,
		Label:       NodeLabel(NodeTypeStart),
		Category:    CategoryBoundary,
		Description: "流程起始节点，每个流程必须有且仅有一个开始节点",
		OutputPorts: []Port{
			{
				Name:        "out",
				DisplayName: "输出",
				Direction:   PortOut,
				Type:        PortTypeTrigger,
				Required:    true,
				Description: "触发流程执行的出口",
			},
		},
		RequiredAttrs: []Attribute{
			{Name: "name", DisplayName: "节点名称", Type: "string", Required: true, Description: "开始节点的显示名称"},
		},
		OptionalAttrs: []Attribute{
			{Name: "trigger_type", DisplayName: "触发方式", Type: "string", Default: raw("manual"), Description: "manual / schedule / webhook",
				Options: []Option{
					{Value: "manual", Label: "手动触发"},
					{Value: "schedule", Label: "定时触发"},
					{Value: "webhook", Label: "Webhook 触发"},
				},
			},
			{Name: "description", DisplayName: "描述", Type: "string", Description: "节点的说明文字"},
		},
		MaxParents: 0,
		MinParents: 0,
	}
}

func schemaEnd() NodeSchema {
	return NodeSchema{
		NodeType:    NodeTypeEnd,
		Label:       NodeLabel(NodeTypeEnd),
		Category:    CategoryBoundary,
		Description: "流程结束节点，一个流程可以有多个结束节点",
		InputPorts: []Port{
			{
				Name:        "in",
				DisplayName: "输入",
				Direction:   PortIn,
				Type:        PortTypeAny,
				Required:    false,
				Description: "接收上游执行结果",
			},
		},
		RequiredAttrs: []Attribute{
			{Name: "name", DisplayName: "节点名称", Type: "string", Required: true, Description: "结束节点的显示名称"},
		},
		OptionalAttrs: []Attribute{
			{Name: "output_template", DisplayName: "输出模板", Type: "string", Description: "流程最终输出的变量模板，支持 {{var}} 语法"},
			{Name: "description", DisplayName: "描述", Type: "string", Description: "节点的说明文字"},
		},
		MinParents: 1,
	}
}

func schemaAction() NodeSchema {
	return NodeSchema{
		NodeType:    NodeTypeAction,
		Label:       NodeLabel(NodeTypeAction),
		Category:    CategoryCompute,
		Description: "执行一个动作操作，如调用 API、执行脚本、数据库操作等",
		InputPorts: []Port{
			{Name: "in", DisplayName: "输入", Direction: PortIn, Type: PortTypeTrigger, Required: true, Description: "上游触发"},
		},
		OutputPorts: []Port{
			{Name: "out", DisplayName: "成功输出", Direction: PortOut, Type: PortTypeAny, Required: false, Description: "执行成功后的输出"},
			{Name: "err", DisplayName: "异常输出", Direction: PortOut, Type: PortTypeEvent, Required: false, Description: "执行失败时的异常出口"},
		},
		RequiredAttrs: []Attribute{
			{Name: "name", DisplayName: "节点名称", Type: "string", Required: true},
			{Name: "action_type", DisplayName: "动作类型", Type: "string", Required: true, Description: "script / sql / http / function"},
			{Name: "payload", DisplayName: "执行负载", Type: "string", Required: true, Description: "脚本内容、SQL 语句或函数定义"},
		},
		OptionalAttrs: []Attribute{
			{Name: "timeout", DisplayName: "超时时间(秒)", Type: "number", Default: raw("30")},
			{Name: "retry_count", DisplayName: "重试次数", Type: "number", Default: raw("0")},
			{Name: "variables", DisplayName: "变量", Type: "json", Default: raw("{}")},
			{Name: "description", DisplayName: "描述", Type: "string"},
		},
		MinParents: 1,
	}
}

func schemaCondition() NodeSchema {
	return NodeSchema{
		NodeType:    NodeTypeCondition,
		Label:       NodeLabel(NodeTypeCondition),
		Category:    CategoryControl,
		Description: "条件判断节点，根据表达式选择执行分支",
		InputPorts: []Port{
			{Name: "in", DisplayName: "输入", Direction: PortIn, Type: PortTypeTrigger, Required: true},
		},
		OutputPorts: []Port{
			{Name: "true", DisplayName: "真分支", Direction: PortOut, Type: PortTypeTrigger, Required: false},
			{Name: "false", DisplayName: "假分支", Direction: PortOut, Type: PortTypeTrigger, Required: false},
		},
		RequiredAttrs: []Attribute{
			{Name: "name", DisplayName: "节点名称", Type: "string", Required: true},
			{Name: "expression", DisplayName: "条件表达式", Type: "string", Required: true, Description: "支持 SpEL 语法"},
		},
		OptionalAttrs: []Attribute{
			{Name: "label_true", DisplayName: "真分支标签", Type: "string", Default: raw("是")},
			{Name: "label_false", DisplayName: "假分支标签", Type: "string", Default: raw("否")},
			{Name: "description", DisplayName: "描述", Type: "string"},
		},
		MinParents: 1,
	}
}

func schemaParallel() NodeSchema {
	return NodeSchema{
		NodeType:    NodeTypeParallel,
		Label:       NodeLabel(NodeTypeParallel),
		Category:    CategoryControl,
		Description: "并行执行节点，可同时发起多条分支执行",
		InputPorts: []Port{
			{Name: "in", DisplayName: "输入", Direction: PortIn, Type: PortTypeTrigger, Required: true},
		},
		OutputPorts: []Port{
			{Name: "out", DisplayName: "全部完成输出", Direction: PortOut, Type: PortTypeTrigger, Required: false},
		},
		RequiredAttrs: []Attribute{
			{Name: "name", DisplayName: "节点名称", Type: "string", Required: true},
			{Name: "branch_count", DisplayName: "分支数量", Type: "number", Required: true},
		},
		OptionalAttrs: []Attribute{
			{Name: "wait_all", DisplayName: "等待全部完成", Type: "boolean", Default: raw("true")},
			{Name: "max_concurrency", DisplayName: "最大并发数", Type: "number", Default: raw("0"), Description: "0 表示不限制"},
			{Name: "description", DisplayName: "描述", Type: "string"},
		},
		MinParents: 1,
	}
}

func schemaLoop() NodeSchema {
	return NodeSchema{
		NodeType:    NodeTypeLoop,
		Label:       NodeLabel(NodeTypeLoop),
		Category:    CategoryControl,
		Description: "循环执行节点，对集合中的每个元素重复执行",
		InputPorts: []Port{
			{Name: "in", DisplayName: "输入", Direction: PortIn, Type: PortTypeTrigger, Required: true},
		},
		OutputPorts: []Port{
			{Name: "out", DisplayName: "循环完成输出", Direction: PortOut, Type: PortTypeTrigger, Required: false},
		},
		RequiredAttrs: []Attribute{
			{Name: "name", DisplayName: "节点名称", Type: "string", Required: true},
			{Name: "collection", DisplayName: "集合变量", Type: "string", Required: true, Description: "要遍历的集合变量名"},
			{Name: "iterator", DisplayName: "迭代变量", Type: "string", Required: true, Description: "每个元素绑定的变量名"},
		},
		OptionalAttrs: []Attribute{
			{Name: "max_iterations", DisplayName: "最大迭代次数", Type: "number", Default: raw("100")},
			{Name: "parallel", DisplayName: "并行执行", Type: "boolean", Default: raw("false")},
			{Name: "description", DisplayName: "描述", Type: "string"},
		},
		MinParents: 1,
	}
}

func schemaDelay() NodeSchema {
	return NodeSchema{
		NodeType:    NodeTypeDelay,
		Label:       NodeLabel(NodeTypeDelay),
		Category:    CategoryControl,
		Description: "延时等待节点，暂停指定时间后继续执行",
		InputPorts: []Port{
			{Name: "in", DisplayName: "输入", Direction: PortIn, Type: PortTypeTrigger, Required: true},
		},
		OutputPorts: []Port{
			{Name: "out", DisplayName: "等待完成输出", Direction: PortOut, Type: PortTypeTrigger, Required: false},
		},
		RequiredAttrs: []Attribute{
			{Name: "name", DisplayName: "节点名称", Type: "string", Required: true},
			{Name: "duration", DisplayName: "等待时长", Type: "string", Required: true, Description: "支持表达式: 10s / 1m / 5m30s"},
		},
		OptionalAttrs: []Attribute{
			{Name: "unit", DisplayName: "时间单位", Type: "string", Default: raw("second"),
				Options: []Option{
					{Value: "second", Label: "秒"},
					{Value: "minute", Label: "分钟"},
					{Value: "hour", Label: "小时"},
				},
			},
			{Name: "description", DisplayName: "描述", Type: "string"},
		},
		MinParents: 1,
	}
}

func schemaNotify() NodeSchema {
	return NodeSchema{
		NodeType:    NodeTypeNotify,
		Label:       NodeLabel(NodeTypeNotify),
		Category:    CategoryCompute,
		Description: "通知节点，发送消息到指定渠道",
		InputPorts: []Port{
			{Name: "in", DisplayName: "输入", Direction: PortIn, Type: PortTypeTrigger, Required: true},
		},
		OutputPorts: []Port{
			{Name: "out", DisplayName: "发送完成输出", Direction: PortOut, Type: PortTypeTrigger, Required: false},
		},
		RequiredAttrs: []Attribute{
			{Name: "name", DisplayName: "节点名称", Type: "string", Required: true},
			{Name: "channel", DisplayName: "通知渠道", Type: "string", Required: true, Description: "email / slack / dingtalk / wechat"},
			{Name: "recipients", DisplayName: "接收人", Type: "string", Required: true},
			{Name: "template", DisplayName: "消息模板", Type: "string", Required: true},
		},
		OptionalAttrs: []Attribute{
			{Name: "subject", DisplayName: "消息主题", Type: "string"},
			{Name: "priority", DisplayName: "优先级", Type: "string", Default: raw("normal"),
				Options: []Option{
					{Value: "low", Label: "低"},
					{Value: "normal", Label: "普通"},
					{Value: "high", Label: "高"},
					{Value: "critical", Label: "紧急"},
				},
			},
			{Name: "retry_count", DisplayName: "重试次数", Type: "number", Default: raw("3")},
			{Name: "description", DisplayName: "描述", Type: "string"},
		},
		MinParents: 1,
	}
}

func schemaHttp() NodeSchema {
	return NodeSchema{
		NodeType:    NodeTypeHttp,
		Label:       NodeLabel(NodeTypeHttp),
		Category:    CategoryCompute,
		Description: "发送 HTTP 请求节点，可调用外部 REST API",
		InputPorts: []Port{
			{Name: "in", DisplayName: "输入", Direction: PortIn, Type: PortTypeTrigger, Required: true},
		},
		OutputPorts: []Port{
			{Name: "out", DisplayName: "成功输出", Direction: PortOut, Type: PortTypeJSON, Required: false},
			{Name: "err", DisplayName: "错误输出", Direction: PortOut, Type: PortTypeEvent, Required: false},
		},
		RequiredAttrs: []Attribute{
			{Name: "name", DisplayName: "节点名称", Type: "string", Required: true},
			{Name: "method", DisplayName: "HTTP 方法", Type: "string", Required: true,
				Options: []Option{
					{Value: "GET", Label: "GET"},
					{Value: "POST", Label: "POST"},
					{Value: "PUT", Label: "PUT"},
					{Value: "DELETE", Label: "DELETE"},
					{Value: "PATCH", Label: "PATCH"},
				},
			},
			{Name: "url", DisplayName: "请求地址", Type: "string", Required: true},
		},
		OptionalAttrs: []Attribute{
			{Name: "headers", DisplayName: "请求头", Type: "json", Default: raw("{}")},
			{Name: "body", DisplayName: "请求体", Type: "string"},
			{Name: "timeout", DisplayName: "超时时间(秒)", Type: "number", Default: raw("30")},
			{Name: "retry_count", DisplayName: "重试次数", Type: "number", Default: raw("0")},
			{Name: "description", DisplayName: "描述", Type: "string"},
		},
		MinParents: 1,
	}
}

func schemaWebhook() NodeSchema {
	return NodeSchema{
		NodeType:    NodeTypeWebhook,
		Label:       NodeLabel(NodeTypeWebhook),
		Category:    CategoryCompute,
		Description: "Webhook 回调节点，等待外部系统通过 Webhook 推送事件",
		InputPorts: []Port{
			{Name: "in", DisplayName: "输入", Direction: PortIn, Type: PortTypeTrigger, Required: true},
		},
		OutputPorts: []Port{
			{Name: "callback", DisplayName: "回调输出", Direction: PortOut, Type: PortTypeEvent, Required: false},
			{Name: "timeout", DisplayName: "超时输出", Direction: PortOut, Type: PortTypeEvent, Required: false},
		},
		RequiredAttrs: []Attribute{
			{Name: "name", DisplayName: "节点名称", Type: "string", Required: true},
			{Name: "webhook_url", DisplayName: "Webhook 地址", Type: "string", Required: true, Description: "外部系统回调的目标 URL"},
		},
		OptionalAttrs: []Attribute{
			{Name: "secret", DisplayName: "签名密钥", Type: "string", Description: "用于验证回调请求的签名"},
			{Name: "timeout", DisplayName: "超时时间(秒)", Type: "number", Default: raw("60")},
			{Name: "description", DisplayName: "描述", Type: "string"},
		},
		MinParents: 1,
	}
}

func schemaError() NodeSchema {
	return NodeSchema{
		NodeType:    NodeTypeError,
		Label:       NodeLabel(NodeTypeError),
		Category:    CategoryControl,
		Description: "异常捕获节点，捕获流程中发生的错误并处理",
		InputPorts: []Port{
			{Name: "in", DisplayName: "输入", Direction: PortIn, Type: PortTypeEvent, Required: true, Description: "接收上游异常事件"},
		},
		OutputPorts: []Port{
			{Name: "out", DisplayName: "处理完成输出", Direction: PortOut, Type: PortTypeTrigger, Required: false},
		},
		RequiredAttrs: []Attribute{
			{Name: "name", DisplayName: "节点名称", Type: "string", Required: true},
			{Name: "error_code", DisplayName: "错误码", Type: "string", Required: true, Description: "捕获的错误码，通配符 * 表示全部"},
		},
		OptionalAttrs: []Attribute{
			{Name: "retry", DisplayName: "是否重试", Type: "boolean", Default: raw("false")},
			{Name: "notification", DisplayName: "通知配置", Type: "json", Default: raw("{}"), Description: "错误通知的配置"},
			{Name: "description", DisplayName: "描述", Type: "string"},
		},
		MinParents: 1,
	}
}

// ---------- JSON serialization helpers ----------

// MarshalToJSON marshals a NodeSchema into JSON bytes.
func (s NodeSchema) MarshalToJSON() ([]byte, error) {
	return json.Marshal(s)
}

// UnmarshalFromJSON unmarshals JSON bytes into a NodeSchema.
func (s *NodeSchema) UnmarshalFromJSON(data []byte) error {
	return json.Unmarshal(data, s)
}

// ---------- internal helpers ----------

func raw(v string) *json.RawMessage {
	data := json.RawMessage(fmt.Sprintf(`"%s"`, v))
	return &data
}
