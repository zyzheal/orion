package handler

type GenericHandlerRepository interface {
    FindByID(ctx interface{}, id string) (interface{}, error)
    FindAll(ctx interface{}) ([]interface{}, error)
    Create(ctx interface{}, entity interface{}) error
}

type GenericHandlerService interface {
    GetByID(ctx interface{}, id string) (interface{}, error)
    List(ctx interface{}) ([]interface{}, error)
}
