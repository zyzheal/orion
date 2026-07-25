package code

import "github.com/gin-gonic/gin"

// SuccessResponse is a standard success envelope.
type SuccessResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// ErrorResponse is a standard error envelope.
type ErrorResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Detail  string `json:"detail,omitempty"`
}

// PaginatedResponse is a paginated list envelope.
type PaginatedResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
	Total   int64       `json:"total"`
	Page    int         `json:"page"`
	Size    int         `json:"size"`
}

// NewSuccessResponse creates a success envelope.
func NewSuccessResponse(data interface{}) SuccessResponse {
	return SuccessResponse{Code: 0, Message: "success", Data: data}
}

// NewErrorResponse creates an error envelope.
func NewErrorResponse(code int, message string, detail string) ErrorResponse {
	return ErrorResponse{Code: code, Message: message, Detail: detail}
}

// NewPaginatedResponse creates a paginated envelope.
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

// Success writes a success response.
func Success(c *gin.Context, status int, data interface{}) {
	c.JSON(status, NewSuccessResponse(data))
}

// Error writes an error response.
func Error(c *gin.Context, status int, code int, message string) {
	c.JSON(status, NewErrorResponse(code, message, ""))
}
