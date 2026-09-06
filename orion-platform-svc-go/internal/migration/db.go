package migration

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/jackc/pgx/v5/stdlib"
)

// DBConfig describes an SQL connection target. Kept for parity with the
// plan in the task brief; DefaultDBFactory uses MigrationEndpoint directly
// and only reaches for DBConfig-shaped inputs if a caller needs it.
type DBConfig struct {
	Driver   string
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	SSLMode  string
}

// DBFactory is a callback that opens a *sql.DB for a MigrationEndpoint.
type DBFactory func(ctx context.Context, ep MigrationEndpoint) (*sql.DB, error)

// DefaultDBFactory opens a *sql.DB for a MigrationEndpoint. Credentials are
// read from the ORION_MIG_<SIDE>_USER / ORION_MIG_<SIDE>_PASSWORD environment
// variables (with SOURCE/TARGET inferred from the endpoint Name), because
// MigrationEndpoint does not currently carry User/Password fields. If the
// env vars are unset the driver is handed an empty user/password, which is
// suitable for local dev / trust auth. SSLMode defaults to "disable" for
// Postgres to stay consistent with the datasource service's default.
func DefaultDBFactory(ctx context.Context, ep MigrationEndpoint) (*sql.DB, error) {
	if ep.Host == "" {
		return nil, fmt.Errorf("migration endpoint %q: host required", ep.Name)
	}
	driver, port := resolveDriverAndPort(ep)
	if driver == "" {
		return nil, fmt.Errorf("migration endpoint %q: unsupported type %q", ep.Name, ep.Type)
	}
	side := sideOf(ep.Name)
	user := ep.User
	if user == "" {
		user = envOr("ORION_MIG_"+side+"_USER", "")
	}
	password := ep.Password
	if password == "" {
		password = envOr("ORION_MIG_"+side+"_PASSWORD", "")
	}
	dsn := buildDSN(driver, ep, port, user, password)

	db, err := sql.Open(driver, dsn)
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", driver, err)
	}
	db.SetMaxOpenConns(4)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping %s (%s:%d/%s): %w", driver, ep.Host, port, ep.Database, err)
	}
	return db, nil
}

// resolveDriverAndPort normalises the MigrationEndpoint's type string into
// the driver name registered with database/sql, and applies a default port
// when the caller did not specify one.
func resolveDriverAndPort(ep MigrationEndpoint) (driver string, port int) {
	port = ep.Port
	switch strings.ToLower(ep.Type) {
	case "postgresql", "postgres", "pg", "":
		driver = "pgx"
		if port == 0 {
			port = 5432
		}
	case "mysql":
		driver = "mysql"
		if port == 0 {
			port = 3306
		}
	default:
		driver = ""
	}
	return driver, port
}

// buildDSN composes a DSN understood by the target driver.
func buildDSN(driver string, ep MigrationEndpoint, port int, user, password string) string {
	if driver == "mysql" {
		return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?parseTime=true",
			user, password, ep.Host, port, ep.Database)
	}
	// postgres (pgx)
	ssl := ep.SSLMode
	if ssl == "" {
		ssl = "disable"
	}
	if ep.Schema != "" {
		if lower := strings.ToLower(ep.Schema); strings.HasPrefix(lower, "sslmode=") {
			ssl = strings.TrimPrefix(lower, "sslmode=")
		}
	}
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		ep.Host, port, user, password, ep.Database, ssl)
}

// sideOf distinguishes source from target endpoints purely by their Name
// field (the model carries no kind tag). Falls back to SOURCE for the
// stable default.
func sideOf(name string) string {
	n := strings.ToLower(name)
	if strings.Contains(n, "target") {
		return "TARGET"
	}
	return "SOURCE"
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
