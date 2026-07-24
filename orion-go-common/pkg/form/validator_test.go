package form

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestFormValidator_RequiredField(t *testing.T) {
	form := &Form{
		ID: "test-form-1",
		Title: "审批表单",
		Fields: []FormField{
			{
				Key:      "approval_name",
				Label:    "审批名称",
				Type:     FieldTypeInput,
				Required: true,
			},
			{
				Key:      "description",
				Label:    "描述",
				Type:     FieldTypeTextArea,
				Required: false,
			},
		},
	}

	v := NewFormValidator(form)

	// 必填字段缺失
	result := v.Validate(map[string]interface{}{})
	if result.IsValid {
		t.Error("expected validation to fail for missing required field")
	}
	if len(result.Errors) != 1 {
		t.Errorf("expected 1 error, got %d", len(result.Errors))
	}
	if result.Errors[0].Field != "approval_name" {
		t.Errorf("expected field 'approval_name', got '%s'", result.Errors[0].Field)
	}

	// 必填字段已填写
	result = v.Validate(map[string]interface{}{
		"approval_name": "测试审批",
	})
	if !result.IsValid {
		t.Errorf("expected validation to pass, errors: %v", result.Errors)
	}
}

func TestFormValidator_LengthValidation(t *testing.T) {
	form := &Form{
		ID: "test-form-2",
		Title: "用户信息",
		Fields: []FormField{
			{
				Key:        "username",
				Label:      "用户名",
				Type:       FieldTypeInput,
				Required:   true,
				MinLength:  intPtr(3),
				MaxLength:  intPtr(20),
			},
		},
	}

	v := NewFormValidator(form)

	// 太短
	result := v.Validate(map[string]interface{}{
		"username": "ab",
	})
	if result.IsValid {
		t.Error("expected min_length validation to fail")
	}

	// 太长
	result = v.Validate(map[string]interface{}{
		"username": "this_username_is_way_too_long",
	})
	if result.IsValid {
		t.Error("expected max_length validation to fail")
	}

	// 合法
	result = v.Validate(map[string]interface{}{
		"username": "alice",
	})
	if !result.IsValid {
		t.Errorf("expected valid input to pass, errors: %v", result.Errors)
	}
}

func TestFormValidator_NumericRange(t *testing.T) {
	form := &Form{
		ID: "test-form-3",
		Title: "配置表单",
		Fields: []FormField{
			{
				Key:    "port",
				Label:  "端口号",
				Type:   FieldTypeNumber,
				Min:    float64Ptr(1024),
				Max:    float64Ptr(65535),
			},
		},
	}

	v := NewFormValidator(form)

	// 太小
	result := v.Validate(map[string]interface{}{
		"port": float64(80),
	})
	if result.IsValid {
		t.Error("expected min validation to fail")
	}

	// 太大
	result = v.Validate(map[string]interface{}{
		"port": float64(99999),
	})
	if result.IsValid {
		t.Error("expected max validation to fail")
	}

	// 合法
	result = v.Validate(map[string]interface{}{
		"port": float64(8080),
	})
	if !result.IsValid {
		t.Errorf("expected valid number to pass, errors: %v", result.Errors)
	}
}

func TestFormValidator_PatternValidation(t *testing.T) {
	form := &Form{
		ID: "test-form-4",
		Title: "注册表单",
		Fields: []FormField{
			{
				Key:       "email",
				Label:     "邮箱",
				Type:      FieldTypeInput,
				Required:  true,
				Pattern:   `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`,
				PatternMsg: "邮箱格式不正确",
			},
		},
	}

	v := NewFormValidator(form)

	// 非法邮箱
	result := v.Validate(map[string]interface{}{
		"email": "not-an-email",
	})
	if result.IsValid {
		t.Error("expected pattern validation to fail")
	}
	if len(result.Errors) > 0 && result.Errors[0].Type != "pattern" {
		t.Errorf("expected pattern error type, got '%s'", result.Errors[0].Type)
	}

	// 合法邮箱
	result = v.Validate(map[string]interface{}{
		"email": "user@example.com",
	})
	if !result.IsValid {
		t.Errorf("expected valid email to pass, errors: %v", result.Errors)
	}
}

