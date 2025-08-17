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
            @dragover.prevent="(!isReadOnly && !isLiveMode) ? handleCellDragOver($event) : null"
            @dragenter.prevent="(!isReadOnly && !isLiveMode) ? handleCellDragEnter($event) : null"
            @dragleave="(!isReadOnly && !isLiveMode) ? handleCellDragLeave($event) : null"
            @drop="(!isReadOnly && !isLiveMode) ? handleCellDrop($event, day.id, period.id) : null"
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
                @mousedown.right.prevent="handleAssignmentMouseRightClick($event, assignment, day.id, period.id)"
                :draggable="(!isReadOnly && !isLiveMode) && !isEditing(assignment.id)"
                @dragstart="(!isReadOnly && !isLiveMode) ? handleAssignmentDragStart($event, assignment, day.id, period.id) : null"
                @dragend="(!isReadOnly && !isLiveMode) ? handleAssignmentDragEnd($event) : null"
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
              <template v-if="!isReadOnly && !isLiveMode && enableCellAdd">
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

    <!-- Available Courses Panel (hidden in live or read-only) -->
    <div v-if="focusedPeriodId && !isReadOnly && !isLiveMode" class="available-courses-panel">
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

    <!-- Teacher/Room Selection Modal (emits frequency) -->
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

    <!-- Context Menu (teleported to body) -->
    <teleport to="body">
      <div
        v-if="contextMenu.show"
        class="context-menu"
        role="menu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
        @click.stop
        ref="contextMenuRef"
        data-debug="context-menu"
      >
        <div class="context-menu-item" role="menuitem" @click="editAssignmentFromContext">
          {{ (!isReadOnly && !isLiveMode) ? '✏️ Edit Assignment' : '📄 View Assignment' }}
        </div>
        <div
          v-if="!isReadOnly && !isLiveMode"
          class="context-menu-item delete"
          role="menuitem"
          @click="deleteAssignmentFromContext"
        >
          🗑️ Delete Assignment
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
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import InlineAssignmentEditor from './InlineAssignmentEditor.vue';
import TeacherRoomSelectionModal from './TeacherRoomSelectionModal.vue';
import { emitSchedulerRemoveEvent } from '../../utils/events.js';

