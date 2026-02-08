/**
 * Minimal Node.js type declarations so the project compiles without
 * depending on node_modules/@types/node (avoids broken pnpm paths).
 */
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: string;
    [key: string]: string | undefined;
  }
  interface Process {
    env: ProcessEnv;
    exit(code?: number): never;
  }
}

declare const process: NodeJS.Process;
declare const __dirname: string;
declare const __filename: string;
declare function require(id: string): unknown;
declare var module: { exports: unknown; require(id: string): unknown };

declare namespace NodeJS {
  interface EventEmitter {
    on(event: string, listener: (...args: unknown[]) => void): this;
  }
}

declare const console: {
  log(message?: unknown, ...optionalParams: unknown[]): void;
  error(message?: unknown, ...optionalParams: unknown[]): void;
  warn(message?: unknown, ...optionalParams: unknown[]): void;
};
