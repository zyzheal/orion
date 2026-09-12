package channels

import (
	"bufio"
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"

	"orion/platform-svc-go/internal/notification/models"

	"orion/platform-svc-go/internal/notification/notification-engine"
)

// ---------------------------------------------------------------------------
// fakeSMTP - a minimal RFC 5321 listener used to prove that EmailHandler really
// transmits a message instead of merely reporting success.
// ---------------------------------------------------------------------------

type fakeSMTP struct {
	ln net.Listener

	mu        sync.Mutex
	commands  []string
	messages  []string
	connCount int
}

func newFakeSMTP(t *testing.T) *fakeSMTP {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("net.Listen: %v", err)
	}
	s := &fakeSMTP{ln: ln}
	t.Cleanup(func() { _ = ln.Close() })

	go func() {
		for {
			conn, err := s.ln.Accept()
			if err != nil {
				return
			}
			go s.serve(conn)
		}
	}()
	return s
}

func (s *fakeSMTP) host() string {
	return strings.Split(s.ln.Addr().String(), ":")[0]
}

func (s *fakeSMTP) port() int {
	p, err := strconv.Atoi(strings.Split(s.ln.Addr().String(), ":")[1])
	if err != nil {
		panic(err)
	}
	return p
}

func (s *fakeSMTP) serve(conn net.Conn) {
	defer conn.Close()
	s.mu.Lock()
	s.connCount++
	s.mu.Unlock()

	r := bufio.NewReader(conn)
	reply := func(line string) { _, _ = conn.Write([]byte(line + "\r\n")) }

	reply("220 orion.local ESMTP fakeSMTP")

	var body []string
	inData := false
	for {
		line, err := r.ReadString('\n')
		if err != nil {
			return
		}
		raw := strings.TrimRight(line, "\r\n")
		upper := strings.ToUpper(raw)

		s.mu.Lock()
		s.commands = append(s.commands, upper)
		s.mu.Unlock()

		switch {
		case upper == "QUIT":
			reply("221 2.0.0 bye")
			return
		case upper == "EHLO" || strings.HasPrefix(upper, "EHLO "):
			reply("250-orion.local")
			reply("250-AUTH PLAIN LOGIN")
			reply("250 HELP")
		case upper == "NOOP" || upper == "RSET":
			reply("250 2.0.0 OK")
		case strings.HasPrefix(upper, "AUTH "):
			reply("235 2.7.0 Authentication successful")
		case !inData && (upper == "MAIL" || strings.HasPrefix(upper, "MAIL ")):
			reply("250 2.1.0 OK")
		case !inData && (upper == "RCPT" || strings.HasPrefix(upper, "RCPT ")):
			reply("250 2.1.5 OK")
		case !inData && upper == "DATA":
			inData = true
			body = nil
			reply("354 End data with <CR><LF>.<CR><LF>")
		case inData:
			if raw == "." {
				inData = false
				s.mu.Lock()
				s.messages = append(s.messages, strings.Join(body, "\n"))
				s.mu.Unlock()
				reply("250 2.0.0 OK")
			} else {
				body = append(body, raw)
			}
		default:
			reply("500 5.5.2 unrecognized command")
		}
	}
}

func (s *fakeSMTP) snapshot() ([]string, []string, int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cmds := make([]string, len(s.commands))
	copy(cmds, s.commands)
	msgs := make([]string, len(s.messages))
	copy(msgs, s.messages)
	return cmds, msgs, s.connCount
}

// ---------------------------------------------------------------------------
// EmailHandler
// ---------------------------------------------------------------------------

func newEmailHandler() *EmailHandler {
	eh := &EmailHandler{}
	eh.BaseNotifyChannel = *NewBaseNotifyChannel()
	return eh
}

func emailMetadata(t *fakeSMTP) models.JSONB {
	return models.JSONB{
		"smtp_host":     t.host(),
		"smtp_port":     t.port(),
		"smtp_from":     "orion@example.com",
		"smtp_starttls": false,
	}
}

