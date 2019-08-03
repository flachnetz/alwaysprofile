import {mergeStacks, Stack} from './stack';
import {Method} from './method';
import {Duration} from './duration';
import {Logger} from "../utils/logger";

const logger = Logger.get("FlameGraphNode");

/**
 * Config to build a stack graph
 */
export interface GraphConfig {
  // collapse recursive calls into one frame.
  collapseRecursiveCalls: boolean;

  // collapse runtime calls (grow stack, ec) into a "runtime" frame.
  collapseRuntimeCalls: boolean;
}

class Node<T> {
  public parents: Node<T>[] = [];
  public children: Node<T>[] = [];

  constructor(
    public readonly id: number,
    public readonly method: Method,
    public payload: T) {
  }

  addChild(node: Node<T>): void {
    this.children.push(node);
    node.parents.push(this);
  }

  public get title(): string {
    return this.method.toString();
  }

  public byId(id: number): Node<T> | null {
    return this.find(node => node.id === id);
  }

  public find(predicate: (node: Node<T>) => boolean): Node<T> | null {
    const path = this.pathTo(predicate);
    if (path != null)
      return path[path.length - 1];

    return null;
  }

  public pathTo(predicate: (node: Node<T>) => boolean): Node<T>[] | null {
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

  public equalTo(other: Node<T>) {
    return this === other;
  }
}

export function fromStacks(stacks: Stack[]): FlameGraphNode {
  return logger.doTimed(`Node.fromStacks(${stacks.length})`,
    () => graphNodeFromStacks(stacks));
}

export type ColorHex = string;

export interface FlameGraphPayload {
  readonly color: ColorHex;
  readonly duration: Duration;
}

export type FlameGraphNode = Node<FlameGraphPayload>;

/*
export class FlameGraphNode extends NodeImpl {
  public readonly color: ColorHex = buildCssColor(this.method.toString());
  public readonly weight: number = this.duration.millis;
}

export function toFlameGraphNode(node: NodeImpl): FlameGraphNode {
  function convert(node: NodeImpl, children: FlameGraphNode[]): FlameGraphNode {
    return new FlameGraphNode(node.id, node.method, node.duration, children);
  }

  return mapGraphNode(node, convert);
}

export function mapGraphNode<T extends NodeImpl>(node: NodeImpl, mapper: (node: NodeImpl, children: T[]) => T): T {
  const children = node.children.map(n => mapGraphNode(n, mapper));
  return mapper(node, children);
}
*/

let nextNodeId = 1;

function graphNodeFromStacks(inputStacks: Stack[]): Node<FlameGraphPayload> {
  function buildNodesInner(stacks: Stack[], level: number): Node<FlameGraphPayload>[] {
    const nodes: Node<FlameGraphPayload>[] = [];

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
      const payload: FlameGraphPayload = {
        color: buildCssColor(method.fqn),
        duration: groupTime,
      };

      const node = new Node(nextNodeId++, method, payload);
      children.forEach(child => node.addChild(child));
      nodes.push(node);
    }

    // move the longest nodes to the front
    nodes.sort((lhs, rhs) => rhs.payload.duration.millis - lhs.payload.duration.millis);

    return nodes;
  }

  // sort and merge the input stacks, then build the root nodes
  const roots = buildNodesInner(mergeStacks(inputStacks), 0);

  // and create an extra root node containing those roots.
  const totalTime = roots.reduce((d, node) => node.payload.duration.plus(d), Duration.ZERO);
  const root = new Node(nextNodeId++, Method.ROOT, <FlameGraphPayload>{
    color: buildCssColor("root"),
    duration: totalTime,
  });

  roots.forEach(node => root.addChild(node));
  return root;
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

function buildCssColor(inputString: string, hue: string = "warm"): ColorHex {
  // Return a color for the given name and library type. The
  // input string is hashed to a color in that hue.

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

  return "#" + byteToHex(r) + byteToHex(g) + byteToHex(b) + "ff"
}

const hex = ["00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "0a", "0b", "0c", "0d", "0e", "0f", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "1a", "1b", "1c", "1d", "1e", "1f", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "2a", "2b", "2c", "2d", "2e", "2f", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "3a", "3b", "3c", "3d", "3e", "3f", "40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "4a", "4b", "4c", "4d", "4e", "4f", "50", "51", "52", "53", "54", "55", "56", "57", "58", "59", "5a", "5b", "5c", "5d", "5e", "5f", "60", "61", "62", "63", "64", "65", "66", "67", "68", "69", "6a", "6b", "6c", "6d", "6e", "6f", "70", "71", "72", "73", "74", "75", "76", "77", "78", "79", "7a", "7b", "7c", "7d", "7e", "7f", "80", "81", "82", "83", "84", "85", "86", "87", "88", "89", "8a", "8b", "8c", "8d", "8e", "8f", "90", "91", "92", "93", "94", "95", "96", "97", "98", "99", "9a", "9b", "9c", "9d", "9e", "9f", "a0", "a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "aa", "ab", "ac", "ad", "ae", "af", "b0", "b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8", "b9", "ba", "bb", "bc", "bd", "be", "bf", "c0", "c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "ca", "cb", "cc", "cd", "ce", "cf", "d0", "d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8", "d9", "da", "db", "dc", "dd", "de", "df", "e0", "e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8", "e9", "ea", "eb", "ec", "ed", "ee", "ef", "f0", "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "fa", "fb", "fc", "fd", "fe", "ff"];

function byteToHex(value: number) {
  return hex[value | 0] || "00";
}
