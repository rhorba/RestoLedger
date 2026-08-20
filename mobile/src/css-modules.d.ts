// Ambient types for CSS module / global CSS imports used by the web target
// (react-native-web) — Metro handles these at build time; TS just needs to know the shape.
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.css';
