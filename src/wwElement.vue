<template>
    <div class="course-scheduler-wrapper">
        <!-- Header with Planning Mode Controls -->
        <div class="scheduler-header">
            <h2>Course Scheduler</h2>
            <div class="scheduler-controls">
                <div class="mode-indicator" :class="{ 'read-only': isReadOnly }">
                    {{ isReadOnly ? 'Published Schedule (Read-Only)' : 'Planning Mode' }}
                </div>
                <div v-if="!isReadOnly" class="header-actions">
                    <button @click="undo" :disabled="!canUndo" class="undo-btn">↶ Undo</button>
                    <button
                        @click="showConflicts = !showConflicts"
                        class="conflicts-btn"
                        :class="{ active: showConflicts }"
                    >
                        ⚠️ Conflicts ({{ allConflicts.length }})
                    </button>
                </div>
            </div>
        </div>

        <!-- Main Scheduler Grid -->
        <div class="scheduler-content">
            <SchedulerGrid
                :periods="periods"
                :school-days="schoolDays"
                :courses="courses"
                :teachers="teachers"
                :classes="classes"
                :rooms="rooms"
                :draft-schedules="draftSchedules"
                :live-schedules="liveSchedules"
                :conflicts="allConflicts"
                :can-undo="canUndo"
                :is-saving="isSaving"
                :is-read-only="isReadOnly"
                :show-statistics="true"
                @cell-click="handleCellClick"
                @assignment-details="handleAssignmentDetails"
                @toggle-non-instructional="handleToggleNonInstructional"
                @filter-year="handleFilterYear"
                @undo-last="undo"
                @save-draft="saveDraft"
                @update-assignments="updateAssignments"
            />
        </div>

        <!-- Assignment Modal -->
        <AssignmentModal
            :visible="showAssignmentModal"
            :day-id="selectedCell.dayId"
            :period-id="selectedCell.periodId"
            :period="selectedCell.period"
            :courses="availableCoursesForSlot"
            :teachers="teachers"
            :classes="classes"
            :rooms="rooms"
            :school-days="schoolDays"
            :existing-assignments="selectedCell.assignments"
            :conflicts="selectedCell.conflicts"
            :is-read-only="isReadOnly"
            @close="closeAssignmentModal"
            @add-assignment="addAssignment"
            @edit-assignment="editAssignment"
            @remove-assignment="removeAssignment"
        />

        <!-- Conflict Panel -->
        <div v-if="showConflicts && allConflicts.length > 0" class="conflicts-sidebar">
            <ConflictPanel
                :visible="showConflicts"
                :conflicts="allConflicts"
                :courses="courses"
                :teachers="teachers"
                :classes="classes"
                :rooms="rooms"
                :periods="periods"
                :school-days="schoolDays"
                @close="showConflicts = false"
                @navigate-to-conflict="navigateToConflict"
                @apply-suggestion="applySuggestion"
                @ignore-conflict="ignoreConflict"
                @auto-resolve-all="autoResolveConflicts"
            />
        </div>

        <!-- Hidden test section for development -->
        <div v-if="showTestData" class="test-data-section">
            <button @click="showTestData = false" class="close-test">×</button>
            <h3>Component Test Data</h3>
            <div class="test-info">
                <div><strong>School ID:</strong> {{ schoolId }}</div>
                <div><strong>Draft ID:</strong> {{ draftId }}</div>
                <div><strong>Published By:</strong> {{ publishedBy || 'Not Published' }}</div>
                <div>
                    <strong>Data Counts:</strong> {{ periods.length }} periods, {{ courses.length }} courses,
                    {{ teachers.length }} teachers
                </div>
                <button @click="emitTestEvent" class="test-button">Test Event Emission</button>
            </div>
        </div>

        <!-- Show test data toggle -->
        <button @click="showTestData = !showTestData" class="test-toggle" title="Toggle test data">🧪</button>
    </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue';
