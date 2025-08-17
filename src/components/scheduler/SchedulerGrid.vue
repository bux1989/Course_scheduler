<template>
  <div class="scheduler-grid" role="grid" aria-label="School schedule grid" :data-readonly="isReadOnly">
    <!-- Main Grid -->
    <div v-if="safeLength(visibleDays) > 0 && safeLength(visiblePeriods) > 0" class="main-grid-container">
      <!-- Grid Header with Days -->
      <div class="grid-header" role="row">
        <div class="period-header-cell" role="columnheader">
          <span class="period-label">Period</span>
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
              <span class="period-time">{{ formatTime(period.start_time) }} - {{ formatTime(period.end_time) }}</span>
              <span v-if="!period.is_instructional" class="non-instructional-badge">
                {{ period.type || 'Break' }}
              </span>
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
            @dragover.prevent="!isReadOnly ? handleCellDragOver($event) : null"
            @dragenter.prevent="!isReadOnly ? handleCellDragEnter($event) : null"
            @dragleave="!isReadOnly ? handleCellDragLeave($event) : null"
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
                :draggable="!isReadOnly"
                @dragstart="!isReadOnly ? handleAssignmentDragStart($event, assignment, day.id, period.id) : null"
                @dragend="!isReadOnly ? handleAssignmentDragEnd($event) : null"
                :data-assignment-id="assignment.id"
                :data-day-id="day.id"
                :data-period-id="period.id"
              >
                <div class="assignment-content">
                  <span class="course-name">{{ getDisplayName(assignment) }}</span>
                  <span class="class-name" v-if="assignment.class_id">{{ getClassName(assignment.class_id) }}</span>
                  <span class="teacher-names" v-if="getAssignmentTeachers(assignment)">
                    {{ getAssignmentTeachers(assignment) }}
                  </span>
                  <span class="room-name" v-if="assignment.room_id">{{ getRoomName(assignment.room_id) }}</span>
                </div>

                <div v-if="hasConflicts(assignment)" class="conflict-indicator" title="Has conflicts">⚠️</div>
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
          <div class="period-label-cell stats-label-cell">
            <div class="stats-title">
              <span class="stats-emoji">📈</span>
              <span>Grade Stats</span>
            </div>
          </div>

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
                <div class="stat-value">{{ formatInt(gradeStats.totalSpots) }}</div>
                <div class="stat-value">{{ formatInt(gradeStats.averageSpots) }}</div>
                <div class="stat-value">{{ formatInt(gradeStats.coursesCount) }}</div>
              </div>
            </div>

            <div v-if="safeLength(getDailyGradeStats(day.id, focusedPeriodId)) === 0" class="no-stats">
              <span class="no-stats-text">No courses scheduled</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Available Courses for Focused Period (planner only) -->
    <div v-if="focusedPeriodId && !isReadOnly" class="available-courses-panel">
      <h3>Available Courses for {{ getFocusedPeriodName() }}</h3>
      <div class="focused-period-info">
        <em>Drag a course into a day cell to schedule it, or click a card to assign.</em>
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
              :title="`${course.name || course.course_name || course.title || 'Course'}`"
              :draggable="true"
              :data-course-id="course.id"
              :data-day-id="day.id"
              :data-period-id="focusedPeriodId"
              @dragstart="handleCourseDragStart($event, course)"
              @dragend="handleCourseDragEnd($event)"
              @click="assignCourseByClick(course, day.id, focusedPeriodId)"
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

      <!-- Courses with no preferred days -->
      <div v-if="safeLength(getNoPreferredDaysCourses()) > 0" class="no-preferred-days-panel">
        <h4>📅 Courses with No Preferred Days</h4>
        <p class="panel-description">These can be scheduled on any day:</p>
        <div class="no-preferred-courses-list">
          <div
            v-for="course in getNoPreferredDaysCourses()"
            :key="`no-pref-${course.id}`"
            class="course-card"
            :style="getCourseCardStyle(course)"
            @click="focusedPeriodId ? assignCourseByClick(course, visibleDays[0]?.id, focusedPeriodId) : null"
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

    <!-- Fallback when grid cannot render -->
    <div v-else-if="safeLength(visibleDays) === 0 || safeLength(visiblePeriods) === 0" class="grid-hidden-debug">
      <div class="grid-hidden-message">
        Grid hidden. Please provide schoolDays and periods.
      </div>
    </div>
  </div>
</template>

<script>
import { computed, ref } from 'vue';

