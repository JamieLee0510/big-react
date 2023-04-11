import { Container, appendChildToContainer } from "hostConfig";
import { FiberNode, FiberRootNode } from "./fiber";
import { MutationMask, NoFlags, Placement } from "./fiberFlags";
import { HostComponent, HostRoot, HostText } from "./workTags";

// 由於要遞歸遍歷 finishedWorked（為父節點） 中的Effect，
// 所以設一個全局變量
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
      // 找到了沒有effect flags的子節點，但還要檢查它的 sibling
      up: while (nextEffect !== null) {
        // 執行mutation
        commitMutationEffectsOnFiber(nextEffect);

        const sibling: FiberNode | null = nextEffect.sibling;
        if (sibling !== null) {
          nextEffect = sibling;
          // break up-loop 之後，就會繼續外層的循環
          break up;
        } else {
          // 沒有 sibling 就向上
          nextEffect = nextEffect.return;
        }
      }
    }
  }
};

const commitMutationEffectsOnFiber = (finisheWork: FiberNode) => {
  const flags = finisheWork.flags;

  if ((flags & Placement) !== NoFlags) {
    // 有Placement flag，處理placement操作，然後清除 placement flag
    commitPlacement(finisheWork);
    finisheWork.flags &= ~Placement;
  }
};

const commitPlacement = (finishedWork: FiberNode) => {
  // 要知道 partent dom，才知道要插入到哪裡
  // 要知道 finisheWork 的dom，才知道要插入什麼

  if (__DEV__) {
    console.warn("執行Placement操作--", finishedWork);
  }

  // parent dom
  const parentDom = getHostParent(finishedWork);

  // 找到 finisheWork 的dom，然後 append 到 parent dom中
  if (parentDom) {
    appendPlacementNodeIntoContainer(finishedWork, parentDom);
  }
};

const getHostParent = (fiber: FiberNode): Container | null => {
  let parent = fiber.return;

  while (parent !== null) {
    const parentTag = parent.tag;

    if (parentTag == HostComponent) {
      return parent.stateNode as Container;
    }

    if (parentTag == HostRoot) {
      // 這邊需要在看一下 FiberRootNode 的結構
      return (parent.stateNode as FiberRootNode).container as Container;
    }
    parent = parent.return;
  }

  if (__DEV__) {
    console.warn("未找到 host parent---", fiber);
  }
  return null;
};

const appendPlacementNodeIntoContainer = (
  finishedWork: FiberNode,
  hostParent: Container
) => {
  // fiber host
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    appendChildToContainer(hostParent, finishedWork.stateNode);
    return;
  }
  const child = finishedWork.child;
  if (child !== null) {
    appendPlacementNodeIntoContainer(child, hostParent);
    let sibling = child.sibling;

    while (sibling !== null) {
      appendPlacementNodeIntoContainer(sibling, hostParent);
      sibling = sibling.sibling;
    }
  }
};
