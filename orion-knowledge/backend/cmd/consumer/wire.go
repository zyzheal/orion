//go:build wireinject

package main

import (
	"github.com/google/wire"

	"github.com/orion-platform/orion-knowledge/config"
	handler "github.com/orion-platform/orion-knowledge/handler/mq"
	"github.com/orion-platform/orion-knowledge/log"
	"github.com/orion-platform/orion-knowledge/mq"
)

func createApp() (*App, error) {
	wire.Build(
		wire.Struct(new(App), "*"),
		wire.NewSet(
			config.ProviderSet,
			log.ProviderSet,
			handler.ProviderSet,
		),
	)
	return &App{}, nil
}

type App struct {
	MQConsumer      mq.MQConsumer
	Config          *config.Config
	MQHandlers      *handler.MQHandlers
	StatCronHandler *handler.CronHandler
}
