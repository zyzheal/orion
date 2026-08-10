package handler

// CacheMonitorRepository defines the data access interface for the cache-monitor module.
type CacheMonitorRepository interface {
    FindByID(ctx interface{}, id string) (interface{}, error)
    FindAll(ctx interface{}) ([]interface{}, error)
    Create(ctx interface{}, entity interface{}) error
    Update(ctx interface{}, entity interface{}) error
    Delete(ctx interface{}, id string) error
}

// CacheMonitorService defines the business logic interface for the cache-monitor module.
type CacheMonitorService interface {
    GetByID(ctx interface{}, id string) (interface{}, error)
    List(ctx interface{}, filter interface{}) ([]interface{}, error)
    Create(ctx interface{}, req interface{}) (interface{}, error)
    Update(ctx interface{}, req interface{}) (interface{}, error)
    Delete(ctx interface{}, id string) error
}
