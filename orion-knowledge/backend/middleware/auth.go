package middleware

import (
	"fmt"

	"github.com/labstack/echo/v4"

	"github.com/orion-platform/orion-knowledge/config"
	"github.com/orion-platform/orion-knowledge/consts"
	"github.com/orion-platform/orion-knowledge/log"
	"github.com/orion-platform/orion-knowledge/repo/pg"
)

type AuthMiddleware interface {
	Authorize(next echo.HandlerFunc) echo.HandlerFunc
	ValidateUserRole(role consts.UserRole) echo.MiddlewareFunc
	ValidateKBUserPerm(role consts.UserKBPermission) echo.MiddlewareFunc
	ValidateLicenseEdition(edition ...consts.LicenseEdition) echo.MiddlewareFunc
	MustGetUserID(c echo.Context) (string, bool)
}

func NewAuthMiddleware(config *config.Config, logger *log.Logger, userAccessRepo *pg.UserAccessRepository, apiTokenRepo *pg.APITokenRepo) (AuthMiddleware, error) {
	switch config.Auth.Type {
	case "jwt":
		return NewJWTMiddleware(config, logger, userAccessRepo, apiTokenRepo), nil
	default:
		return nil, fmt.Errorf("invalid auth type: %s", config.Auth.Type)
	}
}
