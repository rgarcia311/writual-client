/**
 * Minimal Node.js 'http' module declaration (built-in).
 */
declare module "http" {
  export interface Server {
    listen(
      options: { port: number; host?: string },
      callback?: () => void
    ): this;
  }
  export function createServer(
    requestListener?: (req: unknown, res: unknown) => void
  ): Server;
  export function createServer(app: unknown): Server;
}
