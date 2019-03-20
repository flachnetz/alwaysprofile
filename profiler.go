package main

import (
	"fmt"
	"github.com/flachnetz/alwaysprofile/pprof"
	"github.com/flachnetz/alwaysprofile/pprof/sender"
	"math/rand"
	"net/url"
	"sort"
	"time"
)

func main() {
	config := pprof.Config{
		ServiceName: "demo-2",

		Tags: map[string]string{
			"version": "v1.0.0",
		},
		
		Sender: sender.New(sender.Config{
			BaseURL: &url.URL{Scheme: "http", Host: "localhost:3080", Path: "/v1/profile"},
			Timeout: 1 * time.Second,
		}),
	}

	defer pprof.Start(config).Stop()

	fmt.Println("Starting random workload.")

	limitCh := make(chan bool, 4)
	for {
		limitCh <- true
		go func() {
			defer func() { <-limitCh }()
			lookForRandomPrimes()
		}()
	}
}

func lookForRandomPrimes() []int {
	var primes []int

	for idx := 0; idx < 1000; idx++ {
		n := rand.Intn(1024 * 1024)
		if isPrimeNumber(n) {
			primes = append(primes, n)
		}
	}

	sort.Ints(primes)

	return primes
}

func isPrimeNumber(n int) bool {
	if ! isSimplePrime(n) {
		return true
	}

	for idx := 2; idx < n; idx++ {
		if isDivideableBy(n, idx) {
			return false
		}
	}

	return true
}

func isSimplePrime(n int) bool {
	primes := map[int]bool{2: true, 3: true, 5: true, 7: true, 11: true, 13: true, 17: true}
	return primes[n]
}

func isDivideableBy(n int, m int) bool {
	return n%m == 0
}
