export type Flags = number;

export const NoFlags = 0b000000;
export const Placement = 0b000001;
export const Update = 0b000010;
export const ChildDeletion = 0b000100;

export const MutationMask = Placement | Update | ChildDeletion;
