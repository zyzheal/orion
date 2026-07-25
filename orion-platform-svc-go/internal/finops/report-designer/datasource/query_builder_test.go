package datasource

import (
	"strings"
	"testing"
)

func TestQueryBuilder_BuildSelect(t *testing.T) {
	qb := NewQueryBuilder(TypePostgreSQL)

	got := qb.BuildSelect("id, name", "users", "status = 'active'", nil)
	want := "SELECT id, name FROM users WHERE status = 'active'"
	if got != want {
		t.Errorf("BuildSelect = %q, want %q", got, want)
	}
}

func TestQueryBuilder_BuildSelect_NoWhere(t *testing.T) {
	qb := NewQueryBuilder(TypePostgreSQL)

	got := qb.BuildSelect("id, name", "users", "", nil)
	want := "SELECT id, name FROM users "
	if got != want {
		t.Errorf("BuildSelect = %q, want %q", got, want)
	}
}

func TestQueryBuilder_BuildWhere(t *testing.T) {
	qb := NewQueryBuilder(TypePostgreSQL)

	conditions := map[string]string{"status": "'active'", "role": "'admin'"}
	got := qb.BuildWhere(conditions)
	if got == "" {
		t.Fatal("BuildWhere returned empty string for non-empty conditions")
	}
	if !strings.Contains(got, "AND") {
		t.Errorf("BuildWhere = %q, expected AND clause", got)
	}
	// Both conditions must be present (order is non-deterministic due to map iteration).
	if !strings.Contains(got, "status = 'active'") {
		t.Errorf("BuildWhere = %q, expected status clause", got)
	}
	if !strings.Contains(got, "role = 'admin'") {
		t.Errorf("BuildWhere = %q, expected role clause", got)
	}
}

func TestQueryBuilder_BuildWhere_Empty(t *testing.T) {
	qb := NewQueryBuilder(TypePostgreSQL)
	got := qb.BuildWhere(nil)
	if got != "" {
		t.Errorf("BuildWhere(null) = %q, want empty", got)
	}
}

func TestQueryBuilder_BuildOrder(t *testing.T) {
	qb := NewQueryBuilder(TypePostgreSQL)

	got := qb.BuildOrder("created_at", true)
	want := "ORDER BY created_at ASC"
	if got != want {
		t.Errorf("BuildOrder = %q, want %q", got, want)
	}

	got = qb.BuildOrder("name", false)
	want = "ORDER BY name DESC"
	if got != want {
		t.Errorf("BuildOrder = %q, want %q", got, want)
	}
}

func TestQueryBuilder_BuildLimit(t *testing.T) {
	qb := NewQueryBuilder(TypePostgreSQL)

	got := qb.BuildLimit(10)
	want := "LIMIT 10"
	if got != want {
		t.Errorf("BuildLimit = %q, want %q", got, want)
	}
}

func TestQueryBuilder_BuildSQLQuery(t *testing.T) {
	qb := NewQueryBuilder(TypePostgreSQL)

	got := qb.BuildSQLQuery("users", []string{"id", "name"},
		map[string]string{"status": "'active'"}, "created_at", true, 10)
	if !strings.Contains(got, "SELECT id, name") || !strings.Contains(got, "FROM users") {
		t.Errorf("BuildSQLQuery missing core parts: %q", got)
	}
	if !strings.Contains(got, "WHERE") || !strings.Contains(got, "ORDER BY") || !strings.Contains(got, "LIMIT 10") {
		t.Errorf("BuildSQLQuery missing clauses: %q", got)
	}
}

func TestQueryBuilder_BuildSQLQuery_NoFilters(t *testing.T) {
	qb := NewQueryBuilder(TypePostgreSQL)

	got := qb.BuildSQLQuery("users", nil, nil, "", true, 5)
	want := "SELECT * FROM users LIMIT 5"
	if got != want {
		t.Errorf("BuildSQLQuery = %q, want %q", got, want)
	}
}

func TestQueryBuilder_BuildPromQL(t *testing.T) {
	qb := NewQueryBuilder(TypePrometheus)

	got := qb.BuildPromQL("http_requests_total", map[string]string{"status": "200"})
	want := `http_requests_total{status="200"}`
	if got != want {
		t.Errorf("BuildPromQL = %q, want %q", got, want)
	}
}

func TestQueryBuilder_BuildPromQL_NoLabels(t *testing.T) {
	qb := NewQueryBuilder(TypePrometheus)

	got := qb.BuildPromQL("up", nil)
	want := "up"
	if got != want {
		t.Errorf("BuildPromQL = %q, want %q", got, want)
	}
}

func TestQueryBuilder_BuildPromQL_EmptyMetric(t *testing.T) {
	qb := NewQueryBuilder(TypePrometheus)

	got := qb.BuildPromQL("", nil)
	want := ""
	if got != want {
		t.Errorf("BuildPromQL(empty) = %q, want empty", got)
	}
}

func TestQueryBuilder_BuildRESTPath(t *testing.T) {
	qb := NewQueryBuilder(TypeREST)

	got := qb.BuildRESTPath("/api/v1/users/:id/reports", map[string]string{"id": "123"})
	want := "/api/v1/users/123/reports"
	if got != want {
		t.Errorf("BuildRESTPath = %q, want %q", got, want)
	}
}

func TestQueryBuilder_BuildRESTPath_NoParams(t *testing.T) {
	qb := NewQueryBuilder(TypeREST)

	got := qb.BuildRESTPath("/api/v1/reports", nil)
	want := "/api/v1/reports"
	if got != want {
		t.Errorf("BuildRESTPath = %q, want %q", got, want)
	}
}

func TestQueryBuilder_BuildGraphQL(t *testing.T) {
	qb := NewQueryBuilder(TypeGraphQL)

	got := qb.BuildGraphQL("GetUser", []string{"id", "name", "email"}, map[string]string{"id": "id"})
	want := "query GetUser(id: $id) {\n    id\n    name\n    email\n}"
	if got != want {
		t.Errorf("BuildGraphQL = %q, want %q", got, want)
	}
}

func TestQueryBuilder_BuildGraphQL_NoArgs(t *testing.T) {
	qb := NewQueryBuilder(TypeGraphQL)

	got := qb.BuildGraphQL("ListUsers", []string{"id", "name"}, nil)
	want := "query ListUsers {\n    id\n    name\n}"
	if got != want {
		t.Errorf("BuildGraphQL = %q, want %q", got, want)
	}
}
