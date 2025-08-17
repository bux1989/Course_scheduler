<template>
  <div class="scheduler-grid" role="grid" aria-label="School schedule grid" :data-readonly="isReadOnly">
    <!-- Main Grid -->
    <div v-if="safeLength(visibleDays) > 0 && safeLength(visiblePeriods) > 0" class="main-grid-container">
      <!-- Grid Header -->
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
              <span class="period-time">{{ formatTime(period.start_time) }} - {{ formatTime(period.end_time) }}</span>
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

        <!-- Grade Statistics Row -->
        <div v-if="showStatistics && focusedPeriodId" class="statistics-row">
          <div class="period-label-cell stats-label-cell">
            <div class="stats-title">
              <span class="stats-emoji">📈</span>
              <span>Grade Stats</span>
            </div>
          </div>

          <div v-for="day in visibleDays" :key="`stats-${day.id}`" class="day-statistics-cell">
            <div class="stats-headers">
              <div class="stat-header" title="Total free spots">📊</div>
              <div class="stat-header" title="Average spots">⚖️</div>
              <div class="stat-header" title="Courses available">📚</div>
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
            <div v-if="safeLength(getDailyGradeStats(day.id, focusedPeriodId)) === 0" class="no-stats">
              <span class="no-stats-text">No courses scheduled</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Hidden grid debug -->
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

    <!-- Available Courses Panel -->
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

    <!-- Context Menu (fixed to viewport; high z-index) -->
    <div
      v-if="contextMenu.show"
      class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @click.stop
    >
      <div class="context-menu-item" @click="editAssignmentFromContext">
        {{ isReadOnly ? '📄 View Assignment Details' : '✏️ Edit Assignment' }}
      </div>
      <div class="context-menu-item delete" @click="deleteAssignmentFromContext">
        {{ isReadOnly ? '🔍 Test Delete Event' : '🗑️ Delete Assignment' }}
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
import { computed, ref, watch, onMounted } from 'vue';
import InlineAssignmentEditor from './InlineAssignmentEditor.vue';
import TeacherRoomSelectionModal from './TeacherRoomSelectionModal.vue';
import CourseSelectionModal from './CourseSelectionModal.vue';
import { emitSchedulerRemoveEvent } from '../../utils/events.js';

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
    // Local helpers
    const safeArray = (v) => (Array.isArray(v) ? v : []);
    const safeLength = (v) => (Array.isArray(v) ? v.length : 0);
    const normId = (v) => String(v ?? '');

    onMounted(() => {
      console.log('✅ SchedulerGrid mounted');
    });

    // State
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

    // Visible data
    const visibleDays = computed(() => {
      const days = safeArray(props.schoolDays);
      return days.slice(0, props.maxDays || 7);
    });

    const visiblePeriods = computed(() => {
      const all = safeArray(props.periods);
      if (!focusedPeriodId.value) return all;
      const match = all.filter((p) => p.id === focusedPeriodId.value);
      if (safeLength(match) === 0) {
        focusedPeriodId.value = null;
        return all;
      }
      return match;
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

    // Lookups
    const findCourse = (id) => props.courses.find((c) => c.id === id);
    const findClass = (id) => props.classes.find((c) => c.id === id);
    const findRoom = (id) => props.rooms.find((r) => r.id === id);
    const findSubject = (id) => props.subjects.find((s) => s.id === id);

    function getCourseName(courseId) {
      if (!courseId) return null;
      const course = findCourse(courseId);
      return course?.name || course?.course_name || course?.title || null;
    }
    function getSubjectName(subjectId) {
      if (!subjectId) return null;
      const subject = findSubject(subjectId);
      return subject?.name || subject?.title || subject?.subject_name || null;
    }
    function getDisplayName(assignment) {
      return getCourseName(assignment.course_id) || getSubjectName(assignment.subject_id) || 'No Course';
    }
    function getClassName(classId) {
      if (!classId) return '';
      const cls = findClass(classId);
      return cls?.name || 'No Class';
    }
    function getTeacherNames(teacherIds) {
      if (!teacherIds?.length) return 'No Teacher';
      return teacherIds.map((id) => props.teachers.find((t) => t.id === id)?.name || 'Unknown Teacher').join(', ');
    }
    function getAssignmentTeachers(assignment) {
      if (Array.isArray(assignment.teacher_names) && assignment.teacher_names.length) return assignment.teacher_names.join(', ');
      const ids = assignment.staff_ids || assignment.teacher_ids;
      return ids?.length ? getTeacherNames(ids) : '';
    }
    function getRoomName(roomId) {
      if (!roomId) return 'No Room';
      const room = findRoom(roomId);
      return room?.name || 'Unknown Room';
    }

    function hasConflicts(assignment) {
      return props.conflicts.some(
        (conflict) =>
          conflict.day_id === assignment.day_id &&
          conflict.period_id === assignment.period_id &&
          (conflict.assignment_id === assignment.id ||
            conflict.teacher_ids?.some((id) => assignment.teacher_ids?.includes(id)) ||
            conflict.class_id === assignment.class_id ||
            conflict.room_id === assignment.room_id)
      );
    }
    function hasDeletedEntities(assignment) {
      const courseExists = !assignment.course_id || !!findCourse(assignment.course_id);
      const classExists = !assignment.class_id || !!findClass(assignment.class_id);
      const roomExists = !assignment.room_id || !!findRoom(assignment.room_id);
      const teachersExist = !assignment.teacher_ids?.length || assignment.teacher_ids.every((id) => props.teachers.some((t) => t.id === id));
      return !(courseExists && classExists && roomExists && teachersExist);
    }

    // Assignment listing per cell
    function getCellAssignments(dayId, periodId) {
      const entries = currentSchedules.value;
      const assignments = entries.filter((assignment) => {
        const currentDay = props.schoolDays.find((d) => d.id === dayId || d.day_id === dayId);

        const assignmentDayMatch =
          assignment.day_id === dayId ||
          assignment.day_id === currentDay?.day_id ||
          assignment.day_id === currentDay?.id ||
          assignment.day_number === currentDay?.day_number ||
          assignment.day_number === currentDay?.id ||
          (currentDay?.name && assignment.day_name_en === currentDay.name) ||
          (currentDay?.name_en && assignment.day_name_en === currentDay.name_en);

        const currentPeriod = props.periods.find((p) => p.id === periodId);
        const periodMatch =
          assignment.period_id === periodId ||
          (assignment.block_number && currentPeriod?.blockNumber && assignment.block_number === currentPeriod.blockNumber);

        return assignmentDayMatch && periodMatch;
      });

      return assignments.sort((a, b) => {
        const classA = getClassName(a.class_id);
        const classB = getClassName(b.class_id);
        if (classA !== classB) return classA.localeCompare(classB);
        const courseA = getDisplayName(a);
        const courseB = getDisplayName(b);
        return courseA.localeCompare(courseB);
      });
    }

    function getCellClasses(dayId, periodId) {
      const assignments = getCellAssignments(dayId, periodId);
      const classes = [];
      if (safeLength(assignments) > 0) {
        classes.push('has-assignments');
        if (safeLength(assignments) > 1) classes.push('multiple-assignments');
      }
      const hasConflict = assignments.some((a) =>
        props.conflicts.some((c) => c.day_id === dayId && c.period_id === periodId)
      );
      if (hasConflict) classes.push('has-conflicts');
      return classes;
    }

    function getCellAriaLabel(day, period) {
      const assignments = getCellAssignments(day.id, period.id);
      if (safeLength(assignments) === 0) return `${day.name} ${period.name}: Empty, click to add assignment`;
      const courseNames = assignments.map((a) => getDisplayName(a)).join(', ');
      return `${day.name} ${period.name}: ${courseNames}, ${safeLength(assignments)} assignment${safeLength(assignments) > 1 ? 's' : ''}`;
    }

    function getAssignmentClasses(assignment) {
      const classes = [];
      if (hasConflicts(assignment)) classes.push('has-conflict');
      if (hasDeletedEntities(assignment)) classes.push('has-deleted-entities');
      if (!getCourseName(assignment.course_id) && assignment.subject_id) classes.push('lesson-schedule');
      return classes;
    }
    function getAssignmentStyles(assignment) {
      const course = findCourse(assignment.course_id);
      const cls = findClass(assignment.class_id);
      return {
        borderLeft: `4px solid ${course?.color || cls?.color || '#e0e0e0'}`,
        backgroundColor: course?.color ? `${course.color}15` : cls?.color ? `${cls.color}15` : '#f9f9f9',
      };
    }

    // Clicks
    function handleCellClick(dayId, periodId, period) {
      if (props.isReadOnly) return;
      const assignments = getCellAssignments(dayId, periodId);
      if (assignments.length === 0) return;
      emit('cell-click', { dayId, periodId, period });
    }
    function handleAssignmentClick(assignment) {
      emit('assignment-details', assignment);
    }

    // Context menu
    function computeContextMenuPosition(evt, menuSize = { w: 220, h: 96 }) {
      const vw = window.innerWidth || 1024;
      const vh = window.innerHeight || 768;
      let x = (evt?.clientX ?? 0) + 6;
      let y = (evt?.clientY ?? 0) + 6;
      if (x + menuSize.w > vw) x = Math.max(8, vw - menuSize.w - 8);
      if (y + menuSize.h > vh) y = Math.max(8, vh - menuSize.h - 8);
      return { x, y };
    }
    function handleAssignmentRightClick(event, assignment, dayId, periodId) {
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
      contextMenu.value.show = false;
    }
    function editAssignmentFromContext() {
      if (!contextMenu.value.assignment) return;
      if (props.isReadOnly || props.isLiveMode) {
        startInlineEditReadOnly(contextMenu.value.assignment, contextMenu.value.dayId, contextMenu.value.periodId);
      } else {
        startInlineEdit(contextMenu.value.assignment, contextMenu.value.dayId, contextMenu.value.periodId);
      }
      closeContextMenu();
    }
    function deleteAssignmentFromContext() {
      const a = contextMenu.value.assignment;
      if (!a) { closeContextMenu(); return; }
      if (props.isReadOnly || props.isLiveMode) {
        const fn = props.parentEmit || emit;
        emitSchedulerRemoveEvent(fn, {
          dayId: a.day_id, periodId: a.period_id, assignmentId: a.id,
          courseId: a.course_id, courseName: a.course_name || a.display_cell || '',
        });
      } else {
        deleteInlineAssignment(a);
      }
      closeContextMenu();
    }

    // Inline editor
    const isEditing = (assignmentId) => editingAssignment.value?.id === assignmentId;
    function startInlineEdit(a, dayId, periodId) {
      if (props.isReadOnly) return;
      editingAssignment.value = a;
      editingCell.value = { dayId, periodId };
    }
    function startInlineEditReadOnly(a, dayId, periodId) {
      editingAssignment.value = a;
      editingCell.value = { dayId, periodId };
    }
    function saveInlineEdit(updatedAssignment) {
      const current = currentSchedules.value;
      const updated = current.map((s) => (s.id === updatedAssignment.id ? updatedAssignment : s));
      emit('update-assignments', updated);
      editingAssignment.value = null;
      editingCell.value = null;
    }
    function cancelInlineEdit() {
      editingAssignment.value = null;
      editingCell.value = null;
    }
    function deleteInlineAssignment(assignment) {
      if (props.emitDropEvents) {
        const fn = props.parentEmit || emit;
        emitSchedulerRemoveEvent(fn, {
          dayId: assignment.day_id,
          periodId: assignment.period_id,
          assignmentId: assignment.id,
          courseId: assignment.course_id,
          courseName: assignment.course_name || assignment.display_cell || '',
        });
      }
      const current = currentSchedules.value;
      const updated = current.filter((s) => s.id !== assignment.id);
      emit('update-assignments', updated);
      editingAssignment.value = null;
      editingCell.value = null;
    }

    // Available courses
    function normalizeCourseLight(course) {
      // Try to normalize into course.possibleSlots: [{dayId, periodId}]
      let slots = [];
      if (Array.isArray(course.possibleSlots)) {
        slots = course.possibleSlots;
      } else if (Array.isArray(course.possible_time_slots)) {
        slots = course.possible_time_slots.map((s) => ({
          dayId: s.dayId ?? s.day_id ?? s.day ?? s.day_number ?? s.dayNumber ?? s.dayId,
          periodId: s.periodId ?? s.period_id ?? s.blockId ?? s.block_id ?? s.period ?? s.periodId,
        }));
      }
      return { ...course, possibleSlots: slots.filter((s) => s && s.dayId != null && s.periodId != null) };
    }

    function getAvailableCoursesForSlot(dayId, periodId) {
      const normalized = props.courses.map(normalizeCourseLight);
      return normalized.filter((course) => {
        const slots = Array.isArray(course.possibleSlots) ? course.possibleSlots : [];
        if (slots.length === 0) return true;
        return slots.some((slot) => normId(slot.dayId) === normId(dayId) && normId(slot.periodId) === normId(periodId));
      });
    }

    function getNoPreferredDaysCourses() {
      return props.courses.filter((c) => !Array.isArray(c.possible_time_slots) || c.possible_time_slots.length === 0);
    }

    function getCourseCardStyle(course) {
      return {
        borderLeft: `4px solid ${course.color || '#007cba'}`,
        backgroundColor: course.color ? `${course.color}15` : '#f0f8ff',
      };
    }

    function assignCourseToSlot(course, dayId, periodId) {
      if (props.isReadOnly) return;
      modalCourseData.value = {
        courseId: course.id,
        courseName: course.name || course.course_name || '',
        courseCode: course.code || course.course_code || '',
        dayId,
        periodId,
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
      showTeacherRoomModal.value = false;
      modalCourseData.value = null;
    }

    function handleCourseSelectionSubmit(payload) {
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
      showCourseSelectionModal.value = false;
      courseSelectionData.value = null;
    }

    // Drag and Drop (minimal)
    const draggedCourse = ref(null);
    const draggedAssignment = ref(null);
    const dragOverCell = ref(null);

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
      dragOverCell.value = null;
    }

    function handleCellDragOver(event) {
      if (!draggedCourse.value && !draggedAssignment.value) return false;
      event.dataTransfer.dropEffect = draggedAssignment.value ? 'move' : 'copy';
      return false;
    }
    function handleCellDragEnter(event, dayId, periodId) {
      if (!draggedCourse.value && !draggedAssignment.value) return;
      dragOverCell.value = `${dayId}-${periodId}`;
      event.currentTarget.classList.add('drag-over');
    }
    function handleCellDragLeave(event) {
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
        const data = JSON.parse(event.dataTransfer.getData('text/plain'));
        if (data.type === 'course') {
          assignCourseToSlot(data.course || { id: data.id }, dayId, periodId);
        } else if (data.type === 'assignment') {
          const a = data.assignment;
          if (data.originalDayId !== dayId || data.originalPeriodId !== periodId) {
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
              fromDayId: data.originalDayId,
              fromPeriodId: data.originalPeriodId,
              action: 'move',
            });
            emit('update-assignments', {
              action: 'move',
              assignment: a,
              fromDayId: data.originalDayId,
              fromPeriodId: data.originalPeriodId,
              toDayId: dayId,
              toPeriodId: periodId,
            });
          }
        }
      } catch (error) {
        console.error('🚨 [DragDrop] Error handling drop:', error);
      }
    }

    // Focus + stats
    function togglePeriodFocus(periodId) {
      focusedPeriodId.value = focusedPeriodId.value === periodId ? null : periodId;
      emit('period-focus-changed', focusedPeriodId.value);
    }
    function getFocusedPeriodName() {
      const period = props.periods.find((p) => p.id === focusedPeriodId.value);
      return period?.name || period?.label || 'Unknown Period';
    }

    function parseGrades(course) {
      const grades = [];
      if (course.is_for_year_g && typeof course.is_for_year_g === 'object') {
        for (const [, grade] of Object.entries(course.is_for_year_g)) if (grade && grade > 0) grades.push(Number(grade));
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
      return safeArray(props.courses).find((course) => course.id === courseId);
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
            const free = course.freeSpots || 0;
            if (courseGrades.length === 1) {
              totalSpots += free;
              totalGradeAllocation += free;
            } else {
              totalSpots += free;
              totalGradeAllocation += free / courseGrades.length;
            }
          }
        });
        if (coursesCount > 0 || totalSpots > 0) {
          out.push({ grade, totalSpots, averageSpots: totalGradeAllocation, coursesCount });
        }
      });
      return out;
    }

    // Course edit passthrough
    function handleCourseEdit(courseData) {
      emit('course-edit', courseData);
    }

    // Mode logs
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
      contextMenu,

      // Computed
      visibleDays,
      visiblePeriods,
      currentSchedules,

      // Utils
      safeArray,
      safeLength,

      // Formatters and lookups
      formatTime,
      formatDate,
      getDisplayName,
      getClassName,
      getCourseName,
      getSubjectName,
      getTeacherNames,
      getAssignmentTeachers,
      getRoomName,
      hasConflicts,
      hasDeletedEntities,

      // Grid helpers
      getCellAssignments,
      getCellClasses,
      getCellAriaLabel,
      getAssignmentClasses,
      getAssignmentStyles,

      // Interactions
      handleCellClick,
      handleAssignmentClick,
      handleAssignmentRightClick,
      closeContextMenu,
      editAssignmentFromContext,
      deleteAssignmentFromContext,

      // Inline editor
      isEditing,
      startInlineEdit,
      startInlineEditReadOnly,
      saveInlineEdit,
      cancelInlineEdit,
      deleteInlineAssignment,
      handleCourseEdit,

      // Drag/drop
      handleCourseDragStart,
      handleCourseDragEnd,
      handleAssignmentDragStart,
      handleAssignmentDragEnd,
      handleCellDragOver,
      handleCellDragEnter,
      handleCellDragLeave,
      handleCellDrop,

      // Modals
      assignCourseToSlot,
      handleTeacherRoomSubmit,
      handleTeacherRoomCancel,
      handleCourseSelectionSubmit,
      handleCourseSelectionCancel,

      // Focus + stats
      togglePeriodFocus,
      getFocusedPeriodName,
      getDailyGradeStats,
      allGrades,

      // Available courses
      getAvailableCoursesForSlot,
      getNoPreferredDaysCourses,
      getCourseCardStyle,
      assignCourseToFocusedSlot,
    };
  },
};
</script>

