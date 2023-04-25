import {
  Container,
  Instance,
  appendChildToContainer,
  commitUpdate,
  insertChildToContainer,
  removeChild,
} from "hostConfig";
import { FiberNode, FiberRootNode, PendingPassiveEffect } from "./fiber";
import {
  ChildDeletion,
  Flags,
  MutationMask,
  NoFlags,
  PassiveEffect,
  PassiveMask,
  Placement,
  Update,
} from "./fiberFlags";
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
} from "./workTags";
import { Effect, FCUpdateQueue } from "./fiberHooks";
import { HookHasEffect } from "./hookEffectTags";

// 由於要遞歸遍歷 finishedWorked（為父節點） 中的Effect，
// 所以設一個全局變量，指向下一個 fiberNode
let nextEffect: FiberNode | null = null;

export const commitMutationEffects = (
  finishedWorked: FiberNode,
  root: FiberRootNode
) => {
  nextEffect = finishedWorked;

  while (nextEffect !== null) {
    const child: FiberNode | null = nextEffect.child;

    if (
      (nextEffect.subtreeFlags & (MutationMask | PassiveMask)) !== NoFlags &&
      child !== null
    ) {
      // 繼續向下遍歷，直到找到沒有effect flags 的節點
      nextEffect = child;
    } else {
      // 向上DFS
      up: while (nextEffect !== null) {
        // 執行mutation
        commitMutaitonEffectsOnFiber(nextEffect, root);

        // 找到了沒有effect flags的子節點，但還要檢查它的 sibling
        const sibling: FiberNode | null = nextEffect.sibling;
        if (sibling !== null) {
          nextEffect = sibling;
          // break up-loop 之後，就會繼續外層的循環
          break up;
        }
        // 沒有 sibling 就向上
        nextEffect = nextEffect.return;
      }
    }
  }
};

const commitMutaitonEffectsOnFiber = (
  finishedWork: FiberNode,
  root: FiberRootNode
) => {
  const flags = finishedWork.flags;

  if ((flags & Placement) !== NoFlags) {
    commitPlacement(finishedWork);
    finishedWork.flags &= ~Placement;
  }
  // flags Update
  if ((flags & Update) !== NoFlags) {
    commitUpdate(finishedWork);
    finishedWork.flags &= ~Update;
  }

  // flags ChildDeletion
  if ((flags & ChildDeletion) !== NoFlags) {
    const deletions = finishedWork.deletions;
    if (deletions !== null) {
      deletions.forEach((childToDelete) => {
        commitDeletion(childToDelete, root);
      });
    }

    finishedWork.flags &= ~ChildDeletion;
  }

  // TODO: 為什麼不是用 PassiveMask？？
  if ((flags & PassiveEffect) !== NoFlags) {
    // 收集回調
    commitPassiveEffect(finishedWork, root, "update");

    finishedWork.flags &= ~PassiveEffect;
  }
};

function commitPassiveEffect(
  fiber: FiberNode,
  root: FiberRootNode,
  type: keyof PendingPassiveEffect
) {
  // 不是函數組件，不會有副作用/ update階段但沒有副作用，
  if (
    fiber.tag !== FunctionComponent ||
    (type === "update" && (fiber.flags & PassiveEffect) === NoFlags)
  ) {
    return;
  }

  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
  if (updateQueue !== null) {
    if (updateQueue.lastEffect === null && __DEV__) {
      console.error("當FC組件存在PassiveEffect flag時，不應該不存在effect");
    }
    root.pendingPassiveEffects[type].push(updateQueue.lastEffect as Effect);
  }
}

/**
 * 用於遍歷 effect 環狀列表的方法
 * @param flags
 * @param lastEffect
 * @param callback
 */
export function commitHookEffectList(
  flags: Flags,
  lastEffect: Effect,
  callback: (effect: Effect) => void
) {
  let effect = lastEffect.next as Effect;

  do {
    // TODO: 之後理解
    if ((effect.tags & flags) === flags) {
      callback(effect);
    }
    effect = effect.next as Effect;
  } while (effect !== lastEffect.next);
}

/**
 * 在destroy階段的useEffect
 * @param flags
 * @param lastEffect
 */
export function commitHookEffectListUnmount(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const destroy = effect.destroy;
    if (typeof destroy === "function") {
      destroy();
    }
    // 因為到這個階段，FC算是被卸載了，所以要移除tags中的所有effect flags
    effect.tags &= ~HookHasEffect;
  });
}

/**
 * 觸發所有上次更新的destroy
 * @param flags
 * @param lastEffect
 */
export function commitHookEffectListDestroy(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const destroy = effect.destroy;
    if (typeof destroy === "function") {
      destroy();
    }
  });
}

/**
 * 觸發所有這次更新的create回調
 * @param flags
 * @param lastEffect
 */
export function commitHookEffectListCreate(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const create = effect.create;
    if (typeof create === "function") {
      // useEffect 的返回值是 destroy函數
      effect.destroy = create();
    }
  });
}

/**
 * 為了找到在Fragment下同級的所有節點
 * @param rootChildrenToDelete
 * @param unmountFiber
 */
function recordHostChildrenToDelete(
  rootChildrenToDelete: FiberNode[],
  unmountFiber: FiberNode
) {
  // step1: 找到第一個 root host 節點
  const lastOne = rootChildrenToDelete[rootChildrenToDelete.length - 1];
  if (!lastOne) {
    rootChildrenToDelete.push(unmountFiber);
  } else {
    let node = lastOne.sibling;
    while (node !== null) {
      if (node === unmountFiber) {
        rootChildrenToDelete.push(unmountFiber);
      }
      node = node.sibling;
    }
  }
  // step2: 找到每一個 host 節點，看他是不是跟第一個root host 節點同級，如果同級代表為兄弟節點
}

