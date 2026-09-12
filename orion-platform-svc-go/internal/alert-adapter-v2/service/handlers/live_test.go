package handlers

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"go.uber.org/zap"

	"orion/platform-svc-go/internal/alert-adapter-v2/service"
)

func newTestFactory() *service.NotificationFactory {
	return service.NewFactory(nil, zap.NewNop())
}

// ---------------------------------------------------------------------------
// RegisterLiveHandlers
// ---------------------------------------------------------------------------

func TestRegisterLiveHandlersRegistersEveryWorkingChannel(t *testing.T) {
	f := newTestFactory()
	RegisterLiveHandlers(f)

	want := []string{
		"dingtalk", "email", "feishu", "in_app", "opsgenie",
		"pagerduty", "slack", "sms", "telegram", "webhook", "wechat",
	}
	got := f.RegisteredChannels()
	if len(got) != len(want) {
		t.Fatalf("RegisteredChannels() = %v, want exactly %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("RegisteredChannels()[%d] = %q, want %q", i, got[i], want[i])
		}
	}

	// Shells and unimplemented channels must stay out of the runtime registry:
	// registering them turns a loud ErrNoHandler into a silent "delivered"
	// event that nobody ever received.
	for _, ch := range append(StubbyChannels, HandlerlessChannels...) {
		if contains(got, ch) {
			t.Errorf("channel %q must not be registered (Send is unimplemented)", ch)
		}
	}
}

func TestRegisterLiveHandlersCoversEveryListedLiveChannel(t *testing.T) {
	f := newTestFactory()
	RegisterLiveHandlers(f)
	got := f.RegisteredChannels()
	for _, ch := range LiveChannels {
		if !contains(got, ch) {
			t.Errorf("live channel %q was not registered", ch)
		}
	}
}

func TestLiveChannelListsAreDisjoint(t *testing.T) {
	for _, ch := range StubbyChannels {
		if contains(LiveChannels, ch) {
			t.Errorf("%q is both live and a stub", ch)
		}
	}
	for _, ch := range HandlerlessChannels {
		if contains(LiveChannels, ch) || contains(StubbyChannels, ch) {
			t.Errorf("%q appears in more than one list", ch)
		}
	}
}

func contains(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

// ---------------------------------------------------------------------------
// v2 EmailHandler — real SMTP delivery
// ---------------------------------------------------------------------------

type smtpTranscript struct {
	commands string
	message  string
}

type fakeSMTP struct {
	t  *testing.T
	ln net.Listener

	mu          sync.Mutex
	transcripts []smtpTranscript
	conns       int
}

func newFakeSMTP(t *testing.T) *fakeSMTP {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("fake smtp listen: %v", err)
	}
	s := &fakeSMTP{t: t, ln: ln}
	go s.acceptLoop()
	t.Cleanup(func() { _ = ln.Close() })
	return s
}

func (s *fakeSMTP) addr() (host, port string) {
	a, ok := s.ln.Addr().(*net.TCPAddr)
	if !ok {
		s.t.Fatalf("unexpected listener address %T", s.ln.Addr())
	}
	return a.IP.String(), fmt.Sprintf("%d", a.Port)
}

func (s *fakeSMTP) snapshot() []smtpTranscript {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]smtpTranscript, len(s.transcripts))
	copy(out, s.transcripts)
	return out
}

func (s *fakeSMTP) connectionCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.conns
}

func (s *fakeSMTP) acceptLoop() {
	for {
		conn, err := s.ln.Accept()
		if err != nil {
			return
		}
		s.mu.Lock()
		s.conns++
		s.mu.Unlock()
		go s.serve(conn)
	}
}

