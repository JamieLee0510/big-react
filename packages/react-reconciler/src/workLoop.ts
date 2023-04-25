import {
  unstable_scheduleCallback as scheduleCallback,
  unstable_NormalPriority as NormalPriority,
} from "scheduler";

import { scheduleMicroTask } from "hostConfig";
import { beginWork } from "./beginWork";
import {
  commitHookEffectListCreate,
  commitHookEffectListDestroy,
  commitHookEffectListUnmount,
  commitMutationEffects,
} from "./commitWork";
import { completeWork } from "./completeWork";
import {
  createworkInProgress,
  FiberNode,
  FiberRootNode,
  PendingPassiveEffect,
} from "./fiber";
import { MutationMask, NoFlags, PassiveMask } from "./fiberFlags";
import {
  getHighestPriorityLane,
  Lane,
  markRootFinished,
  mergeLane,
  NoLane,
  SyncLane,
} from "./fiberLanes";
import { flushSyncCallbacks, scheduleSyncCallback } from "./syncTaskQueue";
import { HostRoot } from "./workTags";
import { HookHasEffect, Passive } from "./hookEffectTags";

// 全局指針，指向正在工作的FiberNode
let workInProgress: FiberNode | null = null;

// 全局變量，代表本次更新的lane是什麼
let wipRootRenderLane: Lane = NoLane;

// 全局flag，為了調度useEffect的回調
let rootDoesHasPassiveEffects = false;

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  // 因為FiberRootNode不能直接拿來當workInProgress
  workInProgress = createworkInProgress(root.current, {});
  wipRootRenderLane = lane;
}

/* 用來連結Container和renderRoot方法 */
export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
  // TODO:調度功能

  const root = markUpdateFromFiberToRoot(fiber) as FiberRootNode;
  markRootUpdate(root, lane);
  ensureRootIsScheduled(root);
}

/**
 * 保證root fiber在被調度中。
 * 基本上就是調度階段的入口
 * @param root fiberRoot
 */
function ensureRootIsScheduled(root: FiberRootNode) {
  const updateLane = getHighestPriorityLane(root.pendingLanes);
  if (updateLane === NoLane) {
    // 代表當前沒有要更新
    return;
  }
  if (updateLane === SyncLane) {
    // 同步優先級，用微任務調度
    if (__DEV__) {
      console.log("在微任務中調度，優先級:", updateLane);
    }
    // 為何要用 bind？因為要把函數當作傳參、同時函數裡還要綁定入參
    scheduleSyncCallback(performSyncOnRoot.bind(null, root, updateLane));
    scheduleMicroTask(flushSyncCallbacks);
  } else {
    // TODO: 其他優先級，會用宏任務調度
  }
}

function markRootUpdate(root: FiberRootNode, lane: Lane) {
  root.pendingLanes = mergeLane(root.pendingLanes, lane);
}

/* 向上遍歷到根Fiber，返回根FiberRootNode */
function markUpdateFromFiberToRoot(fiber: FiberNode): FiberRootNode | null {
  let node = fiber;
  let parent = node.return;
  while (parent !== null) {
    node = parent;
    parent = node.return;
  }
  if (node.tag === HostRoot) {
    return node.stateNode; //HostComponent
  }
  return null;
}

function performSyncOnRoot(root: FiberRootNode, lane: Lane) {
  const nextLane = getHighestPriorityLane(root.pendingLanes);
  if (nextLane !== SyncLane) {
    // 比 SyncLane 更低優先級的lane
    // 或為 NoLane
    ensureRootIsScheduled(root);
    return;
  }

  if (__DEV__) {
    console.warn("render 階段開始");
  }

  // 初始化，把wip指向第一個FiberNode
  prepareFreshStack(root, lane);

  do {
    try {
      workLoop();
      break;
    } catch (e) {
      if (__DEV__) {
        console.warn("working loop 發生錯誤:", e);
      }
      workInProgress = null;
    }
  } while (true);

  // 獲取更新好的workInProgress樹
  const finishedWork = root.current.alternate;
  root.finishedWork = finishedWork;

  // 保存本次消費的 lane
  root.finishedLane = lane;
  // 重置全局lane
  wipRootRenderLane = NoLane;

  // wip fiberNode樹 樹中的flags
  commitRoot(root);
}

