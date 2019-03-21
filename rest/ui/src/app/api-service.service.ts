import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {parseGoMethod} from './domain/method';
import {Stack} from './domain/stack';

@Injectable()
export class ApiService {
  constructor(private readonly httpClient: HttpClient) {
  }

  public async listServices(): Promise<IServices> {
    return await this.httpClient
      .get<IServices>(`/api/v1/services`)
      .toPromise();
  }

  public async fetchStacks(service: string): Promise<Stack[]> {
    const response = await this.httpClient
      .get<IStackResponse[]>(`/api/v1/services/${encodeURIComponent(service)}/stack`)
      .toPromise();

    return response.map(stack => {
      return new Stack(
        stack.methods.map(method => parseGoMethod(method)),
        Duration.ofMillis(stack.durationInMillis));
    });
  }

}

export interface IServices {
  services: string[];
}

export interface Stacks {

}

export interface IStack {
  methods: Method[];
  duration: Duration;
}

interface IStackResponse {
  methods: string[];
  durationInMillis: number;
}


export function doTimed<T>(action: string, fn: () => T): T {
  console.time(action);
  try {
    return fn();
  } finally {
    console.timeEnd(action);
  }
}
