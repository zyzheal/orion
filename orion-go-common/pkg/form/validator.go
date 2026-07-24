package form

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

// =============================================================================
// FormValidator 校验引擎
// =============================================================================
// 设计原则:
//   1. 基于 FormField 定义声明式校验规则 (required/pattern/min/max/...)
//   2. 支持条件校验 (required_when/visible_when)
//   3. 支持字段间校验 (InterFieldRule)
//   4. 返回结构化的 ValidationError 列表

type FormValidator struct {
	form       *Form
	formattedErrors []ValidationError
}

// NewFormValidator 创建校验器
func NewFormValidator(form *Form) *FormValidator {
	return &FormValidator{
		form:            form,
		formattedErrors: make([]ValidationError, 0),
	}
}

// Validate 校验表单数据
func (v *FormValidator) Validate(data map[string]interface{}) *ValidatedFormData {
	v.formattedErrors = make([]ValidationError, 0)

	if v.form == nil {
		return &ValidatedFormData{
			IsValid: false,
			Errors:  v.formattedErrors,
		}
	}

	// 1. 逐字段校验
	for _, field := range v.form.Fields {
		if field.Hidden {
			continue
		}

		value, ok := data[field.Key]
		fieldErrors := v.validateField(field, value, ok, data)
		v.formattedErrors = append(v.formattedErrors, fieldErrors...)
	}

	// 2. 字段间校验
	if v.form.Rules != nil {
		for _, rule := range v.form.Rules.InterFieldRules {
			errors := v.validateInterField(rule, data)
			v.formattedErrors = append(v.formattedErrors, errors...)
		}
	}

	return &ValidatedFormData{
		FormData: &FormData{
			FormID: v.form.ID,
			Data:   data,
		},
		Errors:  v.formattedErrors,
		IsValid: len(v.formattedErrors) == 0,
	}
}

// validateField 校验单个字段
func (v *FormValidator) validateField(field FormField, value interface{}, exists bool, allData map[string]interface{}) []ValidationError {
	var errors []ValidationError

	// 条件校验: 检查是否满足 required_when
	if field.RequiredWhen != nil {
		meetsCondition := v.evalCondition(field.RequiredWhen, allData)
		if meetsCondition {
			field.Required = true
		}
	}

	// 必填校验
	if field.Required && (!exists || v.isEmptyValue(value)) {
		msg := field.RequiredMsg
		if msg == "" {
			msg = fmt.Sprintf("%s 为必填项", field.Label)
		}
		errors = append(errors, ValidationError{
			Field:   field.Key,
			Message: msg,
			Type:    "required",
		})
		return errors // 必填失败时跳过后续校验
	}

	if !exists || v.isEmptyValue(value) {
		return errors
	}

	// 最小长度校验 (字符串类型)
	if field.MinLength != nil {
		strVal, ok := value.(string)
		if ok && len(strVal) < *field.MinLength {
			errors = append(errors, ValidationError{
				Field:   field.Key,
				Message: fmt.Sprintf("%s 长度不能少于 %d 个字符", field.Label, *field.MinLength),
				Type:    "min_length",
				Value:   strVal,
			})
		}
	}

	// 最大长度校验 (字符串类型)
	if field.MaxLength != nil {
		strVal, ok := value.(string)
		if ok && len(strVal) > *field.MaxLength {
			errors = append(errors, ValidationError{
				Field:   field.Key,
				Message: fmt.Sprintf("%s 长度不能超过 %d 个字符", field.Label, *field.MaxLength),
				Type:    "max_length",
				Value:   strVal,
			})
		}
	}

	// 最小值校验 (数字类型)
	if field.Min != nil {
		numVal := v.toFloat64(value)
		if numVal != nil && *numVal < *field.Min {
			errors = append(errors, ValidationError{
				Field:   field.Key,
				Message: fmt.Sprintf("%s 不能小于 %v", field.Label, *field.Min),
				Type:    "min",
				Value:   fmt.Sprintf("%v", value),
			})
		}
	}

	// 最大值校验 (数字类型)
	if field.Max != nil {
		numVal := v.toFloat64(value)
		if numVal != nil && *numVal > *field.Max {
			errors = append(errors, ValidationError{
				Field:   field.Key,
				Message: fmt.Sprintf("%s 不能大于 %v", field.Label, *field.Max),
				Type:    "max",
				Value:   fmt.Sprintf("%v", value),
			})
		}
	}

	// 正则校验
	if field.Pattern != "" {
		strVal, ok := value.(string)
		if ok {
			re, err := regexp.Compile(field.Pattern)
			if err != nil {
				errors = append(errors, ValidationError{
					Field:   field.Key,
					Message: fmt.Sprintf("正则表达式无效: %v", err),
					Type:    "pattern",
				})
			} else if !re.MatchString(strVal) {
				msg := field.PatternMsg
				if msg == "" {
					msg = fmt.Sprintf("%s 格式不正确", field.Label)
				}
				errors = append(errors, ValidationError{
					Field:   field.Key,
					Message: msg,
					Type:    "pattern",
					Value:   strVal,
				})
			}
		}
	}

	return errors
}

