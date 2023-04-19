/**
 * 存放跟ReactDOM相關的事件系統
 */

import { Container } from "hostConfig";
import { Props } from "shared/ReactTypes";

// 由於是要模擬瀏覽器事件來實現跨平台，所以要自己實現一個合成事件
interface SystheticEvent extends Event {
  __stopPropagation: boolean;
}

type EventCallback = (e: Event) => void;

interface Paths {
  capture: EventCallback[];
  bubble: EventCallback[];
}

// dom[xxx] = reactElement props, 在dom中存放react element 的props
export const elementPropsKey = "__props";

export interface DOMElement extends Element {
  [elementPropsKey]: Props;
}

export function updateFiberProps(node: DOMElement, props: Props) {
  console.log("updateFiberProps: ", props);
  node[elementPropsKey] = props;
}

/**
 * 下面為模擬瀏覽器對於用戶事件的「捕獲」和「冒泡」的流程
 * 「捕獲」事件放在capture、「冒泡」事件放在bubble
 */

const validEventTypeList = ["click"]; // 目前先支持click事件

export function initEvent(container: Container, eventType: string) {
  if (!validEventTypeList.includes(eventType)) {
    console.warn(`當前不支持${eventType}事件`);
    return;
  }
  if (__DEV__) {
    console.log("初始化事件：", eventType);
  }
  container.addEventListener(eventType, (e) => {
    dispatchEvent(container, eventType, e);
  });
}

function dispatchEvent(container: Container, eventType: string, e: Event) {
  const eventTarget = e.target;
  if (eventTarget == null) {
    console.warn("事件target不存在:", e);
    return;
  }
  console.log("collectPath, eventTarget:", eventTarget);
  console.log("collectPath, container:", container);
  // step1: 遍歷container，沿途收集事件
  const { capture, bubble } = collectPath(
    eventTarget as DOMElement,
    container,
    eventType
  );
  // step2: 構造合成事件
  const se = createSyntheticEvent(e);

  // step3: 遍歷capture
  triggerEventFlow(capture, se);

  // step4: 遍歷bubble
  if (se.__stopPropagation) {
    triggerEventFlow(bubble, se);
  }
}

function triggerEventFlow(paths: EventCallback[], se: SystheticEvent) {
  for (let i = 0; i < paths.length; i++) {
    const callback = paths[i];
    console.log("callback:", callback);
    callback.call(null, se);

    if (se.__stopPropagation) {
      break;
    }
  }
}

/**
 *
 * @param e
 * @returns 合成的事件，主要修改 Event的停止冒泡
 */
function createSyntheticEvent(e: Event): SystheticEvent {
  const systheticEvent = e as SystheticEvent;
  systheticEvent.__stopPropagation = false;

  const originStopPropagation = e.stopPropagation;
  systheticEvent.stopPropagation = () => {
    systheticEvent.__stopPropagation = true;
    if (originStopPropagation) {
      originStopPropagation();
    }
  };
  return systheticEvent;
}
function getEventCallbackNameFromEventType(
  eventType: string
): string[] | undefined {
  return {
    click: ["onClickCapture", "onClick"],
  }[eventType];
}

function collectPath(
  targetElement: DOMElement,
  container: Container,
  eventType: string
) {
  const pathResult: Paths = {
    capture: [],
    bubble: [],
  };

  while (targetElement && targetElement !== container) {
    console.log("in collectPath loop");
    // 收集過程
    const elementProp = targetElement[elementPropsKey];
    if (elementProp) {
      // 拿到click，其實是要拿到 onClick 和 onClickCapture
      const callbackNameList = getEventCallbackNameFromEventType(eventType);
      if (callbackNameList) {
        callbackNameList.forEach((callbackName, index) => {
          const eventCallback = elementProp[callbackName];
          if (eventCallback) {
            if (index == 0) {
              // capture 到的事件，用unshift
              pathResult.capture.unshift(eventCallback);
            } else {
              // bubble 到的事件，用push
              pathResult.bubble.push(eventCallback);
            }
          }
        });
      }
    }

    targetElement = targetElement.parentNode as DOMElement;
  }

  return pathResult;
}
