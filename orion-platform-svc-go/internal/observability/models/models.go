package models

import "time"

type Metric struct {
	Name      string      `json:"name" db:"name"`
	Value     float64     `json:"value" db:"value"`
	Tags      map[string]string `json:"tags" db:"tags"`
	Timestamp time.Time   `json:"timestamp" db:"timestamp"`
}

type Dashboard struct {
	ID    string `json:"id" db:"id"`
	Name  string `json:"name" db:"name"`
	Layout string `json:"layout" db:"layout"`
}

type AlertRule struct {
	ID        string  `json:"id" db:"id"`
	Metric    string  `json:"metric" db:"metric"`
	Operator  string  `json:"operator" db:"operator"`
	Threshold float64 `json:"threshold" db:"threshold"`
	Severity  string  `json:"severity" db:"severity"`
	Enabled   bool    `json:"enabled" db:"enabled"`
}

type MetricQuery struct {
	Name     string `json:"name"`
	From     string `json:"from"`
	To       string `json:"to"`
	Aggregate string `json:"aggregate"`
}
