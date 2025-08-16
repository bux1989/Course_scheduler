/**
 * Normalized state access composable for scheduler components
 * Provides consistent access to scheduler state across components
 */
import { computed } from 'vue';
import { useSchedulerStore } from '../pinia/scheduler';

export function useSchedulerState() {
    const store = useSchedulerStore();

    // Core state
    const schoolId = computed(() => store.schoolId);
    const draftId = computed(() => store.draftId);
    const publishedBy = computed(() => store.publishedBy);
    const viewMode = computed(() => store.viewMode);
    const isLoading = computed(() => store.isLoading);
    const error = computed(() => store.error);
    const isDraftSaved = computed(() => store.isDraftSaved);

    // Data state
    const periods = computed(() => store.periods);
    const entries = computed(() => store.entries);
    const filteredEntries = computed(() => store.filteredEntries);
    const periodEntries = computed(() => store.periodEntries);
    const adhocEntries = computed(() => store.adhocEntries);

    // Filter state
    const selectedTeacherIds = computed(() => store.selectedTeacherIds);
    const selectedClassId = computed(() => store.selectedClassId);
    const selectedRoomId = computed(() => store.selectedRoomId);

    // Computed derived state
    const isReadOnly = computed(() => !!publishedBy.value);
    const hasEntries = computed(() => entries.value.length > 0);
    const hasFilteredEntries = computed(() => filteredEntries.value.length > 0);
    const isPeriodView = computed(() => viewMode.value === 'period');
    const isTimeView = computed(() => viewMode.value === 'time');

    // Filter utilities
    const hasActiveFilters = computed(() => {
        return selectedTeacherIds.value.length > 0 || 
               selectedClassId.value !== null || 
               selectedRoomId.value !== null;
    });

    const activeFiltersCount = computed(() => {
        let count = 0;
        if (selectedTeacherIds.value.length > 0) count++;
        if (selectedClassId.value !== null) count++;
        if (selectedRoomId.value !== null) count++;
        return count;
    });

    // Actions (direct delegation to store)
    const actions = {
        initialize: store.initialize,
        updateData: store.updateData,
        loadPeriods: store.loadPeriods,
        checkPlacement: store.checkPlacement,
        upsertEntry: store.upsertEntry,
        removeEntry: store.removeEntry,
        persistDraft: store.persistDraft,
        publish: store.publish,
        setViewMode: store.setViewMode,
        toggleTeacher: store.toggleTeacher,
        setSelectedClass: store.setSelectedClass,
        setSelectedRoom: store.setSelectedRoom,
        clearFilters: store.clearFilters,
        toggleMockMode: store.toggleMockMode,
    };

    return {
        // Core state
        schoolId,
        draftId,
        publishedBy,
        viewMode,
        isLoading,
        error,
        isDraftSaved,

        // Data state
        periods,
        entries,
        filteredEntries,
        periodEntries,
        adhocEntries,

        // Filter state
        selectedTeacherIds,
        selectedClassId,
        selectedRoomId,

        // Computed state
        isReadOnly,
        hasEntries,
        hasFilteredEntries,
        isPeriodView,
        isTimeView,
        hasActiveFilters,
        activeFiltersCount,

        // Actions
        ...actions,
    };
}