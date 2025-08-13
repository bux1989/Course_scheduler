<template>
    <div class="scheduler-grid" role="grid" aria-label="School schedule grid">
        <!-- Toolbar -->
        <div class="scheduler-toolbar">
            <div class="toolbar-section">
                <label class="filter-label">
                    <input
                        type="checkbox"
                        v-model="showNonInstructional"
                        @change="$emit('toggle-non-instructional', showNonInstructional)"
                    />
                    Show Non-Instructional Blocks
                </label>
            </div>

            <div class="toolbar-section">
                <select v-model="selectedYearFilter" @change="$emit('filter-year', selectedYearFilter)">
                    <option value="">All Years</option>
                    <option v-for="year in yearGroups" :key="year" :value="year">{{ year }}</option>
                </select>
            </div>

            <div class="toolbar-actions">
                <button @click="$emit('undo-last')" :disabled="!canUndo" class="undo-button" title="Undo last change">
                    ↶ Undo
                </button>
                <button @click="$emit('save-draft')" class="save-button" :class="{ saving: isSaving }">
                    {{ isSaving ? 'Saving...' : 'Save Draft' }}
                </button>
            </div>
        </div>

        <!-- Debug Messages for Empty Data -->
        <div v-if="visibleDays.length === 0 || visiblePeriods.length === 0" class="debug-message-panel">
            <h3>⚠️ Debug Information</h3>
            <div class="debug-messages">
                <div v-if="visibleDays.length === 0" class="debug-warning">
                    <strong>No School Days Found:</strong>
                    <ul>
                        <li>Raw schoolDays prop: {{ JSON.stringify(schoolDays) }}</li>
                        <li>schoolDays length: {{ schoolDays.length }}</li>
                        <li>maxDays setting: {{ maxDays }}</li>
                    </ul>
                </div>
                <div v-if="visiblePeriods.length === 0" class="debug-warning">
                    <strong>No Periods Visible:</strong>
                    <ul>
                        <li>Raw periods prop: {{ JSON.stringify(periods) }}</li>
                        <li>periods length: {{ periods.length }}</li>
                        <li>showNonInstructional: {{ showNonInstructional }}</li>
                        <li>Filtered periods count: {{ visiblePeriods.length }}</li>
                    </ul>
                </div>
            </div>
        </div>

        <!-- Main Grid (only show if we have data) -->
        <div v-if="visibleDays.length > 0 && visiblePeriods.length > 0">
            <!-- Grid Header with Days -->
            <div class="grid-header" role="row">
                <div class="period-header-cell" role="columnheader">
                    <span class="period-label">Period</span>
                    <div class="debug-info">
                        <small>Days: {{ visibleDays.length }}, Periods: {{ visiblePeriods.length }}</small>
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
                    <div class="period-label-cell" role="rowheader">
                        <div class="period-info">
                            <span class="period-name">{{ period.name }}</span>
                            <span class="period-time"
                                >{{ formatTime(period.start_time) }} - {{ formatTime(period.end_time) }}</span
                            >
                            <span v-if="!period.is_instructional" class="non-instructional-badge">
                                {{ period.type || 'Break' }}
                            </span>
                            <div class="debug-info">
                                <small>ID: {{ period.id }}, Instructional: {{ period.is_instructional !== false ? 'Yes' : 'No' }}</small>
                            </div>
                        </div>
                    </div>

                    <!-- Day Cells -->
                    <div
                        v-for="day in visibleDays"
                        :key="`${period.id}-${day.id}`"
                        class="schedule-cell"
                        :class="getCellClasses(day.id, period.id)"
                        role="gridcell"
                        tabindex="0"
                        @click="handleCellClick(day.id, period.id, period)"
                        @keydown.enter="handleCellClick(day.id, period.id, period)"
                        @keydown.space.prevent="handleCellClick(day.id, period.id, period)"
                        :aria-label="getCellAriaLabel(day, period)"
                    >
                        <!-- Multiple Assignments Display -->
                        <div v-if="getCellAssignments(day.id, period.id).length > 0" class="assignments-container">
                            <div
                                v-for="(assignment, index) in getCellAssignments(day.id, period.id)"
                                :key="index"
                                class="assignment-item"
                                :class="getAssignmentClasses(assignment)"
                                :style="getAssignmentStyles(assignment)"
                                @click.stop="openAssignmentDetails(assignment)"
                            >
                                <div class="assignment-content">
                                    <span class="course-name">{{ getCourseName(assignment.course_id) }}</span>
                                    <span class="class-name" v-if="assignment.class_id">{{
                                        getClassName(assignment.class_id)
                                    }}</span>
                                    <span class="teacher-names" v-if="assignment.teacher_ids?.length">
                                        {{ getTeacherNames(assignment.teacher_ids) }}
                                    </span>
                                    <span class="room-name" v-if="assignment.room_id">{{
                                        getRoomName(assignment.room_id)
                                    }}</span>
                                </div>

                                <!-- Conflict Indicators -->
                                <div v-if="hasConflicts(assignment)" class="conflict-indicator" title="Has conflicts">
                                    ⚠️
                                </div>

                                <!-- Deleted Entity Warnings -->
                                <div v-if="hasDeletedEntities(assignment)" class="deleted-warning" title="Missing data">
                                    ❌
                                </div>
                            </div>

                            <!-- Add More Button for cells with assignments -->
                            <button
                                class="add-more-button"
                                @click.stop="openAssignmentModal(day.id, period.id, period)"
                                title="Add another assignment"
                            >
                                +
                            </button>
                        </div>

                        <!-- Empty Cell -->
                        <div v-else class="empty-cell" @click="openAssignmentModal(day.id, period.id, period)">
                            <span class="add-icon">+</span>
                            <span class="add-text">Add Course</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Statistics Panel (if enabled) -->
        <div v-if="showStatistics" class="statistics-panel">
            <h3>Schedule Statistics</h3>
            <div class="stats-grid">
                <div v-for="yearStats in yearGroupStats" :key="yearStats.year" class="year-stats">
                    <h4>{{ yearStats.year }}</h4>
                    <div class="stat-item">
                        <span class="stat-label">Scheduled Courses:</span>
                        <span class="stat-value">{{ yearStats.scheduledCourses }}/day</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Available Slots:</span>
                        <span class="stat-value">{{ yearStats.availableSlots }}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Utilization:</span>
                        <span class="stat-value">{{ Math.round(yearStats.utilization) }}%</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { computed, ref, watch } from 'vue';

