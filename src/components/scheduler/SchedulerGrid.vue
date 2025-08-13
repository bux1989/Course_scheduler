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

                <label class="filter-label">
                    <input type="checkbox" v-model="showLessonSchedules" @change="handleLessonScheduleToggle" />
                    Show Lesson Schedules (No Course)
                </label>
            </div>

            <div class="toolbar-section">
                <label class="mode-switcher">
                    <span>Planning Mode</span>
                    <input type="checkbox" v-model="isLiveMode" @change="handleModeSwitch" class="mode-toggle" />
                    <span>Live Mode</span>
                </label>
            </div>

            <div class="toolbar-section">
                <select v-model="selectedYearFilter" @change="$emit('filter-year', selectedYearFilter)">
                    <option value="">All Years</option>
                    <option v-for="year in yearGroups" :key="year" :value="year">{{ year }}</option>
                </select>
            </div>

            <div class="toolbar-section">
                <select v-model="selectedClassFilter" @change="handleClassFilterChange">
                    <option value="">All Classes</option>
                    <option v-for="cls in availableClasses" :key="cls.id" :value="cls.id">{{ cls.name }}</option>
                </select>
            </div>

            <div class="toolbar-section">
                <input
                    v-model="searchTerm"
                    type="text"
                    placeholder="Search courses/classes..."
                    class="search-input"
                    title="Search assignments by course, class, or teacher name"
                />
                <button v-if="searchTerm" @click="searchTerm = ''" class="clear-search-btn" title="Clear search">
                    ✕
                </button>
                <div v-if="debouncedSearchTerm || selectedClassFilter" class="filter-status">
                    <small>
                        Filters active:
                        <span v-if="debouncedSearchTerm" class="filter-tag">Search: "{{ debouncedSearchTerm }}"</span>
                        <span v-if="selectedClassFilter" class="filter-tag"
                            >Class: {{ getClassName(selectedClassFilter) }}</span
                        >
                        <span v-if="!showLessonSchedules" class="filter-tag">Courses only</span>
                        <span v-if="!showNonInstructional" class="filter-tag">Instructional periods only</span>
                    </small>
                </div>
            </div>

            <div class="toolbar-section">
                <button
                    @click="clearPeriodFocus"
                    v-if="focusedPeriodId"
                    class="focus-button active"
                    title="Show all periods"
                >
                    Show All Periods (Currently: {{ getFocusedPeriodName() }})
                </button>
                <span v-else class="focus-hint"
                    >Click a period name to focus on that period and see available courses</span
                >
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

        <!-- Main Grid -->
        <div v-if="safeLength(visibleDays) > 0 && safeLength(visiblePeriods) > 0" class="main-grid-container">
            <!-- Debug info for main grid with visibility status -->
            <div class="debug-grid-info">
                <small>
                    ✅ NORMAL MODE - Days: {{ safeLength(visibleDays) }}, Periods: {{ safeLength(visiblePeriods) }} |
                    Drafts: {{ safeLength(draftSchedules) }}, Live: {{ safeLength(liveSchedules) }} | Mode:
                    {{ isLiveMode ? 'Live' : 'Planning' }}
                </small>
            </div>

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
                        @dragover.prevent="handleCellDragOver($event, day.id, period.id)"
                        @dragenter.prevent="handleCellDragEnter($event, day.id, period.id)"
                        @dragleave="handleCellDragLeave($event, day.id, period.id)"
                        @drop="handleCellDrop($event, day.id, period.id)"
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
                                :draggable="!isReadOnly && !isEditing(assignment.id)"
                                @dragstart="handleAssignmentDragStart($event, assignment, day.id, period.id)"
                                @dragend="handleAssignmentDragEnd($event)"
                                :data-assignment-id="assignment.id"
                                :data-day-id="day.id"
                                :data-period-id="period.id"
                            >
                                <!-- Normal Assignment Display -->
                                <div v-if="!isEditing(assignment.id)" class="assignment-content">
                                    <span class="course-name">{{ getDisplayName(assignment) }}</span>
                                    <span class="class-name" v-if="assignment.class_id">{{
                                        getClassName(assignment.class_id)
                                    }}</span>
                                    <span class="teacher-names" v-if="safeLength(assignment.teacher_ids) > 0">
                                        {{ getTeacherNames(assignment.teacher_ids) }}
                                    </span>
                                    <span class="room-name" v-if="assignment.room_id">{{
                                        getRoomName(assignment.room_id)
                                    }}</span>

                                    <!-- Quick Edit Button -->
                                    <button
                                        v-if="!isReadOnly"
                                        @click.stop="startInlineEdit(assignment, day.id, period.id)"
                                        class="quick-edit-btn"
                                        title="Click to edit inline"
                                    >
                                        ✏️
                                    </button>
                                </div>

                                <!-- Inline Editor -->
                                <InlineAssignmentEditor
                                    v-if="isEditing(assignment.id)"
                                    :assignment="assignment"
                                    :courses="courses"
                                    :teachers="teachers"
                                    :classes="classes"
                                    :rooms="rooms"
                                    :subjects="subjects"
                                    @save="saveInlineEdit"
                                    @cancel="cancelInlineEdit"
                                    @delete="deleteInlineAssignment"
                                />

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

        <!-- Debug info when grid is hidden -->
        <div v-else class="grid-hidden-debug">
            <div class="grid-hidden-message">
                ❌ Grid Hidden - Debug Info:
                <ul>
                    <li>Visible Days: {{ safeLength(visibleDays) }} ({{ visibleDays.map(d => d.name).join(', ') }})</li>
                    <li>
                        Visible Periods: {{ safeLength(visiblePeriods) }} ({{
                            visiblePeriods.map(p => p.name || p.label).join(', ')
                        }})
                    </li>
                    <li>Show Non-Instructional: {{ showNonInstructional }}</li>
                    <li>Focused Period: {{ focusedPeriodId }}</li>
                    <li>Total Periods Available: {{ safeLength(periods) }}</li>
                    <li>Total School Days Available: {{ safeLength(schoolDays) }}</li>
                </ul>
                <button
                    @click="
                        showNonInstructional = true;
                        focusedPeriodId = null;
                    "
                    class="emergency-show-btn"
                >
                    🚨 Emergency: Show All Data
                </button>
            </div>
        </div>

        <!-- Available Courses for Focused Period -->
        <div v-if="focusedPeriodId" class="available-courses-panel">
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
                            @click="assignCourseToSlot(course, day.id, focusedPeriodId)"
                            :title="`Click to assign or drag ${course.name || course.course_name} to schedule`"
                            :draggable="true"
                            :data-course-id="course.id"
                            :data-day-id="day.id"
                            :data-period-id="focusedPeriodId"
                            @dragstart="handleCourseDragStart($event, course)"
                            @dragend="handleCourseDragEnd($event)"
                        >
                            <div class="course-name">{{ course.name || course.course_name || course.title }}</div>
                            <div class="course-details">
                                <small v-if="course.course_code">Code: {{ course.course_code }}</small>
                                <small v-if="course.max_students">Max: {{ course.max_students }}</small>
                                <small v-if="course.subject_name">{{ course.subject_name }}</small>
                            </div>
                        </div>
                        <div
                            v-if="safeLength(getAvailableCoursesForSlot(day.id, focusedPeriodId)) === 0"
                            class="no-courses"
                        >
                            No courses available for this day/period
                        </div>
                    </div>
                </div>
            </div>

            <!-- No Preferred Days Courses Panel -->
            <div v-if="safeLength(getNoPreferredDaysCourses()) > 0" class="no-preferred-days-panel">
                <h4>📅 Courses with No Preferred Days</h4>
                <p class="panel-description">
                    These courses have no time slot restrictions and can be scheduled on any day:
                </p>
                <div class="no-preferred-courses-list">
                    <div
                        v-for="course in getNoPreferredDaysCourses()"
                        :key="`no-pref-${course.id}`"
                        class="course-card"
                        :style="getCourseCardStyle(course)"
                        @click="assignCourseToFocusedSlot(course)"
                        :title="`${course.name || course.course_name} - Can be scheduled on any day`"
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
import { computed, ref, watch, nextTick } from 'vue';
import InlineAssignmentEditor from './InlineAssignmentEditor.vue';
import { validateAndUnwrapArray, safeLength, safeArray, toArray, len, nonEmpty } from '../../utils/arrayUtils.js';

