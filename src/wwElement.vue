<template>
    <div class="course-scheduler-wrapper">
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
                :is-live-mode="isLive"
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
                @mode-changed="handleModeChanged"
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
import { ref, computed, watch, onMounted, getCurrentInstance, reactive } from 'vue';
import SchedulerGrid from './components/scheduler/SchedulerGrid.vue';
import AssignmentModal from './components/scheduler/AssignmentModal.vue';
import ConflictPanel from './components/scheduler/ConflictPanel.vue';
import {
    validateAndUnwrapArray,
    safeLength,
    safeArray,
    toArray,
    len,
    nonEmpty,
    normalizePeriods,
    normalizeCourse,
    normalizePossibleSlots,
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
                mode: 'planner',
            }),
        },
        wwElementState: { type: Object, required: true },
        /* wwEditor:start */
        wwEditorState: { type: Object, required: true },
        /* wwEditor:end */
    },
    setup(props, { emit }) {
        // Initialize scheduler store - now using simple Vue reactivity
        const store = useSchedulerStore();

        // Hydration guard to prevent reactive feedback loops
        let hydrating = true;
        const internalState = reactive({
            initializedDraft: null,
            hasHydrated: false,
        });

        // Helper function to check deep equality for draft schedules
        function deepEqual(a, b) {
            if (a === b) return true;
            if (!a || !b) return false;
            if (a.length !== b.length) return false;
            return JSON.stringify(a) === JSON.stringify(b);
        }

        // One-way hydration function - only reads from props, never writes back
        function hydrateFromDraft(draftData) {
            try {
                const normalizedDraft = toArray(draftData);
                // Clone data to internal state - never mutate props
                internalState.initializedDraft = normalizedDraft.map(item => ({ ...item }));
                internalState.hasHydrated = true;

                // Initialize store with cloned data only
                if (store.initialize) {
                    store.initialize(null, null, null, {
                        periods: toArray(props.content.periods).map(p => ({ ...p })),
                        draftSchedules: [...internalState.initializedDraft],
                    });
                }
            } catch (error) {
                console.warn('🔄 [wwElement] Draft hydration warning:', error);
                internalState.hasHydrated = true; // Prevent infinite retry
            }
        }

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

        // Safe array computed properties with enhanced WeWeb collection support
        const periods = computed(() => {
            const rawPeriodsData = props.content.periods;
            const normalizedPeriods = normalizePeriods(rawPeriodsData);

            if (!nonEmpty(normalizedPeriods)) {
                return [];
            }

            return normalizedPeriods;
        });

        const courses = computed(() => {
            const rawCourses = props.content.courses;
            const coursesArray = toArray(rawCourses);

            return coursesArray.map((course, idx) => normalizeCourse(course, idx));
        });

        const teachers = computed(() => {
            const rawTeachers = props.content.teachers;
            const teachersArray = toArray(rawTeachers);
            return teachersArray;
        });

        const classes = computed(() => {
            const rawClasses = props.content.classes;
            const classesArray = toArray(rawClasses);
            return classesArray;
        });

        const rooms = computed(() => {
            const rawRooms = props.content.rooms;
            const roomsArray = toArray(rawRooms);
            return roomsArray;
        });

        const schoolDays = computed(() => {
            const rawDaysData = props.content.schoolDays;
            const validatedDays = toArray(rawDaysData);

            if (!nonEmpty(validatedDays)) {
                return [];
            }

            const defaultDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

            const processedDays = validatedDays.map((day, index) => {
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

            return processedDays;
        });

        const draftSchedules = computed(() => {
            const rawDrafts = props.content.draftSchedules;
            const finalDraftArray = toArray(rawDrafts);
            return finalDraftArray;
        });

        const liveSchedules = computed(() => {
            const rawLive = props.content.liveSchedules;
            const finalLiveArray = toArray(rawLive);
            return finalLiveArray;
        });

        const subjects = computed(() => {
            const rawSubjects = props.content.subjects;
            const subjectsArray = toArray(rawSubjects);
            return subjectsArray;
        });

        // Computed state
        const currentMode = computed(() => props.content.mode || 'planner');
        const isLive = computed(() => currentMode.value === 'live');
        const isReadOnly = computed(() => isLive.value); // Live mode is read-only
        const canUndo = computed(() => safeLength(undoStack.value) > 0);

        // Conflict detection
        const allConflicts = computed(() => {
            return detectConflicts(draftSchedules.value);
        });

        // Available courses for selected slot
        const availableCoursesForSlot = computed(() => {
            if (!selectedCell.value.dayId || !selectedCell.value.periodId) {
                return courses.value;
            }

            // Use backend IDs
            const currentDayId = selectedCell.value.dayId;
            const currentPeriodId = selectedCell.value.periodId;

            // Filter courses based on normalized possibleSlots (using dayId + periodId)
            const filteredCourses = courses.value.filter(course => {
                // If no restrictions, course is available
                if (safeLength(course.possibleSlots) === 0) return true;

                // Check if current slot matches
                const isAvailable = course.possibleSlots.some(slot => {
                    return slot.dayId === currentDayId && slot.periodId === currentPeriodId;
                });

                if (isAvailable) {
                    console.log('  ✅ Available course:', {
                        courseName: course.name,
                        possibleSlots: course.possibleSlots.length,
                    });
                }

                return isAvailable;
            });

            // Only log if this is an actual filtering operation
            if (currentDayId && currentPeriodId && filteredCourses.length !== courses.value.length) {
                console.log('🎯 [wwElement] availableCoursesForSlot filtering:', {
                    currentDayId,
                    currentPeriodId,
                    totalCourses: safeLength(courses.value),
                    filteredCourses: filteredCourses.length,
                });
            }

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
            // Close the modal and emit an event
            closeAssignmentModal();
            emit('edit-assignment-requested', assignment);
        }

        function removeAssignment(assignmentToRemove) {
            saveToUndoStack();

            // Emit scheduler:remove event if configured
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
            // Update internal state to prevent feedback loops
            internalState.initializedDraft = newSchedules.map(item => ({ ...item }));

            // Emit to external systems - but never mutate props directly
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
            if (hydrating) return; // Skip during initialization

            isSaving.value = true;
            try {
                const currentDraft = draftSchedules.value;

                // Emit WeWeb external event - never mutate props/variables here
                emit('trigger-event', {
                    name: 'saveDraft',
                    event: {
                        schedules: currentDraft,
                        timestamp: new Date().toISOString(),
                        action: 'save_draft',
                    },
                });

                // Also emit direct WeWeb event for external handling
                emit('save-draft-external', {
                    schedules: currentDraft,
                    timestamp: new Date().toISOString(),
                });

                // Simulate save delay
                await new Promise(resolve => setTimeout(resolve, 1000));

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

        function handleModeChanged(mode) {
            console.log('🔄 [wwElement] Mode changed to:', mode);
            emit('trigger-event', {
                name: 'scheduler:mode-changed',
                event: { mode, timestamp: new Date().toISOString() },
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

            console.log('🚀 [WeWeb Event] scheduler:drop - Emitting trigger-event');
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

            console.log('🚀 [WeWeb Event] scheduler:drag-start - Emitting trigger-event');
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

            console.log('🚀 [WeWeb Event] scheduler:drag-end - Emitting trigger-event');
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
            console.log('🧪 [WeWeb Event Test] Manual scheduler:drop event test');

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
                console.log('✅ [WeWeb Event Test] scheduler:drop trigger-event emitted');
            } catch (error) {
                console.error('❌ [WeWeb Event Test] scheduler:drop test failed:', error);
            }
        }

        function updateAssignments(payload) {
            if (payload.action === 'move' && payload.assignment) {
                // Handle drag-and-drop assignment move
                const updatedSchedules = [...draftSchedules.value];

                // Find the assignment to move
                const assignmentIndex = updatedSchedules.findIndex(a => a.id === payload.assignment.id);

                if (assignmentIndex !== -1) {
                    // Create updated assignment with new position
                    const updatedAssignment = {
                        ...updatedSchedules[assignmentIndex],
                        day_id: payload.toDayId,
                        period_id: payload.toPeriodId,
                        // Update display fields if they exist
                        day_name_de: schoolDays.value.find(d => d.id === payload.toDayId)?.name_de,
                        day_name_en: schoolDays.value.find(d => d.id === payload.toDayId)?.name_en,
                    };

                    // Update the schedules array
                    updatedSchedules[assignmentIndex] = updatedAssignment;

                    // Push to undo stack
                    undoStack.value.push(JSON.stringify(draftSchedules.value));

                    // Update draft schedules
                    updateDraftSchedules(updatedSchedules);

                    console.log('✅ [DragDrop] Assignment moved successfully:', {
                        assignmentId: payload.assignment.id,
                        from: `${payload.fromDayId}-${payload.fromPeriodId}`,
                        to: `${payload.toDayId}-${payload.toPeriodId}`,
                    });
                } else {
                    console.warn('⚠️ [DragDrop] Could not find assignment to move:', payload.assignment.id);
                }
            } else {
                // Handle other assignment updates (existing functionality)
                updateDraftSchedules(payload);
            }
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
                // Test WeWeb element event format
                emit('element-event', {
                    name: 'scheduler:drop',
                    event: 'scheduler:drop',
                    data: {
                        message: 'Test WeWeb element event from Course Scheduler!',
                        timestamp: new Date().toISOString(),
                        testData: {
                            periods: safeLength(periods.value),
                            courses: safeLength(courses.value),
                            teachers: safeLength(teachers.value),
                            classes: safeLength(classes.value),
                            rooms: safeLength(rooms.value),
                            draftSchedules: safeLength(draftSchedules.value),
                            conflicts: safeLength(allConflicts.value),
                            isReadOnly: isReadOnly.value,
                        },
                    },
                });
                console.log('✅ Test WeWeb element event emitted successfully');
            } catch (error) {
                console.error('❌ Failed to emit test WeWeb element event:', error);
            }
        }

        function logCurrentData() {
            console.log('🐛 [wwElement] === COMPLETE DATA DUMP ===');
            console.log('Raw content object:', props.content);

            // Detailed periods analysis
            console.log('📅 PERIODS ANALYSIS:');
            console.log('  Raw periods:', props.content.periods);
            console.log('  Processed periods:', periods.value);
            if (safeLength(periods.value) > 0) {
                const samplePeriod = periods.value[0];
                console.log('  Sample period object keys:', Object.keys(samplePeriod));
                console.log('  Sample period values:', samplePeriod);
            }

            // Detailed schoolDays analysis
            console.log('🗓️ SCHOOL DAYS ANALYSIS:');
            console.log('  Raw schoolDays:', props.content.schoolDays);
            console.log('  Processed schoolDays:', schoolDays.value);
            if (safeLength(schoolDays.value) > 0) {
                const sampleDay = schoolDays.value[0];
                console.log('  Sample day object keys:', Object.keys(sampleDay));
                console.log('  Sample day values:', sampleDay);
            }

            console.log('Courses:', safeLength(courses.value), courses.value.slice(0, 2));
            console.log('Teachers:', safeLength(teachers.value), teachers.value.slice(0, 2));
            console.log('Classes:', safeLength(classes.value), classes.value.slice(0, 2));
            console.log('Rooms:', safeLength(rooms.value), rooms.value.slice(0, 2));
            console.log('Draft Schedules:', safeLength(draftSchedules.value), draftSchedules.value.slice(0, 2));
            console.log('Live Schedules:', safeLength(liveSchedules.value), liveSchedules.value.slice(0, 2));
            console.log('Is Read Only:', isReadOnly.value);
            console.log('Can Undo:', canUndo.value);
            console.log('All Conflicts:', safeLength(allConflicts.value), allConflicts.value);
            console.log('🐛 [wwElement] === END COMPLETE DATA DUMP ===');
        }

        // Auto-save functionality - prevent feedback loops with hydration guard
        let saveTimeout;
        watch(
            draftSchedules,
            (newDraft, prevDraft) => {
                if (hydrating) return; // Skip during initialization
                if (isReadOnly.value) return;
                if (deepEqual(newDraft, prevDraft)) return; // Skip no-op updates

                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                    // Only save if we're not in a feedback loop
                    if (!hydrating && !deepEqual(newDraft, internalState.initializedDraft)) {
                        saveDraft();
                    }
                }, 2000); // Auto-save after 2 seconds of no changes
            },
            { deep: true }
        );

        // Debug logging on mount - reduced verbosity
        onMounted(() => {
            // One-way initialization on mount
            if (props.content?.draftSchedules) {
                hydrateFromDraft(props.content.draftSchedules);
            }
            hydrating = false; // Allow watchers after initial hydration
            console.log('🚀 [wwElement] Course Scheduler mounted successfully');
        });

        // Guarded watcher for draft schedule updates - only after hydration
        watch(
            () => props.content?.draftSchedules,
            (newDraft, prevDraft) => {
                if (hydrating) return; // Skip during initialization
                if (deepEqual(newDraft, prevDraft)) return; // Skip no-op updates
                if (deepEqual(newDraft, internalState.initializedDraft)) return; // Skip self-updates

                // Only hydrate if data actually changed
                hydrateFromDraft(newDraft);
            },
            { deep: true }
        );

        // Watch for changes in props.content structure only - no state mutations
        watch(
            () => props.content,
            (newContent, oldContent) => {
                if (hydrating) return; // Skip during initialization

                // Only log when there are actual structural changes, not on every reactive update
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
            currentMode,
            isLive,
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
            handleModeChanged,
            handleSchedulerDrop,
            handleSchedulerDragStart,
            handleSchedulerDragEnd,
            testEventEmission,
            navigateToConflict,
            applySuggestion,
            ignoreConflict,
            autoResolveConflicts,
            emitTestEvent,
            logCurrentData,

            // Public API methods for programmatic control
            setViewMode: store.setViewMode,
            toggleTeacher: store.toggleTeacher,
            setSelectedClass: store.setSelectedClass,
            setSelectedRoom: store.setSelectedRoom,
            clearFilters: store.clearFilters,
            persistDraft: store.persistDraft,
            publish: store.publish,

            // Utility functions
            safeLength,
            safeArray,
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

.debug-toggle {
    position: fixed;
    bottom: 70px;
    right: 20px;
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    background: #ff6b6b;
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
    /* No specific styles needed */
}

/* Print styles */
@media print {
    .test-toggle,
    .conflicts-sidebar {
        display: none !important;
    }
}
</style>
