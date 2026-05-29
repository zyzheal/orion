package main

import (
	"context"
	"fmt"
	"net/http"

	_ "github.com/lib/pq"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
	"go.uber.org/zap"

	"orion-ticket-svc-go/internal/config"
	"orion-ticket-svc-go/internal/handler"
	"orion-ticket-svc-go/internal/middleware"
	"orion-ticket-svc-go/internal/otel"
	"orion-ticket-svc-go/internal/repository"
	"orion-ticket-svc-go/internal/service"
)

func runMigrations(db *sqlx.DB) error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS tickets (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			tenant_id UUID NOT NULL,
			title VARCHAR(255) NOT NULL,
			description TEXT,
			type VARCHAR(50),
			priority VARCHAR(50),
			status VARCHAR(50),
			created_by VARCHAR(255),
			assigned_to VARCHAR(500),
			resolved_at TIMESTAMP,
			closed_at TIMESTAMP,
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS ticket_comments (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			ticket_id UUID REFERENCES tickets(id),
			author VARCHAR(255),
			content TEXT,
			is_internal BOOLEAN DEFAULT false,
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS ticket_attachments (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			ticket_id UUID REFERENCES tickets(id),
			file_name VARCHAR(255),
			file_path VARCHAR(500),
			file_size BIGINT,
			uploaded_by VARCHAR(255),
			created_at TIMESTAMP DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_tickets_tenant ON tickets(tenant_id)`,
		`CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)`,
		`CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to)`,
		`CREATE INDEX IF NOT EXISTS idx_comments_ticket ON ticket_comments(ticket_id)`,
		`CREATE INDEX IF NOT EXISTS idx_attachments_ticket ON ticket_attachments(ticket_id)`,
	}

	for _, sql := range migrations {
		if _, err := db.Exec(sql); err != nil {
			return fmt.Errorf("migration failed: %w", err)
		}
	}
	return nil
}

func main() {
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("failed to load config", zap.Error(err))
	}

	// Initialize tracer
	ctx := context.Background()
	cleanupTracer, err := otel.InitTracer(ctx, &cfg.Otel, logger)
	if err != nil {
		logger.Warn("failed to init tracer", zap.Error(err))
	}
	defer cleanupTracer()

	// Connect to database
	db, err := sqlx.Connect("postgres", cfg.Database.DSN())
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()

	// Run migrations
	if err := runMigrations(db); err != nil {
		logger.Fatal("failed to run migrations", zap.Error(err))
	}
	logger.Info("migrations completed")

	// Set up gin
	gin.SetMode(cfg.Server.Mode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(otelgin.Middleware(cfg.Otel.ServiceName))
	r.Use(cors.Default())

	// Middleware
	authMW := middleware.NewAuthMiddleware(cfg)

	// Initialize dependencies
	ticketRepo := repository.NewTicketRepository(db)
	commentRepo := repository.NewCommentRepository(db)
	ticketSvc := service.NewTicketService(ticketRepo, commentRepo)
	ticketHandler := handler.NewTicketHandler(ticketSvc)

	// Routes
	v1 := r.Group("/api/v1")
	v1.Use(authMW.Handle(), middleware.TenantMiddleware())
	{
		v1.GET("/tickets", ticketHandler.ListTickets)
		v1.POST("/tickets", ticketHandler.CreateTicket)
		v1.GET("/tickets/:id", ticketHandler.GetTicket)
		v1.PUT("/tickets/:id", ticketHandler.UpdateTicket)
		v1.DELETE("/tickets/:id", ticketHandler.DeleteTicket)
		v1.GET("/tickets/count", ticketHandler.Count)
		v1.POST("/tickets/:id/assign", ticketHandler.AssignTicket)
		v1.POST("/tickets/:id/resolve", ticketHandler.ResolveTicket)
		v1.GET("/tickets/:id/comments", ticketHandler.ListComments)
		v1.POST("/tickets/:id/comments", ticketHandler.CreateComment)
	}

	// Health check (no auth)
	r.GET("/healthz", func(c *gin.Context) {
		if err := db.Ping(); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy", "db": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "orion-ticket-svc",
			"version": "1.0.0",
		})
	})

	// Ready check
	r.GET("/readyz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	})

	addr := fmt.Sprintf(":%d", cfg.Server.Port)
	logger.Info("starting ticket service", zap.Int("port", cfg.Server.Port))
	if err := r.Run(addr); err != nil {
		logger.Fatal("server failed", zap.Error(err))
	}
}
