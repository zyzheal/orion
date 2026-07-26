package handler

import (
    "net/http"

    "orion/go-common/pkg/errors"

    "github.com/gin-gonic/gin"
)

func respondSuccess(c *gin.Context, data any)              { errors.WriteSuccess(c, data) }
func respondCreated(c *gin.Context, data any)              { errors.WriteCreated(c, data) }
func respondNotFound(c *gin.Context, msg string)           { errors.WriteError(c, errors.ErrNotFound, msg, http.StatusNotFound) }
func respondBadRequest(c *gin.Context, msg string)         { errors.WriteError(c, errors.ErrBadRequest, msg, http.StatusBadRequest) }
func respondConflict(c *gin.Context, msg string)           { errors.WriteError(c, errors.ErrConflict, msg, http.StatusConflict) }
func respondForbidden(c *gin.Context, msg string)          { errors.WriteError(c, errors.ErrForbidden, msg, http.StatusForbidden) }
func respondInternalError(c *gin.Context, msg string)      { errors.WriteError(c, errors.ErrInternal, msg, http.StatusInternalServerError) }
