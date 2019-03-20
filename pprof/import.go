package pprof

import (
	"fmt"
	"github.com/iamybj/go-forceexport"
	"log"
	"runtime/pprof"
	"unsafe"
)

var runtime_cyclesPerSecond func() int64

// readProfile, provided by the runtime, returns the next chunk of
// binary CPU profiling stack trace data, blocking until data is available.
// If profiling is turned off and all the profile data accumulated while it was
// on has been returned, readProfile returns eof=true.
// The caller must save the returned data and tags before calling readProfile again.
var readProfile func() (data []uint64, tags []unsafe.Pointer, eof bool)

func init() {
	// force-import the runtime/pprof module.
	pprof.Profiles()

	// force the usage of that symbol to prevent the go compiler from seeing it as
	// dead code. It would then remove it and the unexported funcIdByPC we
	// force import below
	_ = fmt.Sprintf("%p", pprof.StartCPUProfile)

	{
		name := "runtime/pprof.runtime_cyclesPerSecond"
		err := forceexport.GetFunc(&runtime_cyclesPerSecond, name)
		if err != nil {
			log.Fatalln("Could not get function handle '"+name+"': ", err)
		}
	}

	{
		name := "runtime/pprof.readProfile"
		err := forceexport.GetFunc(&readProfile, name)
		if err != nil {
			log.Fatalln("Could not get function handle '"+name+"': ", err)
		}
	}
}