// TestEmailHandlerSendsViaSMTP pins the delivery itself.
//
// The previous implementation returned Success: true with a fabricated
// MessageID and never opened a connection at all, so asserting on the result
// alone would have passed the stub too. The discriminator is server-side: the
// fake relay must have observed MAIL, both RCPTs and the DATA payload.
func TestEmailHandlerSendsViaSMTP(t *testing.T) {
	smtpServer := newFakeSMTP(t)
	eh := newEmailHandler()

	msg := &engine.NotifyMessage{
		ID:        "n-1",
		TenantID:  "t1",
		Title:     "Pipe failed",
		Subject:   "[ORION] build #42 failed",
		Content:   "step unit-test exited 1",
		Recipient: "ops@example.com",
		CC:        []string{"lead@example.com"},
		Metadata:  emailMetadata(smtpServer),
	}

	result, err := eh.Execute(context.Background(), msg)
	if err != nil {
		t.Fatalf("Execute returned error: %v", err)
	}
	if !result.Success {
		t.Fatalf("result.Success = false, error=%q", result.Error)
	}
	if result.MessageID == "" {
		t.Error("MessageID is empty")
	}

	cmds, msgs, conns := smtpServer.snapshot()
	if conns != 1 {
		t.Fatalf("relay saw %d connections, want exactly 1", conns)
	}
	// The stub records commands case-normalised, matching SMTP's case-
	// insensitive command parsing.
	transcript := strings.Join(cmds, " ")
	for _, want := range []string{
		"MAIL FROM:<ORION@EXAMPLE.COM>",
		"RCPT TO:<OPS@EXAMPLE.COM>",
		"RCPT TO:<LEAD@EXAMPLE.COM>",
		"DATA",
		"QUIT",
	} {
		if !strings.Contains(transcript, want) {
			t.Errorf("relay transcript missing %q; transcript=%q", want, transcript)
		}
	}
	if len(msgs) != 1 {
		t.Fatalf("relay received %d messages, want 1", len(msgs))
	}
	body := msgs[0]
	for _, want := range []string{
		"Subject: [ORION] build #42 failed",
		"From: orion@example.com",
		"To: ops@example.com",
		"Cc: lead@example.com",
		"step unit-test exited 1",
	} {
		if !strings.Contains(body, want) {
			t.Errorf("message body missing %q; body=%q", want, body)
		}
	}
	if !eh.Healthy() {
		t.Error("channel reported unhealthy after a successful send")
	}
}

// TestEmailHandlerAuthenticatesWhenCredentialed proves the optional basic auth
// path is exercised rather than skipped.
func TestEmailHandlerAuthenticatesWhenCredentialed(t *testing.T) {
	smtpServer := newFakeSMTP(t)
	eh := newEmailHandler()

	m := emailMetadata(smtpServer)
	m["smtp_user"] = "relay-user"
	m["smtp_pass"] = "relay-pass"

	msg := &engine.NotifyMessage{
		ID:        "n-2",
		Recipient: "a@example.com",
		Title:     "t",
		Content:   "c",
		Metadata:  m,
	}
	if _, err := eh.Execute(context.Background(), msg); err != nil {
		t.Fatalf("Execute: %v", err)
	}

	cmds, _, _ := smtpServer.snapshot()
	if !strings.Contains(strings.Join(cmds, " "), "AUTH PLAIN") {
		t.Errorf("expected AUTH PLAIN in transcript, got %q", strings.Join(cmds, " "))
	}
}

// TestEmailHandlerFailsCleanlyWithoutRelayConfig guards the loud-failure
// contract: without relay settings the channel must error out, not report
// success.
func TestEmailHandlerFailsCleanlyWithoutRelayConfig(t *testing.T) {
	eh := newEmailHandler()

	_, err := eh.Execute(context.Background(), &engine.NotifyMessage{
		ID:        "n-3",
		Recipient: "a@example.com",
		Metadata:  models.JSONB{},
	})
	if err == nil {
		t.Fatal("expected an error for an unconfigured relay, got nil")
	}
	if !strings.Contains(err.Error(), "smtp_host not configured") {
		t.Errorf("error = %q, want it to name the missing key", err.Error())
	}
}

