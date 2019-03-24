import {mergeStacks, Stack} from './stack';
import {Method} from './method';
import {Duration} from './duration';
import {Logger} from "../utils/logger";

const logger = Logger.get("GraphNode");

/**
 * Config to build a stack graph
 */
export interface GraphConfig {
  // collapse recursive calls into one frame.
  collapseRecursiveCalls: boolean;

  // collapse runtime calls (grow stack, ec) into a "runtime" frame.
  collapseRuntimeCalls: boolean;
}

export class GraphNode {
  public readonly color: string;

  constructor(
    public readonly id: number,
    public readonly method: Method,
    public readonly value: Duration,
    public readonly children: GraphNode[] = []) {

    this.color = buildCssColor(method.toString());
  }

  public get title(): string {
    return this.method.toString();
  }

  public get childrenTime(): Duration {
    return this.children.reduce((acc, child) => acc.plus(child.value), Duration.ZERO);
  }

  public get selfTime(): Duration {
    return this.value.minus(this.childrenTime);
  }

  public byId(id: number): GraphNode | null {
    return this.find(node => node.id === id);
  }

  public find(predicate: (node: GraphNode) => boolean): GraphNode | null {
    const path = this.pathTo(predicate);
    if (path != null)
      return path[path.length - 1];

    return null;
  }

  public pathTo(predicate: (node: GraphNode) => boolean): GraphNode[] | null {
    if (predicate(this))
      return [this];

    for (const child of this.children) {
      const path = child.pathTo(predicate);
      if (path != null) {
        path.unshift(this);
        return path;
      }
    }

    return null;
  }

  static fromStacks(stacks: Stack[]): GraphNode {
    return logger.doTimed(`Node.fromStacks(${stacks.length})`, () => graphNodeFromStacks(stacks));
  }
}

let nextNodeId = 1;

function graphNodeFromStacks(inputStacks: Stack[]): GraphNode {
  function buildNodesInner(stacks: Stack[], level: number): GraphNode[] {
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

  // sort and merge the input stacks, then build the root nodes
  const roots = buildNodesInner(mergeStacks(inputStacks), 0);

  // and create an extra root node containing those roots.
  const totalTime = roots.reduce((d, node) => node.value.plus(d), Duration.ZERO);
  return new GraphNode(nextNodeId++, Method.ROOT, totalTime, roots);
}

function generateStringHashInt(inputString: string): number {
  let hash = 5381, i = inputString.length;
  while (i) {
    hash = (hash * 33) ^ inputString.charCodeAt(--i);
  }

  return hash >>> 0;
}

function generateStringHashFloat(inputString: string): number {
  return generateStringHashInt(inputString) / 0xffffffff;
}

function buildCssColor(inputString: string, hue: string = "warm"): string {
  // Return a color for the given name and library type. The library type
  // selects the hue, and the name is hashed to a color in that hue.

  // calculate hash
  const vector = generateStringHashFloat(inputString);

  // calculate color
  let r: number, g: number, b: number;
  if (hue === 'red') {
    r = 200 + Math.round(55 * vector);
    g = 50 + Math.round(80 * vector);
    b = g;
  } else if (hue === 'orange') {
    r = 190 + Math.round(65 * vector);
    g = 90 + Math.round(65 * vector);
    b = 0;
  } else if (hue === 'yellow') {
    r = 175 + Math.round(55 * vector);
    g = r;
    b = 50 + Math.round(20 * vector);
  } else if (hue === 'green') {
    r = 50 + Math.round(60 * vector);
    g = 200 + Math.round(55 * vector);
    b = r;
  } else if (hue === 'aqua') {
    r = 50 + Math.round(60 * vector);
    g = 165 + Math.round(55 * vector);
    b = g;
  } else if (hue === 'cold') {
    r = Math.round(55 * (1 - vector));
    g = Math.round(230 * (1 - vector));
    b = 200 + Math.round(55 * vector);
  } else {
    // original warm palette
    r = 200 + Math.round(55 * vector);
    g = Math.round(230 * (1 - vector));
    b = Math.round(55 * (1 - vector));
  }

  return 'rgb(' + r + ',' + g + ',' + b + ')';
}
