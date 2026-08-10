package visor

// VisorRepository defines the data access interface for the visor module.
type VisorRepository interface {
    FindByID(ctx interface{}, id string) (interface{}, error)
    FindAll(ctx interface{}) ([]interface{}, error)
    Create(ctx interface{}, entity interface{}) error
    Update(ctx interface{}, entity interface{}) error
    Delete(ctx interface{}, id string) error
}

// VisorService defines the business logic interface for the visor module.
type VisorService interface {
    GetByID(ctx interface{}, id string) (interface{}, error)
    List(ctx interface{}, filter interface{}) ([]interface{}, error)
    Create(ctx interface{}, req interface{}) (interface{}, error)
    Update(ctx interface{}, req interface{}) (interface{}, error)
    Delete(ctx interface{}, id string) error
}

// VisorHandler defines the HTTP handler interface for the visor module.
type VisorHandler interface {
    GetByID(ctx interface{}, id string) (interface{}, error)
    List(ctx interface{}, filter interface{}) ([]interface{}, error)
    Create(ctx interface{}, req interface{}) (interface{}, error)
    Update(ctx interface{}, req interface{}) (interface{}, error)
    Delete(ctx interface{}, id string) error
}