// TestEmailHandlerRejectsMissingSender pins the second required key.
func TestEmailHandlerRejectsMissingSender(t *testing.T) {
	eh := newEmailHandler()

	_, err := eh.Execute(context.Background(), &engine.NotifyMessage{
		ID:       "n-4",
		Metadata: models.JSONB{"smtp_host": "relay.example.com"},
	})
	if err == nil {
		t.Fatal("expected an error for a missing smtp_from, got nil")
	}
	if !strings.Contains(err.Error(), "smtp_from not configured") {
		t.Errorf("error = %q, want it to name the missing key", err.Error())
	}
}

// TestEmailHandlerRejectsEmptyRecipients ensures a config-complete message with
// nobody to deliver to is refused instead of being swallowed.
func TestEmailHandlerRejectsEmptyRecipients(t *testing.T) {
	smtpServer := newFakeSMTP(t)
	eh := newEmailHandler()

	_, err := eh.Execute(context.Background(), &engine.NotifyMessage{
		ID:       "n-5",
		Metadata: emailMetadata(smtpServer),
	})
	if err == nil {
		t.Fatal("expected an error for a recipient-less message, got nil")
	}
	if !strings.Contains(err.Error(), "no recipients") {
		t.Errorf("error = %q, want it to name the missing recipients", err.Error())
	}
	if _, _, conns := smtpServer.snapshot(); conns != 0 {
		t.Errorf("relay saw %d connections, want 0", conns)
	}
}

// TestEmailHandlerMarksUnhealthyOnTransportFailure proves a dead relay is a
// reported, tracked failure rather than a success.
func TestEmailHandlerMarksUnhealthyOnTransportFailure(t *testing.T) {
	eh := newEmailHandler()

	_, err := eh.Execute(context.Background(), &engine.NotifyMessage{
		ID:        "n-6",
		Recipient: "a@example.com",
		Metadata: models.JSONB{
			"smtp_host": "127.0.0.1",
			"smtp_port": 1, // reserved; nothing listens here
			"smtp_from": "orion@example.com",
		},
	})
	if err == nil {
		t.Fatal("expected a connect failure, got nil")
	}
	if eh.Healthy() {
		t.Error("channel still reported healthy after a connect failure")
	}
	if !strings.Contains(err.Error(), "smtp connect") {
		t.Errorf("error = %q, want a connect-level message", err.Error())
	}
}

// TestEmailHandlerSubjectFallsBackToTitle covers the subject-less case.
func TestEmailHandlerSubjectFallsBackToTitle(t *testing.T) {
	smtpServer := newFakeSMTP(t)
	eh := newEmailHandler()

	if _, err := eh.Execute(context.Background(), &engine.NotifyMessage{
		ID:        "n-7",
		Title:     "Deploy complete",
		Content:   "v2.3.1 rolled out",
		Recipient: "a@example.com",
		Metadata:  emailMetadata(smtpServer),
	}); err != nil {
		t.Fatalf("Execute: %v", err)
	}
	_, msgs, _ := smtpServer.snapshot()
	if len(msgs) != 1 {
		t.Fatalf("relay received %d messages, want 1", len(msgs))
	}
	if !strings.Contains(msgs[0], "Subject: Deploy complete") {
		t.Errorf("body = %q, want the title used as the subject", msgs[0])
	}
}

// ---------------------------------------------------------------------------
// SMSHandler
// ---------------------------------------------------------------------------