export default {
    name: 'SchedulerGrid',
    props: {
        // Data props
        periods: { type: Array, default: () => [] },
        schoolDays: { type: Array, default: () => [] },
        courses: { type: Array, default: () => [] },
        teachers: { type: Array, default: () => [] },
        classes: { type: Array, default: () => [] },
        rooms: { type: Array, default: () => [] },

        // Schedule data
        draftSchedules: { type: Array, default: () => [] },
        liveSchedules: { type: Array, default: () => [] },

        // Configuration
        isReadOnly: { type: Boolean, default: false },
        showStatistics: { type: Boolean, default: true },
        maxDays: { type: Number, default: 6 }, // Monday-Saturday

        // State
        conflicts: { type: Array, default: () => [] },
        canUndo: { type: Boolean, default: false },
        isSaving: { type: Boolean, default: false },
    },

    emits: [
        'cell-click',
        'assignment-details',
        'toggle-non-instructional',
        'filter-year',
        'undo-last',
        'save-draft',
        'update-assignments',
    ],

    setup(props, { emit }) {
        // Local state
        const showNonInstructional = ref(true);
        const selectedYearFilter = ref('');
        
        // Debug logging for props and state
        console.log('🚀 [SchedulerGrid] Component setup initialized with props:', {
            periodsCount: props.periods?.length || 0,
            schoolDaysCount: props.schoolDays?.length || 0,
            coursesCount: props.courses?.length || 0,
            teachersCount: props.teachers?.length || 0,
            classesCount: props.classes?.length || 0,
            roomsCount: props.rooms?.length || 0,
            draftSchedulesCount: props.draftSchedules?.length || 0,
            maxDays: props.maxDays,
            isReadOnly: props.isReadOnly,
            showStatistics: props.showStatistics
        });
        
        // Check for empty data and warn
        watch([() => props.schoolDays, () => props.periods], ([newDays, newPeriods]) => {
            if (!newDays || newDays.length === 0) {
                console.warn('⚠️ [SchedulerGrid] No school days found!', {
                    schoolDays: newDays,
                    schoolDaysType: typeof newDays,
                    allProps: {
                        periods: props.periods,
                        schoolDays: props.schoolDays,
                        courses: props.courses,
                        teachers: props.teachers
                    }
                });
            }
            
            if (!newPeriods || newPeriods.length === 0) {
                console.warn('⚠️ [SchedulerGrid] No periods found!', {
                    periods: newPeriods,
                    periodsType: typeof newPeriods
                });
            }
        }, { immediate: true });

        // Computed properties
        const visibleDays = computed(() => {
            const days = props.schoolDays.slice(0, props.maxDays);
            console.log('🗓️ [SchedulerGrid] visibleDays computed:', {
                totalSchoolDays: props.schoolDays.length,
                maxDays: props.maxDays,
                visibleDaysCount: days.length,
                visibleDays: days
            });
            return days;
        });

        const visiblePeriods = computed(() => {
            console.log('📅 [SchedulerGrid] visiblePeriods computation START:', {
                showNonInstructional: showNonInstructional.value,
                totalPeriodsCount: props.periods.length
            });
            
            let filteredPeriods;
            if (showNonInstructional.value) {
                console.log('📅 [SchedulerGrid] Showing ALL periods (including non-instructional)');
                filteredPeriods = props.periods;
            } else {
                console.log('📅 [SchedulerGrid] Filtering to ONLY instructional periods');
                filteredPeriods = props.periods.filter(period => {
                    const isInstructional = period.is_instructional !== false;
                    console.log(`  Period "${period.name}" (id: ${period.id}):`, {
                        is_instructional: period.is_instructional,
                        computed_isInstructional: isInstructional,
                        included: isInstructional,
                        type: period.type
                    });
                    return isInstructional;
                });
            }
            
            console.log('📅 [SchedulerGrid] visiblePeriods computed RESULT:', {
                filteredPeriodsCount: filteredPeriods.length,
                periods: filteredPeriods.map(p => ({
                    id: p.id,
                    name: p.name,
                    is_instructional: p.is_instructional,
                    type: p.type
                }))
            });
            
            return filteredPeriods;
        });

        const yearGroups = computed(() => {
            const years = new Set();
            props.classes.forEach(cls => {
                if (cls.year_group) years.add(cls.year_group);
            });
            return Array.from(years).sort();
        });

        const yearGroupStats = computed(() => {
            return yearGroups.value.map(year => {
                const yearClasses = props.classes.filter(cls => cls.year_group === year);
                const yearAssignments = props.draftSchedules.filter(assignment =>
                    yearClasses.some(cls => cls.id === assignment.class_id)
                );

                const totalSlots = visiblePeriods.value.length * visibleDays.value.length * yearClasses.length;
                const scheduledCourses = yearAssignments.length;
                const averagePerDay = scheduledCourses / visibleDays.value.length;
                const utilization = totalSlots > 0 ? (scheduledCourses / totalSlots) * 100 : 0;

                return {
                    year,
                    scheduledCourses: Math.round(averagePerDay),
                    availableSlots: totalSlots,
                    utilization,
                };
            });
        });

        // Helper functions
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
            const assignments = props.draftSchedules.filter(
                assignment => {
                    const dayMatch = assignment.day_id === dayId;
                    const periodMatch = assignment.period_id === periodId;
                    return dayMatch && periodMatch;
                }
            );
            
            if (assignments.length > 0) {
                console.log(`🎯 [SchedulerGrid] getCellAssignments(${dayId}, ${periodId}):`, {
                    assignmentsFound: assignments.length,
                    assignments: assignments,
                    sampleAssignment: assignments[0]
                });
            }
            
            return assignments;
        }

        function getCellClasses(dayId, periodId) {
            const assignments = getCellAssignments(dayId, periodId);
            const classes = [];

            if (assignments.length > 0) {
                classes.push('has-assignments');
                if (assignments.length > 1) classes.push('multiple-assignments');
            }

            // Check for conflicts
            const hasConflict = assignments.some(assignment =>
                props.conflicts.some(conflict => conflict.day_id === dayId && conflict.period_id === periodId)
            );
            if (hasConflict) classes.push('has-conflicts');

            return classes;
        }

        function getCellAriaLabel(day, period) {
            const assignments = getCellAssignments(day.id, period.id);
            if (assignments.length === 0) {
                return `${day.name} ${period.name}: Empty, click to add assignment`;
            }
            const courseNames = assignments.map(a => getCourseName(a.course_id)).join(', ');
            return `${day.name} ${period.name}: ${courseNames}, ${assignments.length} assignment${assignments.length > 1 ? 's' : ''}`;
        }

        function getAssignmentClasses(assignment) {
            const classes = [];
            if (hasConflicts(assignment)) classes.push('has-conflict');
            if (hasDeletedEntities(assignment)) classes.push('has-deleted-entities');
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
            if (!courseId) return 'No Course';
            const course = props.courses.find(c => c.id === courseId);
            return course?.name || 'Unknown Course';
        }

        function getClassName(classId) {
            if (!classId) return '';
            const cls = props.classes.find(c => c.id === classId);
            return cls?.name || 'No Class';
        }

        function getTeacherNames(teacherIds) {
            if (!teacherIds?.length) return 'No Teacher';
            const names = teacherIds.map(id => {
                const teacher = props.teachers.find(t => t.id === id);
                return teacher?.name || 'Unknown Teacher';
            });
            return names.join(', ');
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
            const teachersExist =
                !assignment.teacher_ids?.length ||
                assignment.teacher_ids.every(id => props.teachers.some(t => t.id === id));

            return !courseExists || !classExists || !roomExists || !teachersExist;
        }

        // Event handlers
        function handleCellClick(dayId, periodId, period) {
            if (props.isReadOnly) return;

            emit('cell-click', { dayId, periodId, period });
        }

        function openAssignmentModal(dayId, periodId, period) {
            if (props.isReadOnly) return;

            emit('cell-click', {
                dayId,
                periodId,
                period,
                mode: 'add',
            });
        }

        function openAssignmentDetails(assignment) {
            emit('assignment-details', assignment);
        }

        return {
            // State
            showNonInstructional,
            selectedYearFilter,

            // Computed
            visibleDays,
            visiblePeriods,
            yearGroups,
            yearGroupStats,

            // Methods
            formatTime,
            formatDate,
            getCellAssignments,
            getCellClasses,
            getCellAriaLabel,
            getAssignmentClasses,
            getAssignmentStyles,
            getCourseName,
            getClassName,
            getTeacherNames,
            getRoomName,
            hasConflicts,
            hasDeletedEntities,
            handleCellClick,
            openAssignmentModal,
            openAssignmentDetails,
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

.scheduler-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #f8f9fa;
    border-bottom: 1px solid #ddd;
    gap: 16px;
    flex-wrap: wrap;
}

.toolbar-section {
    display: flex;
    align-items: center;
    gap: 8px;
}

.filter-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.9em;
    cursor: pointer;
}