import SchedulerGrid from './components/scheduler/SchedulerGrid.vue';
import AssignmentModal from './components/scheduler/AssignmentModal.vue';
import ConflictPanel from './components/scheduler/ConflictPanel.vue';

export default {
    name: 'CourseScheduler',
    components: {
        SchedulerGrid,
        AssignmentModal,
        ConflictPanel,
    },
    props: {
        content: {
            type: Object,
            required: true,
            default: () => ({
                schoolId: null,
                draftId: null,
                publishedBy: null,
                periods: [],
                courses: [],
                teachers: [],
                classes: [],
                rooms: [],
                schoolDays: [],
                draftSchedules: [],
                liveSchedules: [],
            }),
        },
        wwElementState: { type: Object, required: true },
        /* wwEditor:start */
        wwEditorState: { type: Object, required: true },
        /* wwEditor:end */
    },
    setup(props, { emit }) {
        // Local state
        const showAssignmentModal = ref(false);
        const showConflicts = ref(false);
        const showTestData = ref(false);
        const isSaving = ref(false);

        // Undo system
        const undoStack = ref([]);
        const maxUndoSteps = 10;

        // Selected cell for modal
        const selectedCell = ref({
            dayId: null,
            periodId: null,
            period: null,
            assignments: [],
            conflicts: [],
        });

        // Computed properties for data access
        const schoolId = computed(() => props.content.schoolId || 'No School ID');
        const draftId = computed(() => props.content.draftId || 'No Draft ID');
        const publishedBy = computed(() => props.content.publishedBy || null);
        const periods = computed(() => props.content.periods || []);
        const courses = computed(() => props.content.courses || []);
        const teachers = computed(() => props.content.teachers || []);
        const classes = computed(() => props.content.classes || []);
        const rooms = computed(() => props.content.rooms || []);
        const schoolDays = computed(() => props.content.schoolDays || []);
        const draftSchedules = computed(() => props.content.draftSchedules || []);
        const liveSchedules = computed(() => props.content.liveSchedules || []);

        // Computed state
        const isReadOnly = computed(() => !!publishedBy.value);
        const canUndo = computed(() => undoStack.value.length > 0);

        // Conflict detection
        const allConflicts = computed(() => {
            return detectConflicts(draftSchedules.value);
        });

        // Available courses for selected slot
        const availableCoursesForSlot = computed(() => {
            if (!selectedCell.value.dayId || !selectedCell.value.periodId) {
                return courses.value;
            }

            // Filter courses based on possible_time_slots
            return courses.value.filter(course => {
                // If no restrictions, course is available
                if (!course.possible_time_slots?.length) return true;

                // Check if current slot is in possible slots
                return course.possible_time_slots.some(
                    slot => slot.day_id === selectedCell.value.dayId && slot.period_id === selectedCell.value.periodId
                );
            });
        });

        // Methods
        function detectConflicts(schedules) {
            const conflicts = [];
            const conflictId = Date.now();

            // Group by day and period
            const slotMap = new Map();
            schedules.forEach((assignment, index) => {
                const key = `${assignment.day_id}-${assignment.period_id}`;
                if (!slotMap.has(key)) {
                    slotMap.set(key, []);
                }
                slotMap.get(key).push({ ...assignment, index });
            });

            // Check each slot for conflicts
            slotMap.forEach((assignments, slotKey) => {
                if (assignments.length < 2) return;

                const [dayId, periodId] = slotKey.split('-').map(Number);

                // Teacher conflicts
                const teacherMap = new Map();
                assignments.forEach(assignment => {
                    assignment.teacher_ids?.forEach(teacherId => {
                        if (!teacherMap.has(teacherId)) {
                            teacherMap.set(teacherId, []);
                        }
                        teacherMap.get(teacherId).push(assignment);
                    });
                });

                teacherMap.forEach((teacherAssignments, teacherId) => {
                    if (teacherAssignments.length > 1) {
                        conflicts.push({
                            id: `${conflictId}-teacher-${teacherId}-${slotKey}`,
                            type: 'teacher',
                            severity: 'high',
                            day_id: dayId,
                            period_id: periodId,
                            affected_teachers: [teacherId],
                            affected_courses: teacherAssignments.map(a => a.course_id),
                            message: `Teacher is assigned to ${teacherAssignments.length} courses at the same time`,
                            auto_resolvable: false,
                        });
                    }
                });

                // Room conflicts
                const roomMap = new Map();
                assignments.forEach(assignment => {
                    if (assignment.room_id) {
                        if (!roomMap.has(assignment.room_id)) {
                            roomMap.set(assignment.room_id, []);
                        }
                        roomMap.get(assignment.room_id).push(assignment);
                    }
                });

                roomMap.forEach((roomAssignments, roomId) => {
                    if (roomAssignments.length > 1) {
                        conflicts.push({
                            id: `${conflictId}-room-${roomId}-${slotKey}`,
                            type: 'room',
                            severity: 'high',
                            day_id: dayId,
                            period_id: periodId,
                            affected_rooms: [roomId],
                            affected_courses: roomAssignments.map(a => a.course_id),
                            message: `Room is booked for ${roomAssignments.length} courses at the same time`,
                            auto_resolvable: true,
                        });
                    }
                });

                // Class conflicts
                const classMap = new Map();
                assignments.forEach(assignment => {
                    if (assignment.class_id) {
                        if (!classMap.has(assignment.class_id)) {
                            classMap.set(assignment.class_id, []);
                        }
                        classMap.get(assignment.class_id).push(assignment);
                    }
                });

                classMap.forEach((classAssignments, classId) => {
                    if (classAssignments.length > 1) {
                        conflicts.push({
                            id: `${conflictId}-class-${classId}-${slotKey}`,
                            type: 'class',
                            severity: 'medium',
                            day_id: dayId,
                            period_id: periodId,
                            affected_classes: [classId],
                            affected_courses: classAssignments.map(a => a.course_id),
                            message: `Class has ${classAssignments.length} overlapping assignments`,
                            auto_resolvable: false,
                        });
                    }
                });
            });

            return conflicts;
        }

        function saveToUndoStack() {
            const currentState = JSON.stringify(draftSchedules.value);
            undoStack.value.push(currentState);

            if (undoStack.value.length > maxUndoSteps) {
                undoStack.value.shift();
            }
        }

        function handleCellClick({ dayId, periodId, period, mode }) {
            if (isReadOnly.value) return;

            // Get existing assignments for this cell
            const assignments = draftSchedules.value.filter(
                assignment => assignment.day_id === dayId && assignment.period_id === periodId
            );

            // Get conflicts for this cell
            const conflicts = allConflicts.value.filter(
                conflict => conflict.day_id === dayId && conflict.period_id === periodId
            );

            selectedCell.value = {
                dayId,
                periodId,
                period,
                assignments,
                conflicts,
            };

            showAssignmentModal.value = true;
        }

        function closeAssignmentModal() {
            showAssignmentModal.value = false;
            selectedCell.value = {
                dayId: null,
                periodId: null,
                period: null,
                assignments: [],
                conflicts: [],
            };
        }

        function addAssignment(newAssignment) {
            saveToUndoStack();

            const updatedSchedules = [...draftSchedules.value, newAssignment];
            updateDraftSchedules(updatedSchedules);
            closeAssignmentModal();
        }

        function editAssignment(assignment) {
            // For editing, we'll close the modal and emit an event
            // This could open a separate edit form
            closeAssignmentModal();
            emit('edit-assignment-requested', assignment);
        }

        function removeAssignment(assignmentToRemove) {
            saveToUndoStack();

            const updatedSchedules = draftSchedules.value.filter(
                assignment =>
                    !(
                        assignment.day_id === assignmentToRemove.day_id &&
                        assignment.period_id === assignmentToRemove.period_id &&
                        assignment.course_id === assignmentToRemove.course_id &&
                        assignment.class_id === assignmentToRemove.class_id
                    )
            );
            updateDraftSchedules(updatedSchedules);
        }

        function updateDraftSchedules(newSchedules) {
            emit('trigger-event', {
                name: 'updateDraftSchedules',
                event: { draftSchedules: newSchedules },
            });
        }

        function undo() {
            if (undoStack.value.length === 0) return;

            const previousState = undoStack.value.pop();
            const previousSchedules = JSON.parse(previousState);
            updateDraftSchedules(previousSchedules);
        }

        async function saveDraft() {
            isSaving.value = true;
            try {
                emit('trigger-event', {
                    name: 'saveDraft',
                    event: {
                        draftId: draftId.value,
                        schedules: draftSchedules.value,
                    },
                });

                // Simulate save delay
                await new Promise(resolve => setTimeout(resolve, 1000));
            } finally {
                isSaving.value = false;
            }
        }

        function handleAssignmentDetails(assignment) {
            // Open assignment details or edit mode
            emit('trigger-event', {
                name: 'assignmentDetails',
                event: { assignment },
            });
        }

        function handleToggleNonInstructional(show) {
            emit('trigger-event', {
                name: 'toggleNonInstructional',
                event: { showNonInstructional: show },
            });
        }

        function handleFilterYear(year) {
            emit('trigger-event', {
                name: 'filterYear',
                event: { selectedYear: year },
            });
        }

        function updateAssignments(assignments) {
            updateDraftSchedules(assignments);
        }

        function navigateToConflict(conflict) {
            // Navigate to the conflict location in the grid
            selectedCell.value = {
                dayId: conflict.day_id,
                periodId: conflict.period_id,
                period: periods.value.find(p => p.id === conflict.period_id),
                assignments: draftSchedules.value.filter(
                    a => a.day_id === conflict.day_id && a.period_id === conflict.period_id
                ),
                conflicts: [conflict],
            };
            showAssignmentModal.value = true;
            showConflicts.value = false;
        }

        function applySuggestion(suggestion) {
            // Apply suggested conflict resolution
            emit('trigger-event', {
                name: 'applySuggestion',
                event: { suggestion },
            });
        }

        function ignoreConflict(conflict) {
            // Mark conflict as ignored
            emit('trigger-event', {
                name: 'ignoreConflict',
                event: { conflictId: conflict.id },
            });
        }

        function autoResolveConflicts() {
            // Attempt to auto-resolve conflicts
            emit('trigger-event', {
                name: 'autoResolveConflicts',
                event: { conflicts: allConflicts.value.filter(c => c.auto_resolvable) },
            });
        }

        function emitTestEvent() {
            try {
                emit('trigger-event', {
                    name: 'testEvent',
                    event: {
                        message: 'Comprehensive Course Scheduler is working!',
                        timestamp: new Date().toISOString(),
                        data: {
                            periods: periods.value.length,
                            courses: courses.value.length,
                            teachers: teachers.value.length,
                            classes: classes.value.length,
                            rooms: rooms.value.length,
                            draftSchedules: draftSchedules.value.length,
                            conflicts: allConflicts.value.length,
                            isReadOnly: isReadOnly.value,
                        },
                    },
                });
                alert('Test event emitted successfully!');
            } catch (error) {
                console.error('Error emitting event:', error);
                alert('Error emitting event: ' + error.message);
            }
        }

        // Auto-save functionality
        let saveTimeout;
        watch(
            draftSchedules,
            () => {
                if (isReadOnly.value) return;

                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                    saveDraft();
                }, 2000); // Auto-save after 2 seconds of no changes
            },
            { deep: true }
        );

        return {
            // Data
            schoolId,
            draftId,
            publishedBy,
            periods,
            courses,
            teachers,
            classes,
            rooms,
            schoolDays,
            draftSchedules,
            liveSchedules,

            // State
            showAssignmentModal,
            showConflicts,
            showTestData,
            selectedCell,
            isSaving,

            // Computed
            isReadOnly,
            canUndo,
            allConflicts,
            availableCoursesForSlot,

            // Methods
            handleCellClick,
            closeAssignmentModal,
            addAssignment,
            editAssignment,
            removeAssignment,
            updateAssignments,
            undo,
            saveDraft,
            handleAssignmentDetails,
            handleToggleNonInstructional,
            handleFilterYear,
            navigateToConflict,
            applySuggestion,
            ignoreConflict,
            autoResolveConflicts,
            emitTestEvent,
        };
    },
};
</script>

