import {
  Container,
  appendInitialChild,
  createInstance,
  createTextInstance,
} from "hostConfig";
import { FiberNode } from "./fiber";
import { Flags, NoFlags, Update } from "./fiberFlags";
import {
  Fragment,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
} from "./workTags";
import { updateFiberProps } from "react-dom/src/SyntheticEvent";

function markUpdate(fiber: FiberNode) {
  fiber.flags |= Update;
}

// 遞歸中的歸
export const completeWork = (wip: FiberNode) => {
  const newProps = wip.pendingProps;
  const current = wip.alternate;

  switch (wip.tag) {
    case HostComponent:
      // 構建離屏DOM樹

      if (current !== null && wip.stateNode) {
        // 對於HostComponent來說，stateNode保存的是對應的dom節點
        // 此為update的情況
        // step1: 判斷props是否變化，ex: {onClick:xx} -->{onClick:xxx}
        // step2: 如有變，標記 Update flag
        // 但是，除了onClick，還要判斷許多如 className、style等等的變化，先略過
        // 直接調用 updateFiberProps 來一次簡單更新
        updateFiberProps(wip.stateNode, newProps);
      } else {
        // 首屏渲染
        // 因為這裡抽象較高，必須透過宿主環境來創建實例
        // 1. 創建DOM
        // const instance = createInstance(wip.type, newProps);
        const instance = createInstance(wip.type, newProps);
        // 2. 將DOM節點插入到DOM樹中
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
        const oldText = current.memoizedProps.content;
        const newText = newProps.content;

        if (oldText !== newText) {
          markUpdate(wip);
        }
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
    case FunctionComponent:
      bubbleProperties(wip);
      return null;
    case Fragment:
      bubbleProperties(wip);
      return null;
    default:
      if (__DEV__) {
        console.warn("未處理的completeWork情況:", wip);
      }
  }
};

/**
 * 在parent下插入workInProgress節點，但它不一定是一個dom節點
 */
function appendAllChildren(parent: Container, wip: FiberNode) {
  let node = wip.child;

  // 遞歸插入，因為可能有兄弟節點、子節點等
  while (node !== null) {
    // 往下遞，找到HostComponent或HostText，就進行插入
    if (node.tag === HostComponent || node.tag == HostText) {
      appendInitialChild(parent, node?.stateNode);
    } else if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }

    if (node === wip) {
      return;
    }

    while (node.sibling === null) {
      if (node.return === null || node.return === wip) {
        return;
      }
      // 往上歸
      node = node?.return;
    }

    node.sibling.return = node.return;
    node = node.sibling;
  }
}

/**
 * completeWork的性能優化，利用向上遞歸的過程，把flag冒泡上去
 */
function bubbleProperties(wip: FiberNode) {
  let subtreeFlags: Flags = NoFlags;
  let child = wip.child;

  while (child !== null) {
    subtreeFlags |= child.subtreeFlags;
    subtreeFlags |= child.flags;

    child.return = wip; // 這邊！！！
    child = child.sibling;
  }
  wip.subtreeFlags |= subtreeFlags;
}
