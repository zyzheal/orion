package dataclassification

// DataClassificationRepository defines the data access interface for the data-classification module.
type DataClassificationRepository interface {
    FindByID(ctx interface{}, id string) (interface{}, error)
    FindAll(ctx interface{}) ([]interface{}, error)
    Create(ctx interface{}, entity interface{}) error
    Update(ctx interface{}, entity interface{}) error
    Delete(ctx interface{}, id string) error
}

// DataClassificationService defines the business logic interface for the data-classification module.
type DataClassificationService interface {
    GetByID(ctx interface{}, id string) (interface{}, error)
    List(ctx interface{}, filter interface{}) ([]interface{}, error)
    Create(ctx interface{}, req interface{}) (interface{}, error)
    Update(ctx interface{}, req interface{}) (interface{}, error)
    Delete(ctx interface{}, id string) error
}

// DataClassificationHandler defines the HTTP handler interface for the data-classification module.
type DataClassificationHandler interface {
    GetByID(ctx interface{}, id string) (interface{}, error)
    List(ctx interface{}, filter interface{}) ([]interface{}, error)
    Create(ctx interface{}, req interface{}) (interface{}, error)
    Update(ctx interface{}, req interface{}) (interface{}, error)
    Delete(ctx interface{}, id string) error
}
