package repository

import (
	"context"
	"database/sql"
	"math"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/incident/models"
)

func newMockRepo(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewRepository(sqlx.NewDb(db, "postgres"))
}

func incidentRows(id, tenant, title, tags, service, env, incidentType, affected string) *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "title", "tags", "service", "environment", "type", "affected_services",
	}).AddRow(id, tenant, title, tags, service, env, incidentType, affected)
}

// docSpec is one published knowledge document returned by the mock.
type docSpec struct {
	id      string
	title   string
	content string
}

func docRows(rows ...docSpec) *sqlmock.Rows {
	r := sqlmock.NewRows([]string{"id", "title", "content"})
	for _, row := range rows {
		r = r.AddRow(row.id, row.title, row.content)
	}
	return r
}

// The incident whose tags/service/title produce exactly these eight terms.
const incidentArgs = "tenant-a"

func TestGetKnowledgeRecommendationsReturnsRankedDocs(t *testing.T) {
	mock, repo := newMockRepo(t)
	inc := incidentRows("inc-1", incidentArgs,
		"postgres primary unreachable", `["database","p1"]`, "api-gateway", "prod", "availability", `["api-gateway","billing"]`)
	// Deliberately in the opposite order of the expected ranking: the
	// recommendation order must come from relevance, not from the rows.
	docs := docRows(
		docSpec{"doc-3", "On-call rotation policy", "Escalation levels and how to page the primary on-call engineer."},
		docSpec{"doc-2", "Billing API gateway troubleshooting", "The api-gateway returns 503 when an upstream is down; check the gateway logs."},
		docSpec{"doc-1", "Postgres failover runbook", "Fail over the postgres cluster when the primary is unreachable."},
	)
	mock.ExpectQuery("SELECT \\* FROM incidents WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("inc-1", incidentArgs).
		WillReturnRows(inc)
	mock.ExpectQuery("SELECT id, title, content FROM kb_docs").
		WithArgs(
			incidentArgs,
			"%api-gateway%", "%availability%", "%billing%", "%database%",
			"%postgres%", "%primary%", "%prod%", "%unreachable%",
			50,
		).
		WillReturnRows(docs)

	got, err := repo.GetKnowledgeRecommendations(context.Background(), incidentArgs, "inc-1", 0)
	if err != nil {
		t.Fatalf("GetKnowledgeRecommendations: %v", err)
	}
	if len(got) != 3 {
		t.Fatalf("got %d recommendations, want 3: the query must actually read kb_docs", len(got))
	}
	if m := mock.ExpectationsWereMet(); m != nil {
		t.Fatalf("unexpected SQL: %v", m)
	}

	wantIDs := []string{"doc-1", "doc-2", "doc-3"}
	wantRel := []float64{0.2917, 0.125, 0.0833}
	for i, want := range wantIDs {
		if got[i].ID != want {
			t.Errorf("rank %d ID = %q, want %q: results must be ranked by relevance", i, got[i].ID, want)
		}
		if math.Abs(got[i].Relevance-wantRel[i]) > 0.0001 {
			t.Errorf("rank %d relevance = %v, want %v", i, got[i].Relevance, wantRel[i])
		}
		if got[i].Relevance <= 0 || got[i].Relevance > 1 {
			t.Errorf("rank %d relevance = %v, want (0,1]", i, got[i].Relevance)
		}
	}
	if got[0].Description != "Fail over the postgres cluster when the primary is unreachable." {
		t.Errorf("rank 0 Description = %q: it must be an excerpt of the document body", got[0].Description)
	}
	if got[0].Title != "Postgres failover runbook" {
		t.Errorf("rank 0 Title = %q", got[0].Title)
	}
}

func TestGetKnowledgeRecommendationsUnknownIncidentReturnsNotFound(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery("SELECT \\* FROM incidents WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("inc-missing", incidentArgs).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "title", "tags", "service", "environment", "type", "affected_services",
		}))

	got, err := repo.GetKnowledgeRecommendations(context.Background(), incidentArgs, "inc-missing", 5)
	if err == nil {
		t.Fatal("expected an error for an unknown incident, got nil")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Fatalf("error = %q, want it to report the missing incident", err.Error())
	}
	if got != nil {
		t.Errorf("recommendations = %v, want nil on error", got)
	}
	// Only the ownership lookup must run; no document query for a missing incident.
	if m := mock.ExpectationsWereMet(); m != nil {
		t.Fatalf("unexpected SQL: %v", m)
	}
}

