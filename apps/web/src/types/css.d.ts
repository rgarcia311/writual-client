// Plain (non-module) stylesheet imports. Next only ships declarations for `*.module.css`
// and friends, so `import './Screenplay.css'` has no resolvable module for the editor to
// point at — which reads as an unresolved import even though the bundler handles it fine.
declare module "*.css";
declare module "*.scss";
declare module "*.sass";
