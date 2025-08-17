<template>
    <div class="course-scheduler-wrapper">
        <!-- Header with Planning Mode Controls -->
        <div class="scheduler-header">
            <h2>Course Scheduler</h2>
            <div class="scheduler-controls">
                <div class="mode-indicator" :class="{ 'read-only': isReadOnly }">
                    {{ isReadOnly ? 'Published Schedule (Read-Only) - Event Testing Available' : 'Planning Mode' }}
                </div>
                <div class="header-actions">
                    <!-- Always show test button for WeWeb event testing -->
                    <button
                        @click="testEventEmission"
                        class="test-btn"
                        style="
                            background: #007bff;
                            color: white;
                            border: none;
                            padding: 8px 12px;
                            border-radius: 4px;
                            margin-right: 8px;
                        "
                        title="Test WeWeb events (always available)"
                    >
                        🧪 Test Event
                    </button>
                    <!-- Only show editing controls when not read-only -->
                    <div v-if="!isReadOnly" class="editing-controls">
                        <button @click="undo" :disabled="!canUndo" class="undo-btn">↶ Undo</button>
                        <button
                            @click="showConflicts = !showConflicts"
                            class="conflicts-btn"
                            :class="{ active: showConflicts }"
                        >
                            ⚠️ Conflicts ({{ safeLength(allConflicts) }})
                        </button>
                    </div>
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
                :subjects="subjects"
                :draft-schedules="draftSchedules"
                :live-schedules="liveSchedules"
                :conflicts="allConflicts"
                :can-undo="canUndo"
                :is-saving="isSaving"
                :is-read-only="isReadOnly"
                :show-statistics="true"
                :parent-emit="$emit"
                :emit-drop-events="true"
                @cell-click="handleCellClick"
                @assignment-details="handleAssignmentDetails"
                @course-edit="handleCourseEdit"
                @toggle-non-instructional="handleToggleNonInstructional"
                @toggle-lesson-schedules="handleToggleLessonSchedules"
                @period-focus-changed="handlePeriodFocusChanged"
                @filter-year="handleFilterYear"
                @scheduler-drop="handleSchedulerDrop"
                @scheduler-drag-start="handleSchedulerDragStart"
                @scheduler-drag-end="handleSchedulerDragEnd"
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
            :subjects="subjects"
            :school-days="schoolDays"
            :existing-assignments="selectedCell.assignments"
            :conflicts="selectedCell.conflicts"
            :is-read-only="isReadOnly"
            :pre-selected-course="selectedCell.preSelectedCourse"
            @close="closeAssignmentModal"
            @add-assignment="addAssignment"
            @edit-assignment="editAssignment"
            @remove-assignment="removeAssignment"
        />

        <!-- Conflict Panel -->
        <div v-if="showConflicts && safeLength(allConflicts) > 0" class="conflicts-sidebar">
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
                <div><strong>Read Only:</strong> {{ isReadOnly ? 'Yes' : 'No' }}</div>
                <div>
                    <strong>Data Counts:</strong> {{ safeLength(periods) }} periods, {{ safeLength(courses) }} courses,
                    {{ safeLength(teachers) }} teachers
                </div>
                <button @click="emitTestEvent" class="test-button">Test Event Emission</button>
            </div>
        </div>

        <!-- Show test data toggle -->
        <button @click="showTestData = !showTestData" class="test-toggle" title="Toggle test data">🧪</button>

        <!-- Debug data button -->
        <button @click="logCurrentData" class="debug-toggle" title="Log current data to console">🐛</button>
    </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue';
import SchedulerGrid from './components/scheduler/SchedulerGrid.vue';
import AssignmentModal from './components/scheduler/AssignmentModal.vue';
import ConflictPanel from './components/scheduler/ConflictPanel.vue';

