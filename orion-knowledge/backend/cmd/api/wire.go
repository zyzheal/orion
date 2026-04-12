//go:build wireinject

package main

import (
	"github.com/google/wire"

	"github.com/orion-platform/orion-knowledge/config"
	share "github.com/orion-platform/orion-knowledge/handler/share"
	v1 "github.com/orion-platform/orion-knowledge/handler/v1"
	"github.com/orion-platform/orion-knowledge/log"
	"github.com/orion-platform/orion-knowledge/server/http"
	"github.com/orion-platform/orion-knowledge/telemetry"
)

func createApp() (*App, error) {
	wire.Build(
		wire.Struct(new(App), "*"),
		wire.NewSet(
			config.ProviderSet,
			log.ProviderSet,
			telemetry.ProviderSet,

			http.ProviderSet,
			v1.ProviderSet,
			share.ProviderSet,
		),
	)
	return &App{}, nil
}

type App struct {
	HTTPServer    *http.HTTPServer
	Handlers      *v1.APIHandlers
	ShareHandlers *share.ShareHandler
	Config        *config.Config
	Logger        *log.Logger
	Telemetry     *telemetry.Client
}
