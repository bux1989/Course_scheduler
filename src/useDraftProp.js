import { computed, watch } from "vue";
import { applyDraftPropToStore } from "./pinia/draftIngest";

// Lightweight wiring: watches the draft schedule prop(s) and syncs them to Pinia.
export function useDraftProp(props, store) {
  // Support both draftSchedules (plural) and draftSchedule (singular) just in case
  const draftsProp = computed(() => props.draftSchedules ?? props.draftSchedule ?? []);

  watch(
    draftsProp,
    (val) => {
      applyDraftPropToStore(store, val);
    },
    { immediate: true, deep: true }
  );
}
