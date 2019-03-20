import {Injectable} from "@angular/core";
import {ApiService, doTimed, Duration, IStack, Method} from "./api-service.service";
import {BehaviorSubject, Observable} from "rxjs";
import {distinctUntilChanged, map} from "rxjs/operators";
import {Router} from "@angular/router";


@Injectable()
export class StateService {
  private readonly _state$ = new BehaviorSubject<AppState>({
    availableServices: new Set(),

    serviceId: null,
    stacks: null,
    stacksLoading: false,

    graphConfig: {
      groupingMode: "method",
      collapseRecursiveCalls: false,
    }
  });

  constructor(
    private readonly router: Router,
    private readonly apiService: ApiService) {

    void this.initialize();
  }

  public get state$(): Observable<AppState> {
    return this._state$;
  }

  public get state(): AppState {
    return this._state$.getValue();
  }

  public projection<T>(fn: (state: AppState) => T): Observable<T> {
    return this._state$.pipe(map(fn), distinctUntilChanged(deepEqual));
  }

  private publish(state: AppState) {
    this._state$.next(state);
  }

  public async changeServiceId(serviceId: string): Promise<void> {
    if (!this.state.availableServices.has(serviceId)) {
      const availableServices = new Set([...this.state.availableServices, serviceId]);
      this.publish({...this.state, availableServices})
    }

    this.publish({
      ...this.state,
      serviceId: serviceId,
      stacks: null,
      stacksLoading: true,
    });

    const stacks = await this.apiService.fetchStacks(serviceId);

    this.publish({
      ...this.state,
      stacks: stacks,
      stacksLoading: false,
    });
  }

  private async initialize() {
    const response = await this.apiService.listServices();
    const availableServices = new Set([...this.state.availableServices, ...response.services]);
    this.publish({...this.state, availableServices})
  }

  public updateGraphConfig(graphConfig: GraphConfig) {
    this.publish({...this.state, graphConfig})
  }
}

export interface AppState {
  availableServices: Set<string>;

  serviceId: string | null;

  stacks: IStack[] | null;
  stacksLoading: boolean;

  graphConfig: GraphConfig,
}

export interface GraphConfig {
  groupingMode: GroupingMode;
  collapseRecursiveCalls: boolean;
}

export type GroupingMode = "method" | "type" | "package"


type NodeMap = { [id: number]: GraphNode };

/**
 * compare two arrays of methods by their ids.
 */
function arrayCompare(lhs: Method[], rhs: Method[]) {
  for (let idx = 0; idx < lhs.length; idx++) {
    if (idx < rhs.length) {
      const cmp = lhs[idx].id - rhs[idx].id;
      if (cmp !== 0) {
        return cmp;
      }
    } else {
      return -1;
    }
  }
  return 0;
}

export class GraphNode {
  public readonly color: string;

  private childrenCache?: NodeMap;

  constructor(
    public readonly id: number,
    public readonly method: Method,
    public readonly value: Duration,
    public readonly children: GraphNode[] = []) {

    this.color = buildColor(method.toString());
  }

  public get title(): string {
    return this.method.toString();
  }

  public byId(id: number): GraphNode | null {
    if (this.childrenCache == null) {
      const cache: NodeMap = {};

      const traverse = (node: GraphNode) => {
        cache[node.id] = node;
        node.children.forEach(traverse);
      };

      traverse(this);

      this.childrenCache = cache;
    }

    return this.childrenCache[id];
  }

  public pathTo(decendent: GraphNode): GraphNode[] | null {
    if (decendent === this)
      return [this];

    for (const child of this.children) {
      const path = child.pathTo(decendent);
      if (path != null) {
        return [this as GraphNode].concat(path);
      }
    }

    return null;
  }

  static fromStacks(stacks: IStack[], processors: StackProcessor[] = []): GraphNode {
    return doTimed("Node.fromStacks", () => {
      const processed = inSequence(processors)(stacks);


      const nodes = buildNodes(processed);
      const totalTime = nodes.reduce((d, node) => node.value.plus(d), Duration.ZERO);
      return new GraphNode(nextNodeId++, Method.ROOT, totalTime, nodes);
    });
  }
}

let nextNodeId = 1;

function buildNodes(inputStacks: IStack[]): GraphNode[] {
  const sorted = inputStacks.slice().sort((lhs, rhs) => arrayCompare(lhs.methods, rhs.methods));

  function buildNodesInner(stacks: IStack[], level: number): GraphNode[] {
    const nodes: GraphNode[] = [];

    let groupStart = 0;
    for (let idx = 0; idx < stacks.length; idx++) {
      const isLastStack = idx === stacks.length - 1;
      const isGroupEnd = isLastStack || stacks[idx].methods[level] !== stacks[idx + 1].methods[level];
      if (!isGroupEnd)
        continue;

      const groupStacks = stacks.slice(groupStart, idx + 1);

      // remember start of the new group
      groupStart = idx + 1;

      const groupTime = groupStacks.reduce((d, stack) => stack.duration.plus(d), Duration.ZERO);

      // now look for stacks we want to recurse into
      const childStacks = groupStacks.filter(stack => level + 1 < stack.methods.length);
      const children = buildNodesInner(childStacks, level + 1);

      const method = groupStacks[0].methods[level];
      nodes.push(new GraphNode(nextNodeId++, method, groupTime, children));
    }

    // move the longest nodes to the front
    nodes.sort((lhs, rhs) => rhs.value.millis - lhs.value.millis);

    return nodes;
  }

  return buildNodesInner(sorted, 0);
}