// validateInterField 字段间校验
func (v *FormValidator) validateInterField(rule InterFieldRule, data map[string]interface{}) []ValidationError {
	var errors []ValidationError

	srcVal, srcOk := data[rule.Source]
	dstVal, dstOk := data[rule.Target]

	switch rule.Type {
	case "comparison":
		// 比较规则: source op target
		srcNum := v.toFloat64(srcVal)
		dstNum := v.toFloat64(dstVal)
		if srcNum != nil && dstNum != nil {
			violated := false
			switch rule.Op {
			case "gt":
				violated = *srcNum <= *dstNum
			case "lt":
				violated = *srcNum >= *dstNum
			case "gte":
				violated = *srcNum < *dstNum
			case "lte":
				violated = *srcNum > *dstNum
			case "eq":
				violated = *srcNum != *dstNum
			}
			if violated {
				errors = append(errors, ValidationError{
					Field:   rule.Source,
					Message: rule.Message,
					Type:    "inter_field",
					Value:   fmt.Sprintf("%v", srcVal),
				})
			}
		}

	case "consistency":
		// 一致性规则: source == target (如 密码确认)
		srcStr := v.toString(srcVal)
		dstStr := v.toString(dstVal)
		if srcOk && dstOk && srcStr != dstStr {
			errors = append(errors, ValidationError{
				Field:   rule.Source,
				Message: rule.Message,
				Type:    "consistency",
				Value:   srcStr,
			})
		}

	case "range":
		// 范围规则: min <= source <= max
		minStr := v.toString(data["min"])
		maxStr := v.toString(data["max"])
		if minStr != "" && maxStr != "" {
			// TODO: 实现范围校验
		}
	}

	return errors
}

// evalCondition 评估条件表达式
func (v *FormValidator) evalCondition(expr *ConditionExpr, data map[string]interface{}) bool {
	if expr == nil {
		return true
	}

	// 处理逻辑组合
	if expr.Logic != "" && len(expr.Groups) > 0 {
		for _, g := range expr.Groups {
			result := v.evalCondition(&g, data)
			if expr.Logic == "or" && result {
				return true
			}
			if expr.Logic == "and" && !result {
				return false
			}
		}
		return expr.Logic == "or"
	}

	// 单条件评估
	fieldValue := data[expr.Field]
	return v.compareValues(fieldValue, expr.Value, expr.Type)
}

// compareValues 比较两个值
func (v *FormValidator) compareValues(actual, expected interface{}, op Operator) bool {
	actualStr := v.toString(actual)
	expectedStr := v.toString(expected)
	expectedNum := v.toFloat64(expected)
	actualNum := v.toFloat64(actual)

	switch op {
	case OpEqual:
		return actualStr == expectedStr
	case OpNotEqual:
		return actualStr != expectedStr
	case OpContains:
		return strings.Contains(actualStr, expectedStr)
	case OpNotContains:
		return !strings.Contains(actualStr, expectedStr)
	case OpGreater:
		if actualNum != nil && expectedNum != nil {
			return *actualNum > *expectedNum
		}
		return false
	case OpLess:
		if actualNum != nil && expectedNum != nil {
			return *actualNum < *expectedNum
		}
		return false
	case OpGreaterEq:
		if actualNum != nil && expectedNum != nil {
			return *actualNum >= *expectedNum
		}
		return false
	case OpLessEq:
		if actualNum != nil && expectedNum != nil {
			return *actualNum <= *expectedNum
		}
		return false
	case OpEmpty:
		return v.isEmptyValue(actual)
	case OpNotEmpty:
		return !v.isEmptyValue(actual)
	case OpIn:
		if arr, ok := expected.([]interface{}); ok {
			for _, item := range arr {
				if v.toString(item) == actualStr {
					return true
				}
			}
		}
		return false
	case OpNotIn:
		if arr, ok := expected.([]interface{}); ok {
			for _, item := range arr {
				if v.toString(item) == actualStr {
					return false
				}
			}
			return true
		}
		return true
	case OpLike:
		return strings.Contains(actualStr, expectedStr)
	default:
		return true
	}
}

// 辅助方法
func (v *FormValidator) isEmptyValue(val interface{}) bool {
	if val == nil {
		return true
	}
	switch v := val.(type) {
	case string:
		return strings.TrimSpace(v) == ""
	case []interface{}:
		return len(v) == 0
	case map[string]interface{}:
		return len(v) == 0
	default:
		return false
	}
}

func (v *FormValidator) toString(val interface{}) string {
	if val == nil {
		return ""
	}
	if str, ok := val.(string); ok {
		return str
	}
	if num, ok := val.(float64); ok {
		return fmt.Sprintf("%g", num)
	}
	raw, err := json.Marshal(val)
	if err != nil {
		return fmt.Sprintf("%v", val)
	}
	return string(raw)
}

func (v *FormValidator) toFloat64(val interface{}) *float64 {
	if val == nil {
		return nil
	}
	switch v := val.(type) {
	case float64:
		return &v
	case int:
		f := float64(v)
		return &f
	case int64:
		f := float64(v)
		return &f
	case string:
		var f float64
		_, err := fmt.Sscanf(v, "%f", &f)
		if err != nil {
			return nil
		}
		return &f
	default:
		return nil
	}
}