export default {
  name: 'SchedulerGrid',
  props: {
    // Data props (already filtered upstream)
    periods: { type: Array, default: () => [] },
    schoolDays: { type: Array, default: () => [] },
    courses: { type: Array, default: () => [] },
    teachers: { type: Array, default: () => [] },
    classes: { type: Array, default: () => [] },
    rooms: { type: Array, default: () => [] },
    subjects: { type: Array, default: () => [] },

    // Schedule data (parent decides what to pass)
    draftSchedules: { type: Array, default: () => [] },
    liveSchedules: { type: Array, default: () => [] },

    // Configuration
    isReadOnly: { type: Boolean, default: false },
    showStatistics: { type: Boolean, default: true },
    maxDays: { type: Number, default: 6 },
    // NEW: keep earlier behavior (no click-to-add) by default
    enableCellAdd: { type: Boolean, default: false },

    // State
    conflicts: { type: Array, default: () => [] },
    canUndo: { type: Boolean, default: false },
    isSaving: { type: Boolean, default: false },
  },

  emits: [
    'cell-click',
    'assignment-details',
    'period-focus-changed',
    'scheduler-drop',
    'scheduler-drag-start',
    'scheduler-drag-end',
    'update-assignments',
    'course-edit',
  ],

  setup(props, { emit }) {
    // Local safe helpers
    const safeArray = (v) => (Array.isArray(v) ? v : []);
    const safeLength = (v) => (Array.isArray(v) ? v.length : 0);

    // Focused period for stats and the available courses panel
    const focusedPeriodId = ref(null);

    // Drag state
    const draggedCourse = ref(null);
    const draggedAssignment = ref(null);

    // Days and periods to render (no internal filtering except focus)
    const visibleDays = computed(() => safeArray(props.schoolDays).slice(0, props.maxDays || 7));
    const visiblePeriods = computed(() => {
      const all = safeArray(props.periods);
      if (!focusedPeriodId.value) return all;
      const match = all.filter((p) => p.id === focusedPeriodId.value);
      return match.length ? match : all;
    });

    // Use draft by default (parent can pass live instead if desired)
    const currentSchedules = computed(() => props.draftSchedules);

    // Formatting
    function formatTime(timeString) {
      if (!timeString) return '';
      const parts = String(timeString).split(':');
      return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : String(timeString);
    }
    function formatDate(date) {
      if (!date) return '';
      return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    function formatInt(val) {
      const n = Number(val);
      return Number.isFinite(n) ? Math.round(n) : val;
    }

    // Rendering helpers
    function getCellAssignments(dayId, periodId) {
      const entries = currentSchedules.value;
      const assignments = entries.filter((a) => a.day_id === dayId && a.period_id === periodId);

      // Sort by class then course/subject
      return assignments.sort((a, b) => {
        const classA = getClassName(a.class_id);
        const classB = getClassName(b.class_id);
        if (classA !== classB) return classA.localeCompare(classB);

        const courseA = getCourseName(a.course_id) || getSubjectName(a.subject_id) || '';
        const courseB = getCourseName(b.course_id) || getSubjectName(b.subject_id) || '';
        return courseA.localeCompare(courseB);
      });
    }

    function getCellClasses(dayId, periodId) {
      const assignments = getCellAssignments(dayId, periodId);
      const classes = [];
      if (safeLength(assignments) > 0) classes.push('has-assignments');
      if (safeLength(assignments) > 1) classes.push('multiple-assignments');

      const hasConflict = assignments.some((a) =>
        props.conflicts.some((c) => c.day_id === dayId && c.period_id === periodId)
      );
      if (hasConflict) classes.push('has-conflicts');

      return classes;
    }

    function getCellAriaLabel(day, period) {
      const assignments = getCellAssignments(day.id, period.id);
      if (safeLength(assignments) === 0) return `${day.name} ${period.name}: Empty, click to add assignment`;
      const names = assignments.map((a) => getDisplayName(a)).join(', ');
      return `${day.name} ${period.name}: ${names}, ${safeLength(assignments)} assignment${
        safeLength(assignments) > 1 ? 's' : ''
      }`;
    }

    function getAssignmentClasses(assignment) {
      const classes = [];
      if (hasConflicts(assignment)) classes.push('has-conflict');
      if (hasDeletedEntities(assignment)) classes.push('has-deleted-entities');

      // Lesson schedules (no course, only subject)
      const courseName = getCourseName(assignment.course_id);
      if (!courseName && assignment.subject_id) classes.push('lesson-schedule');
      return classes;
    }

    function getAssignmentStyles(assignment) {
      const course = props.courses.find((c) => c.id === assignment.course_id);
      const cls = props.classes.find((c) => c.id === assignment.class_id);
      return {
        borderLeft: `4px solid ${course?.color || cls?.color || '#e0e0e0'}`,
        backgroundColor: course?.color ? `${course.color}15` : cls?.color ? `${cls.color}15` : '#f9f9f9',
      };
    }

    function getCourseName(courseId) {
      if (!courseId) return null;
      const course = props.courses.find((c) => c.id === courseId);
      return course?.name || course?.course_name || course?.title || null;
    }

    function getSubjectName(subjectId) {
      if (!subjectId) return null;
      const subject = props.subjects.find((s) => s.id === subjectId);
      return subject?.name || subject?.title || subject?.subject_name || null;
    }

    function getDisplayName(a) {
      return getCourseName(a.course_id) || getSubjectName(a.subject_id) || 'No Course';
    }

    function getClassName(classId) {
      if (!classId) return '';
      const cls = props.classes.find((c) => c.id === classId);
      return cls?.name || '';
    }

    function getTeacherNames(teacherIds) {
      if (!teacherIds?.length) return '';
      const names = teacherIds
        .map((id) => props.teachers.find((t) => t.id === id)?.name)
        .filter(Boolean);
      return names.join(', ');
    }

    function getAssignmentTeachers(a) {
      if (Array.isArray(a.teacher_names) && a.teacher_names.length) return a.teacher_names.join(', ');
      const ids = a.staff_ids || a.teacher_ids;
      return ids?.length ? getTeacherNames(ids) : '';
    }

    function getRoomName(roomId) {
      if (!roomId) return '';
      return props.rooms.find((r) => r.id === roomId)?.name || '';
    }

    function hasConflicts(a) {
      return props.conflicts.some(
        (c) =>
          c.day_id === a.day_id &&
          c.period_id === a.period_id &&
          (c.assignment_id === a.id ||
            c.teacher_ids?.some((id) => a.teacher_ids?.includes(id)) ||
            c.class_id === a.class_id ||
            c.room_id === a.room_id)
      );
    }

    function hasDeletedEntities(a) {
      const courseOk = !a.course_id || props.courses.some((c) => c.id === a.course_id);
      const classOk = !a.class_id || props.classes.some((c) => c.id === a.class_id);
      const roomOk = !a.room_id || props.rooms.some((r) => r.id === a.room_id);
      const teachersOk = !a.teacher_ids?.length || a.teacher_ids.every((id) => props.teachers.some((t) => t.id === id));
      return !(courseOk && classOk && roomOk && teachersOk);
    }

    // Click on any cell (even empty) to allow adding (optional based on prop)
    function handleCellClick(dayId, periodId, period) {
      if (props.isReadOnly || !props.enableCellAdd) return;
      emit('cell-click', { dayId, periodId, period, mode: 'add', preSelectedCourse: null });
    }

    // Course drag
    function handleCourseDragStart(event, course) {
      draggedCourse.value = course;
      emit('scheduler-drag-start', {
        courseId: course.id,
        courseName: course.name || course.course_name || '',
        courseCode: course.code || course.course_code || '',
        source: 'drag-start',
        timestamp: new Date().toISOString(),
      });

      event.dataTransfer.setData(
        'text/plain',
        JSON.stringify({
          type: 'course',
          course,
          id: course.id,
        })
      );
      event.dataTransfer.effectAllowed = 'copy';
      event.target.style.opacity = '0.5';
    }

    function handleCourseDragEnd(event) {
      emit('scheduler-drag-end', {
        courseId: draggedCourse.value?.id || null,
        courseName: draggedCourse.value?.name || draggedCourse.value?.course_name || null,
        courseCode: draggedCourse.value?.code || draggedCourse.value?.course_code || null,
        success: false,
        source: 'drag-end',
        timestamp: new Date().toISOString(),
      });
      draggedCourse.value = null;
      event.target.style.opacity = '1';
    }

    // Assignment drag
    function handleAssignmentDragStart(event, assignment, dayId, periodId) {
      draggedAssignment.value = { assignment, originalDayId: dayId, originalPeriodId: periodId };
      emit('scheduler-drag-start', {
        courseId: assignment.course_id || '',
        courseName: assignment.course_name || assignment.display_cell || '',
        courseCode: assignment.course_code || '',
        source: 'drag-start',
        timestamp: new Date().toISOString(),
      });

      event.dataTransfer.setData(
        'text/plain',
        JSON.stringify({ type: 'assignment', assignment, originalDayId: dayId, originalPeriodId: periodId })
      );
      event.dataTransfer.effectAllowed = 'move';
      event.target.style.opacity = '0.5';
    }

    function handleAssignmentDragEnd(event) {
      emit('scheduler-drag-end', {
        courseId: draggedAssignment.value?.assignment?.course_id || null,
        courseName:
          draggedAssignment.value?.assignment?.course_name ||
          draggedAssignment.value?.assignment?.display_cell ||
          null,
        courseCode: draggedAssignment.value?.assignment?.course_code || null,
        success: false,
        source: 'drag-end',
        timestamp: new Date().toISOString(),
      });
      draggedAssignment.value = null;
      event.target.style.opacity = '1';
    }

    // Drop target handling (accept both courses and assignments)
    function handleCellDragOver(event) {
      if (!draggedAssignment.value && !draggedCourse.value) return false;
      event.dataTransfer.dropEffect = draggedAssignment.value ? 'move' : 'copy';
      return false;
    }

    function handleCellDragEnter(event) {
      if (!draggedAssignment.value && !draggedCourse.value) return;
      event.currentTarget.classList.add('drag-over');
    }

    function handleCellDragLeave(event) {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        event.currentTarget.classList.remove('drag-over');
      }
    }

    function handleCellDrop(event, dayId, periodId) {
      event.preventDefault();
      event.currentTarget.classList.remove('drag-over');

      try {
        const dragData = JSON.parse(event.dataTransfer.getData('text/plain'));

        if (dragData.type === 'course') {
          const course = dragData.course || {};
          emit('scheduler-drop', {
            dayId,
            periodId,
            courseId: course.id || dragData.id || '',
            courseName: course.name || course.course_name || '',
            courseCode: course.code || course.course_code || '',
            teacherIds: [],
            primaryTeacherId: null,
            roomId: null,
            source: 'course-drop',
            timestamp: new Date().toISOString(),
          });

          emit('scheduler-drag-end', {
            courseId: course.id || dragData.id || '',
            courseName: course.name || course.course_name || '',
            courseCode: course.code || course.course_code || '',
            success: true,
            source: 'drag-end',
            timestamp: new Date().toISOString(),
          });
        } else if (dragData.type === 'assignment') {
          const a = dragData.assignment;
          if (dragData.originalDayId !== dayId || dragData.originalPeriodId !== periodId) {
            emit('scheduler-drop', {
              dayId,
              periodId,
              courseId: a.course_id || '',
              courseName: a.course_name || a.display_cell || '',
              courseCode: a.course_code || '',
              teacherIds: a.teacher_ids || [],
              primaryTeacherId: a.primary_teacher_id || null,
              roomId: a.room_id || null,
              source: 'assignment-move',
              timestamp: new Date().toISOString(),
              fromDayId: dragData.originalDayId,
              fromPeriodId: dragData.originalPeriodId,
              action: 'move',
            });

            emit('update-assignments', {
              action: 'move',
              assignment: a,
              fromDayId: dragData.originalDayId,
              fromPeriodId: dragData.originalPeriodId,
              toDayId: dayId,
              toPeriodId: periodId,
            });
          }
        }
      } catch (e) {
        console.error('Drop error:', e);
      }
    }

    // Period focus
    function togglePeriodFocus(periodId) {
      focusedPeriodId.value = focusedPeriodId.value === periodId ? null : periodId;
      emit('period-focus-changed', focusedPeriodId.value);
    }

    function getFocusedPeriodName() {
      const p = props.periods.find((x) => x.id === focusedPeriodId.value);
      return p?.name || p?.label || 'Unknown Period';
    }

    // Available courses logic (courses normalized upstream; relies on course.possibleSlots)
    function getAvailableCoursesForSlot(dayId, periodId) {
      return safeArray(props.courses).filter((course) => {
        const slots = Array.isArray(course.possibleSlots) ? course.possibleSlots : [];
        if (slots.length === 0) return true; // no restriction
        return slots.some((s) => s.dayId === dayId && s.periodId === periodId);
      });
    }

    function getNoPreferredDaysCourses() {
      return safeArray(props.courses).filter((course) => {
        const slots = Array.isArray(course.possibleSlots) ? course.possibleSlots : [];
        return slots.length === 0;
      });
    }

    function getCourseCardStyle(course) {
      return {
        borderLeft: `4px solid ${course.color || '#007cba'}`,
        backgroundColor: course.color ? `${course.color}15` : '#f0f8ff',
      };
    }

    // Optional click-to-assign (for users who prefer clicking instead of dragging)
    function assignCourseByClick(course, dayId, periodId) {
      emit('scheduler-drop', {
        dayId,
        periodId,
        courseId: course.id || '',
        courseName: course.name || course.course_name || '',
        courseCode: course.code || course.course_code || '',
        teacherIds: [],
        primaryTeacherId: null,
        roomId: null,
        source: 'course-click',
        timestamp: new Date().toISOString(),
      });
    }

    // Assignment click -> details
    function handleAssignmentClick(assignment) {
      emit('assignment-details', assignment);
    }

    return {
      // state
      focusedPeriodId,
      draggedCourse,
      draggedAssignment,

      // computed
      visibleDays,
      visiblePeriods,
      currentSchedules,

      // methods
      safeLength,
      safeArray,
      formatTime,
      formatDate,
      formatInt,
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

      // drag handlers
      handleCourseDragStart,
      handleCourseDragEnd,
      handleAssignmentDragStart,
      handleAssignmentDragEnd,
      handleCellDragOver,
      handleCellDragEnter,
      handleCellDragLeave,
      handleCellDrop,

      togglePeriodFocus,
      getFocusedPeriodName,

      // available courses
      getAvailableCoursesForSlot,
      getNoPreferredDaysCourses,
      getCourseCardStyle,
      assignCourseByClick,

      // details
      handleAssignmentClick,
    };
  },
};
</script>

