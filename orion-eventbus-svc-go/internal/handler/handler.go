package handler

import (
	"net/http"
	"orion/eventbus-svc-go/internal/model"
	"orion/eventbus-svc-go/internal/repository"
	"orion/eventbus-svc-go/internal/service"
	"orion/go-common/pkg/database"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type Handler struct {
	svc *service.EventBusService
	log *zap.Logger
}

func New(db *database.DB, log *zap.Logger) *Handler {
	repo := repository.NewEventBusRepository(db)
	svc := service.NewEventBusService(repo, log)
	return &Handler{svc: svc, log: log}
}

func (h *Handler) PublishEvent(c *gin.Context) {
	var e model.Event
	if err := c.ShouldBindJSON(&e); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.PublishEvent(c.Request.Context(), &e); err != nil {
		h.log.Error("publish event failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	c.JSON(http.StatusCreated, e)
}

func (h *Handler) ListEvents(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	eventType := c.Query("type")
	page := 1
	pageSize := 20
	if p := c.Query("page"); p != "" {
		// parse page
	}
	if ps := c.Query("page_size"); ps != "" {
		// parse pageSize
	}
	events, err := h.svc.ListEvents(c.Request.Context(), tenantID, eventType, page, pageSize)
	if err != nil {
		h.log.Error("list events failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": events})
}

func (h *Handler) CreateSubscription(c *gin.Context) {
	var s model.Subscription
	if err := c.ShouldBindJSON(&s); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.CreateSubscription(c.Request.Context(), &s); err != nil {
		h.log.Error("create subscription failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	c.JSON(http.StatusCreated, s)
}

func (h *Handler) GetSubscription(c *gin.Context) {
	id := c.Param("id")
	s, err := h.svc.GetSubscription(c.Request.Context(), id)
	if err != nil {
		h.log.Error("get subscription failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	if s == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "subscription not found"})
		return
	}
	c.JSON(http.StatusOK, s)
}

func (h *Handler) ListSubscriptions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	subs, err := h.svc.ListSubscriptions(c.Request.Context(), tenantID)
	if err != nil {
		h.log.Error("list subscriptions failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": subs})
}
