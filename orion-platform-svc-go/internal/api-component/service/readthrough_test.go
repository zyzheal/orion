package service

import (
	"context"
	"errors"
	"sort"
	"testing"

	"orion/go-common/pkg/sentinel"
	apicomponent "orion/platform-svc-go/internal/api-component"

	"github.com/gin-gonic/gin"
)

// fakeStore stands in for the api_components table. A fresh Service plus a
// non-empty store models the process immediately after a restart, when the
// process-local registry is empty and every component lives only in the store.
type fakeStore struct {
	components map[string]*apicomponent.APIComponent
	err        error
	listCalls  int
	getCalls   int
	names      []string
}

func (f *fakeStore) Get(_ context.Context, name string) (*apicomponent.APIComponent, error) {
	f.getCalls++
	if f.err != nil {
		return nil, f.err
	}
	comp, ok := f.components[name]
	if !ok {
		return nil, sentinel.NotFound
	}
	return comp, nil
}

func (f *fakeStore) List(_ context.Context) ([]string, error) {
	f.listCalls++
	if f.err != nil {
		return nil, f.err
	}
	if f.names != nil {
		return f.names, nil
	}
	names := make([]string, 0, len(f.components))
	for n := range f.components {
		names = append(names, n)
	}
	sort.Strings(names)
	return names, nil
}

func (f *fakeStore) ListRoutes(context.Context) []apicomponent.FullRoute    { return nil }
func (f *fakeStore) FilterByTag(context.Context, string) []string           { return nil }
func (f *fakeStore) Save(context.Context, *apicomponent.APIComponent) error { return f.err }
func (f *fakeStore) Delete(context.Context, string) error                   { return f.err }

func noopHandler(*gin.Context) {}

func newRoute(path string) apicomponent.RouteComponent {
	return apicomponent.RouteComponent{
		Methods: []apicomponent.HTTPMethod{apicomponent.MethodGet},
		Path:    path,
		Handler: noopHandler,
	}
}

// newComp builds a component the way RegisterComponent does, minus the store write.
func newComp(name, prefix string, routes ...apicomponent.RouteComponent) *apicomponent.APIComponent {
	comp := apicomponent.NewAPIComponent(name, prefix, "summary of "+name)
	comp.Routes = routes
	return comp
}

func storeWith(components ...*apicomponent.APIComponent) *fakeStore {
	f := &fakeStore{components: map[string]*apicomponent.APIComponent{}}
	for _, c := range components {
		f.components[c.Name] = c
	}
	return f
}

// RegisterComponent wrote to the store and to the in-process registry at the
// same time, but every read consulted only the registry, which NewService
// rebuilds empty. After a restart every persisted component was invisible.
func TestGetComponent_ReadsTheStoreAfterARestart(t *testing.T) {
	store := storeWith(newComp("billing", "/billing", newRoute("/invoices")))
	svc := NewService(nil)
	svc.repo = store

	comp, err := svc.GetComponent(context.Background(), "billing")
	if err != nil {
		t.Fatalf("GetComponent: %v", err)
	}
	if comp.Name != "billing" || comp.Prefix != "/billing" {
		t.Fatalf("comp = %+v", comp)
	}
	if store.getCalls != 1 {
		t.Fatalf("store getCalls = %d, want 1", store.getCalls)
	}

	// The read must repopulate the cache, so the second call costs nothing.
	if !svc.registry.Has("billing") {
		t.Fatal("the component was not repopulated into the registry")
	}
	if _, err := svc.GetComponent(context.Background(), "billing"); err != nil {
		t.Fatalf("second GetComponent: %v", err)
	}
	if store.getCalls != 1 {
		t.Fatalf("store getCalls = %d, want 1 (the cache should answer)", store.getCalls)
	}
	if svc.registry.Count() != 1 {
		t.Fatalf("registry Count = %d, want 1", svc.registry.Count())
	}
}

func TestGetComponent_MapsStoreNotFoundToComponentNotFound(t *testing.T) {
	svc := NewService(nil)
	svc.repo = storeWith()

	_, err := svc.GetComponent(context.Background(), "gone")
	if !errors.Is(err, apicomponent.ErrComponentNotFound) {
		t.Fatalf("err = %v, want ErrComponentNotFound", err)
	}
}

// A store outage is not the same as a missing component: collapsing the two
// would let the API report "not found" while the database is down.
func TestGetComponent_PropagatesStoreErrors(t *testing.T) {
	store := storeWith()
	store.err = errors.New("db connection refused")
	svc := NewService(nil)
	svc.repo = store

	_, err := svc.GetComponent(context.Background(), "billing")
	if err == nil {
		t.Fatal("expected the store error")
	}
	if errors.Is(err, apicomponent.ErrComponentNotFound) {
		t.Fatalf("store outage was misreported as a missing component: %v", err)
	}
	if err.Error() != "db connection refused" {
		t.Fatalf("err = %v", err)
	}
}

func TestGetComponent_WithoutAStore(t *testing.T) {
	svc := NewService(nil)
	if svc.repo != nil {
		t.Fatal("NewService(nil) must leave the store nil")
	}
	_, err := svc.GetComponent(context.Background(), "billing")
	if !errors.Is(err, apicomponent.ErrComponentNotFound) {
		t.Fatalf("err = %v, want ErrComponentNotFound", err)
	}
}

