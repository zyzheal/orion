package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/orion/code-svc/internal/code-repo/handler"
	"github.com/orion/code-svc/internal/code-repo/repository"
	"github.com/orion/code-svc/internal/code-repo/service"
	"github.com/orion/code-svc/internal/build/handler"
	"github.com/orion/code-svc/internal/build/service"
	"github.com/orion/code-svc/internal/artifact/handler"
	"github.com/orion/code-svc/internal/artifact/service"
	"github.com/orion/code-svc/internal/config"
)

func main() {
	cfg := config.Load()
	db := initDB(cfg.DatabaseURL)

	codeRepoRepo := repository.NewCodeRepoRepository(db)
	codeRepoSvc := service.NewCodeRepoService(codeRepoRepo)
	codeRepoHandler := codeRepoHandler.NewCodeRepoHandler(codeRepoSvc)

	buildSvc := buildSvc.NewBuildService(db)
	buildHandler := buildHandler.NewBuildHandler(buildSvc)

	artifactSvc := artifactSvc.NewArtifactService(db)
	artifactHandler := artifactHandler.NewArtifactHandler(artifactSvc)

	r := gin.Default()
	api := r.Group("/api/v1/code")
	{
		codeRepoHandler.RegisterRoutes(api)
		buildHandler.RegisterRoutes(api)
		artifactHandler.RegisterRoutes(api)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Starting code service on port %s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}

func initDB(dsn string) *sql.DB {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	return db
}
