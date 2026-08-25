// Plan 09 — 数据库 DevOps 框架 (Handler Template)
//
// 标准 Gin Handler 模板:
//   - 统一请求解析 (BindJSON/BindQuery)
//   - 统一响应格式 (ResponseEnvelope)
//   - 统一错误处理 (c.JSON + error code)
//   - 统一认证 (从 context 提取 tenantID)
package devops

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ============================================================
// 标准 API 响应格式
// ============================================================

type APIResponse struct {
	Success   bool        `json:"success"`
	Data      interface{} `json:"data,omitempty"`
	Error     string      `json:"error,omitempty"`
	Code      string      `json:"code,omitempty"`
	RequestID string      `json:"requestId,omitempty"`
}

type APIListResponse struct {
	Success bool          `json:"success"`
	Data    *ListResponse `json:"data,omitempty"`
	Error   string        `json:"error,omitempty"`
	Code    string        `json:"code,omitempty"`
}

// ============================================================
// 通用 Handler 辅助方法
// ============================================================

// Response 成功响应
func Response(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, APIResponse{
		Success:   true,
		Data:      data,
		RequestID: c.GetString("request_id"),
	})
}

// Created 创建成功响应
func Created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, APIResponse{
		Success:   true,
		Data:      data,
		RequestID: c.GetString("request_id"),
	})
}

// ErrorResponse 错误响应
func ErrorResponse(c *gin.Context, status int, code, message string) {
	c.JSON(status, APIResponse{
		Success:   false,
		Error:     message,
		Code:      code,
		RequestID: c.GetString("request_id"),
	})
}

// NotFoundError 404 响应
func NotFoundError(c *gin.Context, resource string) {
	ErrorResponse(c, http.StatusNotFound, "NOT_FOUND",
		fmt.Sprintf("%s not found", resource))
}

// ValidationError 400 响应
func ValidationError(c *gin.Context, message string) {
	ErrorResponse(c, http.StatusBadRequest, "VALIDATION_ERROR", message)
}

// InternalError 500 响应
func InternalError(c *gin.Context, err error) {
	ErrorResponse(c, http.StatusInternalServerError, "INTERNAL_ERROR",
		"Internal server error")
}

// ============================================================
// 标准 Handler 模板方法
// ============================================================

// StandardCreateHandler 标准创建 Handler
func StandardCreateHandler(service BaseServiceInterface) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req CreateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			ValidationError(c, err.Error())
			return
		}

		tenantID := c.GetString("tenant_id")
		if tenantID == "" {
			tenantID = req.TenantID
		}

		result, err := service.Create(c.Request.Context(), tenantID, &req)
		if err != nil {
			InternalError(c, err)
			return
		}
		Created(c, result)
	}
}

// StandardGetHandler 标准查询 Handler
func StandardGetHandler(service BaseServiceInterface) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		tenantID := c.GetString("tenant_id")

		result, err := service.Get(c.Request.Context(), tenantID, id)
		if err != nil {
			NotFoundError(c, "resource")
			return
		}
		Response(c, result)
	}
}

// StandardListHandler 标准列表 Handler
func StandardListHandler(service BaseServiceInterface) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req ListRequest
		if err := c.ShouldBindQuery(&req); err != nil {
			ValidationError(c, err.Error())
			return
		}
		req = *ValidateListRequest(&req)

		result, err := service.List(c.Request.Context(), &req)
		if err != nil {
			InternalError(c, err)
			return
		}
		c.JSON(http.StatusOK, APIListResponse{
			Success: true,
			Data:    result,
		})
	}
}

// StandardUpdateHandler 标准更新 Handler
func StandardUpdateHandler(service BaseServiceInterface) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var req UpdateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			ValidationError(c, err.Error())
			return
		}
		tenantID := c.GetString("tenant_id")

		result, err := service.Update(c.Request.Context(), tenantID, id, &req)
		if err != nil {
			NotFoundError(c, "resource")
			return
		}
		Response(c, result)
	}
}

// StandardDeleteHandler 标准删除 Handler
func StandardDeleteHandler(service BaseServiceInterface) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		tenantID := c.GetString("tenant_id")

		_, err := service.Delete(c.Request.Context(), tenantID, id)
		if err != nil {
			NotFoundError(c, "resource")
			return
		}
		c.JSON(http.StatusOK, APIResponse{Success: true})
	}
}
