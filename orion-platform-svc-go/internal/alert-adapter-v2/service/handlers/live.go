package handlers

import (
	"orion/platform-svc-go/internal/alert-adapter-v2/service"
)

// LiveChannels is the authoritative list of channels whose Send performs real
// delivery and which are therefore registered with a production factory.
var LiveChannels = []string{
	"email",
	"sms",
	"wechat",
	"dingtalk",
	"feishu",
	"slack",
	"telegram",
	"pagerduty",
	"opsgenie",
	"webhook",
	"in_app",
}

// StubbyChannels holds handler shells that parse their config but whose Send
// returns nil without transmitting anything. They are deliberately NOT
// registered: registering them would turn a loud ErrNoHandler into a silent
// "delivered" event that nobody ever received.
//
// push needs FCM/APNs/JPush credentials and a provider SDK, kafka needs
// sarama or confluent-kafka-go; neither SDK is a dependency of this module.
var StubbyChannels = []string{"push", "kafka"}

// HandlerlessChannels is what models.ValidChannels advertises with no handler
// implementation at all.
var HandlerlessChannels = []string{"phone", "rabbitmq"}

// RegisterLiveHandlers wires every fully implemented channel into f as a
// per-adapter constructor.
//
// Added because production wiring built a factory and never registered a
// handler on it, so SendNotification returned ErrNoHandler for every channel
// and CreateAdapter rejected every adapter with ErrInvalidChannel. Wiring should
// go through this single entry point rather than calling RegisterConstructor
// directly; the per-call closures matter — Go will not assign a
// "func() *EmailHandler" to HandlerConstructor, so the constructors have to be
// wrapped explicitly.
func RegisterLiveHandlers(f *service.NotificationFactory) {
	ctors := map[string]service.HandlerConstructor{
		"email":     func() service.INotificationHandler { return NewEmailHandler() },
		"sms":       func() service.INotificationHandler { return NewSMSHandler() },
		"wechat":    func() service.INotificationHandler { return NewWeChatHandler() },
		"dingtalk":  func() service.INotificationHandler { return NewDingTalkHandler() },
		"feishu":    func() service.INotificationHandler { return NewFeishuHandler() },
		"slack":     func() service.INotificationHandler { return NewSlackHandler() },
		"telegram":  func() service.INotificationHandler { return NewTelegramHandler() },
		"pagerduty": func() service.INotificationHandler { return NewPagerDutyHandler() },
		"opsgenie":  func() service.INotificationHandler { return NewOpsgenieHandler() },
		"webhook":   func() service.INotificationHandler { return NewWebhookHandler() },
		"in_app":    func() service.INotificationHandler { return NewInAppHandler() },
	}
	for _, ch := range LiveChannels {
		ctor, ok := ctors[ch]
		if !ok {
			// LiveChannels is the source of truth; panic rather than silently
			// dropping a channel from the runtime registry.
			panic("handlers: LiveChannels lists " + ch + " but no constructor is provided")
		}
		f.RegisterConstructor(ch, ctor)
	}
}
