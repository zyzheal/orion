// Package server wires the domain CQRS handler to the Gin router.
package main

import (
	"go.uber.org/zap"
	"orion/go-common/pkg/database"

	domain_commands "orion/platform-svc-go/internal/domain/commands"
	domain_events "orion/platform-svc-go/internal/domain/events"
	domain_handler "orion/platform-svc-go/internal/domain/handler"
	domain_service "orion/platform-svc-go/internal/domain/service"
)

var domainCqrsH *domain_handler.Handler

func wireDomainCQRS(db *database.DB, logger *zap.Logger) {
	_ = db
	bus := domain_commands.NewInMemoryCommandBus()
	publisher := domain_events.NewInMemoryEventPublisher()
	svc := domain_service.NewService(bus, publisher, nil, nil, logger)
	domainCqrsH = domain_handler.NewHandler(bus, publisher, svc, logger)
}