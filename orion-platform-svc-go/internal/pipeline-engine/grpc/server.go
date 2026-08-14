// Package grpcserver implements the gRPC server for the PipelineEngine service.
//
// Since protoc is not available, the service is registered manually via
// grpc.ServiceDesc, and a custom JSON codec is registered under the name
// "proto" so that the gRPC framework uses it for all message serialization
// without requiring protoc-generated marshal/unmarshal code.
package grpcserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net"

	"orion/platform-svc-go/internal/pipeline-engine/grpc/pb"
	"orion/platform-svc-go/internal/pipeline-engine/models"
	pe_service "orion/platform-svc-go/internal/pipeline-engine/service"

	"google.golang.org/grpc"
	"google.golang.org/grpc/encoding"
)

// ---------------------------------------------------------------------------
// jsonCodec: a gRPC codec that uses JSON wire format. It is registered under
// the name "proto" so that the gRPC framework uses it transparently instead
// of the real protobuf codec, allowing plain Go structs to serve as message
// types without protoc-generated code.
// ---------------------------------------------------------------------------

type jsonCodec struct{}

func (jsonCodec) Name() string { return "proto" } // override default proto codec

func (jsonCodec) Marshal(v interface{}) ([]byte, error) {
	return json.Marshal(v)
}

func (jsonCodec) Unmarshal(data []byte, v interface{}) error {
	return json.Unmarshal(data, v)
}

func init() {
	encoding.RegisterCodec(jsonCodec{})
}

// ---------------------------------------------------------------------------
// Server wraps the PipelineEngine service as a gRPC server.
// ---------------------------------------------------------------------------

// Server is the gRPC server wrapper for PipelineEngine.
type Server struct {
	engine  *pe_service.PipelineEngine
	grpcSrv *grpc.Server
}

// NewServer creates a new gRPC server wrapping the given PipelineEngine.
func NewServer(engine *pe_service.PipelineEngine) *Server {
	s := &Server{
		engine: engine,
		grpcSrv: grpc.NewServer(),
	}

	// Register the service manually via grpc.ServiceDesc.
	s.grpcSrv.RegisterService(&grpc.ServiceDesc{
		ServiceName: "pipelineengine.PipelineEngine",
		HandlerType: (*Server)(nil),
		Methods: []grpc.MethodDesc{
			{
				MethodName: "ExecutePipeline",
				Handler:    s.executePipelineHandler,
			},
			{
				MethodName: "GetPipelineStatus",
				Handler:    s.getPipelineStatusHandler,
			},
			{
				MethodName: "CancelPipeline",
				Handler:    s.cancelPipelineHandler,
			},
		},
		Streams:  []grpc.StreamDesc{},
		Metadata: "api/proto/pipeline_engine.proto",
	}, s)

	return s
}

// Serve serves the gRPC server on the given listener.
func (s *Server) Serve(lis net.Listener) error {
	return s.grpcSrv.Serve(lis)
}

// GracefulStop stops the gRPC server gracefully.
func (s *Server) GracefulStop() {
	s.grpcSrv.GracefulStop()
}

// ---------------------------------------------------------------------------
// RPC handlers (one per method)
// ---------------------------------------------------------------------------

func (s *Server) executePipelineHandler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := &pb.ExecutePipelineRequest{}
	if err := dec(in); err != nil {
		return nil, fmt.Errorf("decode ExecutePipelineRequest: %w", err)
	}

	contextMap := make(map[string]interface{})
	if in.ContextJSON != "" {
		contextMap["raw"] = in.ContextJSON
	}

	req := models.TriggerRequest{
		PipelineID:      in.PipelineID,
		PipelineVersion: in.PipelineVersion,
		TriggerType:     in.TriggerType,
		TriggerBy:       in.TriggerBy,
		Environment:     in.Environment,
		Context:         contextMap,
		SpecYAML:        in.SpecYAML,
	}

	run, err := s.engine.Execute(ctx, in.TenantID, req)
	if err != nil {
		return nil, fmt.Errorf("execute pipeline: %w", err)
	}

	return &pb.ExecutePipelineResponse{
		RunID:      run.ID,
		PipelineID: run.PipelineID,
		Status:     string(run.Status),
		CreatedAt:  run.CreatedAt,
		TenantID:   run.TenantID,
	}, nil
}

func (s *Server) getPipelineStatusHandler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := &pb.GetPipelineStatusRequest{}
	if err := dec(in); err != nil {
		return nil, fmt.Errorf("decode GetPipelineStatusRequest: %w", err)
	}

	run, err := s.engine.GetRun(ctx, in.TenantID, in.RunID)
	if err != nil {
		return nil, fmt.Errorf("get pipeline status: %w", err)
	}

	var startedAt, completedAt, durationMs int64
	if run.StartedAt != nil {
		startedAt = *run.StartedAt
	}
	if run.CompletedAt != nil {
		completedAt = *run.CompletedAt
	}
	if run.DurationMs != nil {
		durationMs = *run.DurationMs
	}

	var errMsg string
	if run.Status == models.RunStatusFailed {
		errMsg = "pipeline execution failed"
	}

	return &pb.GetPipelineStatusResponse{
		RunID:       run.ID,
		PipelineID:  run.PipelineID,
		Status:      string(run.Status),
		StartedAt:   startedAt,
		CompletedAt: completedAt,
		DurationMs:  durationMs,
		TenantID:    run.TenantID,
		Error:       errMsg,
	}, nil
}

func (s *Server) cancelPipelineHandler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := &pb.CancelPipelineRequest{}
	if err := dec(in); err != nil {
		return nil, fmt.Errorf("decode CancelPipelineRequest: %w", err)
	}

	triggerBy := in.TriggerBy
	if triggerBy == "" {
		triggerBy = "grpc-client"
	}

	run, err := s.engine.CancelRun(ctx, in.TenantID, in.RunID, triggerBy)
	if err != nil {
		return nil, fmt.Errorf("cancel pipeline: %w", err)
	}

	var completedAt int64
	if run.CompletedAt != nil {
		completedAt = *run.CompletedAt
	}

	return &pb.CancelPipelineResponse{
		RunID:       run.ID,
		PipelineID:  run.PipelineID,
		Status:      string(run.Status),
		CompletedAt: completedAt,
		TenantID:    run.TenantID,
	}, nil
}