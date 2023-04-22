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

  const arr =
    num % 2 == 0
      ? [<li key="1">1</li>, <li key="2">2</li>, <li key="3">3</li>]
      : [<li key="3">3</li>, <li key="2">2</li>, <li key="1">1</li>];

  return (
    <ul
      onClick={() => {
        setSum((num) => num + 1);
        setSum((num) => num + 1);
        setSum((num) => num + 1);
      }}
    >
      <li>5</li>
      <li>6</li>
      {arr}
    </ul>
  );

  return (
    <div
      onClick={() => {
        setSum(num + 1);
      }}
    >
      {arr}
    </div>
  );
}
function Child() {
  return <span>big react</span>;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />
);
