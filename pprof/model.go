package pprof

import (
	"fmt"
	"github.com/google/uuid"
	"runtime"
	"time"
	"unsafe"
)

type MethodId uint32

type Sample struct {
	TimestampNs uint64
	Duration    time.Duration
	Stack       []MethodId
	Labels      map[string]string
}

type Profile struct {
	Start   time.Time
	Names   []string
	Samples []Sample

	// some meta data to send with the samples
	ServiceName string
	InstanceId  uuid.UUID
	Tags        map[string]string

	baseTimestamp uint64
	methodCache   map[string]MethodId
	locationCache map[uintptr]MethodId
	period        time.Duration
}

func (profile *Profile) add(data []uint64, tags []unsafe.Pointer) error {
	if len(data) == 0 {
		return nil
	}

	if len(data) < 3 || data[0] > uint64(len(data)) {
		return fmt.Errorf("truncated profile")
	}

	if data[0] < 3 || tags != nil && len(tags) < 1 {
		return fmt.Errorf("malformed profile")
	}

	// skip profile/period header
	if data[0] == 3 && data[2] == 0 {
		return fmt.Errorf("malformed profile")
	}

	// Parse CPU samples from the profile.
	// Each sample is 3+n uint64s:
	//	data[0] = 3+n
	//	data[1] = time stamp
	//	data[2] = count
	//	data[3:3+n] = stack
	// If the count is 0 and the stack has length 1,
	// that's an overflow record inserted by the runtime
	// to indicate that stack[0] samples were lost.
	// Otherwise the count is usually 1,
	// but in a few special cases like lost non-Go samples
	// there can be larger counts.
	for len(data) > 0 {
		if len(data) < 3 || data[0] > uint64(len(data)) {
			return fmt.Errorf("truncated profile")
		}

		if data[0] < 3 || tags != nil && len(tags) < 1 {
			return fmt.Errorf("malformed profile")
		}

		if profile.baseTimestamp == 0 {
			profile.baseTimestamp = uint64(time.Now().UnixNano()) - data[1]
		}

		// get data and advance
		stamp := profile.baseTimestamp + data[1]
		count := data[2]
		stack := data[3:data[0]]
		data = data[data[0]:]

		// get matching metadata tag pointer
		var tag unsafe.Pointer
		if tags != nil {
			tag = tags[0]
			tags = tags[1:]
		}
		_ = tag

		if count == 0 && len(stack) == 1 {
			// overflow record
			count = uint64(stack[0])
			stack = []uint64{
				uint64(funcPC(lostProfileEvent)),
			}
		}

		var loc []MethodId
		for i := len(stack) - 1; i >= 0; i-- {
			addr := stack[i]

			// Addresses from stack traces point to the
			// next instruction after each call, except
			// for the leaf, which points to where the
			// signal occurred. locForPC expects return
			// PCs, so increment the leaf address to look
			// like a return PC.
			if i == 0 {
				addr++
			}

			l := profile.locForPC(uintptr(addr))
			if l == 0 {
				continue
			}

			loc = append(loc, l)
		}

		if len(loc) > 0 {
			sample := Sample{
				TimestampNs: stamp,
				Duration:    profile.period,
				Stack:       loc,
			}

			profile.Samples = append(profile.Samples, sample)
		}
	}

	return nil
}

// lostProfileEvent is the function to which lost profiling
// events are attributed.
// (The name shows up in the pprof graphs.)
func lostProfileEvent() { lostProfileEvent() }

// funcPC returns the PC for the func value f.
func funcPC(f interface{}) uintptr {
	return *(*[2]*uintptr)(unsafe.Pointer(&f))[1]
}

// locForPC returns the lookup id of the function for addr.
// addr must a return PC or 1 + the PC of an inline marker.
// This returns the location of the corresponding call.
func (profile *Profile) locForPC(addr uintptr) MethodId {
	if loc, ok := profile.locationCache[addr]; ok {
		return loc
	}

	// Expand this one address using CallersFrames so we can cache
	// each expansion. In general, CallersFrames takes a whole
	// stack, but in this case we know there will be no skips in
	// the stack and we have return PCs anyway.
	frames := runtime.CallersFrames([]uintptr{addr})

	frame, _ := frames.Next()
	if frame.Function == "runtime.goexit" {
		// Short-circuit if we see runtime.goexit so the loop
		// below doesn't allocate a useless empty location.
		return 0
	}

	var mId MethodId

	// check if we already know the function
	cachedMethodId, ok := profile.methodCache[frame.Function]
	if ok {
		mId = cachedMethodId
	} else {
		// method not known, cache it
		methodId := MethodId(len(profile.Names))
		profile.methodCache[frame.Function] = methodId
		profile.Names = append(profile.Names, frame.Function)

		mId = methodId
	}

	// cache location by address
	profile.locationCache[addr] = mId

	return mId

	// TODO expand inlined functions correctly,
	//  (loop, multiple frames can have the same PC)
	// if !more {
	// 	break
	// }
	// frame, more = frames.Next()
}
