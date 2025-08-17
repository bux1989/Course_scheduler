<template>
    <div class="scheduler-grid" role="grid" aria-label="School schedule grid" :data-readonly="isReadOnly">
        <!-- Main Grid -->
        <div v-if="safeLength(visibleDays) > 0 && safeLength(visiblePeriods) > 0" class="main-grid-container">
            <!-- Grid Header with Days -->
            <div class="grid-header" role="row">
                <div class="period-header-cell" role="columnheader">
                    <span class="period-label">Period</span>
                    <div class="debug-info">
                        <small>Days: {{ safeLength(visibleDays) }}, Periods: {{ safeLength(visiblePeriods) }}</small>
                    </div>
                </div>
                <div
                    v-for="(day, index) in visibleDays"
                    :key="day.id"
                    class="day-header-cell"
                    role="columnheader"
                    :aria-colindex="index + 1"
                >
                    <span class="day-name">{{ day.name }}</span>
                    <span class="day-date" v-if="day.date">{{ formatDate(day.date) }}</span>
                    <div class="debug-info">
                        <small>ID: {{ day.id }}</small>
                    </div>
                </div>
            </div>

            <!-- Grid Body -->
            <div class="grid-body">
                <div
                    v-for="(period, periodIndex) in visiblePeriods"
                    :key="period.id"
                    class="grid-row"
                    :class="{ 'non-instructional': !period.is_instructional }"
                    role="row"
                    :aria-rowindex="periodIndex + 1"
                >
                    <!-- Period Label -->
                    <div
                        class="period-label-cell"
                        role="rowheader"
                        :class="{ focused: focusedPeriodId === period.id }"
                        @click="togglePeriodFocus(period.id)"
                        title="Click to focus on this period"
                    >
                        <div class="period-info">
                            <span class="period-name">{{ period.name }}</span>
                            <span class="period-time"
                                >{{ formatTime(period.start_time) }} - {{ formatTime(period.end_time) }}</span
                            >
                            <span v-if="!period.is_instructional" class="non-instructional-badge">
                                {{ period.type || 'Break' }}
                            </span>
                            <div class="debug-info">
                                <small
                                    >ID: {{ period.id }}, Instructional:
                                    {{ period.is_instructional !== false ? 'Yes' : 'No' }}</small
                                >
                            </div>
                        </div>
                    </div>

                    <!-- Day Cells -->
                    <div
                        v-for="day in visibleDays"
                        :key="`${period.id}-${day.id}`"
                        class="schedule-cell drop-zone"
                        :class="getCellClasses(day.id, period.id)"
                        role="gridcell"
                        tabindex="0"
                        @click="handleCellClick(day.id, period.id, period)"
                        @keydown.enter="handleCellClick(day.id, period.id, period)"
                        @keydown.space.prevent="handleCellClick(day.id, period.id, period)"
                        :aria-label="getCellAriaLabel(day, period)"
                        @dragover.prevent="!isReadOnly ? handleCellDragOver($event, day.id, period.id) : null"
                        @dragenter.prevent="!isReadOnly ? handleCellDragEnter($event, day.id, period.id) : null"
                        @dragleave="!isReadOnly ? handleCellDragLeave($event, day.id, period.id) : null"
                        @drop="!isReadOnly ? handleCellDrop($event, day.id, period.id) : null"
                        :data-day-id="day.id"
                        :data-period-id="period.id"
                    >
                        <!-- Multiple Assignments Display -->
                        <div v-if="safeLength(getCellAssignments(day.id, period.id)) > 0" class="assignments-container">
                            <div
                                v-for="(assignment, index) in getCellAssignments(day.id, period.id)"
                                :key="index"
                                class="assignment-item draggable-assignment"
                                :class="getAssignmentClasses(assignment)"
                                :style="getAssignmentStyles(assignment)"
                                @click.stop="handleAssignmentClick(assignment, day.id, period.id)"
                                @contextmenu.prevent="handleAssignmentRightClick($event, assignment, day.id, period.id)"
                                :draggable="!isReadOnly && !isEditing(assignment.id)"
                                @dragstart="!isReadOnly ? handleAssignmentDragStart($event, assignment, day.id, period.id) : null"
                                @dragend="!isReadOnly ? handleAssignmentDragEnd($event) : null"
                                :data-assignment-id="assignment.id"
                                :data-day-id="day.id"
                                :data-period-id="period.id"
                            >
                                <!-- Normal Assignment Display -->
                                <div v-if="!isEditing(assignment.id)" class="assignment-content">
                                    <span class="course-name">{{ getDisplayName(assignment) }}</span>
                                    <span class="class-name" v-if="assignment.class_id">{{ getClassName(assignment.class_id) }}</span>
                                    <span class="teacher-names" v-if="getAssignmentTeachers(assignment)">
                                        {{ getAssignmentTeachers(assignment) }}
                                    </span>
                                    <span class="room-name" v-if="assignment.room_id">{{ getRoomName(assignment.room_id) }}</span>
                                </div>

                                <!-- Conflict Indicators -->
                                <div v-if="hasConflicts(assignment)" class="conflict-indicator" title="Has conflicts">⚠️</div>

                                <!-- Deleted Entity Warnings -->
                                <div v-if="hasDeletedEntities(assignment)" class="deleted-warning" title="Missing data">❌</div>
                            </div>
                        </div>

                        <!-- Empty Cell -->
                        <div v-else class="empty-cell">
                            <template v-if="!isReadOnly">
                                <span class="add-text">Add Course</span>
                            </template>
                            <template v-else>
                                <span class="empty-text">No assignments</span>
                            </template>
                        </div>
                    </div>
                </div>

                <!-- Grade Statistics Row (when period is focused) -->
                <div v-if="showStatistics && focusedPeriodId" class="statistics-row">
                    <!-- Empty cell for period column -->
                    <div class="period-label-cell stats-label-cell">
                        <div class="stats-title">
                            <span class="stats-emoji">📈</span>
                            <span>Grade Stats</span>
                        </div>
                    </div>

                    <!-- Statistics for each day -->
                    <div v-for="day in visibleDays" :key="`stats-${day.id}`" class="day-statistics-cell">
                        <div class="stats-headers">
                            <div class="stat-header" title="📊 Total free spots available">📊</div>
                            <div class="stat-header" title="⚖️ Average spots available">⚖️</div>
                            <div class="stat-header" title="📚 Amount of courses available">📚</div>
                        </div>

                        <div class="stats-rows">
                            <div
                                v-for="gradeStats in getDailyGradeStats(day.id, focusedPeriodId)"
                                :key="`${day.id}-${gradeStats.grade}`"
                                class="grade-stats-row"
                            >
                                <div class="grade-number">{{ gradeStats.grade }}:</div>
                                <div class="stat-value">{{ gradeStats.totalSpots }}</div>
                                <div class="stat-value">{{ gradeStats.averageSpots.toFixed(1) }}</div>
                                <div class="stat-value">{{ gradeStats.coursesCount }}</div>
                            </div>
                        </div>

                        <!-- Show "No data" if no statistics -->
                        <div v-if="safeLength(getDailyGradeStats(day.id, focusedPeriodId)) === 0" class="no-stats">
                            <span class="no-stats-text">No courses scheduled</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Debug info when grid is hidden -->
        <div v-else class="grid-hidden-debug">
            <div class="grid-hidden-message">
                ❌ Grid Hidden - Debug Info:
                <ul>
                    <li>Visible Days: {{ safeLength(visibleDays) }} ({{ visibleDays.map(d => d.name).join(', ') }})</li>
                    <li>Visible Periods: {{ safeLength(visiblePeriods) }} ({{ visiblePeriods.map(p => p.name || p.label).join(', ') }})</li>
                    <li>Focused Period: {{ focusedPeriodId }}</li>
                    <li>Total Periods Available: {{ safeLength(periods) }}</li>
                    <li>Total School Days Available: {{ safeLength(schoolDays) }}</li>
                </ul>
                <button @click="focusedPeriodId = null" class="emergency-show-btn">🚨 Emergency: Show All Data</button>
            </div>
        </div>

        <!-- Available Courses for Focused Period (only in planner mode) -->
        <div v-if="focusedPeriodId && !isReadOnly" class="available-courses-panel">
            <h3>Available Courses for {{ getFocusedPeriodName() }}</h3>
            <div class="focused-period-info">
                <em>Courses that can be scheduled during this period on each day</em>
            </div>
            <div class="day-courses-grid">
                <div v-for="day in visibleDays" :key="day.id" class="day-courses-column">
                    <h4>{{ day.name }}</h4>
                    <div class="available-courses-list">
                        <div
                            v-for="course in getAvailableCoursesForSlot(day.id, focusedPeriodId)"
                            :key="course.id"
                            class="course-card draggable-course"
                            :style="getCourseCardStyle(course)"
                            @click="!isReadOnly ? assignCourseToSlot(course, day.id, focusedPeriodId) : null"
                            :title="`${!isReadOnly ? 'Click to assign or drag' : 'Course:'} ${course.name || course.course_name} ${!isReadOnly ? 'to schedule' : ''}`"
                            :draggable="!isReadOnly"
                            :data-course-id="course.id"
                            :data-day-id="day.id"
                            :data-period-id="focusedPeriodId"
                            @dragstart="!isReadOnly ? handleCourseDragStart($event, course) : null"
                            @dragend="!isReadOnly ? handleCourseDragEnd($event) : null"
                        >
                            <div class="course-name">{{ course.name || course.course_name || course.title }}</div>
                            <div class="course-details">
                                <small v-if="course.course_code">Code: {{ course.course_code }}</small>
                                <small v-if="course.max_students">Max: {{ course.max_students }}</small>
                                <small v-if="course.subject_name">{{ course.subject_name }}</small>
                            </div>
                        </div>
                        <div v-if="safeLength(getAvailableCoursesForSlot(day.id, focusedPeriodId)) === 0" class="no-courses">
                            No courses available for this day/period
                        </div>
                    </div>
                </div>
            </div>

            <!-- No Preferred Days Courses Panel -->
            <div v-if="safeLength(getNoPreferredDaysCourses()) > 0" class="no-preferred-days-panel">
                <h4>📅 Courses with No Preferred Days</h4>
                <p class="panel-description">These courses have no time slot restrictions and can be scheduled on any day:</p>
                <div class="no-preferred-courses-list">
                    <div
                        v-for="course in getNoPreferredDaysCourses()"
                        :key="`no-pref-${course.id}`"
                        class="course-card"
                        :style="getCourseCardStyle(course)"
                        @click="!isReadOnly ? assignCourseToFocusedSlot(course) : null"
                        :title="`${course.name || course.course_name} - ${!isReadOnly ? 'Can be scheduled on any day' : 'Available on any day'}`"
                    >
                        <div class="course-name">{{ course.name || course.course_name || course.title }}</div>
                        <div class="course-details">
                            <small v-if="course.course_code">Code: {{ course.course_code }}</small>
                            <small v-if="course.max_students">Max: {{ course.max_students }}</small>
                            <small v-if="course.subject_name">{{ course.subject_name }}</small>
                            <small class="flexible-tag">📅 Flexible scheduling</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Teacher/Room Selection Modal -->
        <TeacherRoomSelectionModal
            v-if="showTeacherRoomModal && modalCourseData"
            :courseId="modalCourseData.courseId"
            :courseName="modalCourseData.courseName"
            :dayId="modalCourseData.dayId"
            :periodId="modalCourseData.periodId"
            :teachers="teachers"
            :rooms="rooms"
            @submit="handleTeacherRoomSubmit"
            @cancel="handleTeacherRoomCancel"
        />

        <!-- Course Selection Modal -->
        <CourseSelectionModal
            v-if="showCourseSelectionModal && courseSelectionData"
            :dayId="courseSelectionData.dayId"
            :dayName="courseSelectionData.dayName"
            :periodId="courseSelectionData.periodId"
            :periodName="courseSelectionData.periodName"
            :availableCourses="courseSelectionData.availableCourses"
            @submit="handleCourseSelectionSubmit"
            @cancel="handleCourseSelectionCancel"
        />

        <!-- Context Menu: teleport to body to avoid clipping/stacking issues -->
        <teleport to="body">
            <div
                v-if="contextMenu.show"
                class="context-menu"
                :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
                @click.stop
                ref="contextMenuRef"
                data-debug="context-menu"
            >
                <div class="context-menu-item" @click="editAssignmentFromContext">
                    {{ isReadOnly ? '📄 View Assignment Details' : '✏️ Edit Assignment' }}
                </div>
                <div class="context-menu-item delete" @click="deleteAssignmentFromContext">
                    {{ isReadOnly ? '🔍 Test Delete Event' : '🗑️ Delete Assignment' }}
                </div>
            </div>
            <div v-if="contextMenu.show" class="context-menu-backdrop" @click="closeContextMenu"></div>
        </teleport>

        <!-- Inline Assignment Editor -->
        <InlineAssignmentEditor
            v-if="editingAssignment"
            :assignment="editingAssignment"
            :courses="courses"
            :teachers="teachers"
            :classes="classes"
            :rooms="rooms"
            :subjects="subjects"
            @save="saveInlineEdit"
            @cancel="cancelInlineEdit"
            @delete="deleteInlineAssignment"
            @edit-course="handleCourseEdit"
        />
    </div>
