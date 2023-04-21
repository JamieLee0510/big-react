export type WorkTag =
  | typeof FunctionComponent
  | typeof HostRoot
  | typeof HostComponent
  | typeof HostText
  | typeof Fragment;

export const FunctionComponent = 0;

// ReactDOM.render(HostRoot)
export const HostRoot = 3;

// <div>
export const HostComponent = 5;

// <div>123</div>
export const HostText = 6;

/**
 * FiberNode.tag --- Fragment
 * ReactElement.type --- REACT_FRAGMENT_TYPE
 */
export const Fragment = 7;
