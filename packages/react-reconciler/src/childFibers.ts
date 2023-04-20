import { REACT_ELEMENT_TYPE } from "shared/ReactSymbols";
import { Props, ReactElementType } from "shared/ReactTypes";
import {
  createFiberFromElement,
  createworkInProgress,
  FiberNode,
} from "./fiber";
import { ChildDeletion, Placement } from "./fiberFlags";
import { HostText } from "./workTags";

type ExistingChildren = Map<string | number, FiberNode>;

// 為何要用閉包？主要是可以根據shouldTrackSideEffect來制定要使用哪個函數
function ChildrenReconciler(shouldTrackSideEffect: boolean) {
  function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode) {
    if (!shouldTrackSideEffect) {
      // 如果不用追蹤副作用，直接return
      return;
    }
    const deletions = returnFiber.deletions;
    if (deletions === null) {
      returnFiber.deletions = [childToDelete];
      returnFiber.flags |= ChildDeletion;
    } else {
      deletions.push(childToDelete);
      // TODO: 這裡的指針是指向同一個嗎？
      console.log(returnFiber.deletions);
    }
  }
  function deleteRemainChildren(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode | null
  ) {
    if (!shouldTrackSideEffect) {
      return;
    }
    let childToDelete = currentFirstChild;
    while (childToDelete !== null) {
      deleteChild(returnFiber, childToDelete);
      childToDelete = childToDelete.sibling;
    }
  }

  function reconcileSingleElement(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    element: ReactElementType
  ) {
    // 在update階段，比較key和type，看需不需要刪除更新操作
    const key = element.key;
    while (currentFiber !== null) {
      // update階段

      if (currentFiber.key === key) {
        // key相同時
        if (element.$$typeof === REACT_ELEMENT_TYPE) {
          if (currentFiber.type === element.type) {
            // type相同，直接複用
            const existing = useFiber(currentFiber, element.props);
            existing.return = returnFiber;

            // 當前節點可複用，標記剩下的節點刪除
            deleteRemainChildren(returnFiber, currentFiber.sibling);
            return existing;
          }
          // key相同，但type不同，還是要刪除所有舊的
          deleteRemainChildren(returnFiber, currentFiber);
          break;
        } else {
          // 假如不是 REACT_ELEMENT_TYPE
          if (__DEV__) {
            console.warn("還未實現的React類型：", element.$$typeof);
            break;
          }
        }
      } else {
        // key不同，那就要刪掉舊的fiber，繼續遍歷其他的sibiling
        deleteChild(returnFiber, currentFiber);
        currentFiber = currentFiber.sibling;
      }
    }

    // 根據element(ReactElement)來創建Fiber，然後返回
    const fiber = createFiberFromElement(element);
    // 將fiber的父節點設定好
    fiber.return = returnFiber;
    return fiber;
  }

  /**
   * 複用fiber的方法。由於是調用 createworkInProgress 方法
   * 所以會是在 current 和 wip 之間重複使用
   * @param fiber 要複用的fiber
   * @param pendingProps 更新的props
   */
  function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
    const clone = createworkInProgress(fiber, pendingProps);
    clone.index = 0;
    clone.sibling = null;
    return clone;
  }

  function reconcileSingleTextNode(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    content: string | number
  ) {
    while (currentFiber !== null) {
      // 在update流程
      if (currentFiber.tag === HostText) {
        // 類型沒有變，可以複用
        const existing = useFiber(currentFiber, { content });
        existing.return = returnFiber;
        deleteRemainChildren(returnFiber, currentFiber.sibling);
        return existing;
      }
      // 假如類型不一樣，就代表要先刪除
      deleteChild(returnFiber, currentFiber);
      currentFiber = currentFiber.sibling;
    }

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

  function reconcileChildrenArray(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode | null,
    newChild: any[] //ReactDOM的child有太多類型，直接any
  ) {
    // 為了紀錄array 索引。最後一個可複用的fiber在current中的索引位置
    let lastPlaceIndex = 0;
    // 創建的最後一個fiber
    let lastNewFiber: FiberNode | null = null;
    // 創建的第一個fiber，是在這個函數裡要返回的fiber
    let firstNewFiber: FiberNode | null = null;

    // step1:將 current 放在一個 Map 中
    const existingChildrenMap: ExistingChildren = new Map();
    /**
     * current 是 fiberNode, 兄弟節點是透過 link指針 來綁定；
     * newChild 是array：[ReactElement,...],是透過jsx轉化來的
     */
    let current = currentFirstChild;
    while (current !== null) {
      const keyToUse = current.key !== null ? current.key : current.index;
      existingChildrenMap.set(keyToUse, current);
      current = current.sibling;
    }

    for (let i = 0; i < newChild.length; i++) {
      // step2: 遍歷 newChild，尋找可複用
      const after = newChild[i];
      const newFiber = updateFromMap(
        returnFiber,
        existingChildrenMap,
        i,
        after
      );
      if (newFiber === null) {
        continue;
      }

      // step3: 標記移動或者插入（這邊有點複雜）
      // 「移動」具體是向右移動，用index來比較
      newFiber.index = i;
      newFiber.return = returnFiber;

      if (lastNewFiber == null) {
        lastNewFiber = newFiber;
        firstNewFiber = newFiber;
      } else {
        // 往右移，lastNewFiber始終指向新的fiber
        lastNewFiber.sibling = newFiber;
        lastNewFiber = lastNewFiber.sibling;
      }

      if (!shouldTrackSideEffect) {
        continue;
      }

      const current = newFiber.alternate;
      if (current !== null) {
        const oldIndex = current.index;
        // 比原本的靠右，移動標記
        if (oldIndex < lastPlaceIndex) {
          newFiber.flags |= Placement;
          continue;
        } else {
          // 不移動
          lastPlaceIndex = oldIndex;
        }
      } else {
        // mount 階段，進行插入
        newFiber.flags |= Placement;
      }
    }

    // step4: 將Map 剩下的標記為刪除
    existingChildrenMap.forEach((fiber) => {
      deleteChild(returnFiber, fiber);
    });

    return firstNewFiber;
  }
  function updateFromMap(
    returnFiber: FiberNode,
    existingChildren: ExistingChildren,
    index: number,
    element: any
  ): FiberNode | null {
    const keyToUse = element.key !== null ? element.key : index;
    const before = existingChildren.get(keyToUse);

    // 假如 element 是 HostText 的情況
    if (typeof element == "string" || typeof element == "number") {
      if (before) {
        if (before.tag === HostText) {
          existingChildren.delete(keyToUse);
          return useFiber(before, { content: element.toString() });
        }
      }
      return new FiberNode(HostText, { content: element.toString() }, null);
    }

    // 假如 element 是其他 ReactElement 類型
    if (typeof element === "object" && element !== null) {
      switch (element.$$typeof) {
        case REACT_ELEMENT_TYPE:
          if (before) {
            // key相同，type相同，可複用
            if (before.type == element.type) {
              existingChildren.delete(keyToUse);
              return useFiber(before, element.props);
            }
          }
          return createFiberFromElement(element);
      }
      // TODO: element是數組類型
      if (Array.isArray(element) && __DEV__) {
        console.warn("還未實現數組類型的 newChild");
      }
    }
    return null;
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

      // 多節點的情況，如：ul->li*3,
      if (Array.isArray(newChild)) {
        return reconcileChildrenArray(returnFiber, currentFiber, newChild);
      }
    }

    // HostText
    if (typeof newChild == "string" || typeof newChild === "number") {
      return placeSingleChild(
        reconcileSingleTextNode(returnFiber, currentFiber, newChild)
      );
    }

    // 兜底刪除的情
    if (currentFiber !== null) {
      deleteChild(returnFiber, currentFiber);
    }

    if (__DEV__) {
      console.warn("未實現的reconcile類型:", newChild);
    }
    return null;
  };
}

export const reconcileChildFibers = ChildrenReconciler(true);
export const mountChildFibers = ChildrenReconciler(false);