export default {
  name: 'SchedulerGrid',
  components: { InlineAssignmentEditor, TeacherRoomSelectionModal },
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
    enableCellAdd: { type: Boolean, default: false },
    hideScheduledInAvailable: { type: Boolean, default: true },
    parentEmit: { type: Function, default: null },
    emitDropEvents: { type: Boolean, default: false },
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

    // Available list behavior
    const optimisticallyScheduled = ref(new Set()); // key: day|period|course
    const recurringWhitelist = ref(new Set());

    // Inline editor/context menu
    const editingAssignment = ref(null);
    const editingCell = ref(null);

    const contextMenu = ref({
      show: false, x: 0, y: 0, assignment: null, dayId: null, periodId: null,
    });
    const contextMenuRef = ref(null);

    // Teacher modal
    const showTeacherRoomModal = ref(false);
    const modalCourseData = ref(null);

    // Close context menu on Escape / resize / scroll (capture)
    const onKeyDown = (e) => {
      if (e.key === 'Escape') contextMenu.value.show = false;
    };
    const onWindowResize = () => (contextMenu.value.show = false);
    const onAnyScroll = () => (contextMenu.value.show = false);

    onMounted(() => {
      window.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('resize', onWindowResize, { passive: true });
      window.addEventListener('scroll', onAnyScroll, true);
    });
    onBeforeUnmount(() => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('scroll', onAnyScroll, true);
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
    function formatTime(t) {
      if (!t) return '';
      const parts = String(t).split(':');
      return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : String(t);
    }
    function formatDate(d) {
      return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
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

    // Context menu positioning
    function computeContextMenuPosition(evt, menuSize = { w: 220, h: 96 }) {
      const vw = window.innerWidth || 1024;
      const vh = window.innerHeight || 768;
      let x = (evt?.clientX ?? 0) + 6;
      let y = (evt?.clientY ?? 0) + 6;
      if (x + menuSize.w > vw) x = Math.max(8, vw - menuSize.w - 8);
      if (y + menuSize.h > vh) y = Math.max(8, vh - menuSize.h - 8);
      return { x, y };
    }
    function measureContextMenuRender() {
      nextTick(() => {
        contextMenuRef.value?.getBoundingClientRect?.();
      });
    }
    watch(() => contextMenu.value.show, (show) => { if (show) measureContextMenuRender(); });

    // Clicks + context menu (two entry points for reliability on draggable)
    function handleAssignmentRightClick(event, assignment, dayId, periodId) {
      const pos = computeContextMenuPosition(event);
      contextMenu.value = { show: true, x: pos.x, y: pos.y, assignment, dayId, periodId };
    }
    function handleAssignmentMouseRightClick(event, assignment, dayId, periodId) {
      // Secondary path to ensure right-click works even when contextmenu is suppressed by DnD
      const pos = computeContextMenuPosition(event);
      contextMenu.value = { show: true, x: pos.x, y: pos.y, assignment, dayId, periodId };
    }
    function closeContextMenu() {
      contextMenu.value.show = false;
    }
    function editAssignmentFromContext() {
      if (!contextMenu.value.assignment) return;
      if (props.isReadOnly || props.isLiveMode) startInlineEditReadOnly(contextMenu.value.assignment, contextMenu.value.dayId, contextMenu.value.periodId);
      else startInlineEdit(contextMenu.value.assignment, contextMenu.value.dayId, contextMenu.value.periodId);
      closeContextMenu();
    }
    function deleteAssignmentFromContext() {
      const a = contextMenu.value.assignment;
      if (!a || props.isReadOnly || props.isLiveMode) { closeContextMenu(); return; }
      deleteInlineAssignment(a);
      closeContextMenu();
    }

    // Inline editor
    function isEditing(id) { return editingAssignment.value?.id === id; }
    function startInlineEdit(a, dayId, periodId) {
      if (props.isReadOnly || props.isLiveMode) return;
      editingAssignment.value = a; editingCell.value = { dayId, periodId };
    }
    function startInlineEditReadOnly(a, dayId, periodId) {
      editingAssignment.value = a; editingCell.value = { dayId, periodId };
    }
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
      const data = currentSchedules.value.filter((s) => !isSameId(s.id, a.id));
      emit('update-assignments', data);
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
        const data = JSON.parse(event.dataTransfer.getData('text/plain'));
        if (data.type === 'course') {
          assignCourseToSlot(data.course || { id: data.id }, dayId, periodId);
        } else if (data.type === 'assignment') {
          const a = data.assignment;
          if (!isSameId(data.originalDayId, dayId) || !isSameId(data.originalPeriodId, periodId)) {
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
              fromDayId: data.originalDayId,
              fromPeriodId: data.originalPeriodId,
              action: 'move',
            });
            emit('update-assignments', {
              action: 'move', assignment: a,
              fromDayId: data.originalDayId, fromPeriodId: data.originalPeriodId,
              toDayId: dayId, toPeriodId: periodId,
            });
          }
        }
      } catch (e) { console.error('Drop error:', e); }
    }

    // Open modal
    function assignCourseToSlot(course, dayId, periodId) {
      if (!course || props.isReadOnly || props.isLiveMode) return;
      modalCourseData.value = {
        courseId: course.id,
        courseName: course.name || course.course_name || course.title || '',
        courseCode: course.code || course.course_code || '',
        dayId, periodId,
      };
      showTeacherRoomModal.value = true;
    }
    function handleTeacherRoomSubmit(payload) {
      // frequency-aware optimistic hide
      const key = `${normId(payload.dayId)}|${normId(payload.periodId)}|${normId(payload.courseId)}`;
      if ((payload.frequency || 'one-off') === 'recurring') {
        recurringWhitelist.value.add(key);
        optimisticallyScheduled.value.delete(key);
      } else {
        recurringWhitelist.value.delete(key);
        if (props.hideScheduledInAvailable) optimisticallyScheduled.value.add(key);
      }

      emit('scheduler-drop', {
        dayId: payload.dayId,
        periodId: payload.periodId,
        courseId: payload.courseId,
        courseName: payload.courseName,
        courseCode: modalCourseData.value?.courseCode || '',
        teacherIds: payload.teacherIds,
        primaryTeacherId: payload.primaryTeacherId,
        roomId: payload.roomId,
        frequency: payload.frequency || 'one-off',
        source: 'modal-assignment',
        timestamp: payload.timestamp,
      });

      // compat end event
      emit('scheduler-drag-end', {
        courseId: payload.courseId,
        courseName: payload.courseName,
        courseCode: modalCourseData.value?.courseCode || '',
        success: true,
        source: 'drag-end',
        timestamp: new Date().toISOString(),
      });

      showTeacherRoomModal.value = false;
      modalCourseData.value = null;
    }
    function handleTeacherRoomCancel() {
      showTeacherRoomModal.value = false;
      modalCourseData.value = null;
    }

    // Focus
    function togglePeriodFocus(periodId) {
      const pid = normId(periodId);
      focusedPeriodId.value = isSameId(focusedPeriodId.value, pid) ? null : pid;
      emit('period-focus-changed', focusedPeriodId.value);
    }
    function isFocused(id) { return isSameId(focusedPeriodId.value, id); }
    function getFocusedPeriodName() {
      return props.periods.find((p) => isSameId(p.id, focusedPeriodId.value))?.name || 'Unknown Period';
    }

    // Normalize slots helper
    function normalizeSlots(course) {
      if (Array.isArray(course.possibleSlots)) return course.possibleSlots;
      if (Array.isArray(course.possible_time_slots)) {
        return course.possible_time_slots.map((s) => ({
          dayId: s.dayId ?? s.day_id ?? s.day ?? s.day_number ?? s.dayNumber ?? s.dayId,
          periodId: s.periodId ?? s.period_id ?? s.blockId ?? s.block_id ?? s.period ?? s.periodId,
        })).filter((s) => s && s.dayId != null && s.periodId != null);
      }
      return [];
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

        // Apply optimistic hide unless whitelisted for recurring
        if (!recurringWhitelist.value.has(k) && props.hideScheduledInAvailable) {
          if (scheduledIds.has(cid) || optimisticallyScheduled.value.has(k)) return false;
        }

        const slots = normalizeSlots(course);
        if (slots.length === 0) return true;
        return slots.some((s) => isSameId(s.dayId, dayId) && isSameId(s.periodId, periodId));
      });
    }
    function getNoPreferredDaysCourses() {
      return safeArray(props.courses).filter((course) => normalizeSlots(course).length === 0);
    }
    function getCourseCardStyle(course) {
      return { borderLeft: `4px solid ${course.color || '#007cba'}`, backgroundColor: course.color ? `${course.color}15` : '#f0f8ff' };
    }
    function isDraggingCourse(courseId) { return normId(draggedCourse.value?.id) === normId(courseId); }

    // Grade stats (unchanged)
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
      const scheduledEntries = safeArray(currentSchedules.value).filter((e) => isSameId(e.day_id, dayId) && isSameId(e.period_id, periodId));
      const out = [];
      scheduledEntries.forEach((entry) => {
        const course = findCourseById(entry.course_id);
        if (course) {
          const totalSpots = course.max_students || course.capacity || 0;
          const freeSpots = entry.free_spaces !== undefined ? entry.free_spaces : totalSpots;
          out.push({ ...course, scheduledEntry: entry, freeSpots, totalSpots });
        }
      });
      return out;
    }
    function getDailyGradeStats(dayId, periodId) {
      if (!periodId) return [];
      const scheduledCourses = getScheduledCoursesForSlot(dayId, periodId);
      const out = [];
      allGrades.value.forEach((grade) => {
        let totalSpots = 0, coursesCount = 0, totalGradeAllocation = 0;
        scheduledCourses.forEach((course) => {
          const grades = parseGrades(course);
          if (grades.includes(grade)) {
            coursesCount++;
            const free = course.freeSpots || 0;
            if (grades.length === 1) { totalSpots += free; totalGradeAllocation += free; }
            else { totalSpots += free; totalGradeAllocation += free / grades.length; }
          }
        });
        if (coursesCount > 0 || totalSpots > 0) out.push({ grade, totalSpots, averageSpots: totalGradeAllocation, coursesCount });
      });
      return out;
    }

    function handleCourseEdit(d) { emit('course-edit', d); }

    return {
      // state
      focusedPeriodId,
      draggedCourse,
      draggedAssignment,
      optimisticallyScheduled,
      recurringWhitelist,
      editingAssignment,
      editingCell,
      contextMenu,
      contextMenuRef,
      showTeacherRoomModal,
      modalCourseData,

      // computed
      visibleDays,
      visiblePeriods,
      currentSchedules,

      // helpers
      safeArray,
      safeLength,

      // formatters
      formatTime,
      formatDate,
      formatInt,

      // cell helpers
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

      // interactions
      handleCellClick,
      handleAssignmentClick,
      handleAssignmentRightClick,
      handleAssignmentMouseRightClick,
      closeContextMenu,
      editAssignmentFromContext,
      deleteAssignmentFromContext,

      // inline editor
      isEditing,
      startInlineEdit,
      startInlineEditReadOnly,
      saveInlineEdit,
      cancelInlineEdit,
      deleteInlineAssignment,
      handleCourseEdit,

      // drag/drop
      handleCourseDragStart,
      handleCourseDragEnd,
      handleAssignmentDragStart,
      handleAssignmentDragEnd,
      handleCellDragOver,
      handleCellDragEnter,
      handleCellDragLeave,
      handleCellDrop,

      // modal
      assignCourseToSlot,
      handleTeacherRoomSubmit,
      handleTeacherRoomCancel,

      // focus + stats
      togglePeriodFocus,
      isFocused,
      getFocusedPeriodName,
      getDailyGradeStats,
      allGrades,

      // available courses
      getAvailableCoursesForSlot,
      getNoPreferredDaysCourses,
      getCourseCardStyle,
      isDraggingCourse,
    };
  },
};
</script>

