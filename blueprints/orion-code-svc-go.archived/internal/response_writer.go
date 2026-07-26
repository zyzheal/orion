package internal

import "github.com/gin-gonic/gin"

type SuccessResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type ErrorResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Detail  string `json:"detail,omitempty"`
}

type PaginatedResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
	Total   int64       `json:"total"`
	Page    int         `json:"page"`
	Size    int         `json:"size"`
}

func NewSuccessResponse(data interface{}) SuccessResponse {
	return SuccessResponse{Code: 0, Message: "success", Data: data}
}

func NewErrorResponse(code int, message string, detail string) ErrorResponse {
	return ErrorResponse{Code: code, Message: message, Detail: detail}
}

func NewPaginatedResponse(data interface{}, total int64, page, size int) PaginatedResponse {
	return PaginatedResponse{
		Code:    0,
		Message: "success",
		Data:    data,
		Total:   total,
		Page:    page,
		Size:    size,
	}
}

func Success(c *gin.Context, status int, data interface{}) {
	c.JSON(status, NewSuccessResponse(data))
}

func Error(c *gin.Context, status int, code int, message string) {
	c.JSON(status, NewErrorResponse(code, message, ""))
}
