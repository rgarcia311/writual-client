/**
 * Return a plain object so Server Action results can be passed to Client Components.
 * Serializes Mongoose documents (ObjectId, etc.) to plain JSON values so Next.js can pass them to Client Components.
 */
export function toPlainObject(doc: unknown): unknown {
  if (doc == null) return doc;
  let obj: unknown = doc;
  if (typeof (doc as { toObject?: () => object }).toObject === "function") {
    obj = (doc as { toObject: () => object }).toObject();
  }
  return JSON.parse(JSON.stringify(obj));
}
