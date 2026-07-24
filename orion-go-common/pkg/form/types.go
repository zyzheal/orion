package form

import (
	"encoding/json"
	"fmt"
	"reflect"
	"time"
)

// =============================================================================
// 核心模型 — 借鉴 NeatLogic FormVo + FormAttributeVo + 数据转换模式
// =============================================================================
// NeatLogic 表单引擎核心设计 (§2.1 + 附录 M):
//   - FormVo: 表单容器（标题/描述/版本/字段列表）
//   - FormAttributeVo: 字段元数据（类型/标签/占位符/校验规则）
//   - 数据转换: 将 JSONB 属性映射为动态表单字段
//
// Orion Go 等效:
//   - Form: 对应 FormVo，包含字段定义、布局、条件渲染
//   - FormField: 对应 FormAttributeVo，包含类型/校验/渲染配置
//   - FormData: 表单数据快照（用于提交/回显）

// FieldType 字段类型枚举
type FieldType string

const (
	FieldTypeInput     FieldType = "input"      // 文本输入框
	FieldTypeTextArea  FieldType = "textarea"   // 多行文本
	FieldTypeNumber    FieldType = "number"     // 数字
	FieldTypeSelect    FieldType = "select"     // 下拉选择
	FieldTypeMultiSelect FieldType = "multi-select" // 多选
	FieldTypeCascader  FieldType = "cascader"   // 级联选择
	FieldTypeDate      FieldType = "date"       // 日期
	FieldTypeDateTime  FieldType = "datetime"   // 日期时间
	FieldTypeTime      FieldType = "time"       // 时间
	FieldTypeCheckbox  FieldType = "checkbox"   // 复选框
	FieldTypeRadio     FieldType = "radio"      // 单选
	FieldTypeSwitch    FieldType = "switch"     // 开关
	FieldTypeDict      FieldType = "dict"       // 数据字典
	FieldTypeUpload    FieldType = "upload"     // 文件上传
	FieldTypeEditor    FieldType = "editor"     // 富文本编辑器
	FieldTypeUserSelect FieldType = "user-select" // 用户选择
	FieldTypeColor     FieldType = "color"      // 颜色选择器
	FieldTypeDivider   FieldType = "divider"    // 分隔线（非数据）
	FieldTypeGroup     FieldType = "group"      // 分组容器
	FieldTypeTable     FieldType = "table"      // 表格（重复行）
)

// FieldLayout 字段布局类型
type FieldLayout string

const (
	FieldLayoutRow   FieldLayout = "row"    // 行布局
	FieldLayoutCol   FieldLayout = "col"    // 列布局
	FieldLayoutTab   FieldLayout = "tab"    // 选项卡
	FieldLayoutCollapse FieldLayout = "collapse" // 折叠面板
)

// Operator 条件运算子
type Operator string

const (
	OpEqual    Operator = "equal"
	OpNotEqual Operator = "not_equal"
	OpIn       Operator = "in"
	OpNotIn    Operator = "not_in"
	OpContains Operator = "contains"
	OpNotContains Operator = "not_contains"
	OpGreater   Operator = "greater"
	OpLess      Operator = "less"
	OpGreaterEq Operator = "greater_equal"
	OpLessEq    Operator = "less_equal"
	OpEmpty     Operator = "empty"
	OpNotEmpty  Operator = "not_empty"
	OpLike      Operator = "like"
)

// =============================================================================
// 表单容器 (FormVo 等效)
// =============================================================================

// Form 动态表单定义
type Form struct {
	// 基本信息
	ID          string `json:"id"`               // 表单唯一标识 (UUID)
	Name        string `json:"name"`             // 表单名称
	Title       string `json:"title"`            // 显示标题
	Description string `json:"description"`      // 表单描述
	Version     int    `json:"version"`          // 版本号
	TenantID    string `json:"tenant_id"`        // 租户 ID（多租户隔离）

	// 元数据
	ModuleName string            `json:"module_name"` // 所属模块 (approval/cmdb/config/...)
	FormType   string            `json:"form_type"`   // 表单类型 (approval/cmdb_item/config/...)
	Category   string            `json:"category"`    // 分类
	Tags       []string          `json:"tags"`        // 标签
	Meta       map[string]string `json:"meta"`        // 扩展元数据

	// 字段定义
	Fields []FormField `json:"fields"`

	// 布局配置
	Layout *FormLayoutConfig `json:"layout,omitempty"`

	// 条件渲染
	Conditions []FormCondition `json:"conditions,omitempty"`

	// 动作按钮
	Actions []FormAction `json:"actions,omitempty"`

	// 表单级别校验规则
	Rules *FormRules `json:"rules,omitempty"`

	// 表单状态
	Status    string            `json:"status"` // active/inactive/draft
	CreatedAt time.Time         `json:"created_at"`
	UpdatedAt time.Time         `json:"updated_at"`
}

