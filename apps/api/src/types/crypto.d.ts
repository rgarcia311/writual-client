/**
 * Minimal Node.js 'crypto' module declaration (built-in).
 * No npm install needed - crypto is part of the Node.js runtime.
 */
declare module "crypto" {
  export function randomUUID(): string;
}
