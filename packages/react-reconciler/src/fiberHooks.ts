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
import { Lane, NoLane, requestUpdateLanes } from "./fiberLanes";
import { Flags, PassiveEffect } from "./fiberFlags";
import { HookHasEffect, Passive } from "./hookEffectTags";

let currentlyRenderingFiber: FiberNode | null = null;

let workInProgressHook: Hook | null = null;

let renderLane: Lane = NoLane;

// 主要是為了在update流程中，暫存之前的hook結果
let currentHook: Hook | null = null;

const { currentDispatcher } = internal;

// hooks通用的數據結構
export interface Hook {
  memoizedState: any; // 對於不同的hook，memoizedState會不一樣
  updateQueue: unknown;
  next: Hook | null; // 下一個hook，所以hook是一個鏈表
}

// useEffect下的數據結構
export interface Effect {
  tags: Flags;
  create: EffectCallback | void;
  destroy: EffectCallback | void;
  deps: EffectDeps;
  next: Effect | null;
}
type EffectCallback = () => void;
type EffectDeps = any[] | null;

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
  lastEffect: Effect | null; // 指向最後一個Effect，而它的next便會指向第一個
}

export function renderWithHooks(wip: FiberNode, lane: Lane) {
  // 賦值current fiber
  currentlyRenderingFiber = wip;
  // 重置hook的操作
  wip.memoizedState = null;
  // 重置effect鏈表
  wip.updateQueue = null;

  // 賦值 render lane
  renderLane = lane;

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

  // FC render
  const children = Component(props);

  // 重置操作
  currentlyRenderingFiber = null;
  workInProgressHook = null;
  currentHook = null;
  renderLane = NoLane;
  return children;
}

const hooksDispatchOnMount: Dispatcher = {
  useState: mountState,
  useEffect: mountEffect,
};

const hooksDispatchOnUpdate: Dispatcher = {
  useState: updateState,
  useEffect: updateEffect,
};

function mountEffect(create: EffectCallback | void, deps: EffectDeps | void) {
  // 第一步：找到當前第一個hook
  const hook = mountWorkInProgressHook();

  const nextDeps = deps === undefined ? null : deps;

  // 在當前fiber 的 flag 中增加 PassiveEffect
  (currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;

  hook.memoizedState = pushEffect(
    Passive | HookHasEffect,
    create,
    undefined,
    nextDeps
  );
}

/**
 * 跟mountEffect的差別，什麼時候增加 PassiveEffect flag？依賴有變化的情況
 * @param create
 * @param deps
 */
function updateEffect(create: EffectCallback | void, deps: EffectDeps | void) {
  // 第一步：找到當前第一個hook
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  let destroy: EffectCallback | void;

  if (currentHook !== null) {
    const prevEffect = currentHook.memoizedState as Effect;
    destroy = prevEffect.destroy;
    if (nextDeps !== null) {
      const prevDeps = prevEffect.deps;

      // 淺比較,相等的話，代表依賴沒有變化，所以不需要更新
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        hook.memoizedState = pushEffect(Passive, create, destroy, nextDeps);
        return;
      }
    }
    // 淺比較，不相等
    // 在當前fiber 的 flag 中增加 PassiveEffect
    (currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
    // 標記這個副作用要執行
    hook.memoizedState = pushEffect(
      Passive | HookHasEffect,
      create,
      destroy,
      nextDeps
    );
  }
}

/**
 * 淺比較 舊依賴 和 新依賴有沒有變化
 * @param newDeps
 * @param prevDeps
 * @returns 是否相等
 */
function areHookInputsEqual(newDeps: EffectDeps, prevDeps: EffectDeps) {
  if (newDeps === null || prevDeps === null) {
    return false;
  }
  for (let i = 0; i < newDeps.length && i < prevDeps.length; i++) {
    if (Object.is(prevDeps[i], newDeps[i])) {
      continue;
    }
    return false;
  }
  return true;
}

/**
 * 在當前的effect 環狀列表中，插入新的effect
 * @param hookFlags
 * @param create
 * @param destroy
 * @param deps
 * @returns
 */
function pushEffect(
  hookFlags: Flags,
  create: EffectCallback | void,
  destroy: EffectCallback | void,
  deps: EffectDeps
): Effect {
  const effect = {
    tags: hookFlags,
    create,
    destroy,
    deps,
    next: null,
  } as Effect;
  const fiber = currentlyRenderingFiber as FiberNode;
  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
  if (updateQueue === null) {
    const initUpdateQueue = createFCUpdateQueue();
    fiber.updateQueue = initUpdateQueue;
    effect.next = effect;
    initUpdateQueue.lastEffect = effect;
  } else {
    // 插入effect
    if (updateQueue.lastEffect === null) {
      effect.next = effect;
      updateQueue.lastEffect = effect;
    } else {
      // 取出first
      const firstEffect = updateQueue.lastEffect.next;

      updateQueue.lastEffect.next = effect;
      effect.next = firstEffect;
      updateQueue.lastEffect = effect;
    }
  }
  return effect;
}

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
  queue.shared.pending = null;

  if (pending !== null) {
    const { memorizedState } = processUpdateQueue(
      hook.memoizedState,
      pending,
      renderLane
    );
    hook.memoizedState = memorizedState;
  }
  return [hook.memoizedState, queue.dispatch as Dispatch<State>];
}

function dispatchSetState<State>(
  fiber: FiberNode,
  updateQueue: UpdateQueue<State>,
  action: Action<State>
) {
  const lane = requestUpdateLanes();
  const update = createUpdate(action, lane);
  enqueueUpdate(updateQueue, update);
  scheduleUpdateOnFiber(fiber, lane);

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

function createFCUpdateQueue<State>() {
  const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;
  updateQueue.lastEffect = null;
  return updateQueue;
}
