//go:build wireinject

package main

import (
	"github.com/google/wire"

	"github.com/orion-platform/orion-knowledge/config"
	"github.com/orion-platform/orion-knowledge/log"
	"github.com/orion-platform/orion-knowledge/migration"
)

func createApp() (*App, error) {
	wire.Build(
		wire.Struct(new(App), "*"),
		wire.NewSet(
			config.ProviderSet,
			log.ProviderSet,
			migration.ProviderSet,
		),
	)
	return &App{}, nil
}

type App struct {
	Config           *config.Config
	MigrationManager *migration.Manager
}
