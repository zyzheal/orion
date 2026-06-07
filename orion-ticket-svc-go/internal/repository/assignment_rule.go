package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"orion-ticket-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

type AssignmentRuleRepository struct {
	db *sqlx.DB
}

func NewAssignmentRuleRepository(db *sqlx.DB) *AssignmentRuleRepository {
	return &AssignmentRuleRepository{db: db}
}

func (r *AssignmentRuleRepository) Create(ctx context.Context, rule *models.AssignmentRule) error {
	categoriesJSON, err := json.Marshal(rule.Categories)
	if err != nil {
		return fmt.Errorf("marshal categories: %w", err)
	}
	prioritiesJSON, err := json.Marshal(rule.Priorities)
	if err != nil {
		return fmt.Errorf("marshal priorities: %w", err)
	}
	query := `INSERT INTO assignment_rules (id, name, categories, assignee, priorities, enabled, "order")
		VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err = r.db.ExecContext(ctx, query,
		rule.ID, rule.Name, string(categoriesJSON), rule.Assignee,
		string(prioritiesJSON), rule.Enabled, rule.Order,
	)
	return err
}

func (r *AssignmentRuleRepository) List(ctx context.Context) ([]models.AssignmentRule, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id, name, categories, assignee, priorities, enabled, "order", created_at FROM assignment_rules ORDER BY "order", name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []models.AssignmentRule
	for rows.Next() {
		var rule models.AssignmentRule
		var categoriesJSON, prioritiesJSON string
		if err := rows.Scan(&rule.ID, &rule.Name, &categoriesJSON, &rule.Assignee,
			&prioritiesJSON, &rule.Enabled, &rule.Order, &rule.CreatedAt); err != nil {
			continue
		}
		if err := json.Unmarshal([]byte(categoriesJSON), &rule.Categories); err != nil {
			continue
		}
		if err := json.Unmarshal([]byte(prioritiesJSON), &rule.Priorities); err != nil {
			continue
		}
		rules = append(rules, rule)
	}
	return rules, nil
}

func (r *AssignmentRuleRepository) Delete(ctx context.Context, id string) error {
	result, err := r.db.ExecContext(ctx, "DELETE FROM assignment_rules WHERE id = $1", id)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("not found")
	}
	return nil
}

func (r *AssignmentRuleRepository) FindMatching(ctx context.Context, category, priority string) (*models.AssignmentRule, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, name, categories, assignee, priorities, enabled, "order", created_at
		FROM assignment_rules WHERE enabled = true ORDER BY "order"`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var rule models.AssignmentRule
		var categoriesJSON, prioritiesJSON string
		if err := rows.Scan(&rule.ID, &rule.Name, &categoriesJSON, &rule.Assignee,
			&prioritiesJSON, &rule.Enabled, &rule.Order, &rule.CreatedAt); err != nil {
			continue
		}
		if err := json.Unmarshal([]byte(categoriesJSON), &rule.Categories); err != nil {
			continue
		}
		if err := json.Unmarshal([]byte(prioritiesJSON), &rule.Priorities); err != nil {
			continue
		}

		// Check category match
		categoryMatch := len(rule.Categories) == 0
		for _, c := range rule.Categories {
			if c == category {
				categoryMatch = true
				break
			}
		}

		// Check priority match
		priorityMatch := len(rule.Priorities) == 0
		for _, p := range rule.Priorities {
			if p == priority {
				priorityMatch = true
				break
			}
		}

		if categoryMatch && priorityMatch {
			return &rule, nil
		}
	}
	return nil, nil
}
