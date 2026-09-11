package repository

import (
	"context"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/database"
	"orion/platform-svc-go/internal/ci-cd/deploy/models"
)

// TestDeployWindowCreateDefaultsBeforeInsert pins the ordering bug in Create:
// the timezone default used to be applied after the INSERT, so the row stored
// in the database had an empty timezone while the returned DeployWindow
// carried "Asia/Shanghai". The caller and the database disagreed.
//
// The discriminator is the bound query argument, not the returned field —
// defaulting after the query would still leave w.Timezone looking correct while
// sending an empty string to the database, and the WithArgs assertion below is
// what catches that.
func TestDeployWindowCreateDefaultsBeforeInsert(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	mock.ExpectQuery("INSERT INTO deploy_windows").
		WithArgs("t1", "env-1", "weekly", "0 2 * * 1", 60, "Asia/Shanghai", "admin").
		WillReturnRows(sqlmock.NewRows([]string{"id", "created_at", "updated_at"}).
			AddRow("win-1", time.Now().UTC(), nil))

	r := NewDeployWindowRepository(&database.DB{DB: sqlx.NewDb(db, "sqlmock")})
	w := &models.DeployWindow{
		TenantID:       "t1",
		EnvironmentID:  "env-1",
		Name:           "weekly",
		CronExpression: "0 2 * * 1",
		CreatedBy:      "admin",
	}

	if err := r.Create(context.Background(), w); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if w.Timezone != "Asia/Shanghai" {
		t.Errorf("Timezone = %q, want default Asia/Shanghai", w.Timezone)
	}
	if w.DurationMinutes != 60 {
		t.Errorf("DurationMinutes = %d, want default 60", w.DurationMinutes)
	}
	if w.Status != "active" {
		t.Errorf("Status = %q, want active", w.Status)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet sqlmock expectations: %v", err)
	}
}

// TestDeployWindowCreateKeepsExplicitTimezone makes sure the default does not
// clobber a timezone the caller supplied.
func TestDeployWindowCreateKeepsExplicitTimezone(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	mock.ExpectQuery("INSERT INTO deploy_windows").
		WithArgs("t1", "env-1", "eu-window", "0 2 * * 1", 120, "Europe/Berlin", "admin").
		WillReturnRows(sqlmock.NewRows([]string{"id", "created_at", "updated_at"}).
			AddRow("win-2", time.Now().UTC(), nil))

	r := NewDeployWindowRepository(&database.DB{DB: sqlx.NewDb(db, "sqlmock")})
	w := &models.DeployWindow{
		TenantID:        "t1",
		EnvironmentID:   "env-1",
		Name:            "eu-window",
		CronExpression:  "0 2 * * 1",
		DurationMinutes: 120,
		Timezone:        "Europe/Berlin",
		CreatedBy:       "admin",
	}

	if err := r.Create(context.Background(), w); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if w.Timezone != "Europe/Berlin" {
		t.Errorf("Timezone = %q, want Europe/Berlin to be preserved", w.Timezone)
	}
	if w.DurationMinutes != 120 {
		t.Errorf("DurationMinutes = %d, want 120 to be preserved", w.DurationMinutes)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet sqlmock expectations: %v", err)
	}
}
