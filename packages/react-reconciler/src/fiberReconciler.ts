// 組件mount時，調用的API

import { Container } from "hostConfig";
import { ReactElementType } from "shared/ReactTypes";
import { FiberNode, FiberRootNode } from "./fiber";
import {
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
  UpdateQueue,
} from "./updateQueue";
import { scheduleUpdateOnFiber } from "./workLoop";
import { HostRoot } from "./workTags";
import { requestUpdateLanes } from "./fiberLanes";

// 在createRoot時，執行createContainer
export const createContainer = (container: Container) => {
  const hostRootFiber = new FiberNode(HostRoot, {}, null);
  const root = new FiberRootNode(container, hostRootFiber);

  // 串接更新機制
  hostRootFiber.updateQueue = createUpdateQueue();
  return root;
};

// render方法內部，執行updateContainer
export const updateContainer = (
  element: ReactElementType,
  root: FiberRootNode
) => {
  const hostRootFiber = root.current;
  const lane = requestUpdateLanes();
  const update = createUpdate<ReactElementType | null>(element, lane);

  enqueueUpdate(
    hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>,
    update
  );
  scheduleUpdateOnFiber(hostRootFiber, lane);
  return element;
};
