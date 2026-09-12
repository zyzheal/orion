package service

import (
	"bufio"
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/notification/models"

	"github.com/DATA-DOG/go-sqlmock"
)

// The webhook dispatchers used to POST an empty body: the payload was
// marshalled, then discarded in favour of http.NoBody, so every recipient got
// a request carrying no notification content.
func TestWebhookDispatchersSendPayloadBody(t *testing.T) {
	cases := []struct {
		name    string
		channel models.ChannelType
		want    []string
	}{
		{name: "slack", channel: models.ChannelSlack, want: []string{"Hi", "Hello"}},
		{name: "webhook", channel: models.ChannelWebhook, want: []string{"u@e.com", "Hi", "Hello"}},
		{name: "dingtalk", channel: models.ChannelDingtalk, want: []string{"Hi", "Hello"}},
		{name: "wechat", channel: models.ChannelWechat, want: []string{"Hi", "Hello"}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var gotBody, contentType string
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				b, _ := io.ReadAll(r.Body)
				gotBody = string(b)
				contentType = r.Header.Get("Content-Type")
				if r.Method != http.MethodPost {
					t.Errorf("method = %q, want POST", r.Method)
				}
			}))
			defer srv.Close()

			d := &MultiChannelDispatcher{dispatchers: map[models.ChannelType]ChannelDispatcher{
				models.ChannelSlack:    &SlackWebhookDispatcher{HTTPClient: srv.Client()},
				models.ChannelWebhook:  &WebhookDispatcher{HTTPClient: srv.Client()},
				models.ChannelDingtalk: &DingtalkDispatcher{HTTPClient: srv.Client()},
				models.ChannelWechat:   &WechatDispatcher{HTTPClient: srv.Client()},
			}}

			if err := d.Dispatch(context.Background(), tc.channel, "u@e.com", "Hi", "Hello",
				models.JSONB{"webhook_url": srv.URL}); err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if strings.TrimSpace(gotBody) == "" {
				t.Fatalf("recipient received an empty body")
			}
			if contentType != "application/json" {
				t.Errorf("content-type = %q, want application/json", contentType)
			}
			for _, frag := range tc.want {
				if !strings.Contains(gotBody, frag) {
					t.Errorf("body = %q, want it to contain %q", gotBody, frag)
				}
			}
		})
	}
}

func TestWebhookDispatchersFailOnNon2xx(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "nope", http.StatusForbidden)
	}))
	defer srv.Close()

	cfg := models.JSONB{"webhook_url": srv.URL}
	for _, dispatch := range []func(models.JSONB) error{
		func(c models.JSONB) error {
			return (&SlackWebhookDispatcher{HTTPClient: srv.Client()}).Dispatch(context.Background(), models.ChannelSlack, "u@e.com", "s", "b", c)
		},
		func(c models.JSONB) error {
			return (&WebhookDispatcher{HTTPClient: srv.Client()}).Dispatch(context.Background(), models.ChannelWebhook, "u@e.com", "s", "b", c)
		},
		func(c models.JSONB) error {
			return (&DingtalkDispatcher{HTTPClient: srv.Client()}).Dispatch(context.Background(), models.ChannelDingtalk, "u@e.com", "s", "b", c)
		},
		func(c models.JSONB) error {
			return (&WechatDispatcher{HTTPClient: srv.Client()}).Dispatch(context.Background(), models.ChannelWechat, "u@e.com", "s", "b", c)
		},
	} {
		if err := dispatch(cfg); err == nil {
			t.Error("expected an error for HTTP 403")
		}
	}
}

func TestWebhookDispatchersRejectMissingWebhookURL(t *testing.T) {
	for name, dispatch := range map[string]func(models.JSONB) error{
		"slack": func(c models.JSONB) error {
			return (&SlackWebhookDispatcher{HTTPClient: http.DefaultClient}).Dispatch(context.Background(), models.ChannelSlack, "u@e.com", "s", "b", c)
		},
		"webhook": func(c models.JSONB) error {
			return (&WebhookDispatcher{HTTPClient: http.DefaultClient}).Dispatch(context.Background(), models.ChannelWebhook, "u@e.com", "s", "b", c)
		},
		"dingtalk": func(c models.JSONB) error {
			return (&DingtalkDispatcher{HTTPClient: http.DefaultClient}).Dispatch(context.Background(), models.ChannelDingtalk, "u@e.com", "s", "b", c)
		},
		"wechat": func(c models.JSONB) error {
			return (&WechatDispatcher{HTTPClient: http.DefaultClient}).Dispatch(context.Background(), models.ChannelWechat, "u@e.com", "s", "b", c)
		},
	} {
		if err := dispatch(models.JSONB{}); err == nil {
			t.Errorf("%s: expected an error when webhook_url is missing", name)
		}
	}
}

