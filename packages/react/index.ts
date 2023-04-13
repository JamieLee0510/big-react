import currentDispatcher, {
  Dispatcher,
  resolveDispatcher,
} from "./src/currentDispatcher";
import { jsx } from "./src/jsx";

export const useState: Dispatcher["useState"] = (initState) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initState);
};

// 內部hook的數據共享層，主要是為了解耦react和reconciler的hook數據
export const _SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED_ = {
  currentDispatcher,
};

export default {
  version: "0.0.1",
  createElement: jsx,
};