<style scoped>
/* Same styling you liked, kept intact */

/* Root */
.scheduler-grid {
  display: flex;
  flex-direction: column;
  width: 100%;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}

/* Header row */
.grid-header {
  display: flex !important;
  align-items: stretch;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  font-weight: 600;
}
.period-header-cell {
  width: 140px; min-width: 140px; max-width: 140px;
  padding: 10px 8px; border-right: 1px solid #ddd;
  display: flex; align-items: center; justify-content: center; box-sizing: border-box;
}
.day-header-cell {
  flex: 1 1 0; min-width: 160px; padding: 10px 8px; border-right: 1px solid #ddd;
  text-align: center; display: flex; flex-direction: column; gap: 2px; box-sizing: border-box;
}
.day-header-cell:last-child { border-right: 0; }
.day-name { font-size: 0.95em; }
.day-date { font-size: 0.8em; color: #666; }

/* Body */
.grid-body { display: block; }
.grid-row {
  display: flex !important; align-items: stretch;
  border-bottom: 1px solid #ddd; min-height: 72px;
}
.grid-row:last-child { border-bottom: 0; }
.grid-row.non-instructional { background: #f8f9fa; }

.period-label-cell {
  width: 140px; min-width: 140px; max-width: 140px;
  padding: 8px; border-right: 1px solid #ddd; background: #f9f9f9;
  display: flex; align-items: center; cursor: pointer; transition: background-color 0.2s; box-sizing: border-box;
}
.period-label-cell:hover { background: #f0f7ff !important; }
.period-label-cell.focused { background: #e6f7ff !important; border-left: 4px solid #007cba; }
.period-info { display: flex; flex-direction: column; gap: 2px; }
.period-name { font-weight: 600; font-size: 0.9em; }
.period-time { font-size: 0.78em; color: #666; }
.non-instructional-badge { font-size: 0.72em; color: #888; background: #e9ecef; padding: 1px 4px; border-radius: 3px; align-self: flex-start; }

.schedule-cell {
  flex: 1 1 0; min-width: 160px; border-right: 1px solid #ddd;
  position: relative; cursor: pointer; transition: background-color 0.2s; min-height: 72px; box-sizing: border-box;
}
.schedule-cell:last-child { border-right: 0; }
.schedule-cell:hover { background: #f0f7ff; }
.schedule-cell.has-assignments { background: #eaf7ff; }
.schedule-cell.multiple-assignments { background: #def3ff; }
.schedule-cell.has-conflicts { background: #fff2f0; border-left: 3px solid #ff4d4f; }

/* Assignments */
.assignments-container {
  padding: 4px; height: 100%; display: flex; flex-direction: column; gap: 4px; position: relative; box-sizing: border-box;
}
.assignment-item {
  padding: 4px 6px; border-radius: 4px; border: 1px solid #e0e0e0; position: relative; transition: all 0.2s; background: #fff;
}
.assignment-item:hover { transform: translateX(1px); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.assignment-item.has-conflict { border-color: #ff4d4f; background: #fff2f0; }
.assignment-item.has-deleted-entities { border-color: #faad14; background: #fff7e6; }
.assignment-item.lesson-schedule { opacity: 0.75; border-style: dashed; background: #f5f5f5 !important; font-style: italic; font-size: 0.8em; }
.assignment-content { display: flex; flex-direction: column; gap: 2px; }
.course-name { font-weight: 600; font-size: 0.9em; line-height: 1.2; }
.meta-line { font-size: 0.78em; color: #666; line-height: 1.2; display: inline-flex; gap: 4px; align-items: baseline; }
.conflict-indicator, .deleted-warning { position: absolute; top: 4px; right: 4px; font-size: 0.8em; line-height: 1; }

/* Empty cell */
.empty-cell { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #999; font-size: 0.85em; gap: 4px; }

/* Drag targets */
.drop-zone { position: relative; transition: all 0.2s ease; }
.drop-zone.drag-over { background: rgba(0,123,186,0.08) !important; border: 2px dashed #007cba !important; transform: scale(1.01); }
.drop-zone.drag-over::after {
  content: '📋 Drop here'; position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
  background: rgba(0,123,186,0.9); color: white; padding: 3px 6px; border-radius: 4px; font-size: 12px; font-weight: 600; pointer-events: none; z-index: 10;
}

/* Grade Statistics */
.statistics-row { display: flex !important; border-bottom: 2px solid #007cba; background: #f0f8ff; border-top: 2px solid #007cba; }
.stats-label-cell {
  width: 140px; min-width: 140px; max-width: 140px;
  background: #007cba !important; color: white; display: flex; align-items: center; justify-content: center;
  border-right: 1px solid #ddd; box-sizing: border-box;
}
.stats-title { display: flex; align-items: center; gap: 6px; font-size: 0.95em; font-weight: 600; }
.stats-emoji { font-size: 1.15em; }

.day-statistics-cell {
  --grade-col: 28px;
  flex: 1 1 0; min-width: 160px; border-right: 1px solid #ddd; padding: 6px; background: white;
  display: flex; flex-direction: column; gap: 6px; min-height: 96px; box-sizing: border-box;
}
.day-statistics-cell:last-child { border-right: 0; }
.stats-headers {
  display: grid; grid-template-columns: var(--grade-col) 1fr 1fr 1fr; align-items: center; gap: 4px;
  margin-bottom: 4px; padding: 3px 4px; background: rgba(0,124,186,0.1); border-radius: 4px;
}
.header-spacer { width: 100%; height: 1px; opacity: 0; }
.stat-header { display: flex; align-items: center; justify-content: center; font-size: 0.95em; line-height: 1; padding: 2px 4px; border-radius: 3px; }
.stat-header:hover { background: rgba(0,124,186,0.2); }
.stats-rows { display: flex; flex-direction: column; gap: 3px; flex-grow: 1; }
.grade-stats-row {
  display: grid; grid-template-columns: var(--grade-col) 1fr 1fr 1fr; align-items: center; gap: 6px;
  background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 4px; padding: 3px 4px; font-size: 0.88em;
}
.grade-number { font-weight: 700; color: #333; min-width: var(--grade-col); font-size: 0.95em; }
.stat-value { text-align: center; padding: 2px 4px; background: white; border-radius: 3px; font-size: 0.88em; color: #333; }

/* Available Courses Panel */
.available-courses-panel { padding: 12px; background: #f0f8ff; border-top: 1px solid #007cba; border-bottom: 1px solid #ddd; }
.available-courses-panel h3 { margin: 0 0 6px 0; color: #007cba; font-size: 1.05em; }
.focused-period-info { margin: 0 0 10px 0; color: #666; font-size: 0.9em; }
.day-courses-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.day-courses-column h4 { margin: 0 0 10px 0; padding: 6px 10px; background: #007cba; color: white; border-radius: 4px; text-align: center; font-size: 0.88em; }
.available-courses-list { display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto; }
.course-card { padding: 8px 10px; background: white; border: 1px solid #ddd; border-radius: 4px; cursor: grab; transition: all 0.2s; font-size: 0.9em; }
.course-card:hover { transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,124,186,0.15); border-color: #007cba; }
.course-card:active { cursor: grabbing; }
.course-card.is-dragging { opacity: 0.6; }
.course-card .course-name { font-weight: 600; color: #333; margin-bottom: 2px; display: block; }
.course-card .course-details { display: flex; flex-direction: column; gap: 2px; }
.course-card .course-details small { color: #666; font-size: 0.8em; }
.no-courses { padding: 12px; text-align: center; color: #999; font-style: italic; background: #f9f9f9; border: 1px dashed #ddd; border-radius: 4px; }

/* No Preferred Days Panel */
.no-preferred-days-panel { padding: 12px; background: #f0f8e6; border: 1px solid #52c41a; border-radius: 4px; margin-top: 12px; }
.no-preferred-days-panel h4 { margin: 0 0 8px 0; color: #52c41a; font-size: 1em; display: flex; align-items: center; gap: 8px; }
.panel-description { margin: 0 0 10px 0; color: #666; font-size: 0.9em; font-style: italic; }
.no-preferred-courses-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
.flexible-tag { color: #52c41a !important; font-weight: 600; }

/* Read-only */
.scheduler-grid[data-readonly='true'] .schedule-cell { cursor: default; }
.scheduler-grid[data-readonly='true'] .schedule-cell:hover { background: inherit; }
.scheduler-grid[data-readonly='true'] .draggable-assignment,
.scheduler-grid[data-readonly='true'] .draggable-course { cursor: default; pointer-events: none; }
.scheduler-grid[data-readonly='true'] .empty-cell { color: #999; }
.scheduler-grid[data-readonly='true'] .empty-text { font-style: italic; color: #999; font-size: 0.8em; }

/* Fallback hidden message */
.grid-hidden-debug { padding: 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; margin: 16px; text-align: center; color: #92400e; }

/* Responsive */
@media (max-width: 1024px) {
  .day-header-cell, .schedule-cell, .day-statistics-cell { min-width: 200px; }
}
@media (max-width: 768px) {
  .period-header-cell, .period-label-cell, .stats-label-cell { width: 120px; min-width: 120px; max-width: 120px; }
  .day-header-cell, .schedule-cell, .day-statistics-cell { min-width: 180px; }
}
</style>

<!-- Unscoped styles so teleported menu always renders -->
<style>
.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #ccc;
  border-radius: 6px;
  box-shadow: 0 12px 32px rgba(0,0,0,0.18);
  z-index: 99999;
  min-width: 180px;
  padding: 4px 0;
  pointer-events: auto;
}
.context-menu-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.15s;
  white-space: nowrap;
}
.context-menu-item:hover { background-color: #f5f5f5; }
.context-menu-item.delete:hover { background-color: #ffe6e6; color: #d32f2f; }
.context-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99998;
}
</style>