.toolbar-actions {
    display: flex;
    gap: 8px;
}

.undo-button,
.save-button {
    padding: 6px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 0.9em;
    transition: all 0.2s;
}

.undo-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.save-button {
    background: #007cba;
    color: white;
    border-color: #007cba;
}

.save-button.saving {
    opacity: 0.7;
}

.grid-header {
    display: flex;
    background: #f5f5f5;
    border-bottom: 1px solid #ddd;
    font-weight: 600;
}

.period-header-cell {
    width: 140px;
    padding: 12px 8px;
    border-right: 1px solid #ddd;
    display: flex;
    align-items: center;
    justify-content: center;
}

.day-header-cell {
    flex: 1;
    padding: 12px 8px;
    border-right: 1px solid #ddd;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.day-name {
    font-size: 0.95em;
}

.day-date {
    font-size: 0.8em;
    color: #666;
    font-weight: normal;
}

.grid-body {
    display: flex;
    flex-direction: column;
}

.grid-row {
    display: flex;
    border-bottom: 1px solid #ddd;
    min-height: 80px;
}

.grid-row.non-instructional {
    background: #f8f9fa;
}

.period-label-cell {
    width: 140px;
    padding: 8px;
    border-right: 1px solid #ddd;
    background: #f9f9f9;
    display: flex;
    align-items: center;
}

