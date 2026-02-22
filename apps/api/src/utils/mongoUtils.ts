import mongoose from "mongoose";

export function toObjectId(id: string): mongoose.Types.ObjectId {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(`Invalid ObjectId: ${id}`);
  }
  return new mongoose.Types.ObjectId(id);
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** True if the error means MongoDB does not support transactions (e.g. standalone server). */
export function isTransactionNotSupportedError(e: unknown): boolean {
  const err = e as { code?: number; message?: string };
  return err?.code === 20 || /transaction numbers are only allowed on a replica set|mongos/i.test(String(err?.message ?? ""));
}