<style scoped>
/* styles unchanged from previous message (includes larger grade stats text) */
.scheduler-grid {
  display: flex;
  flex-direction: column;
  width: 100%;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
  background: white;
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
  cursor: pointer;
  transition: background-color 0.2s;
}

.period-label-cell:hover {
  background: #f0f7ff !important;
}

.period-label-cell.focused {
  background: #e6f7ff !important;
  border-left: 4px solid #007cba;
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
  font-size: 0.8em;
  transform: scale(0.95);
  margin: 1px;
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

.add-text {
  opacity: 0.8;
}

/* Drag and Drop Styles */
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

/* Grade Statistics Row Styles (larger text + rounding applied via formatInt) */
.statistics-row {
  display: flex;
  border-bottom: 2px solid #007cba;
  background: #f0f8ff;
  border-top: 2px solid #007cba;
}

.stats-label-cell {
  background: #007cba !important;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stats-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.95em;
  font-weight: 600;
}

.stats-emoji {
  font-size: 1.15em;
}

.day-statistics-cell {
  flex: 1;
  border-right: 1px solid #ddd;
  padding: 10px;
  background: white;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 110px;
}

.stats-headers {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
  padding: 4px;
  background: rgba(0, 124, 186, 0.1);
  border-radius: 4px;
}

.stat-header {
  font-size: 0.95em;
  text-align: center;
  cursor: help;
  padding: 2px 4px;
  border-radius: 3px;
  flex: 1;
}

.stat-header:hover {
  background: rgba(0, 124, 186, 0.2);
}

.stats-rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-grow: 1;
}

