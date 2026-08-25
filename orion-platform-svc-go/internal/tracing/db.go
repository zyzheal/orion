package tracing

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"go.opentelemetry.io/otel/attribute"
	oteltrace "go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/codes"
)

const dbSpanPrefix = "db."

type DBSpan struct {
	ctx  context.Context
	span oteltrace.Span
	db   *sql.DB
}

func NewDBSpan(ctx context.Context, tracer oteltrace.Tracer, db *sql.DB, operation, sqlQuery string) DBSpan {
	name := fmt.Sprintf("%s%s", dbSpanPrefix, operation)
	name = strings.ToLower(name)

	attrs := []attribute.KeyValue{
		attribute.String("db.system", "postgresql"),
		attribute.String("db.statement", truncateSQL(sqlQuery)),
		attribute.String("db.operation", operation),
	}

	spCtx := StartSpan(ctx, tracer, name,
		withKind(oteltrace.SpanKindClient),
		withAttrs(attrs...),
	)

	return DBSpan{ctx: spCtx.Ctx, span: spCtx.Span, db: db}
}

func (d DBSpan) ExecContext(query string, args ...interface{}) (sql.Result, error) {
	result, err := d.db.ExecContext(d.ctx, query, args...)
	if err != nil {
		d.span.RecordError(err)
		d.span.SetStatus(codes.Error, "db exec error")
		d.span.End()
		return nil, err
	}

	if rowsAffected, err2 := result.RowsAffected(); err2 == nil {
		d.span.SetAttributes(attribute.Int64("db.rows.affected", rowsAffected))
	}
	d.span.End()
	return result, nil
}

func (d DBSpan) QueryContext(query string, args ...interface{}) (*sql.Rows, error) {
	rows, err := d.db.QueryContext(d.ctx, query, args...)
	if err != nil {
		d.span.RecordError(err)
		d.span.SetStatus(codes.Error, "db query error")
		d.span.End()
		return nil, err
	}
	return rows, nil
}

func (d DBSpan) QueryRowContext(query string, args ...interface{}) *sql.Row {
	return d.db.QueryRowContext(d.ctx, query, args...)
}

func (d DBSpan) End(err error) {
	if err != nil {
		d.span.RecordError(err)
		d.span.SetStatus(codes.Error, "db error")
	}
	d.span.End()
}

func truncateSQL(sqlQuery string) string {
	const maxLen = 500
	if len(sqlQuery) > maxLen {
		return sqlQuery[:maxLen] + "..."
	}
	return sqlQuery
}