// NOTE: We avoid importing a conflicting safeLength. We define a local one below.
import {
    // validateAndUnwrapArray, // not used currently
    // safeLength,            // DO NOT import; we define local to avoid "not a function"
    // safeArray,             // not used currently
    toArray,
    // len,                   // not used currently
    nonEmpty,
    normalizePeriods,
    normalizeCourse,
} from './utils/arrayUtils.js';

import { emitSchedulerRemoveEvent } from './utils/events.js';
import { detectConflicts } from './utils/conflictDetection.js';
import { useSchedulerStore } from './state/schedulerState';

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
                periods: [],
                courses: [],
                teachers: [],
                classes: [],
                rooms: [],
                schoolDays: [],
                draftSchedules: [],
                liveSchedules: [],
                subjects: [],
                emitDropEvents: false,
            }),
        },
        // Accept draft schedules directly via prop(s)
        draftSchedules: { type: [Array, Object], default: () => [] },
        draftSchedule: { type: [Array, Object], default: () => [] },

        wwElementState: { type: Object, required: true },
        /* wwEditor:start */
        wwEditorState: { type: Object, required: true },
        /* wwEditor:end */
    },
    setup(props, { emit }) {
        // Local helpers (avoid external mismatch)
        const safeLength = v => (Array.isArray(v) ? v.length : 0);

        // Optional debug logger to prevent ReferenceError
        function logCurrentData() {
            try {
                console.log('[wwElement] Debug data snapshot:', {
                    counts: {
                        periods: safeLength(periods.value),
                        courses: safeLength(courses.value),
                        teachers: safeLength(teachers.value),
                        classes: safeLength(classes.value),
                        rooms: safeLength(rooms.value),
                        subjects: safeLength(subjects.value),
                        schoolDays: safeLength(schoolDays.value),
                        draftSchedules: safeLength(draftSchedules.value),
                        liveSchedules: safeLength(liveSchedules.value),
                        conflicts: safeLength(allConflicts.value),
                    },
                    sampleDraft: draftSchedules.value?.[0] || null,
                });
            } catch (e) {
                console.warn('logCurrentData error:', e);
            }
        }

        // Initialize scheduler store
        const store = useSchedulerStore();

        // Initialize store with component data (periods + initial drafts)
        watch(
            () => props.content,
            newContent => {
                if (newContent && store.initialize) {
                    store.initialize(null, null, null, {
                        periods: toArray(newContent.periods),
                        // For initial store state; component uses computed draftSchedules below
                        draftSchedules: toArray(newContent.draftSchedules),
                    });
                }
            },
            { immediate: true, deep: true }
        );

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
            preSelectedCourse: null,
        });

        // Safe array computed properties
        const periods = computed(() => {
            const rawPeriodsData = props.content.periods;
            const normalized = normalizePeriods(rawPeriodsData);
            if (!nonEmpty(normalized)) {
                console.log('📋 [Periods] No periods data available');
                return [];
            }
            return normalized;
        });

        const courses = computed(() => {
            const rawCourses = props.content.courses;
            const arr = toArray(rawCourses);
            if (!nonEmpty(arr)) {
                console.log('🎯 [wwElement] Courses processing: no data available');
            }
            return arr.map((course, idx) => normalizeCourse(course, idx));
        });

        const teachers = computed(() => toArray(props.content.teachers || []));
        const classes = computed(() => toArray(props.content.classes || []));
        const rooms = computed(() => toArray(props.content.rooms || []));

        const schoolDays = computed(() => {
            const validatedDays = toArray(props.content.schoolDays || []);
            if (!nonEmpty(validatedDays)) {
                console.log('📅 [wwElement] SchoolDays processing: no data available');
                return [];
            }

            const defaultDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

            return validatedDays.map((day, index) => {
                const dayName = day.name || day.name_en || day.day_name || defaultDayNames[index] || `Day ${index + 1}`;
                return {
                    ...day,
                    id: day.day_id || day.id,
                    name: dayName,
                    date: day.date || day.day_date || null,
                    is_active: day.is_active !== undefined ? day.is_active : true,
                    day_number: day.day_number || index + 1,
                    day_id: day.day_id || day.id,
                };
            });
        });

        // Prefer draftSchedules/draftSchedule props; fallback to content.draftSchedules; normalize + dedupe
        const draftSchedules = computed(() => {
            const propDraftsA = toArray(props.draftSchedules);
            const propDraftsB = toArray(props.draftSchedule);
            const fromProp = nonEmpty(propDraftsA) ? propDraftsA : propDraftsB;
            const source = nonEmpty(fromProp) ? fromProp : toArray(props.content.draftSchedules);

            const normalized = source
                .filter(v => v && typeof v === 'object')
                .map(n => {
                    const fallbackId = `${n.class_id ?? ''}:${n.day_id ?? ''}:${n.period_id ?? ''}`;
                    const id = String(n.id ?? fallbackId);

                    return {
                        ...n,
                        id,
                        isDraft: n.isDraft === false ? false : true,
                        day_id: Number(n.day_id ?? 0),
                        period_id: String(n.period_id ?? ''),
                        room_id: n.room_id != null ? String(n.room_id) : n.room_id ?? null,
                        class_id: n.class_id != null ? String(n.class_id) : n.class_id ?? null,
                        subject_id: n.subject_id != null ? String(n.subject_id) : n.subject_id ?? null,
                        staff_ids: Array.isArray(n.staff_ids)
                            ? n.staff_ids.filter(s => typeof s === 'string' && s)
                            : [],
                        teacher_names: Array.isArray(n.teacher_names)
                            ? n.teacher_names.filter(s => typeof s === 'string')
                            : [],
                        room_name: typeof n.room_name === 'string' ? n.room_name : '',
                        class_name: typeof n.class_name === 'string' ? n.class_name : '',
                        course_name: typeof n.course_name === 'string' ? n.course_name : '',
                        subject_name: typeof n.subject_name === 'string' ? n.subject_name : '',
                        day_name_de: typeof n.day_name_de === 'string' ? n.day_name_de : '',
                        day_name_en: typeof n.day_name_en === 'string' ? n.day_name_en : '',
                        display_cell: typeof n.display_cell === 'string' ? n.display_cell : '',
                        scheduled_room_name: typeof n.scheduled_room_name === 'string' ? n.scheduled_room_name : '',
                        subject_color: n.subject_color ?? null,
                        subject_icon_id: n.subject_icon_id ?? null,
                        class_grade_level:
                            typeof n.class_grade_level === 'number'
                                ? n.class_grade_level
                                : n.class_grade_level ?? null,
                        currentlyScheduled: n.currentlyScheduled === true,
                    };
                });

            // Deduplicate by id (last one wins)
            const byId = new Map();
            for (const item of normalized) byId.set(item.id, item);
            const out = Array.from(byId.values());

            if (!nonEmpty(out)) {
                console.log('📝 [wwElement] Draft Schedules processing: no data available');
            }

            return out;
        });

        const liveSchedules = computed(() => toArray(props.content.liveSchedules || []));
        const subjects = computed(() => toArray(props.content.subjects || []));

        // Computed state
        const isReadOnly = computed(() => false); // always editable here
        const canUndo = computed(() => safeLength(undoStack.value) > 0);

        // Conflict detection
        const allConflicts = computed(() => detectConflicts(draftSchedules.value));

        // Available courses for selected slot
        const availableCoursesForSlot = computed(() => {
            if (!selectedCell.value.dayId || !selectedCell.value.periodId) {
                return courses.value;
            }
            const currentDayId = selectedCell.value.dayId;
            const currentPeriodId = selectedCell.value.periodId;

            const filteredCourses = courses.value.filter(course => {
                if (safeLength(course.possibleSlots) === 0) return true;
                return course.possibleSlots.some(slot => slot.dayId === currentDayId && slot.periodId === currentPeriodId);
            });

            return filteredCourses;
        });

        // Methods
        function saveToUndoStack() {
            const currentState = JSON.stringify(draftSchedules.value);
            undoStack.value.push(currentState);
            if (safeLength(undoStack.value) > maxUndoSteps) {
                undoStack.value.shift();
            }
        }

        function handleCellClick({ dayId, periodId, period, mode, preSelectedCourse }) {
            if (isReadOnly.value) return;

            const assignments = draftSchedules.value.filter(
                assignment => assignment.day_id === dayId && assignment.period_id === periodId
            );

            const conflicts = allConflicts.value.filter(
                conflict => conflict.day_id === dayId && conflict.period_id === periodId
            );

            selectedCell.value = {
                dayId,
                periodId,
                period,
                assignments,
                conflicts,
                preSelectedCourse,
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
                preSelectedCourse: null,
            };
        }

        function addAssignment(newAssignment) {
            saveToUndoStack();
            const updatedSchedules = [...draftSchedules.value, newAssignment];
            updateDraftSchedules(updatedSchedules);
            closeAssignmentModal();
        }

        function editAssignment(assignment) {
            closeAssignmentModal();
            emit('edit-assignment-requested', assignment);
        }

        function removeAssignment(assignmentToRemove) {
            saveToUndoStack();

            if (props.content.emitDropEvents) {
                emitSchedulerRemoveEvent(emit, {
                    dayId: assignmentToRemove.day_id,
                    periodId: assignmentToRemove.period_id,
                    assignmentId: assignmentToRemove.id,
                    courseId: assignmentToRemove.course_id,
                    courseName: assignmentToRemove.course_name || assignmentToRemove.display_cell || '',
                });
            }

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
            if (safeLength(undoStack.value) === 0) return;
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
                        schedules: draftSchedules.value,
                        timestamp: new Date().toISOString(),
                        action: 'save_draft',
                    },
                });

                emit('save-draft-external', {
                    schedules: draftSchedules.value,
                    timestamp: new Date().toISOString(),
                });

                await new Promise(resolve => setTimeout(resolve, 500));
                console.log('💾 [wwElement] Draft saved successfully');
            } catch (error) {
                console.error('❌ [wwElement] Error saving draft:', error);
            } finally {
                isSaving.value = false;
            }
        }

        function handleAssignmentDetails(assignment) {
            emit('trigger-event', {
                name: 'scheduler:assignment-details',
                event: {
                    assignment,
                    courseId: assignment.course_id || '',
                    courseName: assignment.course_name || assignment.display_cell || '',
                    courseCode: assignment.course_code || '',
                    teacherIds: assignment.teacher_ids || [],
                    roomId: assignment.room_id || null,
                    dayId: assignment.day_id || 0,
                    periodId: assignment.period_id || '',
                    timestamp: new Date().toISOString(),
                },
            });
        }

        function handleCourseEdit(courseData) {
            emit('trigger-event', {
                name: 'scheduler:course-edit',
                event: {
                    courseId: courseData.courseId || '',
                    courseName: courseData.courseName || '',
                    courseCode: courseData.courseCode || '',
                    source: courseData.source || 'inline-editor',
                    timestamp: new Date().toISOString(),
                },
            });
        }

        function handleToggleNonInstructional(show) {
            emit('trigger-event', {
                name: 'toggleNonInstructional',
                event: { showNonInstructional: show },
            });
        }

        function handleToggleLessonSchedules(show) {
            emit('trigger-event', {
                name: 'toggleLessonSchedules',
                event: { showLessonSchedules: show },
            });
        }

        function handlePeriodFocusChanged(periodId) {
            emit('trigger-event', {
                name: 'periodFocusChanged',
                event: { focusedPeriodId: periodId },
            });
        }

        function handleFilterYear(year) {
            emit('trigger-event', {
                name: 'filterYear',
                event: { selectedYear: year },
            });
        }

        // WeWeb Element Event Handlers
        function handleSchedulerDrop(eventData) {
            const safeEventData = {
                dayId: eventData?.dayId || 0,
                periodId: eventData?.periodId || '',
                courseId: eventData?.courseId || '',
                courseName: eventData?.courseName || '',
                courseCode: eventData?.courseCode || '',
                teacherIds: Array.isArray(eventData?.teacherIds) ? eventData.teacherIds : [],
                primaryTeacherId: eventData?.primaryTeacherId || null,
                roomId: eventData?.roomId || null,
                source: eventData?.source || 'drag-drop',
                timestamp: eventData?.timestamp || new Date().toISOString(),
                ...(eventData?.fromDayId !== undefined && { fromDayId: eventData.fromDayId }),
                ...(eventData?.fromPeriodId !== undefined && { fromPeriodId: eventData.fromPeriodId }),
                ...(eventData?.action !== undefined && { action: eventData.action }),
            };

            try {
                emit('trigger-event', {
                    name: 'scheduler:drop',
                    event: safeEventData,
                });
            } catch (error) {
                console.error('❌ [WeWeb Event] scheduler:drop emission failed:', error);
            }
        }

        function handleSchedulerDragStart(eventData) {
            const safeEventData = {
                courseId: eventData?.courseId || '',
                courseName: eventData?.courseName || '',
                courseCode: eventData?.courseCode || '',
                source: eventData?.source || 'drag-start',
                timestamp: eventData?.timestamp || new Date().toISOString(),
            };

            try {
                emit('trigger-event', {
                    name: 'scheduler:drag-start',
                    event: safeEventData,
                });
            } catch (error) {
                console.error('❌ [WeWeb Event] scheduler:drag-start emission failed:', error);
            }
        }

        function handleSchedulerDragEnd(eventData) {
            const safeEventData = {
                courseId: eventData?.courseId || '',
                courseName: eventData?.courseName || '',
                courseCode: eventData?.courseCode || '',
                success: eventData?.success !== undefined ? eventData.success : false,
                source: eventData?.source || 'drag-end',
                timestamp: eventData?.timestamp || new Date().toISOString(),
            };

            try {
                emit('trigger-event', {
                    name: 'scheduler:drag-end',
                    event: safeEventData,
                });
            } catch (error) {
                console.error('❌ [WeWeb Event] scheduler:drag-end emission failed:', error);
            }
        }

        // Test function for manual event emission debugging
        function testEventEmission() {
            const testData = {
                dayId: 1,
                periodId: 'test-period-id',
                courseId: 'test-course-id',
                courseName: 'Test Course',
                courseCode: 'TEST101',
                source: 'manual-test',
                timestamp: new Date().toISOString(),
            };

            try {
                emit('trigger-event', {
                    name: 'scheduler:drop',
                    event: testData,
                });
                console.log('✅ [WeWeb Event Test] scheduler:drop emitted');
            } catch (error) {
                console.error('❌ [WeWeb Event Test] scheduler:drop test failed:', error);
            }
        }

        function updateAssignments(payload) {
            if (payload.action === 'move' && payload.assignment) {
                const updatedSchedules = [...draftSchedules.value];
                const idx = updatedSchedules.findIndex(a => a.id === payload.assignment.id);

                if (idx !== -1) {
                    const updatedAssignment = {
                        ...updatedSchedules[idx],
                        day_id: payload.toDayId,
                        period_id: payload.toPeriodId,
                        day_name_de: schoolDays.value.find(d => d.id === payload.toDayId)?.name_de,
                        day_name_en: schoolDays.value.find(d => d.id === payload.toDayId)?.name_en,
                    };

                    updatedSchedules[idx] = updatedAssignment;
                    undoStack.value.push(JSON.stringify(draftSchedules.value));
                    updateDraftSchedules(updatedSchedules);
                } else {
                    console.warn('⚠️ [DragDrop] Could not find assignment to move:', payload.assignment.id);
                }
            } else {
                updateDraftSchedules(payload);
            }
        }

        function navigateToConflict(conflict) {
            selectedCell.value = {
                dayId: conflict.day_id,
                periodId: conflict.period_id,
                period: periods.value.find(p => p.id === conflict.period_id),
                assignments: draftSchedules.value.filter(
                    a => a.day_id === conflict.day_id && a.period_id === conflict.period_id
                ),
                conflicts: [conflict],
                preSelectedCourse: null,
            };
            showAssignmentModal.value = true;
            showConflicts.value = false;
        }

        function applySuggestion(suggestion) {
            emit('trigger-event', {
                name: 'applySuggestion',
                event: { suggestion },
            });
        }

        function ignoreConflict(conflict) {
            emit('trigger-event', {
                name: 'ignoreConflict',
                event: { conflictId: conflict.id },
            });
        }

        function autoResolveConflicts() {
            emit('trigger-event', {
                name: 'autoResolveConflicts',
                event: { conflicts: allConflicts.value.filter(c => c.auto_resolvable) },
            });
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
                }, 2000);
            },
            { deep: true }
        );

        onMounted(() => {
            console.log('🚀 [wwElement] Component mounted - Course Scheduler loaded successfully');
        });

        // Also react if the direct draftSchedules prop changes, to keep store hints in sync
        watch(
            () => [props.draftSchedules, props.draftSchedule],
            () => {
                if (store.initialize) {
                    store.initialize(null, null, null, {
                        periods: toArray(props.content.periods),
                        draftSchedules: draftSchedules.value,
                    });
                }
            },
            { immediate: true, deep: true }
        );

        // Watch for significant structural changes in content for debug
        watch(
            () => props.content,
            (newContent, oldContent) => {
                if (
                    newContent &&
                    oldContent &&
                    (newContent?.periods?.length !== oldContent?.periods?.length ||
                        newContent?.schoolDays?.length !== oldContent?.schoolDays?.length ||
                        newContent?.courses?.length !== oldContent?.courses?.length)
                ) {
                    console.log('🔄 [wwElement] Content structure changed:', {
                        periods: newContent?.periods?.length || 0,
                        schoolDays: newContent?.schoolDays?.length || 0,
                        courses: newContent?.courses?.length || 0,
                    });
                }
            },
            { deep: true }
        );

        return {
            // Data
            periods,
            courses,
            teachers,
            classes,
            rooms,
            schoolDays,
            draftSchedules,
            liveSchedules,
            subjects,

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
            handleCourseEdit,
            handleToggleNonInstructional,
            handleToggleLessonSchedules,
            handlePeriodFocusChanged,
            handleFilterYear,
            handleSchedulerDrop,
            handleSchedulerDragStart,
            handleSchedulerDragEnd,
            testEventEmission,
            navigateToConflict,
            applySuggestion,
            ignoreConflict,
            autoResolveConflicts,
            logCurrentData,

            // Public API methods for programmatic control (from store)
            setViewMode: store.setViewMode,
            toggleTeacher: store.toggleTeacher,
            setSelectedClass: store.setSelectedClass,
            setSelectedRoom: store.setSelectedRoom,
            clearFilters: store.clearFilters,
            persistDraft: store.persistDraft,
            publish: store.publish,

            // Local helpers
            safeLength,
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
}

.scheduler-content {
    padding: 12px 0;
}

.test-toggle,
.debug-toggle {
    position: fixed;
    bottom: 16px;
    right: 16px;
    margin-left: 8px;
    background: #eee;
    border: 1px solid #ddd;
    padding: 8px 10px;
    border-radius: 4px;
}

.test-toggle {
    right: 56px;
}

.conflicts-sidebar {
    position: fixed;
    top: 80px;
    right: 16px;
    width: 360px;
    max-height: calc(100vh - 100px);
    overflow: auto;
    background: #fff;
    border: 1px solid #eee;
    border-radius: 6px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.08);
    padding: 12px;
}
</style>