// serve is a minimal RFC 5321 relay. Commands are upper-cased when recorded to
// mirror SMTP's case-insensitive command parsing.
func (s *fakeSMTP) serve(conn net.Conn) {
	defer conn.Close()
	w := func(format string, a ...any) { _, _ = fmt.Fprintf(conn, format, a...) }
	w("220 relay ESMTP\r\n")

	var commands []string
	var body []string
	defer func() {
		s.mu.Lock()
		s.transcripts = append(s.transcripts, smtpTranscript{
			commands: strings.Join(commands, " | "),
			message:  strings.Join(body, ""),
		})
		s.mu.Unlock()
	}()

	r := bufio.NewReader(conn)
	for {
		line, err := r.ReadString('\n')
		if err != nil {
			return
		}
		line = strings.TrimRight(line, "\r\n")
		up := strings.ToUpper(line)
		commands = append(commands, up)

		switch {
		case up == "EHLO", strings.HasPrefix(up, "EHLO "), up == "NOOP", up == "RSET":
			w("250-2.0.0 relay\r\n250 HELP\r\n")
		case strings.HasPrefix(up, "AUTH"):
			w("235 2.7.0 Authentication successful\r\n")
		case strings.HasPrefix(up, "MAIL"):
			w("250 2.1.0 Sender OK\r\n")
		case strings.HasPrefix(up, "RCPT"):
			w("250 2.1.5 Recipient OK\r\n")
		case up == "DATA":
			w("354 End data with <CR><LF>.<CR><LF>\r\n")
			for {
				data, err := r.ReadString('\n')
				if err != nil {
					return
				}
				if strings.TrimRight(data, "\r\n") == "." {
					break
				}
				body = append(body, data)
			}
			w("250 2.0.0 Ok: queued\r\n")
		case up == "QUIT":
			w("221 2.0.0 Bye\r\n")
			return
		default:
			w("250 OK\r\n")
		}
	}
}

func dialTo(relay *fakeSMTP) func(ctx context.Context, network, addr string) (net.Conn, error) {
	host, port := relay.addr()
	return func(_ context.Context, network, addr string) (net.Conn, error) {
		return net.DialTimeout("tcp", net.JoinHostPort(host, port), 2*time.Second)
	}
}

func TestEmailHandlerSendsOverSMTP(t *testing.T) {
	relay := newFakeSMTP(t)

	h := NewEmailHandler()
	h.dialer = dialTo(relay)

	host, port := relay.addr()
	cfg := map[string]string{
		"smtp_host": host,
		"smtp_port": port,
		"from":      "orion@example.com",
		"to":        " oncall@example.com ; devops@example.com",
		"starttls":  "false",
		"subject":   "checkout is down",
	}
	if err := h.ValidateConfig(context.Background(), cfg); err != nil {
		t.Fatalf("ValidateConfig: %v", err)
	}
	if err := h.Initialize(context.Background(), cfg); err != nil {
		t.Fatalf("Initialize: %v", err)
	}
	if err := h.Send(context.Background(), "checkout is down", nil); err != nil {
		t.Fatalf("Send: %v", err)
	}

	snap := relay.snapshot()
	if len(snap) != 1 {
		t.Fatalf("relay saw %d deliveries (%d connections), want exactly 1", len(snap), relay.connectionCount())
	}
	if n := relay.connectionCount(); n != 1 {
		t.Fatalf("relay saw %d connections, want exactly 1", n)
	}
	tr := snap[0]

	for _, want := range []string{
		"MAIL FROM:<ORION@EXAMPLE.COM>",
		"RCPT TO:<ONCALL@EXAMPLE.COM>",
		"RCPT TO:<DEVOPS@EXAMPLE.COM>",
		"DATA",
		"QUIT",
	} {
		if !strings.Contains(tr.commands, want) {
			t.Errorf("relay transcript missing %q:\n%s", want, tr.commands)
		}
	}
	for _, want := range []string{
		"From: orion@example.com",
		"To: oncall@example.com, devops@example.com",
		"Subject: checkout is down",
		"Content-Type: text/plain; charset=UTF-8",
		"MIME-Version: 1.0",
		"\r\n\r\ncheckout is down",
	} {
		if !strings.Contains(tr.message, want) {
			t.Errorf("message body missing %q:\n%s", want, tr.message)
		}
	}
}