func TestListComponents_LoadsEveryPersistedComponent(t *testing.T) {
	store := storeWith(
		newComp("audit", "/audit", newRoute("/events")),
		newComp("billing", "/billing", newRoute("/invoices")),
		newComp("flags", "/flags", newRoute("/:key")),
	)
	svc := NewService(nil)
	svc.repo = store

	names, err := svc.ListComponents(context.Background())
	if err != nil {
		t.Fatalf("ListComponents: %v", err)
	}
	want := []string{"audit", "billing", "flags"}
	if len(names) != len(want) {
		t.Fatalf("names = %v, want %v", names, want)
	}
	for i := range want {
		if names[i] != want[i] {
			t.Fatalf("names = %v, want %v", names, want)
		}
	}
	if !svc.loaded {
		t.Fatal("loaded was not set, so every call would re-read the store")
	}
	if svc.registry.Count() != 3 {
		t.Fatalf("registry Count = %d, want 3", svc.registry.Count())
	}
}

func TestListRoutes_LoadsRoutesFromTheStore(t *testing.T) {
	store := storeWith(
		newComp("billing", "/billing", newRoute("/invoices")),
		newComp("audit", "/audit", newRoute("/events")),
	)
	svc := NewService(nil)
	svc.repo = store

	routes, err := svc.ListRoutes(context.Background())
	if err != nil {
		t.Fatalf("ListRoutes: %v", err)
	}
	if len(routes) != 2 {
		t.Fatalf("routes = %v, want 2 entries", routes)
	}
	var paths []string
	for _, r := range routes {
		paths = append(paths, r.Component+":"+r.Path)
		if len(r.Methods) != 1 || r.Methods[0] != "GET" {
			t.Fatalf("route methods = %v, want [GET]", r.Methods)
		}
	}
	sort.Strings(paths)
	if paths[0] != "audit:/events" || paths[1] != "billing:/invoices" {
		t.Fatalf("paths = %v", paths)
	}
}

func TestFilterByTag_LoadsFromTheStore(t *testing.T) {
	a := newComp("billing", "/billing")
	a.Tags = []string{"money"}
	b := newComp("audit", "/audit")
	b.Tags = []string{"compliance"}
	store := storeWith(a, b)

	svc := NewService(nil)
	svc.repo = store

	names, err := svc.FilterByTag(context.Background(), "money")
	if err != nil {
		t.Fatalf("FilterByTag: %v", err)
	}
	if len(names) != 1 || names[0] != "billing" {
		t.Fatalf("names = %v, want [billing]", names)
	}

	empty, err := svc.FilterByTag(context.Background(), "missing")
	if err != nil {
		t.Fatalf("FilterByTag: %v", err)
	}
	if empty == nil || len(empty) != 0 {
		t.Fatalf("empty match = %v, want an empty slice", empty)
	}
}

func TestListComponents_ReturnsStoreErrors(t *testing.T) {
	store := storeWith(newComp("billing", "/billing"))
	store.err = errors.New("db down")
	svc := NewService(nil)
	svc.repo = store

	names, err := svc.ListComponents(context.Background())
	if err == nil {
		t.Fatalf("expected the store error, got names=%v", names)
	}
	if names != nil {
		t.Fatalf("names = %v, want nil on error", names)
	}
	if svc.loaded {
		t.Fatal("a failed load must not set loaded")
	}
}

// The store must be read once per process, not once per request.
func TestEnsureLoaded_QuietsTheStoreAfterOnePass(t *testing.T) {
	store := storeWith(
		newComp("billing", "/billing", newRoute("/invoices")),
		newComp("audit", "/audit", newRoute("/events")),
	)
	svc := NewService(nil)
	svc.repo = store

	for i := 0; i < 3; i++ {
		if _, err := svc.ListComponents(context.Background()); err != nil {
			t.Fatalf("ListComponents #%d: %v", i, err)
		}
		if _, err := svc.ListRoutes(context.Background()); err != nil {
			t.Fatalf("ListRoutes #%d: %v", i, err)
		}
	}
	if store.listCalls != 1 {
		t.Fatalf("store listCalls = %d, want 1", store.listCalls)
	}
	if store.getCalls != 2 {
		t.Fatalf("store getCalls = %d, want 2", store.getCalls)
	}
}

// A component deleted by another process while this one is loading must not
// abort the load or poison the cache.
func TestEnsureLoaded_SkipsComponentsVanishedFromTheStore(t *testing.T) {
	store := storeWith(newComp("billing", "/billing"))
	store.names = []string{"billing", "ghost"}
	svc := NewService(nil)
	svc.repo = store

	names, err := svc.ListComponents(context.Background())
	if err != nil {
		t.Fatalf("ListComponents: %v", err)
	}
	if len(names) != 1 || names[0] != "billing" {
		t.Fatalf("names = %v, want [billing]", names)
	}
	if !svc.loaded {
		t.Fatal("loaded should be set even when one name vanished")
	}
}

// Stats must stay useful when the store is unreachable: an incomplete count
// beats a panic.
func TestStats_SurvivesAStoreError(t *testing.T) {
	store := storeWith(newComp("billing", "/billing"))
	store.err = errors.New("db down")
	svc := NewService(nil)
	svc.repo = store

	stats := svc.Stats(context.Background())
	if stats == nil {
		t.Fatal("Stats returned nil")
	}
	if stats.ComponentCount != 0 {
		t.Fatalf("ComponentCount = %d, want 0 with an empty registry", stats.ComponentCount)
	}
	if stats.Components == nil || len(stats.Components) != 0 {
		t.Fatalf("Components = %v, want an empty slice", stats.Components)
	}
}
