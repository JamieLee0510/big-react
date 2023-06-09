import { Props, Key, Ref, ReactElementType } from "shared/ReactTypes";
import {
  Fragment,
  FunctionComponent,
  HostComponent,
  WorkTag,
} from "./workTags";
import { Flags, NoFlags } from "./fiberFlags";
import { Container } from "hostConfig";
import { Lane, Lanes, NoLane, NoLanes } from "./fiberLanes";
import { Effect } from "./fiberHooks";

export class FiberNode {
  tag: WorkTag;
  key: Key;
  pendingProps: Props;
  stateNode: any;
  type: any;
  ref: Ref;

  return: FiberNode | null;
  sibling: FiberNode | null;
  child: FiberNode | null;
  index: number;

  memoizedProps: Props | null;
  memoizedState: any;
  alternate: FiberNode | null;
  flags: Flags;
  subtreeFlags: Flags;
  updateQueue: unknown;

  // 存放在更新階段需要被刪除的子fibers
  deletions: FiberNode[] | null;

  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    // 作為實例的屬性
    this.tag = tag;

    this.key = key || null;
    // HostComponent, <div> div DOM
    this.stateNode = null;

    // if FunctionComponent, ()=>{}，就是function本身
    this.type = null;

    // 構成樹狀結構，節點之間的關係
    // 指向父FiberNode
    this.return = null;
    // 指向兄弟節點
    this.sibling = null;
    // 指向子節點
    this.child = null;

    // 如果同級的FiberNode有多個
    // 如<ul> li*3 </ul>
    this.index = 0;

    this.ref = null;

    // 作為工作單元
    // 剛開始工作時，props是什麼
    this.pendingProps = pendingProps;
    // 工作完後，props是什麼
    this.memoizedProps = null;
    this.updateQueue = null;
    this.memoizedState = null;

    // 用於切換current fibernodes 和 workInProgress
    this.alternate = null;

    // 副作用
    this.flags = NoFlags;
    this.subtreeFlags = NoFlags;

    this.deletions = null;
  }
}

// 存放unMount時的effect數組、updated時的effect數組
export interface PendingPassiveEffect {
  unmount: Effect[];
  update: Effect[];
}

export class FiberRootNode {
  container: Container;
  current: FiberNode;
  finishedWork: FiberNode | null; //已經遞歸完成的FiberNode
  pendingLanes: Lanes;
  finishedLane: Lane; // 本次消費被更新的lane

  pendingPassiveEffects: PendingPassiveEffect;

  constructor(container: Container, hostRootFiber: FiberNode) {
    this.container = container;
    this.current = hostRootFiber;
    // 把hostRootFiber的 HostComponent指向這個FiberRootNode實例
    hostRootFiber.stateNode = this;

    this.finishedWork = null;

    this.pendingLanes = NoLanes;
    this.finishedLane = NoLane;

    this.pendingPassiveEffects = {
      unmount: [],
      update: [],
    };
  }
}

/* 由於Fiber是雙緩存機制，所以傳入current的話，那就要返回其alternate*/
export const createworkInProgress = (
  current: FiberNode,
  pendingProps: Props
): FiberNode => {
  let wip = current.alternate;

  if (wip == null) {
    // 首次渲染的話，workInProgress必為null；
    // 在mount週期
    wip = new FiberNode(current.tag, pendingProps, current.key);
    wip.stateNode = current.stateNode;
    wip.alternate = current;
    current.alternate = wip;
  } else {
    // 在update週期
    wip.pendingProps = pendingProps;

    // 清除副作用
    wip.flags = NoFlags;
    wip.subtreeFlags = NoFlags;

    wip.deletions = null;
  }
  // 這個可以回答，為什麼 updateQueue 是一個對象{shared:{pending:{}}}
  // 因為這樣一來，workingProgerss和current可以共用一個updateQueue
  wip.type = current.type;
  wip.updateQueue = current.updateQueue;
  wip.child = current.child;
  wip.memoizedProps = current.memoizedProps;
  wip.memoizedState = current.memoizedState;
  return wip;
};

export function createFiberFromElement(element: ReactElementType): FiberNode {
  const { type, key, props } = element;
  // 然後根據不同的type，返回不同的FiberNode
  let fiberTag: WorkTag = FunctionComponent;

  if (typeof type == "string") {
    // <span/>---> tag:span, 為string
    fiberTag = HostComponent;
  } else if (typeof type !== "function" && __DEV__) {
    // 邊界情況，
    console.warn("未定義的tag類型:", type);
  }
  const fiber = new FiberNode(fiberTag, props, key);
  fiber.type = type;

  return fiber;
}

export function createFiberFromFragment(elements: any[], key: Key): FiberNode {
  const fiber = new FiberNode(Fragment, elements, key);
  return fiber;
}
