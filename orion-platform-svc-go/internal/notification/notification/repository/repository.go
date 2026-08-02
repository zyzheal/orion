package repository

type Repository interface{}

type repositoryImpl struct{}

func New() Repository { return &repositoryImpl{} }
