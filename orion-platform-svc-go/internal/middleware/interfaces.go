package middleware

// MiddlewareRepository defines the data access interface for the middleware module.
type MiddlewareRepository interface {
    FindByID(ctx interface{}, id string) (interface{}, error)
    FindAll(ctx interface{}) ([]interface{}, error)
    Create(ctx interface{}, entity interface{}) error
    Update(ctx interface{}, entity interface{}) error
    Delete(ctx interface{}, id string) error
}

// MiddlewareService defines the business logic interface for the middleware module.
type MiddlewareService interface {
    GetByID(ctx interface{}, id string) (interface{}, error)
    List(ctx interface{}, filter interface{}) ([]interface{}, error)
    Create(ctx interface{}, req interface{}) (interface{}, error)
    Update(ctx interface{}, req interface{}) (interface{}, error)
    Delete(ctx interface{}, id string) error
}

// MiddlewareHandler defines the HTTP handler interface for the middleware module.
type MiddlewareHandler interface {
    GetByID(ctx interface{}, id string) (interface{}, error)
    List(ctx interface{}, filter interface{}) ([]interface{}, error)
    Create(ctx interface{}, req interface{}) (interface{}, error)
    Update(ctx interface{}, req interface{}) (interface{}, error)
    Delete(ctx interface{}, id string) error
}
