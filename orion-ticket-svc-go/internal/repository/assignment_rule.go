package repository

import (
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

func (r *AssignmentRuleRepository) Create(rule *models.AssignmentRule) error {
	categoriesJSON, _ := json.Marshal(rule.Categories)
	prioritiesJSON, _ := json.Marshal(rule.Priorities)
	query := `INSERT INTO assignment_rules (id, name, categories, assignee, priorities, enabled, "order")
		VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err := r.db.Exec(query,
		rule.ID, rule.Name, string(categoriesJSON), rule.Assignee,
		string(prioritiesJSON), rule.Enabled, rule.Order,
	)
	return err
}

func (r *AssignmentRuleRepository) List() ([]models.AssignmentRule, error) {
	rows, err := r.db.Query(`SELECT id, name, categories, assignee, priorities, enabled, "order", created_at FROM assignment_rules ORDER BY "order", name`)
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
		json.Unmarshal([]byte(categoriesJSON), &rule.Categories)
		json.Unmarshal([]byte(prioritiesJSON), &rule.Priorities)
		rules = append(rules, rule)
	}
	return rules, nil
}

func (r *AssignmentRuleRepository) Delete(id string) error {
	result, err := r.db.Exec("DELETE FROM assignment_rules WHERE id = $1", id)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("not found")
	}
	return nil
}

func (r *AssignmentRuleRepository) FindMatching(category, priority string) (*models.AssignmentRule, error) {
	rows, err := r.db.Query(
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
		json.Unmarshal([]byte(categoriesJSON), &rule.Categories)
		json.Unmarshal([]byte(prioritiesJSON), &rule.Priorities)

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
