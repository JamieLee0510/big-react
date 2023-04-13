import { Dispatch } from "react/src/currentDispatcher";
import { Action } from "shared/ReactTypes";

export interface Update<State> {
  action: Action<State>;
}

export interface UpdateQueue<State> {
  shared: {
    pending: Update<State> | null;
  };
  // 為了兼容hook的更新流程
  dispatch: Dispatch<State> | null;
}

// 創建一個Update的實例
export const createUpdate = <State>(action: Action<State>): Update<State> => {
  return { action };
};

// 創建一個UpdateQueue實例
export const createUpdateQueue = <State>() => {
  return {
    shared: {
      pending: null,
    },
    dispatch: null,
  } as UpdateQueue<State>;
};

/**
 *
 * @param updateQueue
 * @param update
 *
 * 在UpdateQueue裡增加Update的方法
 */
export const enqueueUpdate = <State>(
  updateQueue: UpdateQueue<State>,
  update: Update<State>
) => {
  updateQueue.shared.pending = update;
};

// 消費UpdateQueue的方法，返回一個全新的狀態（State）
export const processUpdateQueue = <State>(
  baseState: State,
  pendingUpdate: Update<State> | null
): { memorizedState: State } => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memorizedState: baseState,
  };
  if (pendingUpdate !== null) {
    const action = pendingUpdate.action;
    if (action instanceof Function) {
      // baseState:1,  action:(x)=>x+1, memorizedState= 2
      result.memorizedState = action(baseState);
    } else {
      // baseState:1,  action:3, memorizedState= 3
      result.memorizedState = action;
    }
  }
  return result;
};