function commitRoot(root: FiberRootNode) {
  const finishedWork = root.finishedWork;

  if (finishedWork === null) {
    return;
  }
  if (__DEV__) {
    console.warn("commit階段開始---", finishedWork);
  }
  const lane = root.finishedLane;
  if (lane === NoLane && __DEV__) {
    console.error("commit階段, finishedLane不應該是NoLane");
  }

  // 重置
  // my ques:為什麼這樣不會造成淺拷貝也一起重置？
  root.finishedWork = null;
  root.finishedLane = NoLane;
  markRootFinished(root, lane);

  // 檢查目前fiber樹中，函數組件是否需要執行useEffect回調
  if (
    (finishedWork.flags && PassiveMask) !== NoFlags ||
    (finishedWork.subtreeFlags && PassiveMask) !== NoFlags
  ) {
    // 防止執行多次commitRoot操作
    if (!rootDoesHasPassiveEffects) {
      rootDoesHasPassiveEffects = true;

      // 目前可以簡單理解為：在一個setTimeout中執行了一個回調
      scheduleCallback(NormalPriority, () => {
        // 執行副作用
        flushPassiveEffect(root.pendingPassiveEffects);
        return;
      });
    }
  }
  // 判斷是否存在3個子階段需要執行的操作
  // 從 root.flags 和 root.subTreeFlags
  const subTreeHasEffect =
    (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
  const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

  if (rootHasEffect || subTreeHasEffect) {
    // beforeMutation
    // mutation Flags：Placement
    commitMutationEffects(finishedWork, root);

    // 由於雙緩存機制，當workInProgress渲染到頁面中後
    // 會變成current，然後等待下一次更新、創建新的wip fiberTree
    root.current = finishedWork;

    // layout
  } else {
    // 由於雙緩存機制
    root.current = finishedWork;
  }

  rootDoesHasPassiveEffects = false;
  // TODO: 重新調度root
  ensureRootIsScheduled(root);
}

/**
 * 執行useEffect副作用
 * @param pendingPassiveEffects
 */
function flushPassiveEffect(pendingPassiveEffects: PendingPassiveEffect) {
  // 順序：必須照子->父執行完destroy回調，再執行其他回調

  pendingPassiveEffects.unmount.forEach((effect) => {
    commitHookEffectListUnmount(Passive, effect);
  });
  pendingPassiveEffects.unmount = [];

  // 為何要遍歷兩次？因為在本次更新的任何回調都必須在 上一次更新的destroy回調執行完後 再執行
  pendingPassiveEffects.update.forEach((effect) => {
    // Passive | HookHasEffect,代表不僅要是useEffect、而且還有副作用的更新才能觸發
    commitHookEffectListDestroy(Passive | HookHasEffect, effect);
  });
  pendingPassiveEffects.update.forEach((effect) => {
    // Passive | HookHasEffect,代表不僅要是useEffect、而且還有副作用的更新才能觸發
    commitHookEffectListCreate(Passive | HookHasEffect, effect);
  });
  pendingPassiveEffects.update = [];

  // 由於在執行useEffect中，也有可能執行到setState，所以也必須執行flushSyncCallbacks
  flushSyncCallbacks();
}

function workLoop() {
  while (workInProgress !== null) {
    preformUnitOfWork(workInProgress);
  }
}

function preformUnitOfWork(fiber: FiberNode) {
  const next = beginWork(fiber, wipRootRenderLane); // next可能是fiber的子fiber，也可能是null
  fiber.memoizedProps = fiber.pendingProps;

  if (next === null) {
    // 如果沒有子節點，那就 1.遍歷sibling, 2.遞歸的歸
    completeUnitOfWork(fiber);
  } else {
    workInProgress = next;
  }
}

function completeUnitOfWork(fiber: FiberNode) {
  let node: FiberNode | null = fiber;

  do {
    completeWork(node);
    const sibling = node.sibling;
    if (sibling !== null) {
      workInProgress = sibling;
      return;
    }
    // 如果沒有兄弟節點，那就往上遞歸
    node = node.return;
    workInProgress = node;
  } while (node !== null);
}
