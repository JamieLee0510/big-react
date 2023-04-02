// tell if the host environment support Symbol
const supportSymbol = typeof Symbol == "function" && Symbol.for;

export const REACT_ELEMENT_TYPE = supportSymbol
  ? Symbol.for("react.element")
  : 0xeac7;
