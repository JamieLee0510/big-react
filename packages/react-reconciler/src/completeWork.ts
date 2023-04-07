import {
  appendInitialChild,
  createInstance,
  createTextInstance,
} from "hostConfig";
import { FiberNode } from "./fiber";
import { Flags, NoFlags } from "./fiberFlags";
import { HostComponent, HostRoot, HostText } from "./workTags";

// 遞歸中的歸
export const completeWork = (wip: FiberNode) => {
  // todo
  const newProps = wip.pendingProps;
  const current = wip.alternate;

  switch (wip.tag) {
    case HostComponent:
      // 構建離屏DOM樹
      // 1. 創建DOM
      // 2. 將DOM節點插入到DOM樹中

      if (current !== null && wip.stateNode) {
        // 對於HostComponent來說，stateNode保存的是對應的dom節點
        // 此為update的情況
      } else {
        // 首屏渲染

        // 因為這裡抽象較高，必須透過宿主環境來創建實例
        const instance = createInstance(wip.type, newProps);
        appendAllChildren(instance, wip);
        wip.stateNode = instance;
      }
      bubbleProperties(wip);
      return null;
    case HostText:
      // 構建離屏DOM樹
      // 1. 創建DOM
      // 2. 將DOM節點插入到DOM樹中

      if (current !== null && wip.stateNode) {
        // 對於HostComponent來說，stateNode保存的是對應的dom節點
        // 此為update的情況
      } else {
        // 首屏渲染

        // 因為這裡抽象較高，必須透過宿主環境來創建實例
        const instance = createTextInstance(newProps.content);

        wip.stateNode = instance;
      }
      bubbleProperties(wip);
      return null;
    case HostRoot:
      bubbleProperties(wip);
      return null;

    default:
      if (__DEV__) {
        console.warn("未處理的completeWork情況:", wip);
      }
  }
};

function appendAllChildren(parent: FiberNode, wip: FiberNode) {
  //在parent下插入workingProgress節點，但它不一定是一個dom節點

  let node = wip.stateNode;

  // 遞歸插入，因為可能有兄弟節點、子節點等
  while (node !== null) {
    // 往下遞，找到HostComponent或HostText，就進行插入
    if (node.tag === HostComponent || node.tag == HostText) {
      appendInitialChild(parent, node);
    } else if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }

    if (node == wip) {
      return;
    }

    while (node.sibling === null) {
      if (node.return === null || node.return === wip) {
        return;
      }
      // 往上歸
      node = node.return;
    }

    node.sibling.return = node.return;
    node = node.sibling;
  }
}

// 利用completeWork的向上遞歸流程，
function bubbleProperties(wip: FiberNode) {
  let subtreeFlags: Flags = NoFlags;
  let child = wip.child;

  while (child !== null) {
    subtreeFlags |= child.subtreeFlags;
    subtreeFlags |= child.flags;

    child.return = wip.child;
    child = child.sibling;
  }
  wip.subtreeFlags |= subtreeFlags;
}
