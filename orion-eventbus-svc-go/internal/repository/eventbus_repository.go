package repository

import (
	"context"
	"orion/eventbus-svc-go/internal/model"
	"orion/go-common/pkg/database"
)

type EventBusRepository struct {
	db *database.DB
}

func NewEventBusRepository(db *database.DB) *EventBusRepository {
	return &EventBusRepository{db: db}
}

func (r *EventBusRepository) CreateEvent(ctx context.Context, e *model.Event) error {
	_, err := r.db.NamedExecContext(ctx, `INSERT INTO events (id, tenant_id, type, source, payload, priority, created_at) VALUES (:id, :tenant_id, :type, :source, :payload, :priority, :created_at)`, e)
	return err
}

func (r *EventBusRepository) ListEvents(ctx context.Context, tenantID, eventType string, page, pageSize int) ([]model.Event, error) {
	var events []model.Event
	args := []interface{}{tenantID}
	query := "SELECT * FROM events WHERE tenant_id = $1"
	if eventType != "" {
		query += " AND type = $2"
		args = append(args, eventType)
	}
	query += " ORDER BY created_at DESC LIMIT $3 OFFSET $4"
	args = append(args, pageSize, (page-1)*pageSize)
	err := r.db.SelectContext(ctx, &events, query, args...)
	return events, err
}

func (r *EventBusRepository) CreateSubscription(ctx context.Context, s *model.Subscription) error {
	_, err := r.db.NamedExecContext(ctx, `INSERT INTO subscriptions (id, tenant_id, name, event_types, callback_url, secret, enabled, created_at, updated_at) VALUES (:id, :tenant_id, :name, :event_types, :callback_url, :secret, :enabled, :created_at, :updated_at)`, s)
	return err
}

func (r *EventBusRepository) ListSubscriptions(ctx context.Context, tenantID string) ([]model.Subscription, error) {
	var subs []model.Subscription
	err := r.db.SelectContext(ctx, &subs, "SELECT * FROM subscriptions WHERE tenant_id = $1", tenantID)
	return subs, err
}

func (r *EventBusRepository) FindSubscriptionByID(ctx context.Context, id string) (*model.Subscription, error) {
	var sub model.Subscription
	err := r.db.GetContext(ctx, &sub, "SELECT * FROM subscriptions WHERE id = $1", id)
	if err != nil {
		return nil, err
	}
	return &sub, nil
}

func (r *EventBusRepository) CreateEventDelivery(ctx context.Context, d *model.EventDelivery) error {
	_, err := r.db.NamedExecContext(ctx, `INSERT INTO event_deliveries (id, event_id, subscription_id, status, created_at) VALUES (:id, :event_id, :subscription_id, :status, :created_at)`, d)
	return err
}

func (r *EventBusRepository) UpdateEventDelivery(ctx context.Context, d *model.EventDelivery) error {
	_, err := r.db.NamedExecContext(ctx, `UPDATE event_deliveries SET status = :status, response_code = :response_code, response_body = :response_body, delivered_at = :delivered_at WHERE id = :id`, d)
	return err
}
