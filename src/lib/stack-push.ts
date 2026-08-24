import type { EngineAction, EngineState } from "@/engine";
import { getStackPushBlockReason } from "@/engine";
import { toast } from "sonner";

export function tryStackPush(
  state: EngineState,
  dispatch: (action: EngineAction) => void,
  action: Extract<EngineAction, { type: "FILL_COURTS" | "PUSH_TO_COURT" }>,
): boolean {
  const courtIds =
    action.type === "PUSH_TO_COURT" ? [action.courtId] : action.courtIds;
  const blockReason = getStackPushBlockReason(state, { courtIds });
  if (blockReason) {
    toast.error("Stacking issue", { description: blockReason });
    return false;
  }

  dispatch(action);
  return true;
}
