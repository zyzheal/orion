package dr

type DRRepository interface {
    FindByID(ctx interface{}, id string) (interface{}, error)
}

type DRService interface {
    GetByID(ctx interface{}, id string) (interface{}, error)
}
