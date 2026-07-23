import { createId } from "@paralleldrive/cuid2";

export function newId(): string {
  return createId();
}
