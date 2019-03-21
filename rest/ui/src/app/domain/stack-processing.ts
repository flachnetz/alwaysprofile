import {Stack} from './stack';

// processes a list of stacks into another list of stacks.
export type StackProcessor = (stacks: Stack[]) => Stack[];

/**
 * Creates a new stack processor that applies the given stack processors
 * in sequence from left to right to some input data.
 */
export function inSequence(processors: StackProcessor[]): StackProcessor {
  return stacks => processors.reduce((stacks, proc) => proc(stacks), stacks);
}

/**
 * Creates a new stack processor that applies the given function to
 * every stack in the input array. Returning an empty array (or null)
 * removes the resulting entry from the resulting list of stacks
 */
export function createMappingStackProcessor(fn: (stack: Stack) => Stack | null): StackProcessor {
  return stacks => {
    const result: Stack[] = [];

    for (const stack of stacks) {
      const processed = fn(stack);
      if (processed)
        result.push(processed);
    }

    return result;
  };
}

/**
 * Collapses recursive method calls
 */
export function collapseRecursiveCalls(): StackProcessor {
  return createMappingStackProcessor(stack =>
    new Stack([...new Set(stack.methods)], stack.duration));
}