// smtpStub is a minimal in-process SMTP server: it answers the commands the
// net/smtp client sends and captures MAIL FROM, RCPT TO and the DATA payload.
type smtpStub struct {
	ln      net.Listener
	gotMail string
	gotFrom string
	gotRcpt string
	gotCmds []string
	done    chan struct{}
}

func newSMTPStub(t *testing.T) *smtpStub {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	st := &smtpStub{ln: ln, done: make(chan struct{})}
	t.Cleanup(func() {
		ln.Close()
		select {
		case <-st.done:
		case <-time.After(2 * time.Second):
		}
	})
	go func() {
		defer close(st.done)
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		r := bufio.NewReader(conn)
		w := func(code, msg string) { _, _ = io.WriteString(conn, code+" "+msg+"\r\n") }
		w("220", "stub ready")
		data := false
		for {
			line, rerr := r.ReadString('\n')
			if rerr != nil {
				return
			}
			cmd := strings.TrimSpace(line)
			st.gotCmds = append(st.gotCmds, cmd)
			if data {
				if cmd == "." {
					data = false
					w("250", "OK")
				} else {
					st.gotMail += line
				}
				continue
			}
			switch {
			case strings.HasPrefix(cmd, "EHLO"), strings.HasPrefix(cmd, "HELO"):
				w("250", "stub")
			case strings.HasPrefix(cmd, "AUTH"):
				w("235", "Authentication successful")
			case strings.HasPrefix(cmd, "MAIL"):
				st.gotFrom = cmd
				w("250", "OK")
			case strings.HasPrefix(cmd, "RCPT"):
				st.gotRcpt = cmd
				w("250", "OK")
			case strings.HasPrefix(cmd, "DATA"):
				data = true
				w("354", "end with .")
			case strings.HasPrefix(cmd, "QUIT"):
				w("221", "bye")
				return
			default:
				w("250", "OK")
			}
		}
	}()
	return st
}

// stubEmailDispatcher points the dispatcher at the stub without a real relay,
// using the package-internal dialer hook.
func stubEmailDispatcher(st *smtpStub) *EmailDispatcher {
	d := &EmailDispatcher{HTTPClient: http.DefaultClient}
	d.dialer = func(ctx context.Context, network, addr string) (net.Conn, error) {
		return net.DialTimeout(network, st.ln.Addr().String(), 2*time.Second)
	}
	return d
}

