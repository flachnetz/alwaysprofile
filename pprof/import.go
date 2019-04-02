package pprof

import (
	"fmt"
	"github.com/flachnetz/go-forceexport"
	"github.com/huandu/go-tls/g"
	"log"
	"runtime"
	"runtime/pprof"
	"unsafe"
)

type goroutine struct{}

var runtime_pprof_cyclesPerSecond func() int64

// readProfile, provided by the runtime, returns the next chunk of
// binary CPU profiling stack trace data, blocking until data is available.
// If profiling is turned off and all the profile data accumulated while it was
// on has been returned, readProfile returns eof=true.
// The caller must save the returned data and tags before calling readProfile again.
var runtime_pprof_readProfile func() (data []uint64, tags []unsafe.Pointer, eof bool)

var runtime_gopark uintptr

var runtime_saveg func(pc, sp uintptr, gp *goroutine, r *runtime.StackRecord)

var runtime_stopTheWorld func(reason string)
var runtime_startTheWorld func()

//go:linkname runtime_allgs runtime.allgs
var runtime_allgs []*goroutine

func init() {
	// force-import the runtime/pprof module.
	pprof.Profiles()

	// force the usage of that symbol to prevent the go compiler from seeing it as
	// dead code. It would then remove it and the unexported methods we
	// force import below
	_ = fmt.Sprintf("%p", pprof.StartCPUProfile)

	{
		name := "runtime/pprof.runtime_cyclesPerSecond"
		err := forceexport.GetFunc(&runtime_pprof_cyclesPerSecond, name)
		if err != nil {
			log.Fatalln("Could not get function handle '"+name+"': ", err)
		}
	}

	{
		name := "runtime/pprof.readProfile"
		err := forceexport.GetFunc(&runtime_pprof_readProfile, name)
		if err != nil {
			log.Fatalln("Could not get function handle '"+name+"': ", err)
		}
	}

	{
		name := "runtime.saveg"
		err := forceexport.GetFunc(&runtime_saveg, name)
		if err != nil {
			log.Fatalln("Could not get function handle '"+name+"': ", err)
		}
	}

	{
		name := "runtime.stopTheWorld"
		err := forceexport.GetFunc(&runtime_stopTheWorld, name)
		if err != nil {
			log.Fatalln("Could not get function handle '"+name+"': ", err)
		}
	}

	{
		name := "runtime.startTheWorld"
		err := forceexport.GetFunc(&runtime_startTheWorld, name)
		if err != nil {
			log.Fatalln("Could not get function handle '"+name+"': ", err)
		}
	}

	{
		name := "runtime.gopark"
		addr, err := forceexport.FindFuncWithName("runtime.gopark")
		if err != nil {
			log.Fatalln("Could not get function pointer '"+name+"': ", err)
		}

		runtime_gopark = addr
	}
}

func runtime_getg() *goroutine {
	return (*goroutine)(g.G())
}
