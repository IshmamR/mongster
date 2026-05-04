import {
  type HookGroupAlias,
  type HookName,
  type HookOperation,
  modifyOperations,
  removeOperations,
  saveOperations,
} from "./types/types.hooks";

function isGroupAlias(name: string): name is HookGroupAlias {
  return name === "save" || name === "modify" || name === "remove";
}

/** maps group aliases to their operations */
export const HOOK_GROUP_MAP = {
  save: saveOperations,
  modify: modifyOperations,
  remove: removeOperations,
} satisfies Record<HookGroupAlias, readonly HookOperation[]>;

type AnyPreHookFn = (ctx: any) => Promise<any> | any;
type AnyPostHookFn = (ctx: any) => Promise<void> | void;

export class HookRegistry {
  #preHooks = new Map<string, AnyPreHookFn[]>();
  #postHooks = new Map<string, AnyPostHookFn[]>();

  addPre(name: HookName, fn: AnyPreHookFn): void {
    if (isGroupAlias(name)) {
      for (const op of HOOK_GROUP_MAP[name]) {
        this.#pushPre(op, fn);
      }
    } else {
      this.#pushPre(name, fn);
    }
  }

  addPost(name: HookName, fn: AnyPostHookFn): void {
    if (isGroupAlias(name)) {
      for (const op of HOOK_GROUP_MAP[name]) {
        this.#pushPost(op, fn);
      }
    } else {
      this.#pushPost(name, fn);
    }
  }

  #pushPre(op: string, fn: AnyPreHookFn): void {
    const hooks = this.#preHooks.get(op);
    if (hooks) {
      hooks.push(fn);
    } else {
      this.#preHooks.set(op, [fn]);
    }
  }

  #pushPost(op: string, fn: AnyPostHookFn): void {
    const hooks = this.#postHooks.get(op);
    if (hooks) {
      hooks.push(fn);
    } else {
      this.#postHooks.set(op, [fn]);
    }
  }

  /** Run all pre hooks for an operation sequentially */
  async runPre(op: HookOperation, ctx: any): Promise<any> {
    const hooks = this.#preHooks.get(op);
    if (!hooks?.length) return ctx;

    let current = ctx;
    for (const fn of hooks) {
      const result = await fn(current);
      if (result !== undefined && result !== null) {
        current = result;
      }
    }
    return current;
  }

  /** Run all post hooks for an operation sequentially */
  async runPost(op: HookOperation, ctx: any): Promise<void> {
    const hooks = this.#postHooks.get(op);
    if (!hooks?.length) return;

    for (const fn of hooks) {
      await fn(ctx);
    }
  }

  hasPreHooks(op: HookOperation): boolean {
    return (this.#preHooks.get(op)?.length ?? 0) > 0;
  }

  hasPostHooks(op: HookOperation): boolean {
    return (this.#postHooks.get(op)?.length ?? 0) > 0;
  }

  clone(): HookRegistry {
    const copy = new HookRegistry();
    for (const [k, v] of this.#preHooks) {
      copy.#preHooks.set(k, [...v]);
    }
    for (const [k, v] of this.#postHooks) {
      copy.#postHooks.set(k, [...v]);
    }
    return copy;
  }
}
