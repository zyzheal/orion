package service

import (
        "context"
        "sync"

        apicomponent "orion/platform-svc-go/internal/api-component"
        "orion/platform-svc-go/internal/api-component/handler/models"
)

type Service struct {
        mu       sync.RWMutex
        registry *apicomponent.Registry
}

func NewService() *Service {
        return &Service{registry: apicomponent.NewRegistry()}
}

func (s *Service) RegisterComponent(ctx context.Context, req *models.RegisterComponentRequest) error {
        opts := []apicomponent.ComponentOption{
                apicomponent.WithDescription(req.Description),
                apicomponent.WithVersion(req.Version),
                apicomponent.WithTags(req.Tags),
        }
        comp := apicomponent.NewAPIComponent(req.Name, req.Prefix, req.Summary, opts...)
        return s.registry.Register(comp)
}

func (s *Service) UnregisterComponent(ctx context.Context, name string) error {
        return s.registry.Unregister(name)
}

func (s *Service) GetComponent(ctx context.Context, name string) (*apicomponent.APIComponent, error) {
        comp := s.registry.Get(name)
        if comp == nil {
                return nil, apicomponent.ErrComponentNotFound
        }
        return comp, nil
}

func (s *Service) ListComponents(ctx context.Context) ([]string, error) {
        return s.registry.ComponentNames(), nil
}

func (s *Service) ListRoutes(ctx context.Context) ([]models.RouteListResponse, error) {
        routes := s.registry.AllRoutes()
        resp := make([]models.RouteListResponse, 0, len(routes))
        for _, r := range routes {
                methods := make([]string, 0, len(r.Methods))
                for _, m := range r.Methods {
                        methods = append(methods, string(m))
                }
                resp = append(resp, models.RouteListResponse{
                        Component: r.ComponentName,
                        Path:      r.Path,
                        Methods:   methods,
                        Summary:   r.Summary,
                })
        }
        return resp, nil
}

func (s *Service) Stats(ctx context.Context) *models.ComponentStats {
        comps := s.registry.All()
        names := make([]string, 0, len(comps))
        for _, c := range comps {
                names = append(names, c.Name)
        }
        return &models.ComponentStats{
                ComponentCount: s.registry.Count(),
                RouteCount:     s.registry.RouteCount(),
                Components:     names,
        }
}

func (s *Service) FilterByTag(ctx context.Context, tag string) ([]string, error) {
        comps := s.registry.FilterByTag(tag)
        names := make([]string, 0, len(comps))
        for _, c := range comps {
                names = append(names, c.Name)
        }
        return names, nil
}
