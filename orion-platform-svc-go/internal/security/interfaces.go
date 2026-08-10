package security

type SecurityService interface {
    Create(id string, data map[string]interface{}) (string, error)
    Get(id string) (map[string]interface{}, error)
    List(filters map[string]string) ([]map[string]interface{}, error)
    Update(id string, data map[string]interface{}) error
    Delete(id string) error
}

type SecurityRepository interface {
    Insert(ctx interface{}, record interface{}) error
    FindByID(ctx interface{}, id string) (interface{}, error)
    FindAll(ctx interface{}, filters map[string]string) ([]interface{}, error)
    Update(ctx interface{}, id string, data interface{}) error
    Delete(ctx interface{}, id string) error
    Count(ctx interface{}, filters map[string]string) (int64, error)
}

type SecurityHandler interface {
    CreateHandler(w interface{}, r interface{})
    GetHandler(w interface{}, r interface{})
    ListHandler(w interface{}, r interface{})
    UpdateHandler(w interface{}, r interface{})
    DeleteHandler(w interface{}, r interface{})
}
