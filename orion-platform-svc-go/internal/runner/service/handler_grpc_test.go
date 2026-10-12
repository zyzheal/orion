package service

import (
	"context"
	"errors"
	"net"
	"strings"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health/grpc_health_v1"
)

// fakeGRPCConn implements grpc.ClientConnInterface for tests.
type fakeGRPCConn struct {
	lastMethod string
	lastReq    interface{}
	respBytes  []byte
	invErr     error
	invoked    bool
}

func (f *fakeGRPCConn) Invoke(ctx context.Context, method string, args, reply any, _ ...grpc.CallOption) error {
	f.invoked = true
	f.lastMethod = method
	f.lastReq = args
	if f.invErr != nil {
		return f.invErr
	}
	// reply is *[]byte — reflect-lite: write to the concrete type.
	if b, ok := reply.(*[]byte); ok {
		*b = f.respBytes
	}
	return nil
}

func (f *fakeGRPCConn) NewStream(ctx context.Context, desc *grpc.StreamDesc, method string, opts ...grpc.CallOption) (grpc.ClientStream, error) {
	return nil, errors.New("not implemented")
}

func (f *fakeGRPCConn) Connect()   {}
func (f *fakeGRPCConn) WaitForAddrChange(ctx context.Context) error {
	return nil
}

func TestParseGRPCEndpoint_OK(t *testing.T) {
	cases := []struct {
		in       string
		wantHost string
		wantInse bool
	}{
		{"grpc://10.0.0.1:50051", "10.0.0.1:50051", true},
		{"grpcs://api.example.com:443", "api.example.com:443", false},
		{"10.0.0.1:50051", "10.0.0.1:50051", true}, // bare → insecure
	}
	for _, tc := range cases {
		host, inse := parseGRPCEndpoint(tc.in)
		if host != tc.wantHost {
			t.Errorf("host = %q, want %q", host, tc.wantHost)
		}
		if inse != tc.wantInse {
			t.Errorf("inse = %v, want %v (input=%q)", inse, tc.wantInse, tc.in)
		}
	}
}

func TestParseGRPCEndpoint_Invalid(t *testing.T) {
	if host, _ := parseGRPCEndpoint(""); host != "" {
		t.Errorf("empty endpoint: host = %q", host)
	}
}

func TestGRPCHandler_DispatchTask_WithCustomAdapter(t *testing.T) {
	// Custom adapter bypasses dial entirely.
	adapter := &stubGRPCAdapter{
		resp:  "dj-xyz",
		calls: 0,
	}
	h := NewGRPCHandlerWithConfig(GRPCRunnerConfig{DefaultDeadline: 5 * time.Second})
	h.WithClientAdapter(adapter)

	id, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "grpc://10.0.0.1:50051"},
		&RunnerJobView{JobID: "job-1", TaskType: "shell", Params: map[string]interface{}{"command": "echo hi"}},
	)
	if err != nil {
		t.Fatalf("DispatchTask: %v", err)
	}
	if id != "dj-xyz" {
		t.Errorf("id = %q, want dj-xyz", id)
	}
	if adapter.calls != 1 {
		t.Errorf("adapter calls = %d, want 1", adapter.calls)
	}
	if adapter.gotTarget != "10.0.0.1:50051" {
		t.Errorf("adapter target = %q", adapter.gotTarget)
	}
	if adapter.gotReq.JobID != "job-1" {
		t.Errorf("adapter req JobID = %q", adapter.gotReq.JobID)
	}
}

func TestGRPCHandler_DispatchTask_DefaultAdapterWithFakeConn(t *testing.T) {
	fake := &fakeGRPCConn{respBytes: []byte(`{"dispatch_id":"dj-fake"}`)}
	h := NewGRPCHandlerWithConfig(GRPCRunnerConfig{DefaultDeadline: 5 * time.Second})
	h.WithClientFactory(func(_ context.Context, target string, _ GRPCRunnerConfig) (grpc.ClientConnInterface, error) {
		if target != "10.0.0.1:50051" {
			t.Errorf("target = %q", target)
		}
		return fake, nil
	})

	id, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "grpc://10.0.0.1:50051"},
		&RunnerJobView{JobID: "job-1", TaskType: "shell", Params: map[string]interface{}{"command": "echo hi"}},
	)
	if err != nil {
		t.Fatalf("DispatchTask: %v", err)
	}
	if !fake.invoked {
		t.Error("Invoke not called")
	}
	if fake.lastMethod != "/runner.Dispatcher/Dispatch" {
		t.Errorf("method = %q, want /runner.Dispatcher/Dispatch", fake.lastMethod)
	}
	if id != "dj-fake" {
		t.Errorf("id = %q", id)
	}
}

