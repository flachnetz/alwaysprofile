import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {parseGoMethod} from './domain/method';
import {Stack} from './domain/stack';
import {Duration} from './domain/duration';

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
      return fixStack(new Stack(
        stack.methods.map(method => parseGoMethod(method)),
        new Duration(stack.durationInMillis)));
    });
  }

}

export interface IServices {
  services: string[] | null;
}

interface IStackResponse {
  methods: string[];
  durationInMillis: number;
}

function fixStack(stack: Stack): Stack {
  let methods = stack.methods;

  if (methods.length > 1) {
    if (methods[0].fqn === "net/http.(*conn).serve") {
      methods = methods.slice(1);
    }
  }

  if (methods === stack.methods)
    return stack;

  return new Stack(methods, stack.duration);
}
