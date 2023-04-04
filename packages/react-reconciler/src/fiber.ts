import { Props, Key, Ref } from "shared/ReactTypes";
import { WorkTag } from "./workTags";
import { Flags, NoFlags } from "./fiberFlags";
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
  alternate: FiberNode | null;
  flags: Flags;

  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    // 作為實例
    this.tag = tag;
    this.key = key;
    // HostComponent, <div> div DOM
    this.stateNode = null;
    // if FunctionComponent, ()=>{}
    this.type = null;

    // 構成樹狀結構
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

    this.alternate = null;

    // 副作用
    this.flags = NoFlags;
  }
}
