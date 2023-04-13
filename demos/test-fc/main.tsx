import React, { useState } from "react";
import ReactDOM from "react-dom/client";

// const jsx = (
//   <div>
//     <span>hihi</span>
//   </div>
// );

// ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(jsx);

function App() {
  const [num] = useState(100);
  return (
    <div>
      {num}
      {/* <Child /> */}
    </div>
  );
}
function Child() {
  return <span>big react</span>;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />
);
