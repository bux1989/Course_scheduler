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

    <!-- Hidden fallback when grid is not renderable -->
    <div v-else class="grid-hidden-debug">
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
    showStatistics: { type: Boolean, default: true },
    maxDays: { type: Number, default: 6 },
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
    const safeArray = (v) => (Array.isArray(v) ? v : []);
    const safeLength = (v) => (Array.isArray(v) ? v.length : 0);

    const focusedPeriodId = ref(null);

    const visibleDays = computed(() => safeArray(props.schoolDays).slice(0, props.maxDays || 7));
    const visiblePeriods = computed(() => {
      const all = safeArray(props.periods);
      if (!focusedPeriodId.value) return all;
      const match = all.filter((p) => p.id === focusedPeriodId.value);
      return match.length ? match : all;
    });

    const currentSchedules = computed(() => props.draftSchedules);

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

    function getCellAssignments(dayId, periodId) {
      const entries = currentSchedules.value;
      const assignments = entries.filter((a) => a.day_id === dayId && a.period_id === periodId);
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
      const courseName = getCourseName(assignment.course_id);
      if (!courseName && assignment.subject_id) classes.push('lesson-schedule');
      return classes;
    }
    function getAssignmentStyles(assignment) {
      const course = props.courses.find((c) => c.id === assignment.course_id);
      const cls = props.classes.find((c) => c.id === assignment.class_id);
      return {
        borderLeft: `4px solid ${course?.color || cls?.color || '#e0e0e0'}`,
        backgroundColor: course?.color ? `${course.color}15` : cls?.color ? `${cls.color}15` : '#f9f9f9`,
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
      const names = teacherIds.map((id) => props.teachers.find((t) => t.id === id)?.name).filter(Boolean);
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

    // IMPORTANT: always emit so parent can open AssignmentModal for empty cells
    function handleCellClick(dayId, periodId, period) {
      if (props.isReadOnly) return;
      emit('cell-click', { dayId, periodId, period, mode: 'add', preSelectedCourse: null });
    }

    // Drag and drop of assignments (course drag sources are external now)
    const draggedAssignment = ref(null);
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
          draggedAssignment.value?.assignment?.course_name || draggedAssignment.value?.assignment?.display_cell || null,
        courseCode: draggedAssignment.value?.assignment?.course_code || null,
        success: false,
        source: 'drag-end',
        timestamp: new Date().toISOString(),
      });
      draggedAssignment.value = null;
      event.target.style.opacity = '1';
    }
    function handleCellDragOver(event) {
      if (!draggedAssignment.value) return false;
      event.dataTransfer.dropEffect = 'move';
      return false;
    }
    function handleCellDragEnter(event) {
      if (!draggedAssignment.value) return;
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

    function togglePeriodFocus(periodId) {
      focusedPeriodId.value = focusedPeriodId.value === periodId ? null : periodId;
      emit('period-focus-changed', focusedPeriodId.value);
    }
    function getFocusedPeriodName() {
      const p = props.periods.find((x) => x.id === focusedPeriodId.value);
      return p?.name || p?.label || 'Unknown Period';
    }

    // Grade stats helpers (averages rounded via formatInt in template)
    function parseGrades(course) {
      const grades = [];
      if (course.is_for_year_g && typeof course.is_for_year_g === 'object') {
        for (const [, grade] of Object.entries(course.is_for_year_g)) {
          if (grade && grade > 0) grades.push(Number(grade));
        }
      } else if (Array.isArray(course.is_for_year_groups)) {
        grades.push(...course.is_for_year_groups.map((g) => Number(g)).filter((g) => g > 0));
      } else if (Array.isArray(course.year_groups)) {
        grades.push(...course.year_groups.map((g) => Number(g)).filter((g) => g > 0));
      }
      return [...new Set(grades)].sort((a, b) => a - b);
    }
    const allGrades = computed(() => {
      const set = new Set();
      safeArray(props.courses).forEach((c) => parseGrades(c).forEach((g) => set.add(g)));
      return Array.from(set).sort((a, b) => a - b);
    });
    function findCourseById(courseId) {
      return safeArray(props.courses).find((c) => c.id === courseId);
    }
    function getScheduledCoursesForSlot(dayId, periodId) {
      const scheduled = [];
      const scheduledEntries = safeArray(currentSchedules.value).filter(
        (e) => e.day_id === dayId && e.period_id === periodId
      );
      scheduledEntries.forEach((entry) => {
        const course = findCourseById(entry.course_id);
        if (course) {
          const totalSpots = course.max_students || course.capacity || 0;
          const freeSpots = entry.free_spaces !== undefined ? entry.free_spaces : totalSpots;
          scheduled.push({ ...course, scheduledEntry: entry, freeSpots, totalSpots });
        }
      });
      return scheduled;
    }
    function getDailyGradeStats(dayId, periodId) {
      if (!periodId) return [];
      const scheduledCourses = getScheduledCoursesForSlot(dayId, periodId);
      const out = [];
      allGrades.value.forEach((grade) => {
        let totalSpots = 0;
        let coursesCount = 0;
        let totalGradeAllocation = 0;
        scheduledCourses.forEach((course) => {
          const courseGrades = parseGrades(course);
          if (courseGrades.includes(grade)) {
            coursesCount++;
            const freeSpots = course.freeSpots || 0;
            if (courseGrades.length === 1) {
              totalSpots += freeSpots;
              totalGradeAllocation += freeSpots;
            } else {
              const perGrade = freeSpots / courseGrades.length;
              totalSpots += freeSpots;
              totalGradeAllocation += perGrade;
            }
          }
        });
        if (coursesCount > 0 || totalSpots > 0) {
          out.push({ grade, totalSpots, averageSpots: totalGradeAllocation, coursesCount });
        }
      });
      return out;
    }

    function handleAssignmentClick(assignment) {
      if (props.isReadOnly) {
        emit('assignment-details', assignment);
        return;
      }
      emit('assignment-details', assignment);
    }

    return {
      // state
      focusedPeriodId,
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
      handleAssignmentClick,
      handleAssignmentDragStart,
      handleAssignmentDragEnd,
      handleCellDragOver,
      handleCellDragEnter,
      handleCellDragLeave,
      handleCellDrop,
      togglePeriodFocus,
      getFocusedPeriodName,
      getDailyGradeStats,
      allGrades,
    };
  },
};
</script>

<style scoped>
/* ... styles unchanged from the previous version ... */
</style>