<style lang="scss" scoped>
.course-scheduler-wrapper {
    width: 100%;
    min-height: 500px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    position: relative;
}

.scheduler-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: #f8f9fa;
    border-bottom: 1px solid #e0e0e0;
    border-radius: 6px 6px 0 0;

    h2 {
        margin: 0;
        color: #333;
        font-size: 1.3em;
    }

    .scheduler-controls {
        display: flex;
        align-items: center;
        gap: 16px;
    }

    .mode-indicator {
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 0.9em;
        font-weight: 500;
        background: #e6f7ff;
        color: #1890ff;

        &.read-only {
            background: #fff2f0;
            color: #ff4d4f;
        }
    }

    .header-actions {
        display: flex;
        gap: 8px;
    }

    .undo-btn,
    .conflicts-btn {
        padding: 6px 12px;
        border: 1px solid #d9d9d9;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        font-size: 0.9em;
        transition: all 0.2s;

        &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        &:hover:not(:disabled) {
            background: #f0f0f0;
            transform: translateY(-1px);
        }
    }

    .conflicts-btn {
        &.active {
            background: #ff4d4f;
            color: white;
            border-color: #ff4d4f;
        }
    }
}

.scheduler-content {
    display: flex;
    gap: 16px;
    position: relative;
}

.conflicts-sidebar {
    width: 400px;
    position: sticky;
    top: 20px;
    height: fit-content;
}

