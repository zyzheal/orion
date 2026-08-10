package llm

// LlmRepository defines the data access interface for the llm module.
type LlmRepository interface {
    FindByID(ctx interface{}, id string) (interface{}, error)
    FindAll(ctx interface{}) ([]interface{}, error)
    Create(ctx interface{}, entity interface{}) error
    Update(ctx interface{}, entity interface{}) error
    Delete(ctx interface{}, id string) error
}

// LlmService defines the business logic interface for the llm module.
type LlmService interface {
    GetByID(ctx interface{}, id string) (interface{}, error)
    List(ctx interface{}, filter interface{}) ([]interface{}, error)
    Create(ctx interface{}, req interface{}) (interface{}, error)
    Update(ctx interface{}, req interface{}) (interface{}, error)
    Delete(ctx interface{}, id string) error
}

// LlmHandler defines the HTTP handler interface for the llm module.
type LlmHandler interface {
    GetByID(ctx interface{}, id string) (interface{}, error)
    List(ctx interface{}, filter interface{}) ([]interface{}, error)
    Create(ctx interface{}, req interface{}) (interface{}, error)
    Update(ctx interface{}, req interface{}) (interface{}, error)
    Delete(ctx interface{}, id string) error
}
