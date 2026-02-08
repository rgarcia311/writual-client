/**
 * Minimal 'cors' module declaration for Express middleware.
 */
declare module "cors" {
  import type { RequestHandler } from "express";
  function cors(): RequestHandler;
  export default cors;
}
