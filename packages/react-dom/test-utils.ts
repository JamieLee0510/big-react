import { ReactElementType } from "shared/ReactTypes";
//@ts-ignore
import ReactDOM from "react-dom";

export const renderIntoDocument = (element: ReactElementType) => {
  const div = document.createElement("div");
  // element
  return ReactDOM.createRoot(div).render(element);
};
