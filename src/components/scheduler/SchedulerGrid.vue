<template>
  <div class="scheduler-grid" role="grid" aria-label="School schedule grid" :data-readonly="isReadOnly">
    <!-- Main Grid -->
    <div v-if="safeLength(visibleDays) > 0 && safeLength(visiblePeriods) > 0" class="main-grid-container">
      <!-- Grid Header -->
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
            :class="{ focused: isFocused(period.id) }"
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
            <!-- Assignments -->
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
                <div v-if="!isEditing(assignment.id)" class="assignment-content">
                  <span class="course-name">{{ getDisplayName(assignment) }}</span>
                  <span class="meta-line">
                    <span class="teacher-names" v-if="getAssignmentTeachers(assignment)">
                      {{ getAssignmentTeachers(assignment) }}
                    </span>
                    <span class="room-name" v-if="assignment.room_id">• {{ getRoomName(assignment.room_id) }}</span>
                  </span>
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

        <!-- Grade Statistics Row -->
        <div v-if="showStatistics && focusedPeriodId" class="statistics-row">
          <div class="period-label-cell stats-label-cell">
            <div class="stats-title">
              <span class="stats-emoji">📈</span>
              <span>Grade Stats</span>
            </div>
          </div>

          <div v-for="day in visibleDays" :key="`stats-${day.id}`" class="day-statistics-cell">
            <div class="stats-headers" role="presentation">
              <div class="header-spacer" aria-hidden="true"></div>
              <div class="stat-header" title="Total free spots available">📊</div>
              <div class="stat-header" title="Average spots available">⚖️</div>
              <div class="stat-header" title="Courses available">📚</div>
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

    <!-- Available Courses Panel -->
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
              :class="{ 'is-dragging': isDraggingCourse(course.id) }"
              :style="getCourseCardStyle(course)"
              :title="`${course.name || course.course_name || course.title || 'Course'}`"
              :draggable="true"
              :data-course-id="course.id"
              :data-day-id="day.id"
              :data-period-id="focusedPeriodId"
              @dragstart="handleCourseDragStart($event, course)"
              @dragend="handleCourseDragEnd($event)"
              @click="assignCourseToSlot(course, day.id, focusedPeriodId)"
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

      <div v-if="safeLength(getNoPreferredDaysCourses()) > 0" class="no-preferred-days-panel">
        <h4>📅 Courses with No Preferred Days</h4>
        <p class="panel-description">These can be scheduled on any day:</p>
        <div class="no-preferred-courses-list">
          <div
            v-for="course in getNoPreferredDaysCourses()"
            :key="`no-pref-${course.id}`"
            class="course-card"
            :style="getCourseCardStyle(course)"
            @click="focusedPeriodId ? assignCourseToSlot(course, visibleDays[0]?.id, focusedPeriodId) : null"
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

    <!-- Assignment Modal (combined frequency + teacher/room) -->
    <AssignmentModal
      v-if="assignmentModal.show && !isReadOnly"
      :visible="assignmentModal.show"
      :dayId="assignmentModal.dayId"
      :periodId="assignmentModal.periodId"
      :period="assignmentModal.period"
      :preSelectedCourse="assignmentModal.course"
      :teachers="teachers"
      :rooms="rooms"
      :schoolDays="schoolDays"
      :defaultFrequencyChecked="false"
      @close="closeAssignmentModal"
      @submit="handleAssignmentModalSubmit"
    />

    <!-- Context Menu -->
    <div
      v-if="contextMenu.show"
      class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @click.stop
    >
      <div class="context-menu-item" @click="editAssignmentFromContext">
        {{ (!isReadOnly && !isLiveMode) ? '✏️ Edit Assignment' : '📄 View Assignment' }}
      </div>
      <div
        v-if="!isReadOnly && !isLiveMode"
        class="context-menu-item delete"
        @click="deleteAssignmentFromContext"
      >
        🗑️ Delete Assignment
      </div>
    </div>
    <div v-if="contextMenu.show" class="context-menu-backdrop" @click="closeContextMenu"></div>

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
import { computed, ref } from 'vue';
import InlineAssignmentEditor from './InlineAssignmentEditor.vue';
import AssignmentModal from './AssignmentModal.vue';
import { emitSchedulerRemoveEvent } from '../../utils/events.js';

