package nats

import (
	"context"
	"log"

	"github.com/nats-io/nats.go"
)

type Subscriber struct {
	Conn *nats.Conn
}

func NewSubscriber(url string) (*Subscriber, error) {
	nc, err := nats.Connect(url)
	if err != nil {
		return nil, err
	}
	return &Subscriber{Conn: nc}, nil
}

func (s *Subscriber) Subscribe(ctx context.Context, subject string, handler func(msg *nats.Msg)) (*nats.Subscription, error) {
	sub, err := s.Conn.Subscribe(subject, func(msg *nats.Msg) {
		handler(msg)
	})
	if err != nil {
		return nil, err
	}
	log.Printf("Subscribed to %s", subject)
	return sub, nil
}

func (s *Subscriber) Close() {
	s.Conn.Close()
}