</template>

<script>
import { computed, ref, watch, nextTick } from 'vue';
import InlineAssignmentEditor from './InlineAssignmentEditor.vue';
import TeacherRoomSelectionModal from './TeacherRoomSelectionModal.vue';
import CourseSelectionModal from './CourseSelectionModal.vue';
import { generateUniqueDraftId } from '../../utils/idGenerator.js';
import { emitSchedulerRemoveEvent } from '../../utils/events.js';
import {
    validateAndUnwrapArray,
    safeLength,
    safeArray,
    toArray,
    len,
    nonEmpty,
    normalizeCourse,
    normalizePossibleSlots,
} from '../../utils/arrayUtils.js';

export default {
    name: 'SchedulerGrid',
    components: {
        InlineAssignmentEditor,
        TeacherRoomSelectionModal,
        CourseSelectionModal,
    },
    props: {
        periods: { type: Array, default: () => [] },
        schoolDays: { type: Array, default: () => [] },
        courses: { type: Array, default: () => [] },
        teachers: { type: Array, default: () => [] },
        classes: { type: Array, default: () => [] },
        rooms: { type: Array, default: () => [] },
        subjects: { type: Array, default: () => [] },
        draftSchedules: { type: Array, default: () => [] },
        liveSchedules: { type: Array, default: () => [] },
        isReadOnly: { type: Boolean, default: false },
        isLiveMode: { type: Boolean, default: false },
        showStatistics: { type: Boolean, default: true },
        maxDays: { type: Number, default: 6 },
        parentEmit: { type: Function, default: null },
        emitDropEvents: { type: Boolean, default: false },
        conflicts: { type: Array, default: () => [] },
        canUndo: { type: Boolean, default: false },
        isSaving: { type: Boolean, default: false },
    },
    emits: [
        'cell-click',
        'assignment-details',
        'toggle-non-instructional',
        'toggle-lesson-schedules',
        'filter-year',
        'undo-last',
        'save-draft',
        'update-assignments',
        'mode-changed',
        'period-focus-changed',
        'scheduler-drop',
        'scheduler-drag-start',
        'scheduler-drag-end',
        'course-edit',
    ],
    setup(props, { emit }) {
        const focusedPeriodId = ref(null);
        const editingAssignment = ref(null);
        const editingCell = ref(null);

        const showTeacherRoomModal = ref(false);
        const modalCourseData = ref(null);

        const showCourseSelectionModal = ref(false);
        const courseSelectionData = ref(null);

        const contextMenu = ref({
            show: false,
            x: 0,
            y: 0,
            assignment: null,
            dayId: null,
            periodId: null,
        });

        // New: ref to the teleported menu DOM node for measurement
        const contextMenuRef = ref(null);

        watch(focusedPeriodId, (newValue, oldValue) => {
            if (newValue !== oldValue) {
                console.log('🔍 [SchedulerGrid] focusedPeriodId changed:', { from: oldValue, to: newValue });
            }
        });

        watch(
            () => props.isLiveMode,
            (newMode, oldMode) => {
                if (newMode !== oldMode) {
                    const mode = newMode ? 'live' : 'planner';
                    console.log('🔄 [SchedulerGrid] Mode changed to:', mode);
                    emit('mode-changed', mode);
                }
            },
            { immediate: true }
        );

        const visibleDays = computed(() => {
            const validatedDays = validateAndUnwrapArray(props.schoolDays, 'schoolDays');
            if (safeLength(validatedDays) === 0) return [];
            const maxDaysLimit = props.maxDays || 7;
            return validatedDays.slice(0, maxDaysLimit);
        });

        const visiblePeriods = computed(() => {
            const validatedPeriods = safeArray(props.periods);
            if (safeLength(validatedPeriods) === 0) {
                console.log('🔍 [SchedulerGrid] No periods available:', {
                    periodsType: typeof props.periods,
                    periodsLength: props.periods?.length,
                    periodsKeys: Object.keys(props.periods || {}),
                    samplePeriod: Array.isArray(props.periods) ? props.periods[0] : props.periods,
                });
                return [];
            }
            if (safeLength(validatedPeriods) > 0) {
                console.log('🔍 [SchedulerGrid] Period processing summary:', {
                    totalPeriods: safeLength(validatedPeriods),
                    focusedPeriodId: focusedPeriodId.value,
                    stableIds: validatedPeriods.slice(0, 3).map(p => p.id),
                });
            }
            let filteredPeriods = validatedPeriods;
            if (focusedPeriodId.value) {
                const focused = validatedPeriods.filter(period => period.id === focusedPeriodId.value);
                if (safeLength(focused) === 0) {
                    console.warn('🚨 [SchedulerGrid] Focus ID not found, clearing.', {
                        focusedId: focusedPeriodId.value,
                        availableIds: validatedPeriods.slice(0, 5).map(p => p.id),
                    });
                    focusedPeriodId.value = null;
                } else {
                    filteredPeriods = focused;
                }
            }
            return filteredPeriods;
        });

        const currentSchedules = computed(() => (props.isLiveMode ? props.liveSchedules : props.draftSchedules));

        const filteredEntries = computed(() => {
            const entries = currentSchedules.value;
            console.log('🔍 [SchedulerGrid] filteredEntries - Schedule debugging:', {
                mode: props.isLiveMode ? 'live' : 'planner',
                draftSchedulesCount: safeLength(props.draftSchedules),
                liveSchedulesCount: safeLength(props.liveSchedules),
                selectedEntries: entries,
                selectedEntriesCount: safeLength(entries),
                sampleEntry: safeLength(entries) > 0 ? entries[0] : null,
            });
            return entries;
        });

        function formatTime(timeString) {
            if (!timeString) return '';
            const parts = timeString.split(':');
            return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : timeString;
        }
        function formatDate(date) {
            if (!date) return '';
            return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }

        function getCellAssignments(dayId, periodId) {
            let assignments = filteredEntries.value.filter(assignment => {
                const currentDay = props.schoolDays.find(d => d.id === dayId || d.day_id === dayId);
                const assignmentDayMatch =
                    assignment.day_id === dayId ||
                    assignment.day_id === currentDay?.day_id ||
                    assignment.day_id === currentDay?.id ||
                    assignment.day_number === currentDay?.day_number ||
                    assignment.day_number === currentDay?.id ||
                    (currentDay?.name && assignment.day_name_en === currentDay.name) ||
                    (currentDay?.name_en && assignment.day_name_en === currentDay.name_en);

                const currentPeriod = props.periods.find(p => p.id === periodId);
                const periodMatch =
                    assignment.period_id === periodId ||
                    (assignment.block_number && currentPeriod?.blockNumber && assignment.block_number === currentPeriod.blockNumber);

                return assignmentDayMatch && periodMatch;
            });

            const sortedAssignments = assignments.sort((a, b) => {
                const classA = getClassName(a.class_id);
                const classB = getClassName(b.class_id);
                if (classA !== classB) return classA.localeCompare(classB);
                const courseA = getCourseName(a.course_id) || getSubjectName(a.subject_id);
                const courseB = getCourseName(b.course_id) || getSubjectName(b.subject_id);
                return courseA.localeCompare(courseB);
            });

            return sortedAssignments;
        }

        function getCellClasses(dayId, periodId) {
            const assignments = getCellAssignments(dayId, periodId);
            const classes = [];
            if (safeLength(assignments) > 0) {
                classes.push('has-assignments');
                if (safeLength(assignments) > 1) classes.push('multiple-assignments');
            }
            const hasConflict = assignments.some(a =>
                props.conflicts.some(c => c.day_id === dayId && c.period_id === periodId)
            );
            if (hasConflict) classes.push('has-conflicts');
            return classes;
        }

        function getCellAriaLabel(day, period) {
            const assignments = getCellAssignments(day.id, period.id);
            if (safeLength(assignments) === 0) return `${day.name} ${period.name}: Empty, click to add assignment`;
            const courseNames = assignments.map(a => getDisplayName(a)).join(', ');
            return `${day.name} ${period.name}: ${courseNames}, ${safeLength(assignments)} assignment${safeLength(assignments) > 1 ? 's' : ''}`;
        }

        function getAssignmentClasses(assignment) {
            const classes = [];
            if (hasConflicts(assignment)) classes.push('has-conflict');
            if (hasDeletedEntities(assignment)) classes.push('has-deleted-entities');
            const courseName = getCourseName(assignment.course_id);
            if (!courseName && assignment.subject_id) classes.push('lesson-schedule');
            return classes;
        }

        function getAssignmentStyles(assignment) {
            const course = props.courses.find(c => c.id === assignment.course_id);
            const cls = props.classes.find(c => c.id === assignment.class_id);
            return {
                borderLeft: `4px solid ${course?.color || cls?.color || '#e0e0e0'}`,
                backgroundColor: course?.color ? `${course.color}15` : cls?.color ? `${cls.color}15` : '#f9f9f9',
            };
        }

        function getCourseName(courseId) {
            if (!courseId) return null;
            const course = props.courses.find(c => c.id === courseId);
            const courseName = course?.name || course?.course_name || course?.title;
            if (!course) return null;
            return courseName || null;
        }
        function getSubjectName(subjectId) {
            if (!subjectId) return null;
            const subject = props.subjects.find(s => s.id === subjectId);
            return subject?.name || subject?.title || subject?.subject_name || `Subject ${subjectId}`;
        }
        function getDisplayName(assignment) {
            const courseName = getCourseName(assignment.course_id);
            if (courseName) return courseName;
            const subjectName = getSubjectName(assignment.subject_id);
            if (subjectName) return subjectName;
            return 'No Course';
        }
        function getClassName(classId) {
            if (!classId) return '';
            const cls = props.classes.find(c => c.id === classId);
            return cls?.name || 'No Class';
        }
        function getTeacherNames(teacherIds) {
            if (!teacherIds?.length) return 'No Teacher';
            const names = teacherIds.map(id => props.teachers.find(t => t.id === id)?.name || 'Unknown Teacher');
            return names.join(', ');
        }
        function getAssignmentTeachers(assignment) {
            if (assignment.teacher_names && Array.isArray(assignment.teacher_names) && assignment.teacher_names.length > 0) {
                return assignment.teacher_names.join(', ');
            }
            const teacherIds = assignment.staff_ids || assignment.teacher_ids;
            if (teacherIds && teacherIds.length > 0) return getTeacherNames(teacherIds);
            return '';
        }
        function getRoomName(roomId) {
            if (!roomId) return 'No Room';
            const room = props.rooms.find(r => r.id === roomId);
            return room?.name || 'Unknown Room';
        }
        function hasConflicts(assignment) {
            return props.conflicts.some(
                conflict =>
                    conflict.day_id === assignment.day_id &&
                    conflict.period_id === assignment.period_id &&
                    (conflict.assignment_id === assignment.id ||
                        conflict.teacher_ids?.some(id => assignment.teacher_ids?.includes(id)) ||
                        conflict.class_id === assignment.class_id ||
                        conflict.room_id === assignment.room_id)
            );
        }
        function hasDeletedEntities(assignment) {
            const courseExists = !assignment.course_id || props.courses.some(c => c.id === assignment.course_id);
            const classExists = !assignment.class_id || props.classes.some(c => c.id === assignment.class_id);
            const roomExists = !assignment.room_id || props.rooms.some(r => r.id === assignment.room_id);
            const teachersExist = !assignment.teacher_ids?.length || assignment.teacher_ids.every(id => props.teachers.some(t => t.id === id));
            return !courseExists || !classExists || !roomExists || !teachersExist;
        }

        function handleCellClick(dayId, periodId, period) {
            console.log('🖱️ [SchedulerGrid] Cell clicked:', { dayId, periodId, period: period?.name, isReadOnly: props.isReadOnly });
            if (props.isReadOnly) return;
            const assignments = getCellAssignments(dayId, periodId);
            if (assignments.length === 0) {
                console.log('📋 [SchedulerGrid] Empty cell clicked (no add in this component)');
                return;
            } else {
                emit('cell-click', { dayId, periodId, period });
            }
        }

        function openAssignmentModal(dayId, periodId, period) {
            if (props.isReadOnly) return;
            console.log('🎯 [SchedulerGrid] Opening course selection modal for:', { dayId, periodId, period: period.name });
            const availableCourses = getAvailableCoursesForSlot(dayId, periodId);
            const day = props.schoolDays.find(d => d.id === dayId);
            const dayName = day ? day.name : `Day ${dayId}`;
            const periodName = period ? period.name : `Period ${periodId}`;
            courseSelectionData.value = { dayId, periodId, dayName, periodName, period, availableCourses };
            showCourseSelectionModal.value = true;
            emit('cell-click', { dayId, periodId, period, mode: 'add' });
        }

        function openAssignmentDetails(assignment) {
            emit('assignment-details', assignment);
        }

        function togglePeriodFocus(periodId) {
            focusedPeriodId.value = focusedPeriodId.value === periodId ? null : periodId;
            emit('period-focus-changed', focusedPeriodId.value);
        }
        function clearPeriodFocus() {
            focusedPeriodId.value = null;
            emit('period-focus-changed', null);
        }
        function getFocusedPeriodName() {
            const period = props.periods.find(p => p.id === focusedPeriodId.value);
            return period?.name || period?.label || 'Unknown Period';
        }

        function getAvailableCoursesForSlot(dayId, periodId) {
            const normalizedCourses = props.courses.map((course, idx) => normalizeCourse(course, idx));
            let availableCourses = normalizedCourses.filter(course => {
                if (safeLength(course.possibleSlots) === 0) return true;
                return course.possibleSlots.some(slot => slot.dayId === dayId && slot.periodId === periodId);
            });
            console.log('🎯 [SchedulerGrid] Available courses for slot:', {
                dayId, periodId,
                availableCount: safeLength(availableCourses),
                courses: availableCourses.map(c => ({ id: c.id, name: c.name || c.course_name })),
            });
            return availableCourses;
        }

        function getCourseCardStyle(course) {
            return {
                borderLeft: `4px solid ${course.color || '#007cba'}`,
                backgroundColor: course.color ? `${course.color}15` : '#f0f8ff',
            };
        }

        function assignCourseToSlot(course, dayId, periodId) {
            console.log('🎯 [Scheduler] Open teacher/room for:', course.name || course.course_name, '->', dayId, periodId, props.isReadOnly ? '(READ-ONLY)' : '(EDITABLE)');
            modalCourseData.value = {
                courseId: course.id,
                courseName: course.name || course.course_name || '',
                courseCode: course.code || course.course_code || '',
                dayId, periodId,
            };
            showTeacherRoomModal.value = true;
            emit('scheduler-drag-end', {
                courseId: course.id,
                courseName: course.name || course.course_name || '',
                courseCode: course.code || course.course_code || '',
                success: true,
                source: 'drag-end',
                timestamp: new Date().toISOString(),
            });
        }

        function handleTeacherRoomSubmit(payload) {
            console.log('🎯 [Modal] Teacher/room assignment submitted:', payload);
            const uniqueDraftId = generateUniqueDraftId(); // kept if you need it elsewhere
            emit('scheduler-drop', {
                dayId: payload.dayId,
                periodId: payload.periodId,
                courseId: payload.courseId,
                courseName: payload.courseName,
                courseCode: modalCourseData.value?.courseCode || '',
                teacherIds: payload.teacherIds,
                primaryTeacherId: payload.primaryTeacherId,
                roomId: payload.roomId,
                source: 'modal-assignment',
                timestamp: payload.timestamp,
            });
            showTeacherRoomModal.value = false;
            modalCourseData.value = null;
        }
        function handleTeacherRoomCancel() {
            console.log('❌ [Modal] Teacher/room assignment cancelled');
            showTeacherRoomModal.value = false;
            modalCourseData.value = null;
        }

        function handleCourseSelectionSubmit(payload) {
            console.log('🎯 [CourseSelection] Course selected:', payload);
            showCourseSelectionModal.value = false;
            modalCourseData.value = {
                courseId: payload.courseId,
                courseName: payload.courseName,
                courseCode: payload.courseCode,
                dayId: payload.dayId,
                periodId: payload.periodId,
            };
            showTeacherRoomModal.value = true;
            courseSelectionData.value = null;
        }
        function handleCourseSelectionCancel() {
            console.log('❌ [CourseSelection] Course selection cancelled');
            showCourseSelectionModal.value = false;
            courseSelectionData.value = null;
        }

        function getNoPreferredDaysCourses() {
            const coursesWithoutRestrictions = props.courses.filter(course => !course.possible_time_slots || safeLength(course.possible_time_slots) === 0);
            console.log('📅 [NoPreferredDays] Courses available:', { total: safeLength(coursesWithoutRestrictions) });
            return coursesWithoutRestrictions;
        }
        function assignCourseToFocusedSlot(course) {
            if (props.isReadOnly || !focusedPeriodId.value) return;
            const firstDay = visibleDays.value[0];
            if (firstDay) assignCourseToSlot(course, firstDay.id, focusedPeriodId.value);
        }

        // Drag & Drop state
        const draggedCourse = ref(null);
        const draggedAssignment = ref(null);
        const dragOverCell = ref(null);

        // Drag & Drop methods
        function handleCourseDragStart(event, course) {
            console.log('🚀 [Scheduler] Drag started:', course.name || course.course_name, props.isReadOnly ? '(READ-ONLY)' : '(EDITABLE)');
            draggedCourse.value = course;
            emit('scheduler-drag-start', {
                courseId: course.id,
                courseName: course.name || course.course_name || '',
                courseCode: course.code || course.course_code || '',
                source: 'drag-start',
                timestamp: new Date().toISOString(),
            });
            event.dataTransfer.setData('text/plain', JSON.stringify({ type: 'course', course, id: course.id }));
            event.dataTransfer.effectAllowed = 'copy';
            event.target.style.opacity = '0.5';
        }
        function handleCourseDragEnd(event) {
            console.log('🎯 [DragDrop] Course drag ended');
            const course = draggedCourse.value;
            emit('scheduler-drag-end', {
                courseId: course?.id || null,
                courseName: course?.name || course?.course_name || null,
                courseCode: course?.code || course?.course_code || null,
                success: false,
                source: 'drag-end',
                timestamp: new Date().toISOString(),
            });
            draggedCourse.value = null;
            event.target.style.opacity = '1';
        }
        function handleAssignmentDragStart(event, assignment, dayId, periodId) {
            console.log('🎯 [DragDrop] Assignment drag started:', assignment.course_name || assignment.subject_name, props.isReadOnly ? '(READ-ONLY)' : '(EDITABLE)');
            draggedAssignment.value = { assignment, originalDayId: dayId, originalPeriodId: periodId };
            event.dataTransfer.setData('text/plain', JSON.stringify({ type: 'assignment', assignment, originalDayId: dayId, originalPeriodId: periodId }));
            event.dataTransfer.effectAllowed = 'move';
            event.target.style.opacity = '0.5';
        }
        function handleAssignmentDragEnd(event) {
            console.log('🎯 [DragDrop] Assignment drag ended');
            draggedAssignment.value = null;
            event.target.style.opacity = '1';
            dragOverCell.value = null;
        }
        function handleCellDragOver(event, dayId, periodId) {
            event.preventDefault();
            if (!draggedCourse.value && !draggedAssignment.value) return;
            event.dataTransfer.dropEffect = draggedAssignment.value ? 'move' : 'copy';
            return false;
        }
        function handleCellDragEnter(event, dayId, periodId) {
            event.preventDefault();
            if (!draggedCourse.value && !draggedAssignment.value) return;
            dragOverCell.value = `${dayId}-${periodId}`;
            event.currentTarget.classList.add('drag-over');
        }
        function handleCellDragLeave(event, dayId, periodId) {
            if (!event.currentTarget.contains(event.relatedTarget)) {
                dragOverCell.value = null;
                event.currentTarget.classList.remove('drag-over');
            }
        }
        function handleCellDrop(event, dayId, periodId) {
            event.preventDefault();
            dragOverCell.value = null;
            event.currentTarget.classList.remove('drag-over');
            try {
                const dragData = JSON.parse(event.dataTransfer.getData('text/plain'));
                if (dragData.type === 'course') {
                    const course = dragData.course;
                    console.log('🎯 [Scheduler] Dropping:', course.name || course.course_name, '->', dayId, periodId);
                    assignCourseToSlot(course, dayId, periodId);
                } else if (dragData.type === 'assignment') {
                    const assignment = dragData.assignment;
                    const originalDayId = dragData.originalDayId;
                    const originalPeriodId = dragData.originalPeriodId;
                    console.log('🎯 [DragDrop] Moving assignment from:', originalDayId, originalPeriodId, 'to:', dayId, periodId);
                    if (originalDayId !== dayId || originalPeriodId !== periodId) {
                        emit('scheduler-drop', {
                            dayId, periodId,
                            courseId: assignment.course_id || '',
                            courseName: assignment.course_name || assignment.display_cell || '',
                            courseCode: assignment.course_code || '',
                            teacherIds: assignment.teacher_ids || [],
                            primaryTeacherId: assignment.primary_teacher_id || null,
                            roomId: assignment.room_id || null,
                            source: 'assignment-move',
                            timestamp: new Date().toISOString(),
                            fromDayId: originalDayId,
                            fromPeriodId: originalPeriodId,
                            action: 'move',
                        });
                        emit('update-assignments', {
                            action: 'move', assignment,
                            fromDayId: originalDayId, fromPeriodId: originalPeriodId,
                            toDayId: dayId, toPeriodId: periodId,
                        });
                    }
                }
            } catch (error) {
                console.error('🚨 [DragDrop] Error handling drop:', error);
            }
        }

        function isEditing(assignmentId) {
            return editingAssignment.value?.id === assignmentId;
        }

        function handleAssignmentClick(assignment, dayId, periodId) {
            console.log('👆 [Left-Click] Assignment clicked:', {
                assignment: assignment.display_cell || assignment.course_name,
                dayId, periodId, isReadOnly: props.isReadOnly,
            });
            if (props.isReadOnly) {
                emit('assignment-details', assignment);
                return;
            }
            contextMenu.value.show = false;
            emit('assignment-details', assignment);
        }

        // Position helper with logs + clamping
        function computeContextMenuPosition(evt, menuSize = { w: 220, h: 96 }) {
            const vw = window.innerWidth || document.documentElement.clientWidth || 1024;
            const vh = window.innerHeight || document.documentElement.clientHeight || 768;
            const rect = evt?.currentTarget?.getBoundingClientRect?.();
            let x = 0;
            let y = 0;

            console.log('🖱️ [ContextMenu] Right-click event:', {
                clientX: evt?.clientX, clientY: evt?.clientY,
                pageX: evt?.pageX, pageY: evt?.pageY,
                targetTag: evt?.target?.tagName, currentTargetTag: evt?.currentTarget?.tagName,
            });

            if (rect && rect.width >= 0 && rect.height >= 0) {
                x = rect.left + 8;
                y = rect.bottom + 6;
                console.log('📐 [ContextMenu] Using element rect for anchor:', {
                    left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height,
                });
            } else {
                x = (evt?.clientX ?? 0) + 6;
                y = (evt?.clientY ?? 0) + 6;
                console.log('📐 [ContextMenu] Using cursor fallback anchor.');
            }

            const beforeClamp = { x, y };
            if (x + menuSize.w > vw) x = Math.max(8, vw - menuSize.w - 8);
            if (y + menuSize.h > vh) y = Math.max(8, vh - menuSize.h - 8);

            console.log('🧮 [ContextMenu] Position clamp:', {
                viewport: { vw, vh }, menuSize, beforeClamp, afterClamp: { x, y },
                scroll: { x: window.scrollX, y: window.scrollY },
            });

            return { x, y };
        }

        // Measure after render and adjust if needed
        function measureContextMenuRender() {
            nextTick(() => {
                const el = contextMenuRef.value;
                if (!el) {
                    console.log('❓ [ContextMenu] Ref not set after show');
                    return;
                }
                const rect = el.getBoundingClientRect();
                const cs = getComputedStyle(el);
                console.log('📏 [ContextMenu] Rendered rect:', rect);
                console.log('🎨 [ContextMenu] Computed style:', { zIndex: cs.zIndex, position: cs.position, display: cs.display });

                // If somehow off-screen, try to re-clamp using actual size
                const vw = window.innerWidth || 1024;
                const vh = window.innerHeight || 768;
                let x = contextMenu.value.x;
                let y = contextMenu.value.y;
                let changed = false;
                const w = rect.width || 220;
                const h = rect.height || 96;
                if (x + w > vw) { x = Math.max(8, vw - w - 8); changed = true; }
                if (y + h > vh) { y = Math.max(8, vh - h - 8); changed = true; }
                if (changed) {
                    console.log('🔧 [ContextMenu] Repositioning after measurement:', { x, y, w, h, vw, vh });
                    contextMenu.value.x = x;
                    contextMenu.value.y = y;
                }
            });
        }

        watch(() => contextMenu.value.show, (show) => {
            if (show) {
                console.log('▶️ [ContextMenu] Showing at coords:', { x: contextMenu.value.x, y: contextMenu.value.y });
                measureContextMenuRender();
            } else {
                console.log('⏹️ [ContextMenu] Hidden');
            }
        });

        function handleAssignmentRightClick(event, assignment, dayId, periodId) {
            console.log('➡️ [ContextMenu] Right-click on assignment:', {
                id: assignment?.id,
                course: assignment?.course_name || assignment?.display_cell || getDisplayName(assignment),
                dayId, periodId, isReadOnly: props.isReadOnly,
            });

            if (editingAssignment.value) {
                console.log('📝 [Right-Click] Cancelling existing inline edit');
                cancelInlineEdit();
            }

            const pos = computeContextMenuPosition(event);
            contextMenu.value = {
                show: true,
                x: pos.x,
                y: pos.y,
                assignment,
                dayId,
                periodId,
            };
        }

        function closeContextMenu() {
            console.log('❌ [Context Menu] Closing context menu');
            contextMenu.value.show = false;
        }

        function editAssignmentFromContext() {
            console.log('✏️ [Context Menu] Edit assignment selected');
            if (contextMenu.value.assignment) {
                if (props.isReadOnly) {
                    console.log('📖 [Context Menu] Read-only mode - showing details');
                    startInlineEditReadOnly(contextMenu.value.assignment, contextMenu.value.dayId, contextMenu.value.periodId);
                } else {
                    startInlineEdit(contextMenu.value.assignment, contextMenu.value.dayId, contextMenu.value.periodId);
                }
            }
            closeContextMenu();
        }

        function deleteAssignmentFromContext() {
            console.log('🗑️ [Context Menu] Delete assignment selected');
            if (contextMenu.value.assignment) {
                if (props.isReadOnly) {
                    console.log('📖 [Context Menu] Read-only mode - emitting scheduler:remove for testing');
                    const assignment = contextMenu.value.assignment;
                    const emitFunction = props.parentEmit || emit;
                    emitSchedulerRemoveEvent(emitFunction, {
                        dayId: assignment.day_id,
                        periodId: assignment.period_id,
                        assignmentId: assignment.id,
                        courseId: assignment.course_id,
                        courseName: assignment.course_name || assignment.display_cell || '',
                    });
                } else {
                    deleteInlineAssignment(contextMenu.value.assignment);
                }
            }
            closeContextMenu();
        }

        function startInlineEdit(assignment, dayId, periodId) {
            if (props.isReadOnly) return;
            console.log('✏️ [InlineEdit] Starting edit for assignment:', assignment.id);
            if (editingAssignment.value) cancelInlineEdit();
            editingAssignment.value = assignment;
            editingCell.value = { dayId, periodId };
        }
        function startInlineEditReadOnly(assignment, dayId, periodId) {
            console.log('👁️ [InlineEdit] View-only for assignment:', assignment.id);
            if (editingAssignment.value) cancelInlineEdit();
            editingAssignment.value = assignment;
            editingCell.value = { dayId, periodId };
        }
        function saveInlineEdit(updatedAssignment) {
            console.log('💾 [InlineEdit] Saving changes for assignment:', updatedAssignment.id);
            const currentScheduleData = currentSchedules.value;
            const updatedSchedules = currentScheduleData.map(s => (s.id === updatedAssignment.id ? updatedAssignment : s));
            emit('update-assignments', updatedSchedules);
            editingAssignment.value = null;
            editingCell.value = null;
        }
        function cancelInlineEdit() {
            console.log('❌ [InlineEdit] Cancelling edit');
            editingAssignment.value = null;
            editingCell.value = null;
        }
        function deleteInlineAssignment(assignment) {
            console.log('🗑️ [InlineEdit] Deleting assignment:', assignment.id);
            if (props.emitDropEvents) {
                const emitFunction = props.parentEmit || emit;
                emitSchedulerRemoveEvent(emitFunction, {
                    dayId: assignment.day_id,
                    periodId: assignment.period_id,
                    assignmentId: assignment.id,
                    courseId: assignment.course_id,
                    courseName: assignment.course_name || assignment.display_cell || '',
                });
            }
            const currentScheduleData = currentSchedules.value;
            const updatedSchedules = currentScheduleData.filter(s => s.id !== assignment.id);
            emit('update-assignments', updatedSchedules);
            editingAssignment.value = null;
            editingCell.value = null;
        }

        // Grade/stat helpers unchanged
        function parseGrades(course) {
            const grades = [];
            if (course.is_for_year_g && typeof course.is_for_year_g === 'object') {
                for (const [, grade] of Object.entries(course.is_for_year_g)) if (grade && grade > 0) grades.push(Number(grade));
            } else if (course.is_for_year_groups && Array.isArray(course.is_for_year_groups)) {
                grades.push(...course.is_for_year_groups.map(g => Number(g)).filter(g => g > 0));
            } else if (course.year_groups && Array.isArray(course.year_groups)) {
                grades.push(...course.year_groups.map(g => Number(g)).filter(g => g > 0));
            }
            return [...new Set(grades)].sort((a, b) => a - b);
        }
        function findCourseById(courseId) {
            return safeArray(props.courses).find(course => course.id === courseId);
        }
        function getScheduledCoursesForSlot(dayId, periodId) {
            const scheduledCourses = [];
            const scheduledEntries = safeArray(currentSchedules.value).filter(entry => entry.day_id === dayId && entry.period_id === periodId);
            scheduledEntries.forEach(entry => {
                const course = findCourseById(entry.course_id);
                if (course) {
                    const totalSpots = course.max_students || course.capacity || 0;
                    const freeSpots = entry.free_spaces !== undefined ? entry.free_spaces : totalSpots;
                    scheduledCourses.push({ ...course, scheduledEntry: entry, freeSpots, totalSpots });
                }
            });
            return scheduledCourses;
        }
        const allGrades = computed(() => {
            const gradesSet = new Set();
            safeArray(props.courses).forEach(course => parseGrades(course).forEach(g => gradesSet.add(g)));
            return Array.from(gradesSet).sort((a, b) => a - b);
        });
        function getDailyGradeStats(dayId, periodId) {
            if (!periodId) return [];
            const scheduledCourses = getScheduledCoursesForSlot(dayId, periodId);
            const gradeStats = [];
            allGrades.value.forEach(grade => {
                let totalSpots = 0;
                let coursesCount = 0;
                let totalGradeAllocation = 0;
                scheduledCourses.forEach(course => {
                    const courseGrades = parseGrades(course);
                    if (courseGrades.includes(grade)) {
                        coursesCount++;
                        const freeSpots = course.freeSpots || 0;
                        if (courseGrades.length === 1) {
                            totalSpots += freeSpots;
                            totalGradeAllocation += freeSpots;
                        } else {
                            const spotsPerGrade = freeSpots / courseGrades.length;
                            totalSpots += freeSpots;
                            totalGradeAllocation += spotsPerGrade;
                        }
                    }
                });
                if (coursesCount > 0 || totalSpots > 0) {
                    gradeStats.push({ grade, totalSpots, averageSpots: totalGradeAllocation, coursesCount });
                }
            });
            return gradeStats;
        }

        return {
            // State
            focusedPeriodId,
            draggedCourse,
            draggedAssignment,
            dragOverCell,
            editingAssignment,
            editingCell,
            showTeacherRoomModal,
            modalCourseData,
            showCourseSelectionModal,
            courseSelectionData,

            // Computed
            visibleDays,
            visiblePeriods,
            currentSchedules,
            filteredEntries,

            // Methods
            formatTime,
            formatDate,
            getCellAssignments,
            getCellClasses,
            getCellAriaLabel,
            getAssignmentClasses,
            getAssignmentStyles,
            getCourseName,
            getSubjectName,
            getDisplayName,
            getClassName,
            getTeacherNames,
            getAssignmentTeachers,
            getRoomName,
            hasConflicts,
            hasDeletedEntities,
            handleCellClick,
            openAssignmentModal,
            openAssignmentDetails,
            togglePeriodFocus,
            clearPeriodFocus,
            getFocusedPeriodName,
            getAvailableCoursesForSlot,
            getCourseCardStyle,
            assignCourseToSlot,
            getNoPreferredDaysCourses,
            assignCourseToFocusedSlot,

            // Drag and Drop
            handleCourseDragStart,
            handleCourseDragEnd,
            handleAssignmentDragStart,
            handleAssignmentDragEnd,
            handleCellDragOver,
            handleCellDragEnter,
            handleCellDragLeave,
            handleCellDrop,

            // Inline Editing
            isEditing,
            handleAssignmentClick,
            handleAssignmentRightClick,
            startInlineEdit,
            startInlineEditReadOnly,
            saveInlineEdit,
            cancelInlineEdit,
            deleteInlineAssignment,
            handleCourseEdit,

            // Context Menu
            closeContextMenu,
            editAssignmentFromContext,
            deleteAssignmentFromContext,
            contextMenu,
            contextMenuRef,

            // Modal handlers
            handleTeacherRoomSubmit,
            handleTeacherRoomCancel,
            handleCourseSelectionSubmit,
            handleCourseSelectionCancel,

            // Utils
            safeLength,
            safeArray,

            // Grade stats
            getDailyGradeStats,
            allGrades,
        };
    },
};
</script>

<style scoped>
.scheduler-grid {
    display: flex;
    flex-direction: column;
    width: 100%;
    border: 1px solid #ddd;
    border-radius: 6px;
    overflow: hidden;
    background: white;
}

/* ... all your existing styles remain unchanged ... */

/* Context Menu Styles (bumped z-index and teleported to body) */
.context-menu {
    position: fixed;
    background: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
    z-index: 99999; /* ensure it's above everything */
    min-width: 180px;
    padding: 4px 0;
}
.context-menu-item {
    padding: 8px 12px;
    cursor: pointer;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background-color 0.2s;
}
.context-menu-item:hover {
    background-color: #f5f5f5;
}
.context-menu-item.delete:hover {
    background-color: #ffe6e6;
    color: #d32f2f;
}
.context-menu-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 99998;
}
</style>