const commitDeletion = (childToDelete: FiberNode, root: FiberRootNode) => {
  /**
   * 对于FC，需要处理useEffect unmout执行、解绑ref
   * 对于HostComponent，需要解绑ref
   * 对于子树的根HostComponent，需要移除DOM
   */

  // 為了考慮要刪除Fragment時、下面有多個FiberNode，所以用Array
  const rootChildrenToDelete: FiberNode[] = [];

  // const rootHostNode: FiberNode | null = null;
  // 遞歸子樹的操作
  commitNestedComponent(childToDelete, (unmountFiber) => {
    switch (unmountFiber.tag) {
      case HostComponent:
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
        // if (rootHostNode == null) {
        //   rootHostNode = unmountFiber;
        // }
        // TODO:解綁 ref
        return;
      case HostText:
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
        // if (rootHostNode == null) {
        //   rootHostNode = unmountFiber;
        // }
        return;
      case FunctionComponent:
        // TODO: 解綁ref
        commitPassiveEffect(unmountFiber, root, "unmount");
        return;
      default:
        console.warn("未處理的 unmount 類型:", unmountFiber);
    }
  });

  // 移除 rootHostNode 的 DOM
  // if (rootHostNode !== null) {
  //   const hostParent = getHostParent(childToDelete);
  //   if (hostParent !== null) {
  //     removeChild((rootHostNode as FiberNode).stateNode, hostParent);
  //   }
  // }
  if (rootChildrenToDelete.length) {
    const hostParent = getHostParent(childToDelete);
    if (hostParent !== null) {
      rootChildrenToDelete.forEach((node) => {
        removeChild(node.stateNode, hostParent);
      });
    }
  }
  childToDelete.return = null;
  childToDelete.child = null;
};

/**
 *
 * @param root 需要遞歸的子樹的根節點
 * @param onCommitUnmount 處理當前節點的回調
 */
const commitNestedComponent = (
  root: FiberNode,
  onCommitUnmount: (fiber: FiberNode) => void
) => {
  let node = root;
  while (true) {
    onCommitUnmount(node);
    if (node.child !== null) {
      // 向下遍歷
      node.child.return = node;
      node = node.child;
      continue;
    }
    if (node === root) {
      return;
    }
    while (node.sibling === null) {
      if (node.return == null || node.return == root) {
        return;
      }
      // 向上歸
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
};

const commitPlacement = (finishedWork: FiberNode) => {
  if (__DEV__) {
    console.warn("执行Placement操作", finishedWork);
  }
  // parent DOM
  const hostParent = getHostParent(finishedWork);

  // host sibiling
  const hostSibling = getHostSibiling(finishedWork);

  // finishedWork ~~ DOM append parent DOM
  if (hostParent !== null) {
    insertOrAppendPlacementNodeIntoContainer(
      finishedWork,
      hostParent,
      hostSibling as Element
    );
  }
};

function getHostParent(fiber: FiberNode): Container | null {
  let parent = fiber.return;

  while (parent) {
    const parentTag = parent.tag;
    // HostComponent HostRoot
    if (parentTag === HostComponent) {
      return parent.stateNode as Container;
    }
    if (parentTag === HostRoot) {
      return (parent.stateNode as FiberRootNode).container;
    }
    parent = parent.return;
  }
  if (__DEV__) {
    console.warn("未找到host parent");
  }
  return null;
}

function getHostSibiling(fiber: FiberNode): Container | null {
  let node = fiber;

  findSibling: while (true) {
    // 當沒有兄弟節點，向上找
    while (node.sibling === null) {
      const parent = node.return;
      if (
        parent === null ||
        parent.tag === HostRoot ||
        parent.tag === HostComponent
      ) {
        // 終止條件
        return null;
      }

      // 向上遍歷
      node = parent;
    }

    node.sibling.return = node.return;
    node = node.sibling;

    while (node.tag !== HostText && node.tag !== HostComponent) {
      // 向下遍歷，找子孫節點
      // 但不穩定（要插入或移動）的節點不能當作HostSiblining
      if ((node.flags & Placement) !== NoFlags) {
        continue findSibling;
      }
      if (node.child === null) {
        // 找到底但還是沒找到，繼續findSibling
        continue findSibling;
      } else {
        // 繼續向下遍歷
        node.child.return = node;
        node = node.child;
      }
    }

    // 找到Host Sibling
    if ((node.flags & Placement) === NoFlags) {
      return node.stateNode;
    }

    break findSibling;
  }

  if (__DEV__) {
    console.warn("未找到host sibiling");
  }
  return null;
}

function insertOrAppendPlacementNodeIntoContainer(
  finishedWork: FiberNode,
  hostParent: Container,
  before?: Instance
) {
  // fiber host
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    if (before) {
      insertChildToContainer(finishedWork.stateNode, hostParent, before);
    } else {
      appendChildToContainer(hostParent, finishedWork.stateNode);
    }

    return;
  }
  const child = finishedWork.child;
  if (child !== null) {
    insertOrAppendPlacementNodeIntoContainer(child, hostParent);
    let sibling = child.sibling;

    while (sibling !== null) {
      insertOrAppendPlacementNodeIntoContainer(sibling, hostParent);
      sibling = sibling.sibling;
    }
  }
}
