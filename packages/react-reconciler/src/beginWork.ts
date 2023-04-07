import { ReactElementType } from "shared/ReactTypes";
import { mountChildFibers, reconcileChildFibers } from "./childFibers";
import { FiberNode } from "./fiber";
import { processUpdateQueue, UpdateQueue } from "./updateQueue";
import { HostComponent, HostRoot, HostText } from "./workTags";

// 遞歸中的遞
export const beginWork = (wip: FiberNode): FiberNode | null => {
  // 比較新舊fiber，返回子fiber

  switch (wip.tag) {
    case HostRoot:
      // 計算狀態的最新值
      // 創造子fiberNode
      return updateHostRoot(wip);

    case HostComponent:
      // 創造子fiberNode
      return updateHostComponent(wip);
    case HostText:
      // 因為它沒有子節點， 如<h1>hihi</h1>
      // HostText 就是 'hihi'
      return null;
    default:
      if (__DEV__) {
        console.warn("beginWork 執行未定義的類型:", wip.tag);
      }
      break;
  }

  return null;
};

function updateHostRoot(wip: FiberNode) {
  // 不過對首屏渲染而言，baseState為null
  const baseState = wip.memoizedState;
  const updateQueue = wip.updateQueue as UpdateQueue<Element>;

  // 獲取參與計算的update
  const pending = updateQueue.shared.pending;
  // 取得最新狀態
  const { memorizedState } = processUpdateQueue(baseState, pending);
  wip.memoizedState = memorizedState;
  // 計算完後，把update清空
  updateQueue.shared.pending = null;

  const nextChildren = memorizedState;

  // 對比children的 current fiberNode和 ReactElement
  // 生成對應B的wip fiberNode
  reconcileChildren(wip, nextChildren);

  return wip.child;
}

function updateHostComponent(wip: FiberNode) {
  // 跟updateHostRoot的最大區別，是在於updateHostComponent無法觸發更新
  // 不過對首屏渲染而言，baseState為null

  const nextProps = wip.pendingProps;
  const nextChildren = nextProps.children;

  // 對比children的 current fiberNode和 ReactElement
  // 生成對應B的wip fiberNode
  reconcileChildren(wip, nextChildren);

  return wip.child;
}

function reconcileChildren(wip: FiberNode, children?: ReactElementType) {
  // 因為對比的是子節點的current fiberNode和 子節點的ReactElement
  // 所以先獲取父節點的current
  const current = wip.alternate;

  if (current !== null) {
    // update 流程

    // 生成對應B的wip fiberNode方法
    // 這裡有個性能優化的點：
    // 如果一個一個對比，會造成多次的Placement；
    // 但如果是先生成好還沒掛載到HTML的DOM tree，然後再一次Placement
    wip.child = reconcileChildFibers(wip, current?.child, children);
  } else {
    // mount 流程
    wip.child = mountChildFibers(wip, null, children);
  }
}
