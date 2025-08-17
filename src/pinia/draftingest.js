import { normalizeDrafts } from "../utils/normalizeDrafts";

// Push the draft prop into your Pinia store safely.
export function applyDraftPropToStore(store, rawDrafts) {
  const { list, byId, errors } = normalizeDrafts(rawDrafts);
  store.$patch({
    drafts: list,
    draftsById: byId,
    draftErrors: errors,
    lastDraftIngestedAt: Date.now(),
  });
  return { count: list.length, errors };
}