func TestFormValidator_ConditionalRequired(t *testing.T) {
	form := &Form{
		ID: "test-form-5",
		Title: "条件必填",
		Fields: []FormField{
			{
				Key:   "type",
				Label: "类型",
				Type:  FieldTypeSelect,
				Options: []FormFieldOption{
					{Key: "internal", Label: "内部"},
					{Key: "external", Label: "外部"},
				},
			},
			{
				Key:   "external_url",
				Label: "外部链接",
				Type:  FieldTypeInput,
				RequiredWhen: &ConditionExpr{
					Type:  OpEqual,
					Field: "type",
					Value: "external",
				},
			},
		},
	}

	v := NewFormValidator(form)

	// type=internal 时 external_url 不必填
	result := v.Validate(map[string]interface{}{
		"type": "internal",
	})
	if !result.IsValid {
		t.Errorf("expected valid when internal, errors: %v", result.Errors)
	}

	// type=external 时 external_url 必填
	result = v.Validate(map[string]interface{}{
		"type": "external",
	})
	if result.IsValid {
		t.Error("expected conditional required to trigger")
	}
}

func TestFormValidator_InterFieldConsistency(t *testing.T) {
	form := &Form{
		ID: "test-form-6",
		Title: "密码确认",
		Fields: []FormField{
			{Key: "password", Label: "密码", Type: FieldTypeInput, Required: true},
			{Key: "confirm_password", Label: "确认密码", Type: FieldTypeInput, Required: true},
		},
		Rules: &FormRules{
			InterFieldRules: []InterFieldRule{
				{
					Name:    "confirm_password_match",
					Type:    "consistency",
					Message: "两次密码输入不一致",
					Source:  "password",
					Target:  "confirm_password",
				},
			},
		},
	}

	v := NewFormValidator(form)

	// 不一致
	result := v.Validate(map[string]interface{}{
		"password":        "secret123",
		"confirm_password": "wrong",
	})
	if result.IsValid {
		t.Error("expected consistency validation to fail")
	}

	// 一致
	// 注意：由于 InterField 在校验函数中处理，需要确保规则执行
	// 此处测试确保规则被解析
	_ = result
}

func TestFormValidator_NestedConditions(t *testing.T) {
	form := &Form{
		ID: "test-form-7",
		Title: "嵌套条件",
		Fields: []FormField{
			{
				Key:   "region",
				Label: "地区",
				Type:  FieldTypeSelect,
				Options: []FormFieldOption{
					{Key: "china", Label: "中国"},
					{Key: "us", Label: "美国"},
				},
			},
			{
				Key:   "city",
				Label: "城市",
				Type:  FieldTypeInput,
			},
			{
				Key:   "zip_code",
				Label: "邮编",
				Type:  FieldTypeInput,
				RequiredWhen: &ConditionExpr{
					Type:  OpEqual,
					Field: "city",
					Value: "beijing",
					Logic: "and",
					Groups: []ConditionExpr{
						{Type: OpEqual, Field: "region", Value: "china"},
					},
				},
			},
		},
	}

	v := NewFormValidator(form)

	// 所有条件满足
	result := v.Validate(map[string]interface{}{
		"region":   "china",
		"city":     "beijing",
		"zip_code": "100000",
	})
	if !result.IsValid {
		t.Errorf("expected valid when conditions met, errors: %v", result.Errors)
	}
}

func TestFormValidator_EmptyValue(t *testing.T) {
	form := &Form{
		ID: "test-form-8",
		Title: "空值测试",
		Fields: []FormField{
			{Key: "name", Label: "名称", Type: FieldTypeInput, Required: true},
		},
	}

	v := NewFormValidator(form)

	// 空字符串
	result := v.Validate(map[string]interface{}{
		"name": "",
	})
	if result.IsValid {
		t.Error("expected empty string to fail required validation")
	}

	// 空格字符串
	result = v.Validate(map[string]interface{}{
		"name": "   ",
	})
	if result.IsValid {
		t.Error("expected whitespace-only to fail required validation")
	}
}

