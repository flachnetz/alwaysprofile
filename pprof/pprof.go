package pprof

import (
	"errors"
	"fmt"
	"github.com/google/uuid"
	"log"
	"runtime"
	"sync"
	"time"
)

type Config struct {
	Sender Sender
	Logger Logger

	ServiceName string
	Tags        map[string]string

	// The runtime routines allow a variable profiling rate,
	// but in practice operating systems cannot trigger signals
	// at more than about 500 Hz, and our processing of the
	// signal is not cheap (mostly getting the stack trace).
	// 100 Hz is a reasonable choice: it is frequent enough to
	// produce useful data, rare enough not to bog down the
	// system, and a nice round number to make it easy to
	// convert sample counts to seconds.
	SampleFrequencyHz int
}

var cpu struct {
	sync.Mutex

	profiler *profiler
}

type profiler struct {
	Config

	instanceId uuid.UUID
	done       chan bool

	collector *Collector
}

func Start(config Config) Stopper {
	if config.SampleFrequencyHz == 0 {
		config.SampleFrequencyHz = 100
	}

	if config.Logger == nil {
		config.Logger = func(format string, args ...interface{}) {
			fmt.Println(fmt.Sprintf(format, args...))
		}
	}

	cpu.Lock()
	defer cpu.Unlock()

	// Double-check .
	if cpu.profiler != nil {
		panic(errors.New("cpu profiling already active"))
	}

	runtime.SetCPUProfileRate(config.SampleFrequencyHz)

	profiler := &profiler{
		Config:     config,
		instanceId: uuid.New(),
		done:       make(chan bool),
		collector:  NewCollector(config.Sender, config.Logger),
	}

	go profiler.loop()

	return profiler
}

func (p *profiler) loop() {
	defer close(p.done)

	var profile *Profile
	for {
		if profile == nil {
			profile = &Profile{
				Start:       time.Now(),
				ServiceName: p.ServiceName,
				InstanceId:  p.instanceId,
				Tags:        p.Tags,

				methodCache:   make(map[string]MethodId),
				locationCache: make(map[uintptr]MethodId),

				period: time.Duration(1e9 / p.Config.SampleFrequencyHz),
			}
		}

		time.Sleep(100 * time.Millisecond)

		data, tags, eof := readProfile()
		if err := profile.add(data, tags); err != nil {
			log.Println("Process profile data:", err)
		}

		if eof {
			break
		}

		if time.Since(profile.Start) >= 2*time.Second {
			if err := p.collector.Enqueue(profile); err != nil {
				log.Println("Enqueue profile to collector:", err)
			}

			profile = nil
		}
	}

	if err := p.collector.Enqueue(profile); err != nil {
		log.Println("Enqueue profile to collector:", err)
	}
}

type Stopper interface {
	Stop()
}

// StopCPUProfile stops the current CPU profile, if any.
// StopCPUProfile only returns after all the writes for the
// profile have completed.
func (p *profiler) Stop() {
	cpu.Lock()
	defer cpu.Unlock()

	if cpu.profiler != p {
		return
	}

	cpu.profiler = nil
	runtime.SetCPUProfileRate(0)

	<-p.done

	_ = p.collector.Close()
}
