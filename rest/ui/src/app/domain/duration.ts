export class Instant {
  constructor(readonly millis: number) {
  }

  public static now(): Instant {
    return new Instant(Date.now());
  }

  public before(other: Instant): boolean {
    return this.millis < other.millis;
  }

  public after(other: Instant): boolean {
    return this.millis > other.millis;
  }

  public compareTo(other: Duration): number {
    return Math.sign(this.millis - other.millis);
  }

  public equalTo(other: Duration | null): boolean {
    return other != null && this.millis === other.millis;
  }

  public toString(): string {
    return new Date(this.millis).toISOString();
  }
}

export class Duration {
  constructor(readonly millis: number) {
  }

  public get seconds(): number {
    return this.millis / 1000;
  }

  public get micros(): number {
    return 1000 * this.millis;
  }

  public get nanos(): number {
    return 1000 * 1000 * this.millis;
  }

  public plus(other: Duration): Duration {
    return new Duration(this.millis + other.millis);
  }

  public minus(other: Duration): Duration {
    return new Duration(this.millis - other.millis);
  }

  public compareTo(other: Duration): number {
    return Math.sign(this.millis - other.millis);
  }

  public equalTo(other: Duration | null): boolean {
    return other != null && this.millis === other.millis;
  }

  public toString(): string {
    if (this.millis >= 1_000) {
      return this.seconds.toFixed(2) + 's';
    }

    if (this.millis >= 1) {
      return this.millis.toFixed(2) + 'ms';
    }

    if (this.micros >= 1) {
      return this.micros.toFixed(2) + 'µs';
    }

    return this.nanos.toFixed(2) + "ns";
  }

  public static since(startTime: Instant): Duration {
    return new Duration(Date.now() - startTime.millis);
  }

  public static between(earlier: Instant, later: Instant): Duration {
    return new Duration(later.millis - earlier.millis);
  }

  public static ofMillis(millis: number) {
    return new Duration(millis);
  }

  public static ofSeconds(seconds: number) {
    return new Duration(1000 * seconds);
  }

  public static ofMinutes(minutes: number) {
    return new Duration(60000 * minutes);
  }

  public static readonly ZERO = new Duration(0);
}

export class Stopwatch {
  private readonly startTime = performance.now();

  public get elapsed(): Duration {
    return new Duration(performance.now() - this.startTime);
  }

  public toString(): string {
    return this.elapsed.toString();
  }
}
