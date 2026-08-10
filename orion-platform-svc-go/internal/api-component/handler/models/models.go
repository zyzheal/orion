package models

type RegisterComponentRequest struct {
        Name        string            `json:"name" binding:"required"`
        Prefix      string            `json:"prefix" binding:"required"`
        Summary     string            `json:"summary" binding:"required"`
        Description string            `json:"description"`
        Version     string            `json:"version"`
        Tags        []string          `json:"tags"`
        Metadata    map[string]string `json:"metadata"`
}

type AddRouteRequest struct {
        Path    string   `json:"path" binding:"required"`
        Methods []string `json:"methods" binding:"required"`
        Handler string   `json:"handler" binding:"required"`
        Summary string   `json:"summary"`
}

type RouteListResponse struct {
        Component string `json:"component"`
        Path      string `json:"path"`
        Methods   []string `json:"methods"`
        Summary   string `json:"summary"`
}

type ComponentStats struct {
        ComponentCount int      `json:"component_count"`
        RouteCount     int      `json:"route_count"`
        Components     []string `json:"components"`
}