export default {
    name: 'SchedulerGrid',
    components: {
        InlineAssignmentEditor,
    },
    props: {
        // Data props
        periods: { type: Array, default: () => [] },
        schoolDays: { type: Array, default: () => [] },
        courses: { type: Array, default: () => [] },
        teachers: { type: Array, default: () => [] },
        classes: { type: Array, default: () => [] },
        rooms: { type: Array, default: () => [] },
        subjects: { type: Array, default: () => [] },

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
        'toggle-lesson-schedules',
        'filter-year',
        'undo-last',
        'save-draft',
        'update-assignments',
        'mode-changed',
        'period-focus-changed',
    ],

    setup(props, { emit }) {
        // Local state
        const showNonInstructional = ref(true);
        const showLessonSchedules = ref(true);
        const isLiveMode = ref(false);
        const selectedYearFilter = ref('');
        const selectedClassFilter = ref('');
        const focusedPeriodId = ref(null);

        // Inline editing state
        const editingAssignment = ref(null);
        const editingCell = ref(null);

        // Watch for unexpected focusedPeriodId changes (simplified logging)
        watch(focusedPeriodId, (newValue, oldValue) => {
            if (newValue !== oldValue) {
                console.log('🔍 [SchedulerGrid] focusedPeriodId changed:', { from: oldValue, to: newValue });
            }
        });

        // Component initialized

        // Simplified computed properties without reactive caching to prevent disappearing
        const visibleDays = computed(() => {
            const validatedDays = validateAndUnwrapArray(props.schoolDays, 'schoolDays');

            if (safeLength(validatedDays) === 0) {
                return [];
            }

            const maxDaysLimit = props.maxDays || 7;
            return validatedDays.slice(0, maxDaysLimit);
        });

        const visiblePeriods = computed(() => {
            // Use the periods directly - they are already normalized in the parent component
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

            // Debug info only when periods change
            if (safeLength(validatedPeriods) > 0) {
                console.log('🔍 [SchedulerGrid] Period processing summary:', {
                    totalPeriods: safeLength(validatedPeriods),
                    focusedPeriodId: focusedPeriodId.value,
                    showNonInstructional: showNonInstructional.value,
                    stableIds: validatedPeriods.slice(0, 3).map(p => p.id), // Show stable IDs generated
                });
            }

            let filteredPeriods = validatedPeriods;

            // First filter by focused period if set
            if (focusedPeriodId.value) {
                const focusedPeriods = validatedPeriods.filter(period => period.id === focusedPeriodId.value);

                // Safety check: if focused period ID doesn't match any periods, clear the focus and show all
                if (safeLength(focusedPeriods) === 0) {
                    console.warn('🚨 [SchedulerGrid] Focused period ID does not match any periods. Clearing focus.', {
                        focusedId: focusedPeriodId.value,
                        availableIds: validatedPeriods.slice(0, 5).map(p => p.id),
                    });
                    focusedPeriodId.value = null;
                    // Don't filter, show all periods
                } else {
                    filteredPeriods = focusedPeriods;
                }
            }
            // Then filter by instructional status
            else if (!showNonInstructional.value) {
                filteredPeriods = validatedPeriods.filter(period => {
                    // Show periods where attendance_requirement is 'flexible' or 'required' or 'contracted'
                    let shouldShow =
                        period.attendance_requirement === 'flexible' ||
                        period.attendance_requirement === 'required' ||
                        period.attendance_requirement === 'contracted';

                    // Alternative checks if attendance_requirement is not available or doesn't match expected values
                    if (!shouldShow && !period.attendance_requirement) {
                        // Fall back to is_instructional field
                        if (period.is_instructional !== undefined) {
                            shouldShow = period.is_instructional === true;
                        }
                        // Check block_type - exclude known non-instructional types
                        else if (period.block_type) {
                            const nonInstructionalTypes = [
                                'break',
                                'pause',
                                'lunch',
                                'recess',
                                'assembly',
                                'flexband',
                                'frühdienst',
                            ];
                            shouldShow = !nonInstructionalTypes.includes(period.block_type.toLowerCase());
                        }
                        // Fall back to label/name content analysis
                        else if (period.label || period.name) {
                            const text = (period.label || period.name).toLowerCase();
                            const isBreakTime =
                                text.includes('break') ||
                                text.includes('pause') ||
                                text.includes('lunch') ||
                                text.includes('flexband') ||
                                text.includes('frühdienst') ||
                                text.includes('benutzerdefiniert');
                            shouldShow = !isBreakTime;
                        }
                        // Default to showing if we can't determine
                        else {
                            shouldShow = true;
                        }
                    }
                    // If we still don't have a clear answer and attendance_requirement exists but is not 'flexible' or 'required'
                    else if (
                        !shouldShow &&
                        period.attendance_requirement &&
                        period.attendance_requirement !== 'optional'
                    ) {
                        // Show periods that aren't explicitly optional
                        shouldShow = true;
                    }

                    return shouldShow;
                });
            }

            // Simple fallback - if no periods match filters, show all periods
            if (safeLength(filteredPeriods) === 0 && safeLength(props.periods) > 0) {
                filteredPeriods = safeArray(props.periods);
            }

            return filteredPeriods;
        });

        // Performance optimization - debounced filtering
        const debouncedSearchTerm = ref('');
        const searchTerm = ref('');
        let searchDebounceTimer = null;

        // Watch for search changes with debouncing
        watch(searchTerm, newTerm => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                debouncedSearchTerm.value = newTerm;
            }, 300); // 300ms debounce
        });

        // Optimized filtered entries computed property
        const filteredEntries = computed(() => {
            let entries = isLiveMode.value ? props.liveSchedules : props.draftSchedules;

            // Debug: Log schedule data to understand the issue
            console.log('🔍 [SchedulerGrid] filteredEntries - Schedule debugging:', {
                isLiveMode: isLiveMode.value,
                draftSchedulesCount: safeLength(props.draftSchedules),
                liveSchedulesCount: safeLength(props.liveSchedules),
                rawDraftSchedules: props.draftSchedules,
                rawLiveSchedules: props.liveSchedules,
                selectedEntries: entries,
                selectedEntriesCount: safeLength(entries),
                sampleEntry: safeLength(entries) > 0 ? entries[0] : null,
            });

            // Apply debounced search filter
            if (debouncedSearchTerm.value) {
                const search = debouncedSearchTerm.value.toLowerCase();
                entries = entries.filter(entry => {
                    return (
                        (entry.course_name && entry.course_name.toLowerCase().includes(search)) ||
                        (entry.subject_name && entry.subject_name.toLowerCase().includes(search)) ||
                        (entry.class_name && entry.class_name.toLowerCase().includes(search)) ||
                        (entry.teacher_names && entry.teacher_names.some(name => name.toLowerCase().includes(search)))
                    );
                });
            }

            // Apply class filter
            if (selectedClassFilter.value) {
                entries = entries.filter(entry => entry.class_id === selectedClassFilter.value);
            }

            // Apply lesson schedule filter
            if (!showLessonSchedules.value) {
                entries = entries.filter(entry => entry.course_id);
            }

            return entries;
        });

        const yearGroups = computed(() => {
            const years = new Set();
            props.classes.forEach(cls => {
                if (cls.year_group) years.add(cls.year_group);
            });
            return Array.from(years).sort();
        });

        const availableClasses = computed(() => {
            // Filter classes based on year filter if applied
            if (selectedYearFilter.value) {
                return props.classes.filter(cls => cls.year_group === selectedYearFilter.value);
            }
            return props.classes.slice().sort((a, b) => a.name.localeCompare(b.name));
        });

        const yearGroupStats = computed(() => {
            return yearGroups.value.map(year => {
                const yearClasses = props.classes.filter(cls => cls.year_group === year);
                const yearAssignments = props.draftSchedules.filter(assignment =>
                    yearClasses.some(cls => cls.id === assignment.class_id)
                );

                const totalSlots =
                    safeLength(visiblePeriods.value) * safeLength(visibleDays.value) * safeLength(yearClasses);
                const scheduledCourses = yearAssignments.length;
                const averagePerDay = scheduledCourses / safeLength(visibleDays.value);
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
            // Use optimized filtered entries for better performance
            let assignments = filteredEntries.value.filter(assignment => {
                // Enhanced day ID matching - handle multiple day ID formats robustly
                const currentDay = props.schoolDays.find(d => d.id === dayId || d.day_id === dayId);

                // Try multiple approaches for day matching to handle different data structures
                const assignmentDayMatch =
                    assignment.day_id === dayId || // Direct day_id match
                    assignment.day_id === currentDay?.day_id || // Match via current day's day_id
                    assignment.day_id === currentDay?.id || // Match via current day's id
                    assignment.day_number === currentDay?.day_number || // Match via day number
                    assignment.day_number === currentDay?.id || // Sometimes day_number matches id
                    (currentDay?.name && assignment.day_name_en === currentDay.name) || // Match by day name
                    (currentDay?.name_en && assignment.day_name_en === currentDay.name_en); // Match by English name

                // Enhanced period matching to handle both UUID and stable IDs
                const currentPeriod = props.periods.find(p => p.id === periodId);
                const periodMatch = 
                    assignment.period_id === periodId || // Direct period_id match (for stable IDs like "period-7")
                    assignment.period_id === currentPeriod?.originalId || // Match original UUID from normalized periods
                    (assignment.block_number && currentPeriod?.block_number && 
                     assignment.block_number === currentPeriod.block_number); // Match by block_number

                // Debug: Log assignment matching details for first few attempts
                if (Math.random() < 0.05) { // Only log randomly to avoid spam (5% chance)
                    console.log('🔍 [SchedulerGrid] Assignment matching debug:', {
                        requestedDay: dayId,
                        requestedPeriod: periodId,
                        currentPeriod: currentPeriod,
                        assignmentDayId: assignment.day_id,
                        assignmentPeriodId: assignment.period_id,
                        assignmentBlockNumber: assignment.block_number,
                        currentDay: currentDay,
                        assignmentDayMatch: assignmentDayMatch,
                        periodMatch: periodMatch,
                        periodMatchReasons: {
                            directMatch: assignment.period_id === periodId,
                            originalIdMatch: assignment.period_id === currentPeriod?.originalId,
                            blockNumberMatch: assignment.block_number === currentPeriod?.block_number
                        },
                        finalMatch: assignmentDayMatch && periodMatch,
                        sampleAssignment: assignment
                    });
                }

                return assignmentDayMatch && periodMatch;
            });

            // Sort assignments by class name, then by course/subject name (already filtered by filteredEntries)
            const sortedAssignments = assignments.sort((a, b) => {
                const classA = getClassName(a.class_id);
                const classB = getClassName(b.class_id);

                if (classA !== classB) {
                    return classA.localeCompare(classB);
                }

                // If same class, sort by course/subject name
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

            // Check for conflicts
            const hasConflict = assignments.some(assignment =>
                props.conflicts.some(conflict => conflict.day_id === dayId && conflict.period_id === periodId)
            );
            if (hasConflict) classes.push('has-conflicts');

            return classes;
        }

        function getCellAriaLabel(day, period) {
            const assignments = getCellAssignments(day.id, period.id);
            if (safeLength(assignments) === 0) {
                return `${day.name} ${period.name}: Empty, click to add assignment`;
            }
            const courseNames = assignments.map(a => getDisplayName(a)).join(', ');
            return `${day.name} ${period.name}: ${courseNames}, ${safeLength(assignments)} assignment${safeLength(assignments) > 1 ? 's' : ''}`;
        }

        function getAssignmentClasses(assignment) {
            const classes = [];
            if (hasConflicts(assignment)) classes.push('has-conflict');
            if (hasDeletedEntities(assignment)) classes.push('has-deleted-entities');

            // Add class for lesson schedules (no course, only class and subject)
            const courseName = getCourseName(assignment.course_id);
            if (!courseName && assignment.subject_id) {
                classes.push('lesson-schedule');
            }

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
            if (!courseId) {
                return null; // Return null instead of "No Course" to allow fallback to subject
            }
            const course = props.courses.find(c => c.id === courseId);
            const courseName = course?.name || course?.course_name || course?.title;

            if (!course) {
                return null; // Return null to allow fallback to subject
            }

            return courseName || null;
        }

        function getSubjectName(subjectId) {
            if (!subjectId) return null;
            const subject = props.subjects.find(s => s.id === subjectId);
            return subject?.name || subject?.title || subject?.subject_name || `Subject ${subjectId}`;
        }

        function getDisplayName(assignment) {
            // Prioritize course name, then subject name, then fallback
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

        // New event handlers
        function handleLessonScheduleToggle() {
            emit('toggle-lesson-schedules', showLessonSchedules.value);
        }

        function handleClassFilterChange() {
            // Class filter is handled locally - no need to emit
        }

        function handleModeSwitch() {
            emit('mode-changed', isLiveMode.value ? 'live' : 'planning');
        }
        function togglePeriodFocus(periodId) {
            if (focusedPeriodId.value === periodId) {
                focusedPeriodId.value = null;
            } else {
                focusedPeriodId.value = periodId;
            }
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
            // Get the day information
            const currentDay = props.schoolDays.find(d => d.id === dayId || d.day_id === dayId);

            // Get day number from multiple possible sources
            let currentDayNumber = currentDay?.day_number;
            if (!currentDayNumber) {
                // Fall back to finding by index if day_number not available
                const dayIndex = props.schoolDays.findIndex(d => d.id === dayId || d.day_id === dayId);
                currentDayNumber = dayIndex >= 0 ? dayIndex + 1 : null; // 1-based numbering
            }

            console.log('🎯 [SchedulerGrid] getAvailableCoursesForSlot:', {
                dayId,
                periodId,
                currentDay,
                currentDayNumber,
                coursesTotal: safeLength(props.courses),
            });

            // Filter courses that are available for this specific day/period
            let availableCourses = props.courses.filter(course => {
                // If course has no time slot restrictions, it's available anywhere
                if (!course.possible_time_slots?.length) {
                    return true;
                }

                // Check if this day/period combination is in the course's possible slots
                return course.possible_time_slots.some(slot => {
                    // Handle string format "day_number|period_id"
                    if (typeof slot === 'string' && slot.includes('|')) {
                        const [dayNumber, slotPeriodId] = slot.split('|');
                        const slotDayNumber = parseInt(dayNumber);
                        return slotDayNumber === currentDayNumber && slotPeriodId === periodId;
                    }
                    // Handle object format {day_id, period_id}
                    else if (typeof slot === 'object') {
                        return slot.day_id === dayId && slot.period_id === periodId;
                    }
                    return false;
                });
            });

            // Apply search filter
            if (debouncedSearchTerm.value) {
                const search = debouncedSearchTerm.value.toLowerCase();
                availableCourses = availableCourses.filter(course => {
                    return (
                        (course.name && course.name.toLowerCase().includes(search)) ||
                        (course.course_name && course.course_name.toLowerCase().includes(search)) ||
                        (course.title && course.title.toLowerCase().includes(search)) ||
                        (course.course_code && course.course_code.toLowerCase().includes(search)) ||
                        (course.subject_name && course.subject_name.toLowerCase().includes(search)) ||
                        (course.description && course.description.toLowerCase().includes(search))
                    );
                });
            }

            // Apply class filter
            if (selectedClassFilter.value) {
                const selectedClass = props.classes.find(cls => cls.id === selectedClassFilter.value);
                if (selectedClass) {
                    availableCourses = availableCourses.filter(course => {
                        // Check if course is available for the selected class's year group
                        if (course.is_for_year_groups && safeLength(course.is_for_year_groups) > 0) {
                            return course.is_for_year_groups.includes(selectedClass.year_group);
                        }
                        return true; // If no restrictions, course is available
                    });
                }
            }

            console.log('🎯 [SchedulerGrid] Available courses for slot (after filtering):', {
                dayId,
                periodId,
                availableCount: safeLength(availableCourses),
                searchTerm: debouncedSearchTerm.value,
                classFilter: selectedClassFilter.value,
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
            if (props.isReadOnly) return;

            console.log('🎯 [SchedulerGrid] Assigning course to slot:', {
                courseId: course.id,
                courseName: course.name || course.course_name,
                dayId,
                periodId,
            });

            // Emit cell click to open assignment modal with this course pre-selected
            emit('cell-click', {
                dayId,
                periodId,
                period: props.periods.find(p => p.id === periodId),
                preSelectedCourse: course,
            });
        }

        function getNoPreferredDaysCourses() {
            // Get courses that have no possible_time_slots restrictions for the focused period
            const coursesWithoutRestrictions = props.courses.filter(course => {
                // Course has no time slot restrictions
                return !course.possible_time_slots || safeLength(course.possible_time_slots) === 0;
            });

            // Filter by current search term and class filter for consistency
            let filteredCourses = coursesWithoutRestrictions;

            if (debouncedSearchTerm.value) {
                const search = debouncedSearchTerm.value.toLowerCase();
                filteredCourses = filteredCourses.filter(course => {
                    return (
                        (course.name && course.name.toLowerCase().includes(search)) ||
                        (course.course_name && course.course_name.toLowerCase().includes(search)) ||
                        (course.title && course.title.toLowerCase().includes(search)) ||
                        (course.course_code && course.course_code.toLowerCase().includes(search)) ||
                        (course.subject_name && course.subject_name.toLowerCase().includes(search))
                    );
                });
            }

            // Filter by selected class if a class filter is applied
            if (selectedClassFilter.value) {
                // Check if the course is available for the selected class
                filteredCourses = filteredCourses.filter(course => {
                    // If course has is_for_year_groups, check if it includes the selected class's year
                    const selectedClass = props.classes.find(cls => cls.id === selectedClassFilter.value);
                    if (selectedClass && course.is_for_year_groups) {
                        return course.is_for_year_groups.includes(selectedClass.year_group);
                    }
                    return true; // If no year restrictions, course is available
                });
            }

            console.log('📅 [NoPreferredDays] Filtered courses:', {
                total: safeLength(coursesWithoutRestrictions),
                afterSearch: safeLength(filteredCourses),
                searchTerm: debouncedSearchTerm.value,
                classFilter: selectedClassFilter.value,
            });

            return filteredCourses;
        }

        function assignCourseToFocusedSlot(course) {
            if (props.isReadOnly || !focusedPeriodId.value) return;

            // For no-preferred-days courses, we could assign to any day
            // Let's just show the assignment modal for the first day
            const firstDay = visibleDays.value[0];
            if (firstDay) {
                assignCourseToSlot(course, firstDay.id, focusedPeriodId.value);
            }
        }

        // Drag and Drop State
        const draggedCourse = ref(null);
        const draggedAssignment = ref(null);
        const dragOverCell = ref(null);

        // Drag and Drop Methods
        function handleCourseDragStart(event, course) {
            if (props.isReadOnly) {
                event.preventDefault();
                return;
            }

            console.log('🎯 [DragDrop] Course drag started:', course.name || course.course_name);
            draggedCourse.value = course;

            // Set drag data
            event.dataTransfer.setData(
                'text/plain',
                JSON.stringify({
                    type: 'course',
                    course: course,
                    id: course.id,
                })
            );

            event.dataTransfer.effectAllowed = 'copy';

            // Add visual feedback
            event.target.style.opacity = '0.5';
        }

        function handleCourseDragEnd(event) {
            console.log('🎯 [DragDrop] Course drag ended');
            draggedCourse.value = null;
            event.target.style.opacity = '1';
        }

        function handleAssignmentDragStart(event, assignment, dayId, periodId) {
            if (props.isReadOnly) {
                event.preventDefault();
                return;
            }

            console.log('🎯 [DragDrop] Assignment drag started:', assignment.course_name || assignment.subject_name);
            draggedAssignment.value = {
                assignment,
                originalDayId: dayId,
                originalPeriodId: periodId,
            };

            // Set drag data
            event.dataTransfer.setData(
                'text/plain',
                JSON.stringify({
                    type: 'assignment',
                    assignment: assignment,
                    originalDayId: dayId,
                    originalPeriodId: periodId,
                })
            );

            event.dataTransfer.effectAllowed = 'move';

            // Add visual feedback
            event.target.style.opacity = '0.5';
        }

        function handleAssignmentDragEnd(event) {
            console.log('🎯 [DragDrop] Assignment drag ended');
            draggedAssignment.value = null;
            event.target.style.opacity = '1';

            // Clear any drag over effects
            dragOverCell.value = null;
        }

        function handleCellDragOver(event, dayId, periodId) {
            event.preventDefault();

            if (!draggedCourse.value && !draggedAssignment.value) return;

            // Show drop allowed effect
            event.dataTransfer.dropEffect = draggedAssignment.value ? 'move' : 'copy';

            return false;
        }

        function handleCellDragEnter(event, dayId, periodId) {
            event.preventDefault();

            if (!draggedCourse.value && !draggedAssignment.value) return;

            // Add visual feedback to cell
            dragOverCell.value = `${dayId}-${periodId}`;

            // Add CSS class for visual feedback
            event.currentTarget.classList.add('drag-over');
        }

        function handleCellDragLeave(event, dayId, periodId) {
            // Only remove feedback if we're actually leaving the cell
            if (!event.currentTarget.contains(event.relatedTarget)) {
                dragOverCell.value = null;
                event.currentTarget.classList.remove('drag-over');
            }
        }

        function handleCellDrop(event, dayId, periodId) {
            event.preventDefault();

            // Clear visual feedback
            dragOverCell.value = null;
            event.currentTarget.classList.remove('drag-over');

            try {
                const dragData = JSON.parse(event.dataTransfer.getData('text/plain'));

                if (dragData.type === 'course') {
                    // Assign new course to cell
                    const course = dragData.course;
                    console.log(
                        '🎯 [DragDrop] Dropping course:',
                        course.name || course.course_name,
                        'to cell:',
                        dayId,
                        periodId
                    );

                    assignCourseToSlot(course, dayId, periodId);
                } else if (dragData.type === 'assignment') {
                    // Move existing assignment to new cell
                    const assignment = dragData.assignment;
                    const originalDayId = dragData.originalDayId;
                    const originalPeriodId = dragData.originalPeriodId;

                    console.log(
                        '🎯 [DragDrop] Moving assignment from:',
                        originalDayId,
                        originalPeriodId,
                        'to:',
                        dayId,
                        periodId
                    );

                    // Check if it's actually moving to a different cell
                    if (originalDayId !== dayId || originalPeriodId !== periodId) {
                        // Emit update to move the assignment
                        emit('update-assignments', {
                            action: 'move',
                            assignment: assignment,
                            fromDayId: originalDayId,
                            fromPeriodId: originalPeriodId,
                            toDayId: dayId,
                            toPeriodId: periodId,
                        });
                    }
                }
            } catch (error) {
                console.error('🚨 [DragDrop] Error handling drop:', error);
            }
        }

        // Inline Editing Methods
        function isEditing(assignmentId) {
            return editingAssignment.value?.id === assignmentId;
        }

        function handleAssignmentClick(assignment, dayId, periodId) {
            if (props.isReadOnly) return;

            // If already editing this assignment, do nothing
            if (isEditing(assignment.id)) return;

            // If editing another assignment, close it first
            if (editingAssignment.value) {
                cancelInlineEdit();
            }

            // For now, just show details (can be changed to start inline edit)
            openAssignmentDetails(assignment);
        }

        function startInlineEdit(assignment, dayId, periodId) {
            if (props.isReadOnly) return;

            console.log('✏️ [InlineEdit] Starting edit for assignment:', assignment.id);

            // Close any existing edit
            if (editingAssignment.value) {
                cancelInlineEdit();
            }

            editingAssignment.value = assignment;
            editingCell.value = { dayId, periodId };
        }

        function saveInlineEdit(updatedAssignment) {
            console.log('💾 [InlineEdit] Saving changes for assignment:', updatedAssignment.id);

            // Create updated assignments array
            const currentSchedules = isLiveMode.value ? props.liveSchedules : props.draftSchedules;
            const updatedSchedules = currentSchedules.map(schedule =>
                schedule.id === updatedAssignment.id ? updatedAssignment : schedule
            );

            // Emit update
            emit('update-assignments', updatedSchedules);

            // Clear editing state
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

            // Create updated assignments array without this assignment
            const currentSchedules = isLiveMode.value ? props.liveSchedules : props.draftSchedules;
            const updatedSchedules = currentSchedules.filter(schedule => schedule.id !== assignment.id);

            // Emit update
            emit('update-assignments', updatedSchedules);

            // Clear editing state
            editingAssignment.value = null;
            editingCell.value = null;
        }

        return {
            // State
            showNonInstructional,
            showLessonSchedules,
            isLiveMode,
            selectedYearFilter,
            selectedClassFilter,
            focusedPeriodId,
            draggedCourse,
            draggedAssignment,
            dragOverCell,
            editingAssignment,
            editingCell,
            searchTerm,
            debouncedSearchTerm,

            // Computed
            visibleDays,
            visiblePeriods,
            filteredEntries,
            yearGroups,
            availableClasses,
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
            getSubjectName,
            getDisplayName,
            getClassName,
            getTeacherNames,
            getRoomName,
            hasConflicts,
            hasDeletedEntities,
            handleCellClick,
            openAssignmentModal,
            openAssignmentDetails,
            handleLessonScheduleToggle,
            handleClassFilterChange,
            handleModeSwitch,
            togglePeriodFocus,
            clearPeriodFocus,
            getFocusedPeriodName,
            getAvailableCoursesForSlot,
            getCourseCardStyle,
            assignCourseToSlot,
            getNoPreferredDaysCourses,
            assignCourseToFocusedSlot,

            // Drag and Drop Methods
            handleCourseDragStart,
            handleCourseDragEnd,
            handleAssignmentDragStart,
            handleAssignmentDragEnd,
            handleCellDragOver,
            handleCellDragEnter,
            handleCellDragLeave,
            handleCellDrop,

            // Inline Editing Methods
            isEditing,
            handleAssignmentClick,
            startInlineEdit,
            saveInlineEdit,
            cancelInlineEdit,
            deleteInlineAssignment,

            // Utility functions
            safeLength,
            safeArray,
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

/* Emergency recovery mode styling */
.main-grid-container.emergency-mode {
    border: 3px solid #e74c3c;
    box-shadow: 0 0 10px rgba(231, 76, 60, 0.3);
}

.main-grid-container.normal-mode {
    border: 2px solid #27ae60;
    box-shadow: 0 0 5px rgba(39, 174, 96, 0.2);
}

.emergency-recovery-notice {
    background: #ffe6e6;
    border: 2px solid #e74c3c;
    padding: 12px;
    margin: 8px;
    border-radius: 4px;
    text-align: center;
}

.emergency-message {
    color: #c0392b;
    font-weight: bold;
}

.emergency-recover-btn {
    background: #e74c3c;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    margin-left: 10px;
    cursor: pointer;
    font-size: 0.9em;
}

.emergency-recover-btn:hover {
    background: #c0392b;
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
    position: relative;
}

.search-input {
    padding: 6px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    width: 200px;
    transition: border-color 0.2s ease;
}

.search-input:focus {
    outline: none;
    border-color: #007cba;
    box-shadow: 0 0 0 2px rgba(0, 123, 186, 0.2);
}

.clear-search-btn {
    background: #6c757d;
    color: white;
    border: none;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: -30px;
    z-index: 2;
}

.clear-search-btn:hover {
    background: #5a6268;
}

.filter-status {
    margin-left: 8px;
    padding: 4px 8px;
    background: rgba(0, 123, 186, 0.1);
    border: 1px solid rgba(0, 123, 186, 0.3);
    border-radius: 4px;
}

.filter-tag {
    display: inline-block;
    background: #007cba;
    color: white;
    padding: 2px 6px;
    margin: 0 2px;
    border-radius: 3px;
    font-size: 11px;
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

.assignment-item.lesson-schedule {
    opacity: 0.6;
    border-style: dashed;
    background: #f5f5f5 !important;
    font-style: italic;
    font-size: 0.8em; /* Make text smaller */
    transform: scale(0.95); /* Make overall size smaller */
    margin: 1px; /* Add small margin for visual separation */
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

/* Available Courses Panel */
.available-courses-panel {
    padding: 16px;
    background: #f0f8ff;
    border-top: 1px solid #007cba;
    border-bottom: 1px solid #ddd;
}

.available-courses-panel h3 {
    margin: 0 0 8px 0;
    color: #007cba;
    font-size: 1.1em;
}

.focused-period-info {
    margin: 0 0 16px 0;
    color: #666;
    font-size: 0.9em;
}

.day-courses-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
}

.day-courses-column h4 {
    margin: 0 0 12px 0;
    padding: 8px 12px;
    background: #007cba;
    color: white;
    border-radius: 4px;
    text-align: center;
    font-size: 0.9em;
}

.available-courses-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 300px;
    overflow-y: auto;
}

.course-card {
    padding: 10px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.85em;
}

.course-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 124, 186, 0.15);
    border-color: #007cba;
}

.course-card .course-name {
    font-weight: 500;
    color: #333;
    margin-bottom: 4px;
    display: block;
}

.course-card .course-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.course-card .course-details small {
    color: #666;
    font-size: 0.8em;
}

.no-courses {
    padding: 16px;
    text-align: center;
    color: #999;
    font-style: italic;
    background: #f9f9f9;
    border: 1px dashed #ddd;
    border-radius: 4px;
}

/* No Preferred Days Panel */
.no-preferred-days-panel {
    padding: 16px;
    background: #f0f8e6;
    border: 1px solid #52c41a;
    border-radius: 4px;
    margin-top: 16px;
}

.no-preferred-days-panel h4 {
    margin: 0 0 8px 0;
    color: #52c41a;
    font-size: 1em;
    display: flex;
    align-items: center;
    gap: 8px;
}

.panel-description {
    margin: 0 0 12px 0;
    color: #666;
    font-size: 0.9em;
    font-style: italic;
}

.no-preferred-courses-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 12px;
}

.flexible-tag {
    color: #52c41a !important;
    font-weight: 500;
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

/* New styles for enhanced functionality */
.filter-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.9em;
    margin-right: 16px;
}

.mode-switcher {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9em;
}

.mode-toggle {
    width: 40px;
    height: 20px;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background: #ccc;
    border-radius: 10px;
    position: relative;
    cursor: pointer;
    transition: background-color 0.3s;
}

.mode-toggle:checked {
    background: #007cba;
}

.mode-toggle::before {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: white;
    border-radius: 50%;
    transition: left 0.3s;
}

.mode-toggle:checked::before {
    left: 22px;
}

.focus-button {
    padding: 6px 12px;
    border: 1px solid #007cba;
    border-radius: 4px;
    background: white;
    color: #007cba;
    cursor: pointer;
    font-size: 0.9em;
    transition: all 0.2s;
}

.focus-button:hover {
    background: #007cba;
    color: white;
}

.focus-button.active {
    background: #007cba;
    color: white;
}

.focus-hint {
    font-size: 0.85em;
    color: #666;
    font-style: italic;
}

.period-label-cell.focused {
    background: #e6f7ff !important;
    border-left: 4px solid #007cba;
}

.period-label-cell {
    cursor: pointer;
    transition: background-color 0.2s;
}

.period-label-cell:hover {
    background: #f0f7ff !important;
}

/* New debug styles for grid visibility issues */
.debug-grid-info {
    padding: 8px 16px;
    background: #e8f5e8;
    border: 1px solid #4caf50;
    border-radius: 4px;
    margin-bottom: 8px;
    font-family: monospace;
}

.grid-hidden-debug {
    padding: 20px;
    background: #ffebee;
    border: 2px solid #f44336;
    border-radius: 8px;
    margin: 16px;
    text-align: center;
}

.grid-hidden-message {
    color: #c62828;
    font-weight: bold;
    font-size: 1.1em;
}

.grid-hidden-message ul {
    text-align: left;
    display: inline-block;
    margin: 12px 0;
    color: #666;
    font-weight: normal;
    font-size: 0.9em;
    font-family: monospace;
}

.grid-hidden-message li {
    margin-bottom: 6px;
}

.emergency-show-btn {
    padding: 12px 24px;
    background: #f44336;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 1em;
    font-weight: bold;
    cursor: pointer;
    margin-top: 16px;
    transition: all 0.2s;
}

.emergency-show-btn:hover {
    background: #d32f2f;
    transform: scale(1.05);
}

.main-grid-container {
    border: 2px solid #4caf50;
    border-radius: 6px;
    padding: 4px;
}

/* Drag and Drop Styles */
.draggable-course {
    cursor: grab;
    transition: all 0.2s ease;
    border: 1px solid rgba(0, 123, 186, 0.3);
}

.draggable-course:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    border-color: #007cba;
}

.draggable-course:active {
    cursor: grabbing;
}

.draggable-assignment {
    cursor: grab;
    transition: all 0.2s ease;
}

.draggable-assignment:hover {
    transform: scale(1.02);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.draggable-assignment:active {
    cursor: grabbing;
}

.drop-zone {
    position: relative;
    transition: all 0.2s ease;
}

.drop-zone.drag-over {
    background: rgba(0, 123, 186, 0.1) !important;
    border: 2px dashed #007cba !important;
    transform: scale(1.02);
}

.drop-zone.drag-over::after {
    content: '📋 Drop here';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 123, 186, 0.9);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
    pointer-events: none;
    z-index: 10;
}

.assignment-item.dragging {
    opacity: 0.5;
    transform: rotate(5deg);
}

.course-card.dragging {
    opacity: 0.5;
    transform: rotate(-3deg) scale(1.05);
}

/* Enhanced visual feedback for drag operations */
.scheduler-grid:has(.dragging) .drop-zone:not(.drag-over) {
    background: rgba(255, 255, 255, 0.8);
    border: 1px dashed #ddd;
}

.scheduler-grid:has(.dragging) .assignment-item:not(.dragging) {
    opacity: 0.7;
}

/* Inline Editing Styles */
.assignment-content {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.quick-edit-btn {
    position: absolute;
    top: 2px;
    right: 2px;
    background: rgba(0, 123, 186, 0.8);
    color: white;
    border: none;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    font-size: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: all 0.2s ease;
    z-index: 2;
}

.assignment-item:hover .quick-edit-btn {
    opacity: 1;
}

.quick-edit-btn:hover {
    background: #007cba;
    transform: scale(1.1);
}

.assignment-item.editing {
    z-index: 100;
    position: relative;
}

.assignment-item.editing .assignment-content {
    display: none;
}
</style>