<style scoped>
/* Root */
.scheduler-grid {
  display: flex;
  flex-direction: column;
  width: 100%;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
  background: white;
}

/* Header row (force flex) */
.grid-header {
  display: flex !important;
  align-items: stretch;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  font-weight: 600;
}

.period-header-cell {
  width: 140px;
  min-width: 140px;
  max-width: 140px;
  padding: 12px 8px;
  border-right: 1px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.day-header-cell {
  flex: 1 1 0;
  min-width: 160px;
  padding: 12px 8px;
  border-right: 1px solid #ddd;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 2px;
  box-sizing: border-box;
}
.day-header-cell:last-child { border-right: 0; }
.day-name { font-size: 0.95em; }
.day-date { font-size: 0.8em; color: #666; }

/* Body */
.grid-body { display: block; }

.grid-row {
  display: flex !important;
  align-items: stretch;
  border-bottom: 1px solid #ddd;
  min-height: 80px;
}
.grid-row:last-child { border-bottom: 0; }
.grid-row.non-instructional { background: #f8f9fa; }

/* Period label cell */
.period-label-cell {
  width: 140px;
  min-width: 140px;
  max-width: 140px;
  padding: 8px;
  border-right: 1px solid #ddd;
  background: #f9f9f9;
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: background-color 0.2s;
  box-sizing: border-box;
}
.period-label-cell:hover { background: #f0f7ff !important; }
.period-label-cell.focused { background: #e6f7ff !important; border-left: 4px solid #007cba; }
.period-info { display: flex; flex-direction: column; gap: 2px; }
.period-name { font-weight: 500; font-size: 0.9em; }
.period-time { font-size: 0.8em; color: #666; }
.non-instructional-badge { font-size: 0.75em; color: #888; background: #e9ecef; padding: 2px 4px; border-radius: 3px; }

/* Cells */
.schedule-cell {
  flex: 1 1 0;
  min-width: 160px;
  border-right: 1px solid #ddd;
  position: relative;
  cursor: pointer;
  transition: background-color 0.2s;
  min-height: 80px;
  box-sizing: border-box;
}
.schedule-cell:last-child { border-right: 0; }
.schedule-cell:hover { background: #f0f7ff; }
.schedule-cell.has-assignments { background: #e6f7ff; }
.schedule-cell.multiple-assignments { background: #d6f3ff; }
.schedule-cell.has-conflicts { background: #fff2f0; border-left: 3px solid #ff4d4f; }

/* Assignment items */
.assignments-container {
  padding: 4px;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: relative;
  box-sizing: border-box;
}
.assignment-item {
  padding: 4px 6px;
  border-radius: 3px;
  border: 1px solid #e0e0e0;
  position: relative;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}
.assignment-item:hover { transform: translateX(1px); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.assignment-item.has-conflict { border-color: #ff4d4f; background: #fff2f0; }
.assignment-item.has-deleted-entities { border-color: #faad14; background: #fff7e6; }
.assignment-item.lesson-schedule { opacity: 0.6; border-style: dashed; background: #f5f5f5 !important; font-style: italic; font-size: 0.8em; }

/* Content */
.assignment-content { display: flex; flex-direction: column; gap: 1px; }
.course-name { font-weight: 500; font-size: 0.85em; line-height: 1.2; }
.class-name, .teacher-names, .room-name { font-size: 0.75em; color: #666; line-height: 1.1; }

.conflict-indicator, .deleted-warning {
  position: absolute; top: 2px; right: 2px; font-size: 0.7em;
}

/* Empty cell */
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
.add-text { opacity: 0.8; }

/* Drag targets */
.drop-zone { position: relative; transition: all 0.2s ease; }
.drop-zone.drag-over { background: rgba(0,123,186,0.1) !important; border: 2px dashed #007cba !important; transform: scale(1.02); }
.drop-zone.drag-over::after {
  content: '📋 Drop here'; position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
  background: rgba(0,123,186,0.9); color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; pointer-events: none; z-index: 10;
}

/* Grade Statistics */
.statistics-row { display: flex !important; border-bottom: 2px solid #007cba; background: #f0f8ff; border-top: 2px solid #007cba; }
.stats-label-cell {
  width: 140px; min-width: 140px; max-width: 140px;
  background: #007cba !important; color: white; display: flex; align-items: center; justify-content: center;
  border-right: 1px solid #ddd; box-sizing: border-box;
}
.stats-title { display: flex; align-items: center; gap: 6px; font-size: 0.85em; font-weight: 600; }
.stats-emoji { font-size: 1.1em; }

.day-statistics-cell {
  flex: 1 1 0;
  min-width: 160px;
  border-right: 1px solid #ddd;
  padding: 8px; background: white;
  display: flex; flex-direction: column; gap: 4px; min-height: 100px; box-sizing: border-box;
}
.day-statistics-cell:last-child { border-right: 0; }

.stats-headers {
  display: flex; justify-content: space-between; align-items: center; gap: 2px;
  margin-bottom: 4px; padding: 2px; background: rgba(0,124,186,0.1); border-radius: 3px;
}
.stat-header { font-size: 0.9em; text-align: center; cursor: help; padding: 2px 4px; border-radius: 2px; flex: 1; }
.stat-header:hover { background: rgba(0,124,186,0.2); }

.stats-rows { display: flex; flex-direction: column; gap: 2px; flex-grow: 1; }
.grade-stats-row {
  display: flex; align-items: center; justify-content: space-between; gap: 4px;
  background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 2px; padding: 2px 4px; font-size: 0.75em;
}
.grade-number { font-weight: 600; color: #333; min-width: 20px; font-size: 0.8em; }
.stat-value { text-align: center; padding: 1px 2px; background: white; border-radius: 2px; font-size: 0.7em; color: #666; min-width: 18px; flex: 1; }

/* Available Courses Panel */
.available-courses-panel { padding: 16px; background: #f0f8ff; border-top: 1px solid #007cba; border-bottom: 1px solid #ddd; }
.available-courses-panel h3 { margin: 0 0 8px 0; color: #007cba; font-size: 1.1em; }
.focused-period-info { margin: 0 0 16px 0; color: #666; font-size: 0.9em; }
.day-courses-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
.day-courses-column h4 { margin: 0 0 12px 0; padding: 8px 12px; background: #007cba; color: white; border-radius: 4px; text-align: center; font-size: 0.9em; }
.available-courses-list { display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; }
.course-card { padding: 10px; background: white; border: 1px solid #ddd; border-radius: 4px; cursor: grab; transition: all 0.2s; font-size: 0.85em; }
.course-card:hover { transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,124,186,0.15); border-color: #007cba; }
.course-card .course-name { font-weight: 500; color: #333; margin-bottom: 4px; display: block; }
.course-card .course-details { display: flex; flex-direction: column; gap: 2px; }
.course-card .course-details small { color: #666; font-size: 0.8em; }
.no-courses { padding: 16px; text-align: center; color: #999; font-style: italic; background: #f9f9f9; border: 1px dashed #ddd; border-radius: 4px; }

/* No Preferred Days Panel */
.no-preferred-days-panel { padding: 16px; background: #f0f8e6; border: 1px solid #52c41a; border-radius: 4px; margin-top: 16px; }
.no-preferred-days-panel h4 { margin: 0 0 8px 0; color: #52c41a; font-size: 1em; display: flex; align-items: center; gap: 8px; }
.panel-description { margin: 0 0 12px 0; color: #666; font-size: 0.9em; font-style: italic; }
.no-preferred-courses-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
.flexible-tag { color: #52c41a !important; font-weight: 500; }

/* Debug hidden */
.grid-hidden-debug { padding: 20px; background: #ffebee; border: 2px solid #f44336; border-radius: 8px; margin: 16px; text-align: center; }
.grid-hidden-message { color: #c62828; font-weight: bold; font-size: 1.1em; }
.grid-hidden-message ul { text-align: left; display: inline-block; margin: 12px 0; color: #666; font-weight: normal; font-size: 0.9em; font-family: monospace; }
.grid-hidden-message li { margin-bottom: 6px; }
.emergency-show-btn { padding: 12px 24px; background: #f44336; color: white; border: none; border-radius: 6px; font-size: 1em; font-weight: bold; cursor: pointer; margin-top: 16px; transition: all 0.2s; }
.emergency-show-btn:hover { background: #d32f2f; transform: scale(1.05); }

/* Read-only */
.scheduler-grid[data-readonly='true'] .schedule-cell { cursor: default; }
.scheduler-grid[data-readonly='true'] .schedule-cell:hover { background: inherit; }
.scheduler-grid[data-readonly='true'] .draggable-course,
.scheduler-grid[data-readonly='true'] .draggable-assignment { cursor: default; pointer-events: none; }
.scheduler-grid[data-readonly='true'] .empty-cell { color: #999; }
.scheduler-grid[data-readonly='true'] .empty-text { font-style: italic; color: #999; font-size: 0.8em; }

/* Responsive */
@media (max-width: 1024px) {
  .day-header-cell, .schedule-cell, .day-statistics-cell { min-width: 200px; }
}
@media (max-width: 768px) {
  .period-header-cell, .period-label-cell, .stats-label-cell { width: 120px; min-width: 120px; max-width: 120px; }
  .day-header-cell, .schedule-cell, .day-statistics-cell { min-width: 180px; }
}

/* Context Menu (not scoped to avoid teleport issues) remains below */
</style>

<!-- Unscoped styles for context menu/backdrop -->
<style>
.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 12px 32px rgba(0,0,0,0.2);
  z-index: 99999;
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
  white-space: nowrap;
}
.context-menu-item:hover { background-color: #f5f5f5; }
.context-menu-item.delete:hover { background-color: #ffe6e6; color: #d32f2f; }
.context-menu-backdrop { position: fixed; inset: 0; z-index: 99998; }
</style>
