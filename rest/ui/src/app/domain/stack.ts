import {Method, methodsCompare} from './method';
import {Duration} from './duration';

export class Stack {
  constructor(
    readonly methods: Method[],
    readonly duration: Duration) {
  }

  public get top(): Method {
    return this.methods[this.methods.length - 1];
  }

  public compareTo(other: Stack): number {
    const rc = methodsCompare(this.methods, other.methods);
    if (rc !== 0) {
      return rc;
    }

    return this.duration.compareTo(other.duration);
  }

  public toString(): string {
    return `<Stack duration=${this.duration} top=${this.top}>`;
  }
}

export type StacksMap = { [instanceId: string]: Stack[] };

export class Stacks {
  constructor(readonly byInstance: StacksMap) {
  }

  public get merged(): Stack[] {
    return mergeStacks(...Object.values(this.byInstance));
  }
}

export function mergeStacks(...stacks: Stack[][]): Stack[] {
  const allStacks: Stack[] = Array.prototype.concat.apply([], stacks);

  // sort them
  allStacks.sort((lhs, rhs) => lhs.compareTo(rhs));

  // and de-duplicate them
  const mergedStacks: Stack[] = [];
  allStacks.forEach(stack => {
    const latestIndex = mergedStacks.length - 1;
    const latestStack = mergedStacks[latestIndex];

    if (latestStack != null && methodsCompare(latestStack.methods, stack.methods) === 0) {
      // merge into the latest stack
      mergedStacks[latestIndex] = new Stack(
        latestStack.methods,
        latestStack.duration.plus(stack.duration));
    } else {
      // start a new stack segment
      mergedStacks.push(stack);
    }
  });

  return mergedStacks;
}

