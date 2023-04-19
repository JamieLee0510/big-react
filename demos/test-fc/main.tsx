import React, { useState } from "react";
import ReactDOM from "react-dom/client";

// const jsx = (
//   <div>
//     <span>hihi</span>
//   </div>
// );

// ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(jsx);

function App() {
  const [num, setSum] = useState(100);

  return (
    <div
      onClick={() => {
        setSum(num + 1);
      }}
    >
      {num}
    </div>
  );
}
function Child() {
  return <span>big react</span>;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />
);