func TestEmailHandlerAuthenticatesWhenCredentialed(t *testing.T) {
	relay := newFakeSMTP(t)

	h := NewEmailHandler()
	h.dialer = dialTo(relay)

	host, port := relay.addr()
	if err := h.Initialize(context.Background(), map[string]string{
		"smtp_host": host, "smtp_port": port,
		"from": "orion@example.com", "to": "oncall@example.com",
		"username": "orion", "password": "secret", "starttls": "false",
	}); err != nil {
		t.Fatalf("Initialize: %v", err)
	}
	if err := h.Send(context.Background(), "hello", nil); err != nil {
		t.Fatalf("Send: %v", err)
	}
	tr := relay.snapshot()[0]
	if !strings.Contains(tr.commands, "AUTH PLAIN") {
		t.Errorf("credentials were configured but no AUTH PLAIN was sent:\n%s", tr.commands)
	}
}

func TestEmailHandlerSubjectFallsBackToVariables(t *testing.T) {
	relay := newFakeSMTP(t)

	h := NewEmailHandler()
	h.dialer = dialTo(relay)

	host, port := relay.addr()
	if err := h.Initialize(context.Background(), map[string]string{
		"smtp_host": host, "smtp_port": port,
		"from": "orion@example.com", "to": "oncall@example.com", "starttls": "false",
	}); err != nil {
		t.Fatalf("Initialize: %v", err)
	}
	if err := h.Send(context.Background(), "body", map[string]string{"title": "CPU at 99%"}); err != nil {
		t.Fatalf("Send: %v", err)
	}
	tr := relay.snapshot()[0]
	if !strings.Contains(tr.message, "Subject: CPU at 99%") {
		t.Errorf("subject did not fall back to the title variable:\n%s", tr.message)
	}
}

func TestEmailHandlerRejectsUnconfiguredSend(t *testing.T) {
	if err := NewEmailHandler().Send(context.Background(), "hello", nil); !errors.Is(err, ErrMissingRequiredConfig) {
		t.Fatalf("uninitialised Send err = %v, want ErrMissingRequiredConfig", err)
	}

	h := NewEmailHandler()
	if err := h.Initialize(context.Background(), map[string]string{"smtp_host": "mail.example.com"}); err != nil {
		t.Fatalf("Initialize: %v", err)
	}
	if err := h.Send(context.Background(), "hello", nil); !errors.Is(err, ErrMissingRequiredConfig) {
		t.Fatalf("Send with missing from/to err = %v, want ErrMissingRequiredConfig", err)
	}

	if err := NewEmailHandler().ValidateConfig(context.Background(), map[string]string{"smtp_host": "x"}); !errors.Is(err, ErrMissingRequiredConfig) {
		t.Fatalf("ValidateConfig err = %v, want ErrMissingRequiredConfig", err)
	}
}

func TestEmailHandlerRejectsUnparsablePort(t *testing.T) {
	h := NewEmailHandler()
	if err := h.Initialize(context.Background(), map[string]string{
		"smtp_host": "mail.example.com", "from": "a@example.com", "to": "b@example.com",
		"smtp_port": "not-a-port",
	}); err != nil {
		t.Fatalf("Initialize: %v", err)
	}
	err := h.Send(context.Background(), "hello", nil)
	if err == nil {
		t.Fatal("Send returned nil for an unparsable smtp_port")
	}
	if strings.Contains(err.Error(), "smtp connect") {
		t.Fatalf("port was not validated before dialing: %v", err)
	}
}

// ---------------------------------------------------------------------------
// v2 SMSHandler — real gateway POST
// ---------------------------------------------------------------------------

