import { computed, watch } from "vue";
import { applyDraftPropToStore } from "./pinia/draftIngest";

// Watches for drafts on props and syncs them to Pinia.
// Supports any of these sources: props.draftSchedules, props.draftSchedule, or props.content.draftSchedules.
export function useDraftProp(props, store) {
  const draftsProp = computed(
    () => props.draftSchedules ?? props.draftSchedule ?? props.content?.draftSchedules ?? []
  );

  watch(
    draftsProp,
    (val) => {
      applyDraftPropToStore(store, val);
    },
    { immediate: true, deep: true }
  );
}
