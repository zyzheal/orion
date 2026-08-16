package service

import (
	"context"
	"testing"

	"orion/platform-svc-go/internal/assistant/models"
)

func Test_NewInMemorySessionStore(t *testing.T) {
	store := NewInMemorySessionStore()
	if store == nil {
		t.Fatal("nil store")
	}
}

func Test_SessionStore_SaveAndGet(t *testing.T) {
	store := NewInMemorySessionStore()
	ctx := context.Background()
	sess := &models.Session{
		ID:       "s-1",
		TenantID: "t1",
		UserID:   "u1",
	}
	if err := store.Save(ctx, sess); err != nil {
		t.Fatalf("Save: %v", err)
	}
	got, err := store.Get(ctx, "s-1", "t1")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.ID != "s-1" || got.TenantID != "t1" {
		t.Fatalf("unexpected session: %+v", got)
	}
}

func Test_SessionStore_Get_NotFound(t *testing.T) {
	store := NewInMemorySessionStore()
	_, err := store.Get(context.Background(), "missing", "t1")
	if err == nil {
		t.Fatal("expected error for missing session")
	}
}

func Test_SessionStore_Get_TenantMismatch(t *testing.T) {
	store := NewInMemorySessionStore()
	store.Save(context.Background(), &models.Session{ID: "s1", TenantID: "t1"})
	_, err := store.Get(context.Background(), "s1", "t2")
	if err == nil {
		t.Fatal("expected error for wrong tenant")
	}
}

func Test_SessionStore_ListByUser(t *testing.T) {
	store := NewInMemorySessionStore()
	store.Save(context.Background(), &models.Session{ID: "s1", TenantID: "t1", UserID: "u1"})
	store.Save(context.Background(), &models.Session{ID: "s2", TenantID: "t1", UserID: "u1"})
	store.Save(context.Background(), &models.Session{ID: "s3", TenantID: "t1", UserID: "u2"})
	store.Save(context.Background(), &models.Session{ID: "s4", TenantID: "t2", UserID: "u1"})

	sessions, err := store.ListByUser(context.Background(), "t1", "u1", 10)
	if err != nil {
		t.Fatalf("ListByUser: %v", err)
	}
	if len(sessions) != 2 {
		t.Fatalf("expected 2 sessions, got %d", len(sessions))
	}
}

func Test_SessionStore_Delete(t *testing.T) {
	store := NewInMemorySessionStore()
	store.Save(context.Background(), &models.Session{ID: "s1", TenantID: "t1"})
	if err := store.Delete(context.Background(), "s1", "t1"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	_, err := store.Get(context.Background(), "s1", "t1")
	if err == nil {
		t.Fatal("expected error after delete")
	}
}

func Test_SessionManager_GetOrCreate_New(t *testing.T) {
	store := NewInMemorySessionStore()
	mgr := NewSessionManager(store)
	sess, err := mgr.GetOrCreate(context.Background(), "s1", "t1", "u1")
	if err != nil {
		t.Fatalf("GetOrCreate: %v", err)
	}
	if sess.ID != "s1" || sess.TenantID != "t1" || sess.UserID != "u1" {
		t.Fatalf("unexpected session: %+v", sess)
	}
}

func Test_SessionManager_GetOrCreate_Existing(t *testing.T) {
	store := NewInMemorySessionStore()
	store.Save(context.Background(), &models.Session{ID: "s1", TenantID: "t1", UserID: "u1"})
	mgr := NewSessionManager(store)
	sess, err := mgr.GetOrCreate(context.Background(), "s1", "t1", "u1")
	if err != nil {
		t.Fatalf("GetOrCreate: %v", err)
	}
	if sess.ID != "s1" {
		t.Fatalf("unexpected id: %s", sess.ID)
	}
}

func Test_SessionManager_GetOrCreate_EmptyID(t *testing.T) {
	store := NewInMemorySessionStore()
	mgr := NewSessionManager(store)
	_, err := mgr.GetOrCreate(context.Background(), "", "t1", "u1")
	if err == nil {
		t.Fatal("expected error for empty session_id")
	}
}

func Test_SessionManager_AppendTurn(t *testing.T) {
	store := NewInMemorySessionStore()
	store.Save(context.Background(), &models.Session{ID: "s1", TenantID: "t1"})
	mgr := NewSessionManager(store)

	err := mgr.AppendTurn(context.Background(), "s1", "t1", "hello", "hi")
	if err != nil {
		t.Fatalf("AppendTurn: %v", err)
	}

	sess, _ := store.Get(context.Background(), "s1", "t1")
	if len(sess.Messages) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(sess.Messages))
	}
	if sess.Messages[0].Role != "user" || sess.Messages[0].Content != "hello" {
		t.Fatalf("unexpected first message: %+v", sess.Messages[0])
	}
	if sess.Messages[1].Role != "assistant" || sess.Messages[1].Content != "hi" {
		t.Fatalf("unexpected second message: %+v", sess.Messages[1])
	}
}