func TestGetKnowledgeRecommendationsErrorsFromTheDatabase(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery("SELECT \\* FROM incidents").
		WillReturnError(sql.ErrNoRows)

	_, err := repo.GetKnowledgeRecommendations(context.Background(), incidentArgs, "inc-1", 5)
	if err == nil {
		t.Fatal("expected an error, got nil")
	}
}

func TestGetKnowledgeRecommendationsWithoutTermsIssuesNoDocumentQuery(t *testing.T) {
	mock, repo := newMockRepo(t)
	// A 2-character title is below the minimum term length, so there is nothing
	// to search for and the endpoint answers with an empty list.
	mock.ExpectQuery("SELECT \\* FROM incidents WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("inc-thin", incidentArgs).
		WillReturnRows(incidentRows("inc-thin", incidentArgs, "ab", "[]", "", "", "", "[]"))

	got, err := repo.GetKnowledgeRecommendations(context.Background(), incidentArgs, "inc-thin", 5)
	if err != nil {
		t.Fatalf("GetKnowledgeRecommendations: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("got %d recommendations for a term-less incident, want 0", len(got))
	}
	if m := mock.ExpectationsWereMet(); m != nil {
		t.Fatalf("a term-less incident must not query kb_docs: %v", m)
	}
}

func TestGetKnowledgeRecommendationsHonoursLimit(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery("SELECT \\* FROM incidents").
		WillReturnRows(incidentRows("inc-1", incidentArgs,
			"database latency", "[]", "database", "prod", "availability", "[]"))
	mock.ExpectQuery("SELECT id, title, content FROM kb_docs").
		WillReturnRows(docRows(
			docSpec{"doc-a", "Database latency", "database latency tuning"},
			docSpec{"doc-b", "Database backups", "database backup restore"},
			docSpec{"doc-c", "Database migration", "database migration guide"},
		))

	got, err := repo.GetKnowledgeRecommendations(context.Background(), incidentArgs, "inc-1", 2)
	if err != nil {
		t.Fatalf("GetKnowledgeRecommendations: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("got %d recommendations, want the limit of 2", len(got))
	}
}

func TestGetKnowledgeRecommendationsClampsLimit(t *testing.T) {
	for _, tc := range []struct {
		name     string
		limit    int
		wantArgs []interface{}
	}{
		{"zero becomes the default", 0, []interface{}{50}},
		{"negative becomes the default", -7, []interface{}{50}},
		{"huge values are capped", 100000, []interface{}{200}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			mock, repo := newMockRepo(t)
			mock.ExpectQuery("SELECT \\* FROM incidents").
				WillReturnRows(incidentRows("inc-1", incidentArgs,
					"database latency", "[]", "database", "prod", "availability", "[]"))
			mock.ExpectQuery("SELECT id, title, content FROM kb_docs").
				WithArgs(incidentArgs, "%availability%", "%database%", "%latency%", "%prod%", tc.wantArgs[0]).
				WillReturnRows(docRows())

			got, err := repo.GetKnowledgeRecommendations(context.Background(), incidentArgs, "inc-1", tc.limit)
			if err != nil {
				t.Fatalf("GetKnowledgeRecommendations: %v", err)
			}
			if len(got) != 0 {
				t.Errorf("got %d recommendations, want 0 for an empty result set", len(got))
			}
			if m := mock.ExpectationsWereMet(); m != nil {
				t.Fatalf("unexpected SQL: %v", m)
			}
		})
	}
}

func TestKnowledgeTermsUsesTagsServiceTitleAndCapsTheCount(t *testing.T) {
	got := knowledgeTerms(&models.Incident{
		Title:            "database latency spike",
		Tags:             `["database","p1","postgres"]`,
		Service:          "Database",
		Environment:      "prod",
		Type:             "availability",
		AffectedServices: `["database","billing"]`,
	})
	want := []string{"availability", "billing", "database", "latency", "postgres", "prod", "spike"}
	if len(got) != len(want) {
		t.Fatalf("terms = %v, want %v", got, want)
	}
	for i, w := range want {
		if got[i] != w {
			t.Errorf("term %d = %q, want %q", i, got[i], w)
		}
	}
}

func TestKnowledgeTermsCapsAtTheMaximum(t *testing.T) {
	inc := &models.Incident{
		Tags: `["alpha","bravo","charlie","delta","echo","foxtrot","golf","hotel","india","juliet","kilo","lima","mike","november"]`,
	}
	if got := knowledgeTerms(inc); len(got) != knowledgeMaxTerms {
		t.Fatalf("got %d terms, want the cap of %d: unbounded term lists grow the SQL indefinitely",
			len(got), knowledgeMaxTerms)
	}
}

func TestKnowledgeTermsRejectsShortAndEmptyInput(t *testing.T) {
	if got := knowledgeTerms(&models.Incident{Title: "ab cd", Tags: `["ok"]`}); len(got) != 0 {
		t.Fatalf("terms = %v, want none", got)
	}
}

func TestIncidentTokensSplitsJSONArraysAndKeepsHyphenatedWords(t *testing.T) {
	got := incidentTokens(`["api-gateway","postgres", 12]`)
	want := []string{"api-gateway", "postgres", "12"}
	if len(got) != len(want) {
		t.Fatalf("tokens = %v, want %v", got, want)
	}
	for i, w := range want {
		if got[i] != w {
			t.Errorf("token %d = %q, want %q", i, got[i], w)
		}
	}
}

func TestKnowledgeRelevanceWeightsTitleMatchesAboveBodyMatches(t *testing.T) {
	terms := []string{"database"}
	// A title match is worth 0.5 of the 1.5 possible for the term, a body match
	// is worth 1.0, and both together saturate the score.
	if got := knowledgeRelevance(terms, "Database operations", "unrelated body"); got != 0.3333 {
		t.Errorf("title-only relevance = %v, want 0.3333", got)
	}
	if got := knowledgeRelevance(terms, "operations", "the database is slow"); got != 0.6667 {
		t.Errorf("body-only relevance = %v, want 0.6667", got)
	}
	if got := knowledgeRelevance(terms, "Database operations", "the database is slow"); got != 1.0 {
		t.Errorf("both relevance = %v, want 1.0", got)
	}
	if got := knowledgeRelevance(terms, "other", "another"); got != 0 {
		t.Errorf("no-match relevance = %v, want 0", got)
	}
	if got := knowledgeRelevance(nil, "a", "b"); got != 0 {
		t.Errorf("empty-term relevance = %v, want 0", got)
	}
}

func TestKnowledgeSnippetTruncatesLongBodies(t *testing.T) {
	long := strings.Repeat("word ", 60) + "tail"
	got := knowledgeSnippet(long)
	if !strings.HasSuffix(got, "...") {
		t.Fatalf("long snippet = %q, want a truncation marker", got)
	}
	if len(got) > 163 {
		t.Fatalf("long snippet is %d chars, want at most 163", len(got))
	}
	if got := knowledgeSnippet("  short   body  "); got != "short body" {
		t.Errorf("short snippet = %q, want the whitespace-collapsed body", got)
	}
}
