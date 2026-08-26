/// <reference types="vite/client" />

declare module '*.vert?raw' {
  const value: string;
  export default value;
}

declare module '*.frag?raw' {
  const value: string;
  export default value;
}

declare module '*.glsl?raw' {
  const value: string;
  export default value;
}