func Test_SessionManager_GetContextWindow(t *testing.T) {
	store := NewInMemorySessionStore()
	mgr := NewSessionManager(store)
	store.Save(context.Background(), &models.Session{
		ID:       "s1",
		TenantID: "t1",
		Messages: []models.Message{
			{Role: "user", Content: "q1"},
			{Role: "assistant", Content: "a1"},
			{Role: "user", Content: "q2"},
			{Role: "assistant", Content: "a2"},
		},
	})

	window := mgr.GetContextWindow(context.Background(), "s1", "t1", 2)
	if len(window) != 2 {
		t.Fatalf("expected 2 messages in window, got %d", len(window))
	}
	if window[0].Content != "q2" {
		t.Fatalf("expected q2, got %s", window[0].Content)
	}
}

func Test_SessionManager_GetContextWindow_EmptySession(t *testing.T) {
	store := NewInMemorySessionStore()
	mgr := NewSessionManager(store)
	window := mgr.GetContextWindow(context.Background(), "s1", "t1", 2)
	if window != nil {
		t.Fatal("expected nil for non-existent session")
	}
}

func Test_SessionManager_GetContextWindow_EmptyID(t *testing.T) {
	store := NewInMemorySessionStore()
	mgr := NewSessionManager(store)
	window := mgr.GetContextWindow(context.Background(), "", "t1", 2)
	if window != nil {
		t.Fatal("expected nil for empty session_id")
	}
}

func Test_Service_QueryWithSession(t *testing.T) {
	svc := NewService(nil)
	svc.SetLLMClient(nil)

	ctx := context.Background()
	resp, err := svc.QueryWithSession(ctx, "t1", "u1", "s1", models.QueryRequest{
		Question: "hello",
	})
	if err != nil {
		t.Fatalf("QueryWithSession: %v", err)
	}
	if resp.SessionID != "s1" {
		t.Fatalf("unexpected session_id: %s", resp.SessionID)
	}
	if resp.Answer == "" {
		t.Fatal("expected non-empty answer")
	}
	if resp.TurnCount < 2 {
		t.Fatalf("expected turn_count >= 2, got %d", resp.TurnCount)
	}
}

func Test_Service_EnrichWithHistory_Empty(t *testing.T) {
	svc := NewService(nil)
	result := svc.enrichWithHistory("hello", nil)
	if result != "hello" {
		t.Fatalf("expected 'hello', got %q", result)
	}
}

func Test_Service_EnrichWithHistory_WithContext(t *testing.T) {
	svc := NewService(nil)
	history := []models.Message{
		{Role: "user", Content: "show alerts"},
		{Role: "assistant", Content: "here are 3 alerts"},
	}
	result := svc.enrichWithHistory("what about warnings?", history)
	if result == "what about warnings?" {
		t.Fatal("expected enriched question")
	}
}