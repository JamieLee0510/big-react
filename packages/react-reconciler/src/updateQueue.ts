import { Dispatch } from "react/src/currentDispatcher";
import { Action } from "shared/ReactTypes";
import { Lane } from "./fiberLanes";

export interface Update<State> {
  action: Action<State>;
  lane: Lane;
  next: Update<any> | null;
}

export interface UpdateQueue<State> {
  shared: {
    pending: Update<State> | null;
  };
  // 為了兼容hook的更新流程
  dispatch: Dispatch<State> | null;
}

// 創建一個Update的實例
export const createUpdate = <State>(
  action: Action<State>,
  lane: Lane
): Update<State> => {
  return { action, lane, next: null };
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
  console.warn(`enqueueUpdate~`);
  //updateQueue.shared.pending = update; // 這邊只是覆蓋pending，但多次更新需要存放所有的update
  const pending = updateQueue.shared.pending;
  if (pending == null) {
    // 代表目前 updateQueue 還沒有插入新的update
    // pending = a -> a
    update.next = update;
  } else {
    // 建立一個環狀鏈表
    // b.next = a.next
    update.next = pending.next;
    // a.next = b, 最後 pending = b -> a -> b
    pending.next = update;
  }
  // pending = b->a->b
  // pending = c->a->b->c //最新插入的update，讓其成為新的環狀鏈表
  updateQueue.shared.pending = update;
};

/**
 * 消費UpdateQueue的方法，返回一個全新的狀態（State）
 * 同時也會消費 lane
 **/
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