// FormLayoutConfig 表单布局配置
type FormLayoutConfig struct {
	Type     FieldLayout `json:"type"`     // 布局类型
	Size     string      `json:"size"`     // small/medium/large
	LabelPos string      `json:"label_pos"` // left/top
	Columns  int         `json:"columns"`  // 栅格列数 (默认 24)
	Span     int         `json:"span"`     // 每列跨度
}

// FormAction 表单动作按钮
type FormAction struct {
	Key       string `json:"key"`         // 动作键 (submit/save/cancel/...)
	Label     string `json:"label"`       // 按钮文字
	Type      string `json:"type"`        // primary/danger/default
	Disabled  bool   `json:"disabled"`    // 是否禁用
	Permission string `json:"permission"` // 权限标识
	API       string `json:"api"`         // API 端点
	Confirm   string `json:"confirm"`     // 确认提示文字
}

// FormRules 表单级别校验规则
type FormRules struct {
	SubmitStrategy string `json:"submit_strategy"` // strict/lenient (严格/宽松)
	FieldRefs      []string `json:"field_refs"`     // 需要校验的字段引用
	InterFieldRules []InterFieldRule `json:"inter_field_rules,omitempty"` // 字段间校验
}

// InterFieldRule 字段间校验规则
type InterFieldRule struct {
	Name    string   `json:"name"`      // 规则名称
	Message string   `json:"message"`   // 错误消息
	Fields  []string `json:"fields"`    // 涉及字段
	Type    string   `json:"type"`      // comparison/range/consistency
	Source  string   `json:"source"`    // 源字段
	Target  string   `json:"target"`    // 目标字段
	Op      string   `json:"op"`        // 比较运算符
}

// =============================================================================
// 字段定义 (FormAttributeVo 等效)
// =============================================================================

// FormField 表单字段定义
type FormField struct {
	// 标识与标签
	Key       string `json:"key"`           // 字段唯一键 (数据库字段名)
	Label     string `json:"label"`         // 显示标签
	Hint      string `json:"hint"`          // 提示文字
	Placeholder string `json:"placeholder"` // 占位符

	// 字段类型
	Type   FieldType `json:"type"`          // 字段类型
	Render string   `json:"render"`         // 自定义渲染组件名

	// 校验规则
	Required    bool              `json:"required"`
	RequiredMsg string            `json:"required_msg"` // 必填错误消息
	Min         *float64          `json:"min"`          // 最小值/最小长度
	Max         *float64          `json:"max"`          // 最大值/最大长度
	MinLength   *int              `json:"min_length"`   // 最小字符长度
	MaxLength   *int              `json:"max_length"`   // 最大字符长度
	Pattern     string            `json:"pattern"`      // 正则表达式
	PatternMsg  string            `json:"pattern_msg"`  // 正则不匹配错误消息
	UniqueKey   string            `json:"unique_key"`   // 唯一性校验键

	// 选项配置 (select/multi-select/radio/checkbox/cascader/dict)
	Options   []FormFieldOption `json:"options"`         // 选项列表
	OptionURL string            `json:"option_url"`      // 动态选项 API 地址
	OptionKey string            `json:"option_key"`      // 选项值字段
	OptionLabel string           `json:"option_label"`    // 选项标签字段

	// 字典配置 (dict 类型)
	DictCode string `json:"dict_code"` // 字典编码

	// 数据源配置
	DataSource     string `json:"data_source"`      // 数据源标识
	DataSourceQuery string `json:"data_source_query"` // 数据源查询语句

	// 级联配置 (cascader)
	CascadeFields  []string `json:"cascade_fields"` // 级联字段顺序
	CascadeMode    string   `json:"cascade_mode"`   // auto/manual

	// 布局配置
	Span    int    `json:"span"`    // 栅格跨度
	Order   int    `json:"order"`   // 排序
	Group   string `json:"group"`   // 分组
	Tab     string `json:"tab"`     // 选项卡
	Collapse string `json:"collapse"` // 折叠面板

	// 状态
	Disabled bool   `json:"disabled"`
	ReadOnly bool   `json:"read_only"`
	Hidden   bool   `json:"hidden"`
	Visible  bool   `json:"visible"`

	// 默认值
	Default interface{} `json:"default"`

	// 条件渲染
	VisibleWhen  *ConditionExpr `json:"visible_when"`
	RequiredWhen *ConditionExpr `json:"required_when"`
	DisabledWhen *ConditionExpr `json:"disabled_when"`

	// 事件
	Events map[string]string `json:"events"` // onChange/onBlur/onFocus

	// 扩展属性
	Props json.RawMessage `json:"props,omitempty"` // 组件自定义属性 (JSON)

	// 字段关联 (用于表单元数据)
	EntityRef string `json:"entity_ref"` // 关联实体
	FieldRef  string `json:"field_ref"`  // 关联字段

	// 描述
	Description string `json:"description"` // 字段描述

	// 是否支持清空
	Clearable bool `json:"clearable"`

	// 搜索过滤 (适用于 select)
	Filterable bool `json:"filterable"`
}