// TestSMSHandlerPostsToGateway pins the real HTTP call.
//
// The previous implementation always returned "SMS channel not implemented
// yet", so a passing Success already discriminates; asserting on the received
// payload additionally pins the field mapping.
func TestSMSHandlerPostsToGateway(t *testing.T) {
	var got http.Header
	var payload map[string]any

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r.Header.Clone()
		_ = json.NewDecoder(r.Body).Decode(&payload)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"gw-1"}`))
	}))
	defer srv.Close()

	sh := &SMSHandler{BaseNotifyChannel: *NewBaseNotifyChannel()}

	msg := &engine.NotifyMessage{
		ID:       "n-8",
		TenantID: "t1",
		Title:    "Incident",
		Content:  "checkout is down",
		Metadata: models.JSONB{
			"sms_gateway_url": srv.URL,
			"sms_api_key":     "gw-secret",
			"sms_sign_name":   "ORION",
			"sms_phones":      []string{"+8613800000001", " +8613800000002 "},
		},
	}

	result, err := sh.Execute(context.Background(), msg)
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if !result.Success {
		t.Fatalf("result.Success = false, code=%d error=%q", result.ResponseCode, result.Error)
	}
	if result.ResponseCode != http.StatusOK {
		t.Errorf("ResponseCode = %d, want %d", result.ResponseCode, http.StatusOK)
	}

	if payload["message"] != "Incident: checkout is down" {
		t.Errorf("message = %v, want title-prefixed text", payload["message"])
	}
	phones, _ := payload["phones"].([]any)
	if len(phones) != 2 || phones[0] != "+8613800000001" || phones[1] != "+8613800000002" {
		t.Errorf("phones = %v, want the two trimmed numbers", payload["phones"])
	}
	if payload["signature"] != "ORION" {
		t.Errorf("signature = %v, want ORION", payload["signature"])
	}
	if payload["notificationId"] != "n-8" || payload["tenantId"] != "t1" {
		t.Errorf("audit fields wrong: notificationId=%v tenantId=%v",
			payload["notificationId"], payload["tenantId"])
	}
	if got.Get("Authorization") != "Bearer gw-secret" {
		t.Errorf("Authorization = %q, want Bearer gw-secret", got.Get("Authorization"))
	}
	if got.Get("Content-Type") != "application/json; charset=utf-8" {
		t.Errorf("Content-Type = %q", got.Get("Content-Type"))
	}
	if !sh.Healthy() {
		t.Error("channel reported unhealthy after a successful send")
	}
}

// TestSMSHandlerFallsBackToRecipientWhenNoPhoneList pins the recipient fallback
// and its comma/semicolon splitting.
func TestSMSHandlerFallsBackToRecipientWhenNoPhoneList(t *testing.T) {
	var payload map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&payload)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	sh := &SMSHandler{BaseNotifyChannel: *NewBaseNotifyChannel()}

	msg := &engine.NotifyMessage{
		ID:        "n-9",
		Recipient: "+8613800000010,+8613800000011; +8613800000012",
		Content:   "hello",
		Metadata:  models.JSONB{"sms_gateway_url": srv.URL},
	}
	if _, err := sh.Execute(context.Background(), msg); err != nil {
		t.Fatalf("Execute: %v", err)
	}
	phones, _ := payload["phones"].([]any)
	if len(phones) != 3 {
		t.Fatalf("phones = %v, want the 3 numbers parsed from the recipient", payload["phones"])
	}
	if phones[2] != "+8613800000012" {
		t.Errorf("phones[2] = %v, semicolon split failed", phones[2])
	}
	if payload["signature"] != nil {
		t.Errorf("signature = %v, want it absent when unset", payload["signature"])
	}
}

// TestSMSHandlerFailsCleanlyWithoutGatewayConfig guards the honest-failure
// contract for an unconfigured channel.
func TestSMSHandlerFailsCleanlyWithoutGatewayConfig(t *testing.T) {
	sh := &SMSHandler{BaseNotifyChannel: *NewBaseNotifyChannel()}

	_, err := sh.Execute(context.Background(), &engine.NotifyMessage{
		ID:        "n-10",
		Recipient: "+8613800000000",
		Metadata:  models.JSONB{},
	})
	if err == nil {
		t.Fatal("expected an error for an unconfigured gateway, got nil")
	}
	if !strings.Contains(err.Error(), "sms_gateway_url not configured") {
		t.Errorf("error = %q, want it to name the missing key", err.Error())
	}
}

// TestSMSHandlerRejectsMessageWithoutNumbers ensures an untargetable message is
// refused instead of being posted to the gateway.
func TestSMSHandlerRejectsMessageWithoutNumbers(t *testing.T) {
	hits := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits++
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	sh := &SMSHandler{BaseNotifyChannel: *NewBaseNotifyChannel()}

	_, err := sh.Execute(context.Background(), &engine.NotifyMessage{
		ID:       "n-11",
		Metadata: models.JSONB{"sms_gateway_url": srv.URL},
	})
	if err == nil {
		t.Fatal("expected an error for a number-less message, got nil")
	}
	if hits != 0 {
		t.Errorf("gateway was hit %d times, want 0", hits)
	}
}

// TestSMSHandlerTracksGatewayFailure proves a 5xx gateway is recorded as a
// failed delivery and demotes the channel.
func TestSMSHandlerTracksGatewayFailure(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	sh := &SMSHandler{BaseNotifyChannel: *NewBaseNotifyChannel()}

	result, err := sh.Execute(context.Background(), &engine.NotifyMessage{
		ID:        "n-12",
		Recipient: "+8613800000000",
		Content:   "hi",
		Metadata:  models.JSONB{"sms_gateway_url": srv.URL},
	})
	if err != nil {
		t.Fatalf("Execute returned a transport error for a reachable gateway: %v", err)
	}
	if result == nil || result.Success {
		t.Fatalf("result = %+v, want a non-success result", result)
	}
	if result.ResponseCode != http.StatusServiceUnavailable {
		t.Errorf("ResponseCode = %d, want 503", result.ResponseCode)
	}
	if sh.Healthy() {
		t.Error("channel still reported healthy after a 5xx gateway response")
	}
}

// ---------------------------------------------------------------------------
// SendJSONWithHeaders
// ---------------------------------------------------------------------------

// TestSendJSONWithHeadersRejectsUnhealthyChannel guards the early-out path.
func TestSendJSONWithHeadersRejectsUnhealthyChannel(t *testing.T) {
	b := NewBaseNotifyChannel()
	b.SetHealthy(false)

	result, err := b.SendJSONWithHeaders(context.Background(), "http://example.invalid/",
		map[string]any{"a": 1}, map[string]string{"X-Test": "1"})
	if err != nil {
		t.Fatalf("expected nil error for the unhealthy short-circuit, got %v", err)
	}
	if result == nil || result.Success {
		t.Fatalf("result = %+v, want a non-success result", result)
	}
	if !strings.Contains(result.Error, "unhealthy") {
		t.Errorf("error = %q", result.Error)
	}
}

// ---------------------------------------------------------------------------
// metadata parsing helpers
// ---------------------------------------------------------------------------

// TestMetaStringIsTypeSafe pins that a wrongly-typed metadata value is treated
// as absent instead of panicking (the older webhook channels use raw
// .(string) asserts, which panic on a numeric value).
func TestMetaStringIsTypeSafe(t *testing.T) {
	if _, ok := metaString(models.JSONB{"k": 42}, "k"); ok {
		t.Error("metaString accepted a numeric value as a string")
	}
	if _, ok := metaString(models.JSONB{}, "missing"); ok {
		t.Error("metaString accepted an absent key")
	}
	got, ok := metaString(models.JSONB{"k": "  spaced  "}, "k")
	if !ok || got != "spaced" {
		t.Errorf("metaString = (%q, %v), want (spaced, true)", got, ok)
	}
}

// TestMetaIntAndMetaBoolCoerceAndDefault covers every accepted coercion.
func TestMetaIntAndMetaBoolCoerceAndDefault(t *testing.T) {
	if got := metaInt(models.JSONB{"p": "465"}, "p", 587); got != 465 {
		t.Errorf("metaInt string = %d, want 465", got)
	}
	if got := metaInt(models.JSONB{"p": float64(25)}, "p", 587); got != 25 {
		t.Errorf("metaInt float64 = %d, want 25", got)
	}
	if got := metaInt(models.JSONB{"p": "not-a-number"}, "p", 587); got != 587 {
		t.Errorf("metaInt malformed = %d, want default 587", got)
	}
	if got := metaInt(models.JSONB{}, "p", 587); got != 587 {
		t.Errorf("metaInt absent = %d, want default 587", got)
	}

	cases := map[string]bool{
		"true":  true,
		"false": false,
		"1":     true,
		"0":     false,
	}
	for in, want := range cases {
		if got := metaBool(models.JSONB{"b": in}, "b", true); got != want {
			t.Errorf("metaBool(%q) = %v, want %v", in, got, want)
		}
	}
	if got := metaBool(models.JSONB{"b": true}, "b", false); got != true {
		t.Errorf("metaBool(bool) = %v, want true", got)
	}
	if got := metaBool(models.JSONB{"b": "maybe"}, "b", false); got != false {
		t.Errorf("metaBool(malformed) = %v, want default false", got)
	}
}
