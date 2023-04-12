import { REACT_ELEMENT_TYPE } from "shared/ReactSymbols";
import { ReactElementType } from "shared/ReactTypes";
import { createFiberFromElement, FiberNode } from "./fiber";
import { Placement } from "./fiberFlags";
import { HostText } from "./workTags";

// 為何要用閉包？主要是可以根據shouldTrackSideEffect來制定要使用哪個函數
function ChildrenReconciler(shouldTrackSideEffect: boolean) {
  function reconcileSingleElement(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    element: ReactElementType
  ) {
    // 根據element(ReactElement)來創建Fiber，然後返回
    const fiber = createFiberFromElement(element);
    // 將fiber的父節點設定好
    fiber.return = returnFiber;
    return fiber;
  }

  function reconcileSingleTextNode(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    content: string | number
  ) {
    const fiber = new FiberNode(HostText, { content }, null);

    // 將fiber的父節點設定好
    fiber.return = returnFiber;
    return fiber;
  }

  function placeSingleChild(fiber: FiberNode) {
    // 當有副作用而且為首屏渲染時
    if (shouldTrackSideEffect && fiber.alternate == null) {
      // fiber.alternate == null, 代表current為null-->首屏
      fiber.flags |= Placement;
    }

    return fiber;
  }

  return function reconcileChildFibers(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    newChild?: ReactElementType
  ) {
    // 判斷當前fiber類型

    if (typeof newChild == "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return placeSingleChild(
            reconcileSingleElement(returnFiber, currentFiber, newChild)
          );
        default:
          if (__DEV__) {
            console.warn("未實現的reconcile類型:", newChild);
          }
      }
    }
    // TODO: 多節點的情況，如：ul->li*3,

    // HostText
    if (typeof newChild == "string" || typeof newChild === "number") {
      return placeSingleChild(
        reconcileSingleTextNode(returnFiber, currentFiber, newChild)
      );
    }
    if (__DEV__) {
      console.warn("未實現的reconcile類型:", newChild);
    }
    return null;
  };
}

export const reconcileChildFibers = ChildrenReconciler(true);
export const mountChildFibers = ChildrenReconciler(false);
