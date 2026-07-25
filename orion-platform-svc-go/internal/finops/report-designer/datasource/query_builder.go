package datasource

import (
	"fmt"
	"strings"
)

// QueryBuilder constructs queries for different data source types.
type QueryBuilder struct {
	dsType DataSourceType
}

// NewQueryBuilder creates a new QueryBuilder for the given data source type.
func NewQueryBuilder(dsType DataSourceType) *QueryBuilder {
	return &QueryBuilder{dsType: dsType}
}

// BuildSelect builds a SELECT-style query for database sources.
// Columns are comma-separated, where clause is optional.
func (qb *QueryBuilder) BuildSelect(columns, table, where string, params map[string]interface{}) string {
	var parts []string
	if where != "" {
		parts = append(parts, fmt.Sprintf("WHERE %s", where))
	}
	return fmt.Sprintf("SELECT %s FROM %s %s", columns, table, strings.Join(parts, " "))
}

// BuildWhere builds a WHERE clause from key-value pairs.
func (qb *QueryBuilder) BuildWhere(conditions map[string]string) string {
	if len(conditions) == 0 {
		return ""
	}
	parts := make([]string, 0, len(conditions))
	for k, v := range conditions {
		parts = append(parts, fmt.Sprintf("%s = %s", k, v))
	}
	return strings.Join(parts, " AND ")
}

// BuildOrder builds an ORDER BY clause.
func (qb *QueryBuilder) BuildOrder(column string, ascending bool) string {
	dir := "ASC"
	if !ascending {
		dir = "DESC"
	}
	return fmt.Sprintf("ORDER BY %s %s", column, dir)
}

// BuildLimit builds a LIMIT clause.
func (qb *QueryBuilder) BuildLimit(limit int) string {
	return fmt.Sprintf("LIMIT %d", limit)
}

// BuildSQLQuery builds a complete SQL query with optional filters, ordering, and limits.
func (qb *QueryBuilder) BuildSQLQuery(table string, columns []string, filters map[string]string,
	orderColumn string, ascending bool, limit int,
) string {
	colStr := strings.Join(columns, ", ")
	if colStr == "" {
		colStr = "*"
	}

	where := qb.BuildWhere(filters)
	var clauses []string
	if where != "" {
		clauses = append(clauses, fmt.Sprintf("WHERE %s", where))
	}
	if orderColumn != "" {
		clauses = append(clauses, qb.BuildOrder(orderColumn, ascending))
	}
	if limit > 0 {
		clauses = append(clauses, qb.BuildLimit(limit))
	}

	return fmt.Sprintf("SELECT %s FROM %s %s", colStr, table, strings.Join(clauses, " "))
}

// BuildPromQL builds a PromQL query string from a metric name and optional label filters.
func (qb *QueryBuilder) BuildPromQL(metric string, labels map[string]string) string {
	var parts []string
	if metric == "" {
		return ""
	}
	parts = append(parts, metric)

	if len(labels) > 0 {
		labelParts := make([]string, 0, len(labels))
		for k, v := range labels {
			labelParts = append(labelParts, fmt.Sprintf("%s=%q", k, v))
		}
		parts = append(parts, fmt.Sprintf("{%s}", strings.Join(labelParts, ",")))
	}

	return strings.Join(parts, "")
}

// BuildRESTPath builds a REST API path with path parameters.
func (qb *QueryBuilder) BuildRESTPath(basePath string, params map[string]string) string {
	path := basePath
	for k, v := range params {
		path = strings.ReplaceAll(path, ":"+k, v)
	}
	return path
}

// BuildGraphQL builds a simple GraphQL query string.
func (qb *QueryBuilder) BuildGraphQL(operationName string, fields []string, args map[string]string) string {
	var argStr string
	if len(args) > 0 {
		argParts := make([]string, 0, len(args))
		// Keys represent argument names; values are their placeholders.
		for k, v := range args {
			argParts = append(argParts, fmt.Sprintf("%s: $%s", k, v))
		}
		argStr = "(" + strings.Join(argParts, ", ") + ")"
	}

	fieldList := strings.Join(fields, "\n    ")
	return fmt.Sprintf("query %s%s {\n    %s\n}", operationName, argStr, fieldList)
}
