package lock

type LockRepository interface {
    FindByID(ctx interface{}, id string) (interface{}, error)
    Create(ctx interface{}, entity interface{}) error
    Delete(ctx interface{}, id string) error
}

type LockService interface {
    Acquire(ctx interface{}, key string) (interface{}, error)
    Release(ctx interface{}, id string) error
}
