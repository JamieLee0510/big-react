import internal from "shared/internals";
import { FiberNode } from "./fiber";
import { Dispatch, Dispatcher } from "react/src/currentDispatcher";
import {
  UpdateQueue,
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
  processUpdateQueue,
} from "./updateQueue";
import { Action } from "shared/ReactTypes";
import { scheduleUpdateOnFiber } from "./workLoop";

let currentlyRenderingFiber: FiberNode | null = null;

let workInProgressHook: Hook | null = null;

// 主要是為了在update流程中，暫存之前的hook結果
let currentHook: Hook | null = null;

const { currentDispatcher } = internal;

// hooks通用的數據結構
export interface Hook {
  memoizedState: any; // 對於不同的hook，memoizedState會不一樣
  updateQueue: unknown;
  next: Hook | null; // 下一個hook，所以hook是一個鏈表
}

export function renderWithHooks(wip: FiberNode) {
  // 賦值current fiber
  currentlyRenderingFiber = wip;
  // 重置hook的操作
  wip.memoizedState = null;

  const current = wip.alternate;

  if (current !== null) {
    // udpate狀態
    currentDispatcher.current = hooksDispatchOnUpdate;
  } else {
    // mount狀態
    currentDispatcher.current = hooksDispatchOnMount;
  }

  const Component = wip.type;
  const props = wip.pendingProps;
  const children = Component(props);

  currentlyRenderingFiber = null;
  return children;
}

const hooksDispatchOnMount: Dispatcher = {
  useState: mountState,
};

const hooksDispatchOnUpdate: Dispatcher = {
  useState: updateState,
};

function mountState<State>(
  initialState: State | (() => State)
): [State, Dispatch<State>] {
  // 第一步：找到當前useState對應的hook數據
  const hook = mountWorkInProgressHook();
  let memoizedState;
  if (initialState instanceof Function) {
    memoizedState = initialState();
  } else {
    memoizedState = initialState;
  }

  const queue = createUpdateQueue<State>();
  hook.updateQueue = queue;
  hook.memoizedState = memoizedState;

  // @ts-ignore
  const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
  queue.dispatch = dispatch;

  return [memoizedState, dispatch];
}
function updateState<State>(): [State, Dispatch<State>] {
  // 第一步：找到當前useState對應的hook數據
  const hook = updateWorkInProgressHook();

  // 第二步：計算新 state 的邏輯
  const queue = hook.updateQueue as UpdateQueue<State>;
  const pending = queue.shared.pending;

  if (pending !== null) {
    const { memorizedState } = processUpdateQueue(hook.memoizedState, pending);
    hook.memoizedState = memorizedState;
  }
  return [hook.memoizedState, queue.dispatch as Dispatch<State>];
}

function dispatchSetState<State>(
  fiber: FiberNode,
  updateQueue: UpdateQueue<State>,
  action: Action<State>
) {
  const update = createUpdate(action);
  enqueueUpdate(updateQueue, update);
  scheduleUpdateOnFiber(fiber);

  // 下面是HostRoot 的首次渲染流程，基本上可以做比對
  // 因為dispatchSetState也是要接入reconciler的更新流程
  // const update = createUpdate<ReactElementType | null>(element);

  // enqueueUpdate(
  //   hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>,
  //   update
  // );
  // scheduleUpdateOnFiber(hostRootFiber);
}

function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memoizedState: null,
    updateQueue: null,
    next: null,
  };

  if (workInProgressHook == null) {
    // 代表為mount階段，而且是第一個hook
    if (currentlyRenderingFiber == null) {
      throw new Error("請在函數組件內調用hook");
    } else {
      workInProgressHook = hook;
      currentlyRenderingFiber.memoizedState = workInProgressHook;
    }
  } else {
    // mount 時後續的hook
    workInProgressHook.next = hook;
    // 接下來的看不懂@@
    workInProgressHook = hook;
  }
  return workInProgressHook;
}

function updateWorkInProgressHook(): Hook {
  // TODO: render階段觸發的更新

  // 用來保存下一個hook
  let nextCurrentHook: Hook | null = null;

  if (currentHook == null) {
    // 代表這是FC update的時候的第一個hook，hooks 鏈表中的頭
    const current = currentlyRenderingFiber?.alternate;
    if (current !== null) {
      nextCurrentHook = current?.memoizedState;
    } else {
      nextCurrentHook = null;
    }
  } else {
    // 代表進入FC update時，後續的hook
    nextCurrentHook = currentHook.next;
  }

  // TODO: 懂了這裡，就懂了hook的邏輯
  if (nextCurrentHook == null) {
    // mount/update hook1 hook2 hook3
    // update       hook1 hook2 hook3 hook4
    // 照理說，hook應該要一一對應
    throw new Error(
      `組件 ${currentlyRenderingFiber?.type} 本次執行的hook比上次執行多`
    );
  }

  currentHook = nextCurrentHook;
  const newHook: Hook = {
    memoizedState: currentHook?.memoizedState,
    updateQueue: currentHook?.updateQueue,
    next: null,
  };

  // 更新WIP
  if (workInProgressHook == null) {
    // 代表為mount階段，而且是第一個hook
    if (currentlyRenderingFiber == null) {
      throw new Error("請在函數組件內調用hook");
    } else {
      workInProgressHook = newHook;
      currentlyRenderingFiber.memoizedState = workInProgressHook;
    }
  } else {
    // mount 時後續的hook
    workInProgressHook.next = newHook;
    // 接下來的看不懂@@
    workInProgressHook = newHook;
  }
  return workInProgressHook;
}
