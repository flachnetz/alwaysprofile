package pprof

import (
	"errors"
)

var ErrQueueIsFull = errors.New("queue is full")

type Logger func(fmt string, args ...interface{})

type Sender interface {
	Send(p *Profile) error
}

type Collector struct {
	sender     Sender
	logger     Logger
	profilesCh chan *Profile
	closedCh   chan bool
}


func NewCollector(sender Sender, logger Logger) *Collector {
	collector := &Collector{
		sender:     sender,
		logger:     logger,
		profilesCh: make(chan *Profile, 16),
		closedCh:   make(chan bool),
	}

	go collector.run()

	return collector
}

// Close the collectors. This ensures, that all pending profiles are send out.
func (c *Collector) Close() error {
	close(c.profilesCh)
	<-c.closedCh
	return nil
}

func (c *Collector) Enqueue(p *Profile) error {
	if p == nil || len(p.Samples) == 0 {
		return nil
	}

	select {
	case c.profilesCh <- p:
		return nil
	default:
		return ErrQueueIsFull
	}
}

func (c *Collector) run() {
	defer close(c.closedCh)

	for {
		profile, ok := <-c.profilesCh
		if ! ok {
			break
		}

		c.send(profile)
	}
}

func (c *Collector) send(profile *Profile) {
	defer func() {
		if r := recover(); r != nil {
			c.logger("sending profile failed: %v", r)
		}
	}()

	err := c.sender.Send(profile)
	if err != nil {
		c.logger("sending profile failed: %s", err)
	}
}