.period-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.period-name {
    font-weight: 500;
    font-size: 0.9em;
}

.period-time {
    font-size: 0.8em;
    color: #666;
}

.non-instructional-badge {
    font-size: 0.75em;
    color: #888;
    background: #e9ecef;
    padding: 2px 4px;
    border-radius: 3px;
}

.schedule-cell {
    flex: 1;
    border-right: 1px solid #ddd;
    position: relative;
    cursor: pointer;
    transition: background-color 0.2s;
    min-height: 80px;
}

.schedule-cell:hover {
    background: #f0f7ff;
}

.schedule-cell.has-assignments {
    background: #e6f7ff;
}

.schedule-cell.multiple-assignments {
    background: #d6f3ff;
}

.schedule-cell.has-conflicts {
    background: #fff2f0;
    border-left: 3px solid #ff4d4f;
}

.assignments-container {
    padding: 4px;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 2px;
    position: relative;
}

.assignment-item {
    padding: 4px 6px;
    border-radius: 3px;
    border: 1px solid #e0e0e0;
    position: relative;
    cursor: pointer;
    transition: all 0.2s;
}

.assignment-item:hover {
    transform: translateX(1px);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.assignment-item.has-conflict {
    border-color: #ff4d4f;
    background: #fff2f0;
}

.assignment-item.has-deleted-entities {
    border-color: #faad14;
    background: #fff7e6;
}

.assignment-content {
    display: flex;
    flex-direction: column;
    gap: 1px;
}

.course-name {
    font-weight: 500;
    font-size: 0.85em;
    line-height: 1.2;
}

.class-name,
.teacher-names,
.room-name {
    font-size: 0.75em;
    color: #666;
    line-height: 1.1;
}

.conflict-indicator,
.deleted-warning {
    position: absolute;
    top: 2px;
    right: 2px;
    font-size: 0.7em;
}

.add-more-button {
    margin-top: 2px;
    padding: 2px 4px;
    background: #f0f0f0;
    border: 1px dashed #ccc;
    border-radius: 2px;
    cursor: pointer;
    font-size: 0.8em;
    align-self: stretch;
}

.add-more-button:hover {
    background: #e0e0e0;
}

.empty-cell {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #ccc;
    font-size: 0.85em;
    gap: 4px;
}

.add-icon {
    font-size: 20px;
    opacity: 0.6;
}

.add-text {
    opacity: 0.8;
}

.statistics-panel {
    padding: 16px;
    background: #f8f9fa;
    border-top: 1px solid #ddd;
}

.statistics-panel h3 {
    margin: 0 0 12px 0;
    color: #333;
    font-size: 1em;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
}

.year-stats {
    background: white;
    padding: 12px;
    border-radius: 4px;
    border: 1px solid #e0e0e0;
}

.year-stats h4 {
    margin: 0 0 8px 0;
    color: #333;
    font-size: 0.9em;
}

.stat-item {
    display: flex;
    justify-content: space-between;
    font-size: 0.85em;
    margin-bottom: 4px;
}

.stat-label {
    color: #666;
}

.stat-value {
    font-weight: 500;
    color: #333;
}

/* Responsive Design */
@media (max-width: 768px) {
    .period-header-cell,
    .period-label-cell {
        width: 100px;
        font-size: 0.8em;
    }

    .day-header-cell {
        font-size: 0.8em;
    }

    .scheduler-toolbar {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
    }

    .stats-grid {
        grid-template-columns: 1fr;
    }
}

/* Keyboard Navigation */
.schedule-cell:focus {
    outline: 2px solid #007cba;
    outline-offset: -2px;
}

/* Debug message panel */
.debug-message-panel {
    padding: 20px;
    background: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 4px;
    margin: 16px;
}

.debug-message-panel h3 {
    margin: 0 0 12px 0;
    color: #856404;
}

.debug-warning {
    margin-bottom: 16px;
    padding: 12px;
    background: #fff;
    border-left: 4px solid #ffc107;
    border-radius: 4px;
}

.debug-warning strong {
    display: block;
    margin-bottom: 8px;
    color: #856404;
}

.debug-warning ul {
    margin: 8px 0 0 16px;
    color: #6c757d;
    font-family: monospace;
    font-size: 0.9em;
}

.debug-warning li {
    margin-bottom: 4px;
    word-break: break-all;
}

/* Debug info styling */
.debug-info {
    font-size: 0.7em;
    color: #888;
    margin-top: 2px;
    padding: 2px;
    background: rgba(0, 0, 0, 0.05);
    border-radius: 2px;
}

/* Read-only mode */
.scheduler-grid[data-readonly='true'] .schedule-cell {
    cursor: default;
}

.scheduler-grid[data-readonly='true'] .schedule-cell:hover {
    background: inherit;
}
</style>
