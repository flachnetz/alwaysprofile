import {Duration, Instant} from "./duration";
import {compareBy} from "../utils/sort";

export interface HistogramValue {
  readonly time: Instant;
  readonly value: number;
}

export class Histogram {
  public readonly maxTime: Instant;
  public readonly minTime: Instant;

  public readonly maxValue: number;

  public readonly values: ReadonlyArray<HistogramValue>;

  constructor(
    public readonly bucketTime: Duration,
    values: HistogramValue[]) {

    this.values = [...values].sort(compareBy(value => value.time));

    let maxValue = values[0].value;
    this.values.forEach(value => {
      if (value.value > maxValue)
        maxValue = value.value;
    });

    this.maxValue = maxValue;

    this.minTime = this.values[0].time;
    this.maxTime = this.values[this.values.length - 1].time;
  }

  public get totalTime(): Duration {
    return Duration.between(this.minTime, this.maxTime).plus(this.bucketTime);
  }

  public static ofValues(bucketSize: Duration, values: HistogramValue[]): Histogram {
    if (values.length < 1) {
      return new Histogram(new Duration(1000), [
        {time: Instant.now(), value: 0},
      ])
    }

    return new Histogram(bucketSize, values);
  }
}