func TestSMSHandlerPostsToGateway(t *testing.T) {
	var gotBody map[string]any
	var gotAuth, gotContentType string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		gotContentType = r.Header.Get("Content-Type")
		if err := json.NewDecoder(r.Body).Decode(&gotBody); err != nil {
			t.Errorf("gateway payload was not valid JSON: %v", err)
		}
		w.WriteHeader(http.StatusAccepted)
	}))
	defer srv.Close()

	h := NewSMSHandler()
	if err := h.ValidateConfig(context.Background(), map[string]string{"gateway": srv.URL}); err != nil {
		t.Fatalf("ValidateConfig: %v", err)
	}
	if err := h.Initialize(context.Background(), map[string]string{
		"gateway":   srv.URL,
		"api_key":   "gw-secret",
		"signature": "ORION",
		"phones":    " +8613800000010 ; +8613800000011 ",
	}); err != nil {
		t.Fatalf("Initialize: %v", err)
	}
	if err := h.Send(context.Background(), "checkout is down", map[string]string{
		"tenant_id": "tenant-1", "alert_id": "alert-42",
	}); err != nil {
		t.Fatalf("Send: %v", err)
	}

	if gotAuth != "Bearer gw-secret" {
		t.Errorf("Authorization = %q, want %q", gotAuth, "Bearer gw-secret")
	}
	if gotContentType == "" {
		t.Error("gateway request had no Content-Type header")
	}
	if got := fmt.Sprint(gotBody["body"]); got != "checkout is down" {
		t.Errorf("body = %v, want %q", gotBody["body"], "checkout is down")
	}
	if got := fmt.Sprint(gotBody["to"]); !strings.Contains(got, "+8613800000010") || !strings.Contains(got, "+8613800000011") {
		t.Errorf("to = %v, want both phone numbers", gotBody["to"])
	}
	if got := fmt.Sprint(gotBody["signature"]); got != "ORION" {
		t.Errorf("signature = %v, want ORION", gotBody["signature"])
	}
	if got := fmt.Sprint(gotBody["tenant"]); got != "tenant-1" {
		t.Errorf("tenant = %v, want tenant-1", gotBody["tenant"])
	}
	if got := fmt.Sprint(gotBody["alertId"]); got != "alert-42" {
		t.Errorf("alertId = %v, want alert-42", gotBody["alertId"])
	}
	if got := fmt.Sprint(gotBody["source"]); got != "orion-alert-adapter-v2" {
		t.Errorf("source = %v, want orion-alert-adapter-v2", gotBody["source"])
	}
	if _, ok := gotBody["sentAt"]; !ok {
		t.Error("payload has no sentAt field")
	}
}

func TestSMSHandlerTracksGatewayFailure(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	h := NewSMSHandler()
	if err := h.Initialize(context.Background(), map[string]string{
		"gateway": srv.URL, "phones": "+8613800000010",
	}); err != nil {
		t.Fatalf("Initialize: %v", err)
	}
	if err := h.Send(context.Background(), "hello", nil); err == nil {
		t.Fatal("Send returned nil for a 503 gateway response")
	}
}

func TestSMSHandlerRejectsMissingPhones(t *testing.T) {
	hits := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits++
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	h := NewSMSHandler()
	if err := h.Initialize(context.Background(), map[string]string{"gateway": srv.URL}); err != nil {
		t.Fatalf("Initialize: %v", err)
	}
	if err := h.Send(context.Background(), "hello", nil); !errors.Is(err, ErrMissingRequiredConfig) {
		t.Fatalf("Send err = %v, want ErrMissingRequiredConfig", err)
	}
	if hits != 0 {
		t.Errorf("gateway was hit %d times, want 0", hits)
	}

	if err := h.Send(context.Background(), "   ", nil); !errors.Is(err, ErrMissingRequiredConfig) {
		t.Fatalf("blank template err = %v, want ErrMissingRequiredConfig", err)
	}
	if hits != 0 {
		t.Errorf("gateway was hit %d times for a blank template, want 0", hits)
	}
}
