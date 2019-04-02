package main

import (
	"fmt"
	"github.com/flachnetz/alwaysprofile/pprof"
	"github.com/flachnetz/alwaysprofile/pprof/sender"
	"io"
	"io/ioutil"
	"math/rand"
	"net/http"
	"net/url"
	"sort"
	"time"
)

func main() {
	config := pprof.Config{
		ServiceName: "demo-5",

		Tags: map[string]string{
			"version": "v1.0.0",
		},

		SampleFrequencyHz: 500,

		Sender: sender.New(sender.Config{
			BaseURL: &url.URL{Scheme: "http", Host: "localhost:3080", Path: "/v1/profile"},
			Timeout: 1 * time.Second,
		}),
	}

	defer pprof.Start(config).Stop()

	http.DefaultClient.Transport = &http.Transport{
		MaxConnsPerHost:     128,
		MaxIdleConns:        128,
		MaxIdleConnsPerHost: 128,
	}

	fmt.Println("Starting random workload.")

	limitCh := make(chan bool, 2)
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
			reportPrimeNumber(n)
		}

		// time.Sleep(100 * time.Millisecond)
	}

	sort.Ints(primes)

	return primes
}

func isPrimeNumber(n int) bool {
	if isSimplePrime(n) {
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

func reportPrimeNumber(n int) {
	response, err := http.Get(fmt.Sprintf("http://localhost:8000/prime?n=%d", n))
	if err != nil {
		return
	}

	_, _ = io.Copy(ioutil.Discard, response.Body)

	_ = response.Body.Close()
}
