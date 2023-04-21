import {
  Container,
  Instance,
  appendChildToContainer,
  commitUpdate,
  insertChildToContainer,
  removeChild,
} from "hostConfig";
import { FiberNode, FiberRootNode } from "./fiber";
import {
  ChildDeletion,
  MutationMask,
  NoFlags,
  Placement,
  Update,
} from "./fiberFlags";
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
} from "./workTags";

// 由於要遞歸遍歷 finishedWorked（為父節點） 中的Effect，
// 所以設一個全局變量，指向下一個 fiberNode
let nextEffect: FiberNode | null = null;

export const commitMutationEffects = (finishedWorked: FiberNode) => {
  nextEffect = finishedWorked;

  while (nextEffect !== null) {
    const child: FiberNode | null = nextEffect.child;

    if (
      (nextEffect.subtreeFlags & MutationMask) !== NoFlags &&
      child !== null
    ) {
      // 繼續向下遍歷，直到找到沒有effect flags 的節點
      nextEffect = child;
    } else {
      // 向上DFS
      up: while (nextEffect !== null) {
        // 執行mutation
        commitMutaitonEffectsOnFiber(nextEffect);

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

const commitMutaitonEffectsOnFiber = (finishedWork: FiberNode) => {
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
        commitDeletion(childToDelete);
      });
    }

    finishedWork.flags &= ~ChildDeletion;
  }
};

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

const commitDeletion = (childToDelete: FiberNode) => {
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
        // TODO: useEffect unMount處理
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
      hostSibling
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
