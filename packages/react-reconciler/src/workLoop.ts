import { beginWork } from "./beginWork";
import { commitMutationEffects } from "./commitWork";
import { completeWork } from "./completeWork";
import { createWorkingProgress, FiberNode, FiberRootNode } from "./fiber";
import { MutationMask, NoFlags } from "./fiberFlags";
import { HostRoot } from "./workTags";

// 全局指針，指向正在工作的FiberNode
let workingProgress: FiberNode | null = null;

function prepareFreshStack(root: FiberRootNode) {
  workingProgress = createWorkingProgress(root.current, {});
}

// 用來連結Container和renderRoot方法
export function scheduteUpdateOnFiber(fiber: FiberNode) {
  // TODO:調度功能
  const root = markUpdateFromFiberToRoot(fiber);
}

// 向上遍歷，
function markUpdateFromFiberToRoot(fiber: FiberNode) {
  let node = fiber;
  let parent = fiber.return;
  while (parent) {
    node = parent;
    parent = node.return;
  }
  if (node.tag === HostRoot) {
    return node.stateNode; //HostComponent
  }
  return null;
}

function renderRoot(root: FiberRootNode) {
  // 初始化
  prepareFreshStack(root);

  do {
    try {
      workLoop();
      break;
    } catch (e) {
      if (__DEV__) {
        console.warn("working loop 發生錯誤:", e);
      }

      workingProgress = null;
    }
  } while (true);

  // 獲取更新好的workingProgress樹
  const finishedWork = root.current.alternate;
  root.finisedWork = finishedWork;

  commitRoot(root);
}

function commitRoot(root: FiberRootNode) {
  const finishedWork = root.finisedWork;

  if (finishedWork === null) {
    return;
  }
  if (__DEV__) {
    console.log("commit階段開始---", finishedWork);
  }

  // 重置
  // my ques:為什麼這樣不會造成淺拷貝也一起重置？
  root.finisedWork = null;

  // 判斷是否存在3個子階段需要執行的操作
  // 從 root.flags 和 root.subTreeFlags
  const subTreeHasEffect =
    (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
  const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

  if (rootHasEffect || subTreeHasEffect) {
    // beforeMutation
    // mutation Flags：Placement
    commitMutationEffects(finishedWork);

    // 由於雙緩存機制，當workingProgress渲染到頁面中後
    // 會變成current，然後等待下一次更新、創建新的wip fiberTree
    root.current = finishedWork;

    // layout
  } else {
    // 由於雙緩存機制
    root.current = finishedWork;
  }
}

function workLoop() {
  while (workingProgress) {
    preformUnitOfWork(workingProgress);
  }
}

function preformUnitOfWork(fiber: FiberNode) {
  const next = beginWork(fiber);
  fiber.memoizedProps = fiber.pendingProps;

  if (next !== null) {
    completeUnitOfWork(next);
  } else {
    workingProgress = null;
  }
}

function completeUnitOfWork(fiber: FiberNode) {
  const node: FiberNode | null = fiber;

  do {
    completeWork(node);
    const sibling = node.sibling;
    if (sibling) {
      workingProgress = sibling;
      return;
    }
    // 如果沒有兄弟節點，那就往上遞歸
    workingProgress = node.return;
  } while (node !== null);
}