.grade-stats-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 0.9em;
}

.grade-number {
  font-weight: 700;
  color: #333;
  min-width: 22px;
  font-size: 1em;
}

.stat-value {
  text-align: center;
  padding: 2px 4px;
  background: white;
  border-radius: 3px;
  font-size: 0.9em;
  color: #333;
  min-width: 22px;
  flex: 1;
}

.no-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  color: #999;
}

.no-stats-text {
  font-size: 0.85em;
  font-style: italic;
  text-align: center;
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
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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
  max-height: 340px;
  overflow-y: auto;
}

.course-card {
  padding: 10px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: grab;
  transition: all 0.2s;
  font-size: 0.9em;
}

.course-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 124, 186, 0.15);
  border-color: #007cba;
}

.course-card:active {
  cursor: grabbing;
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
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.flexible-tag {
  color: #52c41a !important;
  font-weight: 500;
}

/* Read-only mode */
.scheduler-grid[data-readonly='true'] .schedule-cell {
  cursor: default;
}

.scheduler-grid[data-readonly='true'] .schedule-cell:hover {
  background: inherit;
}

.scheduler-grid[data-readonly='true'] .draggable-assignment,
.scheduler-grid[data-readonly='true'] .draggable-course {
  cursor: default;
  pointer-events: none;
}

.scheduler-grid[data-readonly='true'] .empty-cell {
  color: #999;
}

.scheduler-grid[data-readonly='true'] .empty-text {
  font-style: italic;
  color: #999;
  font-size: 0.8em;
}

/* Fallback hidden message */
.grid-hidden-debug {
  padding: 16px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 6px;
  margin: 16px;
  text-align: center;
  color: #92400e;
}

/* Responsive */
@media (max-width: 768px) {
  .period-header-cell,
  .period-label-cell {
    width: 110px;
    font-size: 0.85em;
  }

  .day-header-cell {
    font-size: 0.85em;
  }
}
</style>
