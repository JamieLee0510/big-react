import { FiberNode } from "react-reconciler/src/fiber";
import { HostText } from "react-reconciler/src/workTags";
import { updateFiberProps, DOMElement } from "./SyntheticEvent";
import { Props } from "shared/ReactTypes";

// 用來對應不同的宿主環境，如browser的話，就是DOMElement
export type Container = Element;
export type Instance = Element;
export type TextInstance = Text;

export const createInstance = (type: string, props: Props): Instance => {
  // TODO: 處理props
  const element = document.createElement(type) as unknown;
  updateFiberProps(element as DOMElement, props);
  return element as DOMElement;
};

export const appendInitialChild = (
  parent: Instance | Container,
  child: Instance
) => {
  parent.appendChild(child);
};

export const createTextInstance = (content: string) => {
  return document.createTextNode(content);
};

export const appendChildToContainer = appendInitialChild;

export const commitUpdate = (fiber: FiberNode) => {
  switch (fiber.tag) {
    case HostText:
      const text = fiber.memoizedProps.content;

      return commitTextUpdate(fiber.stateNode, text);
    default:
      console.warn("未實現的 Update 類型：", fiber);
  }
};

const commitTextUpdate = (textInstance: TextInstance, content: string) => {
  textInstance.textContent = content;
};

export const removeChild = (
  child: Instance | TextInstance,
  container: Container
) => {
  container.removeChild(child);
};

export function insertChildToContainer(
  child: Instance,
  container: Container,
  before: Instance
) {
  container.insertBefore(child, before);
}

/**
 * 假如當前宿主環境支持 queueMicrotask ---> 返回 queueMicrotask；
 * 假如當前宿主環境支持 Promise ---> 返回一個Promise、裡面包callback；
 * 假如都沒有支持，就使用 setTimeout 宏任務
 */
export const scheduleMicroTask =
  typeof queueMicrotask === "function"
    ? queueMicrotask
    : typeof Promise === "function"
    ? (callback: (...args: any) => void) => Promise.resolve(null).then(callback)
    : setTimeout;
