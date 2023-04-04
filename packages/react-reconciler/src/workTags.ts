export type WorkTag =
  | typeof FunctionComponent
  | typeof RootHost
  | typeof HostComponent
  | typeof HostText;

export const FunctionComponent = 0;
export const RootHost = 3;

// <div>
export const HostComponent = 5;

// <div>123</div>
export const HostText = 6;