// FormFieldOption 字段选项
type FormFieldOption struct {
	Key       string                 `json:"key"`       // 选项值
	Label     string                 `json:"label"`     // 选项标签
	Disabled  bool                   `json:"disabled"`  // 是否禁用
	Meta      map[string]interface{} `json:"meta"`      // 扩展元数据
	Children  []FormFieldOption      `json:"children"`  // 子选项 (级联)
}

// ConditionExpr 条件表达式
type ConditionExpr struct {
	Type   Operator   `json:"type"`    // 运算子
	Field  string     `json:"field"`   // 字段名
	Value  interface{} `json:"value"`  // 比较值 (可为数组)
	Logic  string     `json:"logic"`   // and/or
	Groups []ConditionExpr `json:"groups"` // 嵌套条件组
}

// =============================================================================
// 条件渲染
// =============================================================================

// FormCondition 表单级条件渲染规则
type FormCondition struct {
	Name     string          `json:"name"`    // 条件名称
	Group    string          `json:"group"`   // 作用于字段组
	Field    string          `json:"field"`   // 目标字段
	Expr     *ConditionExpr  `json:"expr"`    // 条件表达式
	Actions  []ConditionAction `json:"actions"` // 触发动作
}

// ConditionAction 条件触发动作
type ConditionAction struct {
	Type   string  `json:"type"`   // show/hide/enable/disable/required/readonly
	Target string  `json:"target"` // 目标字段
	Value  bool    `json:"value"`  // 目标状态
}

// =============================================================================
// 表单数据 (用于提交/回显)
// =============================================================================

// FormData 表单数据快照
type FormData struct {
	FormID   string                 `json:"form_id"`   // 表单 ID
	Data     map[string]interface{} `json:"data"`      // 字段值
	RawData  json.RawMessage        `json:"raw_data"`  // 原始 JSON
	CreatedAt time.Time             `json:"created_at"` // 创建时间
}

// ValidatedFormData 校验后的表单数据
type ValidatedFormData struct {
	FormData    *FormData
	Errors      []ValidationError
	IsValid     bool
}

// ValidationError 校验错误
type ValidationError struct {
	Field   string `json:"field"`   // 字段名
	Message string `json:"message"` // 错误消息
	Type    string `json:"type"`    // error/required/pattern/...
	Value   string `json:"value"`   // 当前值
}

// =============================================================================
// 数据转换
// =============================================================================

// FormDataConverter 表单数据转换器 — 从 JSONB 转换为结构化数据
type FormDataConverter struct{}

// NewFormDataConverter 创建数据转换器
func NewFormDataConverter() *FormDataConverter {
	return &FormDataConverter{}
}

// ToFormData 将 Go 结构体转换为 FormData
func (c *FormDataConverter) ToFormData(form *Form, obj interface{}) (*FormData, error) {
	if form == nil || obj == nil {
		return nil, fmt.Errorf("form and obj must not be nil")
	}

	data := make(map[string]interface{})
	v := reflect.ValueOf(obj)
	t := reflect.TypeOf(obj)

	if v.Kind() == reflect.Ptr {
		v = v.Elem()
		t = t.Elem()
	}

	if v.Kind() != reflect.Struct {
		return nil, fmt.Errorf("obj must be a struct or pointer to struct")
	}

	// 遍历结构体字段
	for i := 0; i < v.NumField(); i++ {
		field := v.Field(i)
		fieldType := t.Field(i)
		jsonTag := fieldType.Tag.Get("json")

		if jsonTag == "" || jsonTag == "-" {
			continue
		}

		// 解析 json tag: "field_name,omitempty"
		if idx := len(jsonTag) - 1; jsonTag[idx] == ',' {
			jsonTag = jsonTag[:idx]
		}

		// 如果字段可导出且有值
		if field.CanInterface() {
			data[jsonTag] = field.Interface()
		}
	}

	return &FormData{
		FormID:   form.ID,
		Data:     data,
		CreatedAt: time.Now(),
	}, nil
}

// FromFormData 将 FormData 转换为 Go 结构体
func (c *FormDataConverter) FromFormData(form *Form, data *FormData, dest interface{}) error {
	if form == nil || data == nil || dest == nil {
		return fmt.Errorf("form, data and dest must not be nil")
	}

	// 序列化为 JSON 再反序列化到目标结构体
	raw, err := json.Marshal(data.Data)
	if err != nil {
		return fmt.Errorf("failed to marshal data: %w", err)
	}

	if err := json.Unmarshal(raw, dest); err != nil {
		return fmt.Errorf("failed to unmarshal data into struct: %w", err)
	}

	return nil
}
