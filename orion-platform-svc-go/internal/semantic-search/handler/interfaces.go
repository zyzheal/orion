package handler

type SemanticSearchRepository interface {
    FindByID(ctx interface{}, id string) (interface{}, error)
    FindAll(ctx interface{}) ([]interface{}, error)
    Create(ctx interface{}, entity interface{}) error
}

type SemanticSearchService interface {
    GetByID(ctx interface{}, id string) (interface{}, error)
    List(ctx interface{}, filter interface{}) ([]interface{}, error)
}
