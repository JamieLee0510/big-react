export type Flags = number;

export const NoFlags = 0b0000000;
export const Placement = 0b0000001;
export const Update = 0b0000010;
export const ChildDeletion = 0b0000100;

// 代表當前fiber更新時，需要觸發useEffect
export const PassiveEffect = 0b0001000;

export const MutationMask = Placement | Update | ChildDeletion;

// 卸載組件的時候也需要觸發useEffect
export const PassiveMask = PassiveEffect | ChildDeletion;
