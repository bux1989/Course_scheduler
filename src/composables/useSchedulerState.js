/**
 * Normalized state access composable for scheduler components
 * Provides consistent access to scheduler state across components
 */
import { computed } from 'vue';
import { useSchedulerStore } from '../pinia/scheduler';

export function useSchedulerState() {
    const store = useSchedulerStore();

    // Core state with safety checks
    const schoolId = computed(() => store?.schoolId || null);
    const draftId = computed(() => store?.draftId || null);
    const publishedBy = computed(() => store?.publishedBy || null);
    const viewMode = computed(() => store?.viewMode || 'period');
    const isLoading = computed(() => store?.isLoading || false);
    const error = computed(() => store?.error || null);
    const isDraftSaved = computed(() => store?.isDraftSaved || true);

    // Data state with safety checks
    const periods = computed(() => store?.periods || []);
    const entries = computed(() => store?.entries || []);
    const filteredEntries = computed(() => store?.filteredEntries || []);
    const periodEntries = computed(() => store?.periodEntries || []);
    const adhocEntries = computed(() => store?.adhocEntries || []);

    // Filter state with safety checks
    const selectedTeacherIds = computed(() => store?.selectedTeacherIds || []);
    const selectedClassId = computed(() => store?.selectedClassId || null);
    const selectedRoomId = computed(() => store?.selectedRoomId || null);

    // Computed derived state with safety checks
    const isReadOnly = computed(() => !!publishedBy.value);
    const hasEntries = computed(() => (entries.value || []).length > 0);
    const hasFilteredEntries = computed(() => (filteredEntries.value || []).length > 0);
    const isPeriodView = computed(() => viewMode.value === 'period');
    const isTimeView = computed(() => viewMode.value === 'time');

    // Filter utilities with safety checks
    const hasActiveFilters = computed(() => {
        const teacherIds = selectedTeacherIds.value || [];
        const classId = selectedClassId.value;
        const roomId = selectedRoomId.value;
        return teacherIds.length > 0 || classId !== null || roomId !== null;
    });

    const activeFiltersCount = computed(() => {
        let count = 0;
        const teacherIds = selectedTeacherIds.value || [];
        const classId = selectedClassId.value;
        const roomId = selectedRoomId.value;
        if (teacherIds.length > 0) count++;
        if (classId !== null) count++;
        if (roomId !== null) count++;
        return count;
    });

    // Actions (direct delegation to store with safety checks)
    const actions = {
        initialize: (...args) => store?.initialize?.(...args),
        updateData: (...args) => store?.updateData?.(...args),
        loadPeriods: (...args) => store?.loadPeriods?.(...args),
        checkPlacement: (...args) => store?.checkPlacement?.(...args),
        upsertEntry: (...args) => store?.upsertEntry?.(...args),
        removeEntry: (...args) => store?.removeEntry?.(...args),
        persistDraft: (...args) => store?.persistDraft?.(...args),
        publish: (...args) => store?.publish?.(...args),
        setViewMode: (...args) => store?.setViewMode?.(...args),
        toggleTeacher: (...args) => store?.toggleTeacher?.(...args),
        setSelectedClass: (...args) => store?.setSelectedClass?.(...args),
        setSelectedRoom: (...args) => store?.setSelectedRoom?.(...args),
        clearFilters: (...args) => store?.clearFilters?.(...args),
        toggleMockMode: (...args) => store?.toggleMockMode?.(...args),
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
