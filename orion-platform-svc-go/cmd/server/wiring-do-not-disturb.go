package main

import (
	"orion/go-common/pkg/database"

	dnd_handler "orion/platform-svc-go/internal/do-not-disturb/handler"
	dnd_repo "orion/platform-svc-go/internal/do-not-disturb/repository"
	dnd_service "orion/platform-svc-go/internal/do-not-disturb/service"
)

var dndH *dnd_handler.Handler

func wireDoNotDisturb(db *database.DB) {
	dndRepo := dnd_repo.NewRepository(db.DB)
	dndSvc := dnd_service.NewService(dndRepo)
	dndH = dnd_handler.NewHandler(dndSvc)
}