export default {
  name: 'SchedulerGrid',
  components: {
    InlineAssignmentEditor,
    AssignmentModal,
  },
  props: {
    // Data
    periods: { type: Array, default: () => [] },
    schoolDays: { type: Array, default: () => [] },
    courses: { type: Array, default: () => [] },
    teachers: { type: Array, default: () => [] },
    classes: { type: Array, default: () => [] },
    rooms: { type: Array, default: () => [] },
    subjects: { type: Array, default: () => [] },

    // Schedules
    draftSchedules: { type: Array, default: () => [] },
    liveSchedules: { type: Array, default: () => [] },

    // Config/mode
    isReadOnly: { type: Boolean, default: false },
    isLiveMode: { type: Boolean, default: false },
    showStatistics: { type: Boolean, default: true },
    maxDays: { type: Number, default: 6 },
    enableCellAdd: { type: Boolean, default: false },

    // Available list behavior
    hideScheduledInAvailable: { type: Boolean, default: true },

    // Compat
    parentEmit: { type: Function, default: null },
    emitDropEvents: { type: Boolean, default: false },

    // State
    conflicts: { type: Array, default: () => [] },
    canUndo: { type: Boolean, default: false },
    isSaving: { type: Boolean, default: false },
  },
  emits: [
    'cell-click',
    'assignment-details',
    'update-assignments',
    'period-focus-changed',
    'scheduler-drop',
    'scheduler-drag-start',
    'scheduler-drag-end',
    'course-edit',
  ],
  setup(props, { emit }) {
    // Helpers
    const safeArray = (v) => (Array.isArray(v) ? v : []);
    const safeLength = (v) => (Array.isArray(v) ? v.length : 0);
    const normId = (v) => String(v ?? '');
    const isSameId = (a, b) => normId(a) === normId(b);

    // Focus
    const focusedPeriodId = ref(null);

    // Drag state
    const draggedCourse = ref(null);
    const draggedAssignment = ref(null);

    // Available list state
    const optimisticallyScheduled = ref(new Set()); // keys: day|period|course (one-off)
    const recurringWhitelist = ref(new Set());       // keys: day|period|course (keep visible)

    // Inline editor/context menu
    const editingAssignment = ref(null);
    const editingCell = ref(null);

    const contextMenu = ref({
      show: false, x: 0, y: 0, assignment: null, dayId: null, periodId: null,
    });

    // Combined assignment modal
    const assignmentModal = ref({
      show: false,
      dayId: null,
      periodId: null,
      period: null,
      course: null,
    });

    // Visible data
    const visibleDays = computed(() => safeArray(props.schoolDays).slice(0, props.maxDays || 7));
    const visiblePeriods = computed(() => {
      const all = safeArray(props.periods);
      if (!focusedPeriodId.value) return all;
      const filtered = all.filter((p) => isSameId(p.id, focusedPeriodId.value));
      return filtered.length ? filtered : all;
    });
    const currentSchedules = computed(() => (props.isLiveMode ? props.liveSchedules : props.draftSchedules));

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

    // Lookups
    function getCourseName(courseId) {
      if (!courseId) return null;
      const course = props.courses.find((c) => isSameId(c.id, courseId));
      return course?.name || course?.course_name || course?.title || null;
    }
    function getSubjectName(subjectId) {
      if (!subjectId) return null;
      const subject = props.subjects.find((s) => isSameId(s.id, subjectId));
      return subject?.name || subject?.title || subject?.subject_name || null;
    }
    function getDisplayName(a) {
      return getCourseName(a.course_id) || getSubjectName(a.subject_id) || 'No Course';
    }
    function getClassName(classId) {
      if (!classId) return '';
      const cls = props.classes.find((c) => isSameId(c.id, classId));
      return cls?.name || '';
    }
    function getTeacherNames(teacherIds) {
      if (!teacherIds?.length) return '';
      const names = teacherIds.map((id) => props.teachers.find((t) => isSameId(t.id, id))?.name).filter(Boolean);
      return names.join(', ');
    }
    function getAssignmentTeachers(a) {
      if (Array.isArray(a.teacher_names) && a.teacher_names.length) return a.teacher_names.join(', ');
      const ids = a.staff_ids || a.teacher_ids;
      return ids?.length ? getTeacherNames(ids) : '';
    }
    function getRoomName(roomId) {
      if (!roomId) return 'No Room';
      const room = props.rooms.find((r) => isSameId(r.id, roomId));
      return room?.name || 'Unknown Room';
    }

    function hasConflicts(a) {
      return props.conflicts.some(
        (c) =>
          isSameId(c.day_id, a.day_id) &&
          isSameId(c.period_id, a.period_id) &&
          (isSameId(c.assignment_id, a.id) ||
            c.teacher_ids?.some((id) => (a.teacher_ids || []).some((x) => isSameId(x, id))) ||
            isSameId(c.class_id, a.class_id) ||
            isSameId(c.room_id, a.room_id))
      );
    }
    function hasDeletedEntities(a) {
      const courseOk = !a.course_id || props.courses.some((c) => isSameId(c.id, a.course_id));
      const classOk = !a.class_id || props.classes.some((c) => isSameId(c.id, a.class_id));
      const roomOk = !a.room_id || props.rooms.some((r) => isSameId(r.id, a.room_id));
      const teachersOk = !a.teacher_ids?.length || a.teacher_ids.every((id) => props.teachers.some((t) => isSameId(t.id, id)));
      return !(courseOk && classOk && roomOk && teachersOk);
    }

    // Cells
    function getCellAssignments(dayId, periodId) {
      const entries = currentSchedules.value;
      const assignments = entries.filter((a) => isSameId(a.day_id, dayId) && isSameId(a.period_id, periodId));
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
        props.conflicts.some((c) => isSameId(c.day_id, dayId) && isSameId(c.period_id, periodId))
      );
      if (hasConflict) classes.push('has-conflicts');
      return classes;
    }
    function getCellAriaLabel(day, period) {
      const assignments = getCellAssignments(day.id, period.id);
      if (safeLength(assignments) === 0) return `${day.name} ${period.name}: Empty, click to add assignment`;
      const names = assignments.map((a) => getDisplayName(a)).join(', ');
      return `${day.name} ${period.name}: ${names}, ${assignments.length} assignment${assignments.length > 1 ? 's' : ''}`;
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
      const course = props.courses.find((c) => isSameId(c.id, assignment.course_id));
      const cls = props.classes.find((c) => isSameId(c.id, assignment.class_id));
      return {
        borderLeft: `4px solid ${course?.color || cls?.color || '#e0e0e0'}`,
        backgroundColor: course?.color ? `${course.color}15` : (cls?.color ? `${cls.color}15` : '#f9f9f9'),
      };
    }

    // Clicks + context menu
    function handleCellClick(dayId, periodId, period) {
      if (props.isReadOnly || !props.enableCellAdd) return;
      emit('cell-click', { dayId, periodId, period, mode: 'add', preSelectedCourse: null });
    }
    function handleAssignmentClick(assignment) {
      emit('assignment-details', assignment);
    }
    function handleAssignmentRightClick(event, assignment, dayId, periodId) {
      contextMenu.value = { show: true, x: event.clientX, y: event.clientY, assignment, dayId, periodId };
    }
    function closeContextMenu() { contextMenu.value.show = false; }
    function editAssignmentFromContext() {
      if (!contextMenu.value.assignment) return;
      if (props.isReadOnly || props.isLiveMode) startInlineEditReadOnly(contextMenu.value.assignment, contextMenu.value.dayId, contextMenu.value.periodId);
      else startInlineEdit(contextMenu.value.assignment, contextMenu.value.dayId, contextMenu.value.periodId);
      closeContextMenu();
    }
    function deleteAssignmentFromContext() {
      if (!contextMenu.value.assignment || props.isReadOnly || props.isLiveMode) { closeContextMenu(); return; }
      deleteInlineAssignment(contextMenu.value.assignment);
      closeContextMenu();
    }

    // Inline editor
    function isEditing(id) { return editingAssignment.value?.id === id; }
    function startInlineEdit(a, dayId, periodId) { if (props.isReadOnly || props.isLiveMode) return; editingAssignment.value = a; editingCell.value = { dayId, periodId }; }
    function startInlineEditReadOnly(a, dayId, periodId) { editingAssignment.value = { ...a, readOnly: true }; editingCell.value = { dayId, periodId }; }
    function saveInlineEdit(updated) {
      const data = currentSchedules.value;
      const updatedList = data.map((s) => (isSameId(s.id, updated.id) ? updated : s));
      emit('update-assignments', updatedList);
      editingAssignment.value = null; editingCell.value = null;
    }
    function cancelInlineEdit() { editingAssignment.value = null; editingCell.value = null; }
    function deleteInlineAssignment(a) {
      if (props.emitDropEvents) {
        const fn = props.parentEmit || emit;
        emitSchedulerRemoveEvent(fn, {
          dayId: a.day_id, periodId: a.period_id, assignmentId: a.id,
          courseId: a.course_id, courseName: a.course_name || a.display_cell || '',
        });
      }
      const data = currentSchedules.value;
      const updated = data.filter((s) => !isSameId(s.id, a.id));
      emit('update-assignments', updated);
      editingAssignment.value = null; editingCell.value = null;
    }

    // Drag: course
    function handleCourseDragStart(event, course) {
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

    // Drag: assignment
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
        courseName: draggedAssignment.value?.assignment?.course_name || draggedAssignment.value?.assignment?.display_cell || null,
        courseCode: draggedAssignment.value?.assignment?.course_code || null,
        success: false,
        source: 'drag-end',
        timestamp: new Date().toISOString(),
      });
      draggedAssignment.value = null;
      event.target.style.opacity = '1';
    }

    // Drop target handlers
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
          assignCourseToSlot(dragData.course || { id: dragData.id }, dayId, periodId);
        } else if (dragData.type === 'assignment') {
          const a = dragData.assignment;
          if (!isSameId(dragData.originalDayId, dayId) || !isSameId(dragData.originalPeriodId, periodId)) {
            emit('scheduler-drop', {
              dayId, periodId,
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
              action: 'move', assignment: a,
              fromDayId: dragData.originalDayId, fromPeriodId: dragData.originalPeriodId,
              toDayId: dayId, toPeriodId: periodId,
            });
          }
        }
      } catch (e) { console.error('Drop error:', e); }
    }

    // Open combined modal
    function assignCourseToSlot(course, dayId, periodId) {
      if (!course || props.isReadOnly) return;
      assignmentModal.value = {
        show: true, dayId, periodId,
        period: props.periods.find((p) => isSameId(p.id, periodId)) || null,
        course,
      };
    }
    function closeAssignmentModal() {
      assignmentModal.value = { show: false, dayId: null, periodId: null, period: null, course: null };
    }

    // Handle submit from combined modal
    function handleAssignmentModalSubmit(payload) {
      // payload contains: dayId, periodId, courseId, courseName, courseCode, teacherIds, primaryTeacherId, roomId, frequency
      const { dayId, periodId, courseId, courseName, courseCode, teacherIds, primaryTeacherId, roomId, frequency } = payload;

      // Available-list behavior
      const key = `${normId(dayId)}|${normId(periodId)}|${normId(courseId)}`;
      if (frequency === 'recurring') {
        // Keep visible: whitelist overrides any hide behavior
        recurringWhitelist.value.add(key);
        // Ensure optimistic hide is not set
        optimisticallyScheduled.value.delete(key);
      } else {
        // One-off: hide if configured
        recurringWhitelist.value.delete(key);
        if (props.hideScheduledInAvailable) {
          optimisticallyScheduled.value.add(key);
        }
      }

      // Emit final scheduler-drop
      emit('scheduler-drop', {
        dayId, periodId,
        courseId, courseName, courseCode,
        teacherIds: teacherIds || [],
        primaryTeacherId: primaryTeacherId || null,
        roomId: roomId || null,
        frequency,
        source: 'modal-assignment',
        timestamp: new Date().toISOString(),
      });

      // Success drag-end signal (compat)
      emit('scheduler-drag-end', {
        courseId, courseName, courseCode,
        success: true, source: 'drag-end', timestamp: new Date().toISOString(),
      });

      closeAssignmentModal();
    }

    // Focus
    function togglePeriodFocus(periodId) {
      const pid = normId(periodId);
      focusedPeriodId.value = isSameId(focusedPeriodId.value, pid) ? null : pid;
      emit('period-focus-changed', focusedPeriodId.value);
    }
    function isFocused(id) { return isSameId(focusedPeriodId.value, id); }
    function getFocusedPeriodName() {
      const p = props.periods.find((x) => isSameId(x.id, focusedPeriodId.value));
      return p?.name || p?.label || 'Unknown Period';
    }

    // Available courses
    function getAvailableCoursesForSlot(dayId, periodId) {
      const dayKey = normId(dayId);
      const periodKey = normId(periodId);

      const scheduledIds = new Set(
        safeArray(currentSchedules.value)
          .filter((e) => isSameId(e.day_id, dayId) && isSameId(e.period_id, periodId))
          .map((e) => normId(e.course_id))
      );

      return safeArray(props.courses).filter((course) => {
        const cid = normId(course.id);
        const k = `${dayKey}|${periodKey}|${cid}`;

        // If recurring whitelist has it, keep visible regardless of schedule/hide flags
        if (recurringWhitelist.value.has(k)) {
          // Still respect possibleSlots below
        } else if (props.hideScheduledInAvailable) {
          if (scheduledIds.has(cid) || optimisticallyScheduled.value.has(k)) return false;
        }

        const slots = Array.isArray(course.possibleSlots) ? course.possibleSlots : [];
        if (slots.length === 0) return true;
        return slots.some((s) => isSameId(s.dayId, dayId) && isSameId(s.periodId, periodId));
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
    function isDraggingCourse(courseId) { return normId(draggedCourse.value?.id) === normId(courseId); }

    // Grade stats (unchanged calculations)
    function parseGrades(course) {
      const grades = [];
      if (course.is_for_year_g && typeof course.is_for_year_g === 'object') {
        for (const [, g] of Object.entries(course.is_for_year_g)) if (g && g > 0) grades.push(Number(g));
      } else if (Array.isArray(course.is_for_year_groups)) {
        grades.push(...course.is_for_year_groups.map((g) => Number(g)).filter((g) => g > 0));
      } else if (Array.isArray(course.year_groups)) {
        grades.push(...course.year_groups.map((g) => Number(g)).filter((g) => g > 0));
      }
      return [...new Set(grades)].sort((a, b) => a - b);
    }
    const allGrades = computed(() => {
      const set = new Set(); safeArray(props.courses).forEach((c) => parseGrades(c).forEach((g) => set.add(g)));
      return Array.from(set).sort((a, b) => a - b);
    });
    function findCourseById(courseId) { return safeArray(props.courses).find((c) => isSameId(c.id, courseId)); }
    function getScheduledCoursesForSlot(dayId, periodId) {
      const scheduled = [];
      const scheduledEntries = safeArray(currentSchedules.value).filter(
        (e) => isSameId(e.day_id, dayId) && isSameId(e.period_id, periodId)
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
        let totalSpots = 0, coursesCount = 0, totalGradeAllocation = 0;
        scheduledCourses.forEach((course) => {
          const courseGrades = parseGrades(course);
          if (courseGrades.includes(grade)) {
            coursesCount++;
            const freeSpots = course.freeSpots || 0;
            if (courseGrades.length === 1) { totalSpots += freeSpots; totalGradeAllocation += freeSpots; }
            else { const perGrade = freeSpots / courseGrades.length; totalSpots += freeSpots; totalGradeAllocation += perGrade; }
          }
        });
        if (coursesCount > 0 || totalSpots > 0) out.push({ grade, totalSpots, averageSpots: totalGradeAllocation, coursesCount });
      });
      return out;
    }

    return {
      // state
      focusedPeriodId, draggedCourse, draggedAssignment,
      optimisticallyScheduled, recurringWhitelist,
      editingAssignment, editingCell,
      contextMenu, assignmentModal,

      // computed
      visibleDays, visiblePeriods, currentSchedules,

      // helpers
      safeArray, safeLength,

      // formatters
      formatTime, formatDate, formatInt,

      // cell helpers
      getCellAssignments, getCellClasses, getCellAriaLabel,
      getAssignmentClasses, getAssignmentStyles,
      getCourseName, getSubjectName, getDisplayName, getClassName,
      getTeacherNames, getAssignmentTeachers, getRoomName,
      hasConflicts, hasDeletedEntities,

      // interactions
      handleCellClick, handleAssignmentClick, handleAssignmentRightClick,
      closeContextMenu, editAssignmentFromContext, deleteAssignmentFromContext,

      // inline editor
      isEditing, startInlineEdit, startInlineEditReadOnly,
      saveInlineEdit, cancelInlineEdit, deleteInlineAssignment,
      handleCourseEdit: (d) => emit('course-edit', d),

      // drag/drop
      handleCourseDragStart, handleCourseDragEnd,
      handleAssignmentDragStart, handleAssignmentDragEnd,
      handleCellDragOver, handleCellDragEnter, handleCellDragLeave, handleCellDrop,

      // assignment modal
      assignCourseToSlot, closeAssignmentModal, handleAssignmentModalSubmit,

      // focus + stats
      togglePeriodFocus, isFocused, getFocusedPeriodName,
      getDailyGradeStats, allGrades,

      // available courses
      getAvailableCoursesForSlot, getNoPreferredDaysCourses, getCourseCardStyle, isDraggingCourse,
    };
  },
};
</script>

<style scoped>
/* Minimal styling kept; your existing CSS can remain as before */

/* Context Menu */
.context-menu {
  position: fixed; background: white; border: 1px solid #ccc; border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12); z-index: 2000; min-width: 160px; padding: 4px 0;
}
.context-menu-item { padding: 8px 12px; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 8px; transition: background-color 0.15s; }
.context-menu-item:hover { background-color: #f5f5f5; }
.context-menu-item.delete:hover { background-color: #ffe6e6; color: #d32f2f; }
.context-menu-backdrop { position: fixed; inset: 0; z-index: 1999; }
</style>
