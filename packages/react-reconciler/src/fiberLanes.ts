import { FiberRootNode } from "./fiber";

export type Lane = number;
export type Lanes = number; // Lane的集合

export const SyncLane = 0b0001;
export const NoLane = 0b0000;
export const NoLanes = 0b0000;

export const mergeLane = (laneA: Lane, laneB: Lane): Lanes => {
  return laneA | laneB;
};

/**
 * 返回當前的lane，目前先都預設為 SyncLane
 * 之後可以根據不同情況（如click、useEffect等）而返回不同的lane
 * @returns SyncLane
 */
export const requestUpdateLanes = () => {
  return SyncLane;
};

export const getHighestPriorityLane = (lanes: Lanes): Lane => {
  return lanes & -lanes;
};

export const markRootFinished = (root: FiberRootNode, lane: Lane) => {
  root.pendingLanes &= ~lane;
};
