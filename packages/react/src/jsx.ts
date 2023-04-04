import { REACT_ELEMENT_TYPE } from "shared/ReactSymbols";
import { ReactElementType, Type, Key, Ref, Props } from "shared/ReactTypes";

// 返回一個 ReactElement 的數據結構

const ReactElement = (
  type: Type,
  key: Key,
  ref: Ref,
  props: Props
): ReactElementType => {
  const element = {
    $$typeof: REACT_ELEMENT_TYPE,
    type,
    key,
    ref,
    props,
    __mark: "DingDemo",
  };
  return element;
};

export const jsx = (type: Type, config: any, ...maybeChildren: any) => {
  let key: Key = null;
  const props: Props = {};
  let ref: Ref = null;

  for (const prop in config) {
    const val = config[prop];
    if (prop === "key") {
      if (val !== undefined) {
        key = "" + val;
      }
      continue;
    }
    if (prop === "ref") {
      if (val !== undefined) {
        ref = val;
      }
      continue;
    }
    // 判斷是不是原型的 property
    if ({}.hasOwnProperty.call(config, prop)) {
      props[prop] = val;
    }
  }

  // children 長度判斷
  const maybeChildrenLength = maybeChildren.length;
  if (maybeChildrenLength) {
    if (maybeChildrenLength == 1) {
      props.children = maybeChildren[0];
    } else {
      props.children = maybeChildren;
    }
  }

  return ReactElement(type, key, ref, props);
};

// 實際上，React在dev和prod的環境中，jsx是不同的實現
export const jsxDEV = (type: Type, config: any) => {
  let key: Key = null;
  const props: Props = {};
  let ref: Ref = null;

  for (const prop in config) {
    const val = config[prop];
    if (prop === "key") {
      if (val !== undefined) {
        key = "" + val;
      }
      continue;
    }
    if (prop === "ref") {
      if (val !== undefined) {
        ref = val;
      }
      continue;
    }
    // 判斷是不是原型的 property
    if ({}.hasOwnProperty.call(config, prop)) {
      props[prop] = val;
    }
  }

  return ReactElement(type, key, ref, props);
};