func TestFormValidator_OpIn(t *testing.T) {
	form := &Form{
		ID: "test-form-9",
		Title: "操作符测试",
		Fields: []FormField{
			{
				Key:   "status",
				Label: "状态",
				Type:  FieldTypeSelect,
				Options: []FormFieldOption{
					{Key: "active", Label: "活跃"},
					{Key: "inactive", Label: "非活跃"},
				},
				RequiredWhen: &ConditionExpr{
					Type:  OpIn,
					Field: "status",
					Value: []interface{}{"active", "inactive"},
				},
			},
		},
	}

	v := NewFormValidator(form)
	result := v.Validate(map[string]interface{}{
		"status": "active",
	})
	if !result.IsValid {
		t.Errorf("expected op_in to pass, errors: %v", result.Errors)
	}
}

// 辅助方法
func intPtr(i int) *int {
	return &i
}

func float64Ptr(f float64) *float64 {
	return &f
}

func TestFormRenderer_RenderJSON(t *testing.T) {
	form := &Form{
		ID: "form-1",
		Name: "审批表单",
		Title: "审批申请",
		Fields: []FormField{
			{
				Key:      "title",
				Label:    "标题",
				Type:     FieldTypeInput,
				Required: true,
			},
			{
				Key:   "status",
				Label: "状态",
				Type:  FieldTypeSelect,
				Options: []FormFieldOption{
					{Key: "draft", Label: "草稿"},
					{Key: "submitted", Label: "已提交"},
				},
			},
		},
	}

	renderer := NewFormRenderer(form)
	schemaBytes, err := renderer.RenderJSON()
	if err != nil {
		t.Fatalf("RenderJSON failed: %v", err)
	}

	var schema map[string]interface{}
	if err := json.Unmarshal(schemaBytes, &schema); err != nil {
		t.Fatalf("failed to unmarshal schema: %v", err)
	}

	if schema["title"] != "审批申请" {
		t.Errorf("expected title '审批申请', got '%v'", schema["title"])
	}

	properties := schema["properties"].(map[string]interface{})
	if len(properties) != 2 {
		t.Errorf("expected 2 properties, got %d", len(properties))
	}
}

func TestFormRenderer_RenderHTML(t *testing.T) {
	form := &Form{
		ID: "form-2",
		Title: "用户信息",
		Fields: []FormField{
			{Key: "username", Label: "用户名", Type: FieldTypeInput, Required: true},
			{Key: "email", Label: "邮箱", Type: FieldTypeInput},
		},
	}

	renderer := NewFormRenderer(form)
	htmlBytes, err := renderer.RenderHTML()
	if err != nil {
		t.Fatalf("RenderHTML failed: %v", err)
	}

	html := string(htmlBytes)
	if !strings.Contains(html, "用户名") {
		t.Error("expected HTML to contain '用户名'")
	}
	if !strings.Contains(html, "邮箱") {
		t.Error("expected HTML to contain '邮箱'")
	}
}

func TestFormDataConverter_ToFormData(t *testing.T) {
	type TestStruct struct {
		Name  string `json:"name"`
		Email string `json:"email"`
		Age   int    `json:"age"`
	}

	form := &Form{ID: "test-1"}
	obj := &TestStruct{
		Name:  "alice",
		Email: "alice@example.com",
		Age:   30,
	}

	converter := NewFormDataConverter()
	result, err := converter.ToFormData(form, obj)
	if err != nil {
		t.Fatalf("ToFormData failed: %v", err)
	}

	if result.Data["name"] != "alice" {
		t.Errorf("expected name 'alice', got '%v'", result.Data["name"])
	}
	if result.Data["age"] != 30 {
		t.Errorf("expected age 30, got '%v'", result.Data["age"])
	}
}
