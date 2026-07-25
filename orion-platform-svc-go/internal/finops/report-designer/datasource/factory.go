package datasource

import "errors"

// ErrUnsupportedType is returned when a DataSourceType is not supported.
var ErrUnsupportedType = errors.New("unsupported datasource type")

// DataSourceFactory creates DataSource instances from configuration.
type DataSourceFactory struct {
	logger Logger
}

// Logger interface used for structured logging within the factory.
type Logger interface {
	Debug(msg string, fields ...interface{})
	Info(msg string, fields ...interface{})
	Warn(msg string, fields ...interface{})
	Error(msg string, fields ...interface{})
}

// NewDataSourceFactory creates a new DataSourceFactory.
// A nil logger is acceptable; it simply means no logging will occur.
func NewDataSourceFactory(logger Logger) *DataSourceFactory {
	return &DataSourceFactory{logger: logger}
}

// Create builds a DataSource from the given configuration.
// Supported types: postgresql, mysql, rest, graphql, csv, json, prometheus.
func (f *DataSourceFactory) Create(cfg *DataSourceConfig) (DataSource, error) {
	switch cfg.Type {
	case TypePostgreSQL:
		return NewPostgreSQLSource(cfg)
	case TypeMySQL:
		return NewMySQLSource(cfg)
	case TypeREST:
		return NewRESTSource(cfg)
	case TypeGraphQL:
		return NewGraphQLSource(cfg)
	case TypeCSV:
		return NewCSVSource(cfg)
	case TypeJSON:
		return NewJSONSource(cfg)
	case TypePrometheus:
		return NewPrometheusSource(cfg)
	default:
		if f.logger != nil {
			f.logger.Error("factory: unknown datasource type", "type", cfg.Type, "name", cfg.Name)
		}
		return nil, ErrUnknownType
	}
}