// EmailDispatcher used to parse the relay settings, discard every one of them
// and return nil, reporting an undelivered email as sent.
func TestEmailDispatcherDeliversOverSMTP(t *testing.T) {
	st := newSMTPStub(t)
	d := stubEmailDispatcher(st)

	err := d.Dispatch(context.Background(), models.ChannelEmail, "u@e.com", "Hi", "Hello body", models.JSONB{
		"smtp_host": "127.0.0.1",
		"smtp_port": float64(587),
		"smtp_from": "noreply@orion.example",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	for _, frag := range []string{
		"From: noreply@orion.example", "To: u@e.com", "Subject: Hi",
		"Hello body", "Message-ID:",
	} {
		if !strings.Contains(st.gotMail, frag) {
			t.Errorf("mail = %q, want it to contain %q", st.gotMail, frag)
		}
	}
	if !strings.Contains(st.gotRcpt, "u@e.com") {
		t.Errorf("rcpt command = %q, want the recipient", st.gotRcpt)
	}
	if !strings.Contains(st.gotFrom, "noreply@orion.example") {
		t.Errorf("mail-from command = %q, want the sender", st.gotFrom)
	}
}

// The short host/port/from aliases predate the smtp_* convention and must
// still resolve; configured credentials must reach the AUTH command.
func TestEmailDispatcherAcceptsShortConfigAliases(t *testing.T) {
	st := newSMTPStub(t)
	d := stubEmailDispatcher(st)

	if err := d.Dispatch(context.Background(), models.ChannelEmail, "u@e.com", "Hi", "Body", models.JSONB{
		"host": "127.0.0.1", "port": float64(25), "from": "noreply@orion.example",
		"username": "user", "password": "secret",
	}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(st.gotMail, "Body") {
		t.Errorf("mail = %q, want the body", st.gotMail)
	}
	if !strings.Contains(strings.Join(st.gotCmds, " "), "AUTH") {
		t.Errorf("commands = %v, want AUTH when credentials are configured", st.gotCmds)
	}
}

func TestEmailDispatcherValidatesConfig(t *testing.T) {
	d := &EmailDispatcher{HTTPClient: http.DefaultClient}
	for _, tc := range []struct {
		name      string
		recipient string
		config    models.JSONB
		needle    string
	}{
		{name: "no host", recipient: "u@e.com", config: models.JSONB{"smtp_from": "a@b.c"}, needle: "smtp_host"},
		{name: "no from", recipient: "u@e.com", config: models.JSONB{"smtp_host": "relay"}, needle: "from"},
		{name: "no recipient", recipient: "", config: models.JSONB{"smtp_host": "relay", "smtp_from": "a@b.c"}, needle: "recipient"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := d.Dispatch(context.Background(), models.ChannelEmail, tc.recipient, "s", "b", tc.config)
			if err == nil {
				t.Fatalf("expected a configuration error, got nil")
			}
			if !strings.Contains(err.Error(), tc.needle) {
				t.Fatalf("error = %q, want it to name %q", err.Error(), tc.needle)
			}
		})
	}
}

func TestEmailDispatcherFailsClosedWhenRelayIsUnreachable(t *testing.T) {
	d := &EmailDispatcher{HTTPClient: http.DefaultClient}
	d.dialer = func(ctx context.Context, network, addr string) (net.Conn, error) {
		return nil, errors.New("connection refused")
	}
	err := d.Dispatch(context.Background(), models.ChannelEmail, "u@e.com", "s", "b", models.JSONB{
		"smtp_host": "127.0.0.1", "smtp_from": "a@b.c",
	})
	if err == nil {
		t.Fatal("expected an error when the relay cannot be reached")
	}
	if !strings.Contains(err.Error(), "connection refused") {
		t.Errorf("error = %q, want the dial failure", err.Error())
	}
}

func TestEmailDispatcherIgnoresOtherChannels(t *testing.T) {
	d := &EmailDispatcher{HTTPClient: http.DefaultClient}
	if err := d.Dispatch(context.Background(), models.ChannelSlack, "u@e.com", "s", "b", models.JSONB{}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

// MultiChannelDispatcher is the only ChannelDispatcher implementation and the
// service drops delivery silently when none is attached, so the routing table
// must cover every channel the models package declares.
func TestMultiChannelDispatcherRoutesEveryChannel(t *testing.T) {
	d := NewMultiChannelDispatcher(nil)
	for _, ch := range []models.ChannelType{
		models.ChannelEmail, models.ChannelSlack, models.ChannelWebhook,
		models.ChannelDingtalk, models.ChannelWechat, models.ChannelInApp,
	} {
		if _, ok := d.dispatchers[ch]; !ok {
			t.Errorf("channel %s is not routable: its notifications are dropped silently", ch)
		}
	}
}

type recordedDispatch struct {
	channel   models.ChannelType
	recipient string
}

type recordingDispatcher struct {
	calls chan recordedDispatch
}

func (r *recordingDispatcher) Dispatch(ctx context.Context, channel models.ChannelType, recipient string, subject, body string, config models.JSONB) error {
	select {
	case r.calls <- recordedDispatch{channel: channel, recipient: recipient}:
	default:
	}
	return nil
}

var _ ChannelDispatcher = (*recordingDispatcher)(nil)

func channelRows(channels ...models.ChannelType) *sqlmock.Rows {
	rows := sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "type", "config", "enabled", "created_at", "updated_at",
	})
	now := time.Now()
	for _, ch := range channels {
		rows.AddRow("ch-"+string(ch), "t1", string(ch), ch, nil, true, now, now)
	}
	return rows
}

// deliverAsync is the only delivery path in the service. With no dispatcher
// attached it returns before touching a channel, which is how notifications
// were marked sent without ever being delivered.
func TestDeliverAsyncDispatchesEnabledChannels(t *testing.T) {
	fake := &recordingDispatcher{calls: make(chan recordedDispatch, 4)}
	svc, mock := newMockService(t)
	svc.dispatcher = fake

	mock.ExpectQuery("SELECT \\* FROM notification_channel_configs").
		WillReturnRows(channelRows(models.ChannelSlack, models.ChannelInApp))

	svc.deliverAsync(&models.Notification{
		ID: "n-1", TenantID: "t1", Channel: models.ChannelSlack,
		Recipient: "u@e.com", Subject: "Hi", Body: "Hello",
	})

	select {
	case c := <-fake.calls:
		if c.channel != models.ChannelSlack {
			t.Errorf("dispatched channel = %s, want slack", c.channel)
		}
		if c.recipient != "u@e.com" {
			t.Errorf("recipient = %q, want u@e.com", c.recipient)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("deliverAsync never dispatched: the notification was dropped")
	}
}

func TestDeliverAsyncSkipsNonMatchingChannels(t *testing.T) {
	fake := &recordingDispatcher{calls: make(chan recordedDispatch, 4)}
	svc, mock := newMockService(t)
	svc.dispatcher = fake

	mock.ExpectQuery("SELECT \\* FROM notification_channel_configs").
		WillReturnRows(channelRows(models.ChannelWebhook))

	svc.deliverAsync(&models.Notification{
		ID: "n-1", TenantID: "t1", Channel: models.ChannelSlack, Recipient: "u@e.com",
	})

	select {
	case c := <-fake.calls:
		t.Fatalf("unexpected dispatch for channel %s", c.channel)
	case <-time.After(200 * time.Millisecond):
	}
}