func TestGRPCHandler_DispatchTask_InvokeError(t *testing.T) {
	fake := &fakeGRPCConn{invErr: errors.New("conn refused")}
	h := NewGRPCHandlerWithConfig(GRPCRunnerConfig{})
	h.WithClientFactory(func(_ context.Context, _ string, _ GRPCRunnerConfig) (grpc.ClientConnInterface, error) {
		return fake, nil
	})
	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "grpc://x:1"},
		&RunnerJobView{JobID: "j"},
	)
	if err == nil {
		t.Fatal("expected invoke error")
	}
	if !strings.Contains(err.Error(), "conn refused") {
		t.Errorf("err = %v", err)
	}
}

func TestGRPCHandler_DispatchTask_MissingEndpoint(t *testing.T) {
	h := NewGRPCHandlerWithConfig(GRPCRunnerConfig{})
	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: ""},
		&RunnerJobView{JobID: "j"},
	)
	if err == nil {
		t.Fatal("expected endpoint error")
	}
}

func TestGRPCHandler_DispatchTask_MissingJobID(t *testing.T) {
	h := NewGRPCHandlerWithConfig(GRPCRunnerConfig{})
	_, err := h.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "grpc://x:1"},
		&RunnerJobView{JobID: ""},
	)
	if err == nil {
		t.Fatal("expected job_id error")
	}
}

func TestGRPCHandler_PlaceholderReturnsNotFound(t *testing.T) {
	p := newGRPCPlaceholder()
	_, err := p.DispatchTask(context.Background(),
		&RunnerAgentView{Endpoint: "grpc://x:1"},
		&RunnerJobView{JobID: "j"},
	)
	if !errors.Is(err, ErrHandlerNotFound) {
		t.Errorf("placeholder: got %v, want ErrHandlerNotFound", err)
	}
}

// stubGRPCAdapter implements GRPCRunnerClientInterface for tests.
type stubGRPCAdapter struct {
	resp       string
	calls      int
	gotTarget  string
	gotReq     *GRPCCallRequest
	invErr     error
}

func (s *stubGRPCAdapter) DispatchJob(_ context.Context, target string, req *GRPCCallRequest) (string, error) {
	s.calls++
	s.gotTarget = target
	s.gotReq = req
	if s.invErr != nil {
		return "", s.invErr
	}
	return s.resp, nil
}

// Integration smoke: spin up a TCP gRPC server on a real port and verify
// defaultDial + Invoke work end-to-end. Guards against grpc API drift
// and catches broken credential wiring.
func TestGRPCHandler_TCPPipeSmoke(t *testing.T) {
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Skipf("cannot bind TCP listener: %v", err)
	}
	defer lis.Close()
	srv := grpc.NewServer()
	grpc_health_v1.RegisterHealthServer(srv, &stubHealthServer{})
	go func() { _ = srv.Serve(lis) }()
	defer srv.GracefulStop()

	target := lis.Addr().String()
	dialCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	conn, err := defaultDial(dialCtx, target, GRPCRunnerConfig{}, true)
	if err != nil {
		t.Fatalf("defaultDial: %v", err)
	}
	if cc, ok := conn.(*grpc.ClientConn); ok {
		defer cc.Close()
	}
	// Invoke Health/Check with a minimal request.
	pingCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	var resp grpc_health_v1.HealthCheckResponse
	if err := conn.Invoke(pingCtx, "/grpc.health.v1.Health/Check",
		&grpc_health_v1.HealthCheckRequest{}, &resp); err != nil {
		t.Fatalf("Invoke Health/Check: %v", err)
	}
	if resp.GetStatus() != grpc_health_v1.HealthCheckResponse_SERVING {
		t.Errorf("status = %v, want SERVING", resp.GetStatus())
	}
}

// stubHealthServer implements grpc_health_v1.HealthServer minimally.
type stubHealthServer struct {
	grpc_health_v1.UnimplementedHealthServer
}

func (s *stubHealthServer) Check(ctx context.Context, _ *grpc_health_v1.HealthCheckRequest) (*grpc_health_v1.HealthCheckResponse, error) {
	return &grpc_health_v1.HealthCheckResponse{
		Status: grpc_health_v1.HealthCheckResponse_SERVING,
	}, nil
}
