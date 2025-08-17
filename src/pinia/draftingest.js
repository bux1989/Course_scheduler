import { normalizeDrafts } from "../utils/normalizeDrafts";

// Call this to push the draft prop into your Pinia store.
// It doesn't assume your store shape—just adds/updates these keys safely:
// - drafts: array of normalized drafts
// - draftsById: map by id
// - draftErrors: normalization errors (if any)
// - lastDraftIngestedAt: timestamp
export function applyDraftPropToStore(store, rawDrafts) {
  const { list, byId, errors } = normalizeDrafts(rawDrafts);
  store.$patch({
    drafts: list,
    draftsById: byId,
    draftErrors: errors,
    lastDraftIngestedAt: Date.now()
  });
  return { count: list.length, errors };
}

// Handy selector example if you need it in components
export function selectDraftsForDay(store, dayId) {
  const d = Number(dayId);
  return (store.drafts || []).filter((x) => x.day_id === d);
}
