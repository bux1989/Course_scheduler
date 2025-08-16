/**
 * Centralized filter composable for scheduler components
 * Manages all filtering logic in one place
 */
import { ref, computed } from 'vue';
import { useSchedulerStore } from '../pinia/scheduler';

export function useSchedulerFilters() {
    const store = useSchedulerStore();

    // Computed filter state from store
    const selectedTeacherIds = computed(() => store.selectedTeacherIds);
    const selectedClassId = computed(() => store.selectedClassId);
    const selectedRoomId = computed(() => store.selectedRoomId);

    // Filter actions (delegated to store)
    function toggleTeacher(teacherId) {
        store.toggleTeacher(teacherId);
    }

    function setSelectedClass(classId) {
        store.setSelectedClass(classId);
    }

    function setSelectedRoom(roomId) {
        store.setSelectedRoom(roomId);
    }

    function clearFilters() {
        store.clearFilters();
    }

    // Filter utilities
    function isTeacherSelected(teacherId) {
        return selectedTeacherIds.value.includes(teacherId);
    }

    function hasActiveFilters() {
        return selectedTeacherIds.value.length > 0 || 
               selectedClassId.value !== null || 
               selectedRoomId.value !== null;
    }

    function getActiveFiltersCount() {
        let count = 0;
        if (selectedTeacherIds.value.length > 0) count++;
        if (selectedClassId.value !== null) count++;
        if (selectedRoomId.value !== null) count++;
        return count;
    }

    // Entry filtering utilities
    function applyFilters(entries) {
        let filtered = [...entries];

        // Apply teacher filter
        if (selectedTeacherIds.value.length > 0) {
            filtered = filtered.filter(entry => {
                return entry.teacher_ids && entry.teacher_ids.some(id => selectedTeacherIds.value.includes(id));
            });
        }

        // Apply class filter
        if (selectedClassId.value) {
            filtered = filtered.filter(entry => entry.class_id === selectedClassId.value);
        }

        // Apply room filter
        if (selectedRoomId.value) {
            filtered = filtered.filter(entry => entry.room_id === selectedRoomId.value);
        }

        return filtered;
    }

    return {
        // State
        selectedTeacherIds,
        selectedClassId,
        selectedRoomId,

        // Actions
        toggleTeacher,
        setSelectedClass,
        setSelectedRoom,
        clearFilters,

        // Utilities
        isTeacherSelected,
        hasActiveFilters,
        getActiveFiltersCount,
        applyFilters,
    };
}