export type StackProcessor = (stacks: IStack[]) => IStack[];

function inSequence(processors: StackProcessor[]): StackProcessor {
  return stacks => {
    return processors.reduce((stacks, proc) => proc(stacks), stacks);
  }
}

export function simpleStackProcessor(process: (stack: IStack) => IStack | null): StackProcessor {
  return stacks => {
    const result: IStack[] = [];

    for (const stack of stacks) {
      const processed = process(stack);
      if (processed)
        result.push(processed);
    }

    return result;
  }
}

export function collapseRecursiveCalls(): StackProcessor {
  return simpleStackProcessor(stack => {
    return {
      duration: stack.duration,
      methods: [...new Set(stack.methods)],
    }
  })
}

export function updateMethodGroupKey(fn: (method: Method) => string): StackProcessor {
  return simpleStackProcessor(stack => {
    return {
      duration: stack.duration,
      methods: stack.methods.map(method => method.withKey(fn(method))),
    }
  })
}


function generateHash(name: string): number {
  // Return a vector (0.0->1.0) that is a hash of the input string.
  // The hash is computed to favor early characters over later ones, so
  // that strings with similar starts have similar vectors.
  const MAX_CHAR = 64;

  let hash = 0;
  let maxHash = 0;
  let weight = 1;
  const mod = 10;

  if (name) {
    for (let i = 0; i < name.length; i++) {
      if (i > MAX_CHAR) {
        break
      }

      hash += weight * (name.charCodeAt(i) % mod);
      maxHash += weight * (mod - 1);
      weight *= 0.70
    }

    if (maxHash > 0) {
      hash = hash / maxHash
    }
  }
  return hash
}

function buildColor(name: string) {
  // Return a color for the given name and library type. The library type
  // selects the hue, and the name is hashed to a color in that hue.

  let r;
  let g;
  let b;

  // default when libtype is not in use
  let hue = "wram";

  // calculate hash
  let vector = 0;
  if (name) {
    const nameArr = name.split('`');
    if (nameArr.length > 1) {
      name = nameArr[nameArr.length - 1] // drop module name if present
    }
    name = name.split('(')[0]; // drop extra info
    vector = generateHash(name)
  }

  // calculate color
  if (hue === 'red') {
    r = 200 + Math.round(55 * vector);
    g = 50 + Math.round(80 * vector);
    b = g
  } else if (hue === 'orange') {
    r = 190 + Math.round(65 * vector);
    g = 90 + Math.round(65 * vector);
    b = 0
  } else if (hue === 'yellow') {
    r = 175 + Math.round(55 * vector);
    g = r;
    b = 50 + Math.round(20 * vector)
  } else if (hue === 'green') {
    r = 50 + Math.round(60 * vector);
    g = 200 + Math.round(55 * vector);
    b = r
  } else if (hue === 'aqua') {
    r = 50 + Math.round(60 * vector);
    g = 165 + Math.round(55 * vector);
    b = g
  } else if (hue === 'cold') {
    r = Math.round(55 * (1 - vector));
    g = Math.round(230 * (1 - vector));
    b = 200 + Math.round(55 * vector)
  } else {
    // original warm palette
    r = 200 + Math.round(55 * vector);
    g = Math.round(230 * (1 - vector));
    b = Math.round(55 * (1 - vector))
  }

  return 'rgb(' + r + ',' + g + ',' + b + ')'
}

export function deepEqual(lhs: any, rhs: any): boolean {
  if (lhs == null || rhs == null) {
    return lhs === rhs;
  }

  if (typeof lhs === "object" && typeof rhs === "object") {
    if (typeof lhs.compareTo === "function") {
      return lhs.compareTo(rhs) === 0;
    }

    if (Array.isArray(lhs) && Array.isArray(rhs)) {
      if (lhs.length !== rhs.length)
        return false;

      for (let idx = 0; idx < lhs.length; idx++) {
        if (!deepEqual(lhs[idx], rhs[idx])) {
          return false;
        }
      }

      return true;
    }

    // normal object
    const lhsKeys = Object.keys(lhs as object).sort();
    const rhsKeys = Object.keys(rhs as object).sort();
    if (!deepEqual(lhsKeys, rhsKeys))
      return false;

    for (let idx = 0; idx < lhsKeys.length; idx++) {
      if (!deepEqual(lhs[lhsKeys[idx]], rhs[rhsKeys[idx]])) {
        return false;
      }
    }

    return true;
  }

  return lhs === rhs;
}