.test-data-section {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 2000;
    min-width: 400px;
}

.close-test {
    position: absolute;
    top: 8px;
    right: 12px;
    background: none;
    border: none;
    font-size: 1.2em;
    cursor: pointer;
    color: #999;
}

.test-info {
    margin-top: 16px;
}

.test-info > div {
    margin-bottom: 8px;
    font-size: 0.9em;
}

.test-button {
    margin-top: 12px;
    padding: 8px 16px;
    background: #007cba;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.test-toggle {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    background: #007cba;
    color: white;
    font-size: 1.2em;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    transition: all 0.2s;

    &:hover {
        transform: scale(1.1);
    }
}

/* Responsive Design */
@media (max-width: 1200px) {
    .conflicts-sidebar {
        width: 350px;
    }
}

@media (max-width: 900px) {
    .scheduler-content {
        flex-direction: column;
    }

    .conflicts-sidebar {
        width: 100%;
        position: relative;
        top: auto;
    }

    .scheduler-header {
        flex-direction: column;
        gap: 12px;
        align-items: stretch;

        .scheduler-controls {
            justify-content: space-between;
        }

        .header-actions {
            justify-content: center;
        }
    }
}

@media (max-width: 600px) {
    .course-scheduler-wrapper {
        font-size: 0.9em;
    }

    .test-data-section {
        width: 90vw;
        min-width: unset;
    }

    .test-toggle {
        bottom: 10px;
        right: 10px;
        width: 35px;
        height: 35px;
        font-size: 1em;
    }
}

/* Accessibility improvements */
@media (prefers-reduced-motion: reduce) {
    * {
        transition-duration: 0.01ms !important;
        animation-duration: 0.01ms !important;
    }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
    .scheduler-header,
    .mode-indicator,
    .undo-btn,
    .conflicts-btn {
        border-width: 2px;
    }
}

/* Print styles */
@media print {
    .test-toggle,
    .header-actions,
    .conflicts-sidebar {
        display: none !important;
    }

    .scheduler-header .mode-indicator.read-only::after {
        content: ' (Read-Only)';
    }
}
</style>
