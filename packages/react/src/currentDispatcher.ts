import { Action } from "shared/ReactTypes";

export interface Dispatcher {
  useState: <T>(initState: (() => T) | T) => [T, Dispatch<T>];
  // 其他的所有hooks
}

export type Dispatch<State> = (action: Action<State>) => void;

const currentDispatcher: { current: Dispatcher | null } = { current: null };

/**
 * 用來獲取當前的hook集合
 */
export const resolveDispatcher = (): Dispatcher => {
  const dispatcher = currentDispatcher.current;

  if (dispatcher === null) {
    throw new Error("hook只能在函數組件中執行");
  }
  return dispatcher;
};

export default currentDispatcher;
