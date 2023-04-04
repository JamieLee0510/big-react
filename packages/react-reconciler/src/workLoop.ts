import { beginWork } from "./beginWork";
import { completeWork } from "./completeWork";
import { FiberNode } from "./fiber";

// 全局指針，指向正在工作的FiberNode
let workingProgress: FiberNode | null = null;

function prepareFreshStack(fiber: FiberNode) {
  workingProgress = fiber;
}

function renderRoot(root: FiberNode) {
  // 初始化
  prepareFreshStack(root);

  do {
    try {
      workLoop();
      break;
    } catch (e) {
      console.warn("working loop 發生錯誤:", e);
      workingProgress = null;
    }
  } while (true);
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
