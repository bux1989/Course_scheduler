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

    <!-- Available Courses for Focused Period -->
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
        <p class="panel-description">
          These courses have no time slot restrictions and can be scheduled on any day:
        </p>
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

    <!-- Context Menu teleported to body (prevents clipping/stacking issues) -->
    <teleport to="body">
      <div
        v-if="contextMenu.show"
        class="context-menu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
        @click.stop
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
import { computed, ref, watch } from 'vue';
import InlineAssignmentEditor from './InlineAssignmentEditor.vue';
import TeacherRoomSelectionModal from './TeacherRoomSelectionModal.vue';
import CourseSelectionModal from './CourseSelectionModal.vue';
import { emitSchedulerRemoveEvent } from '../../utils/events.js';
import { validateAndUnwrapArray, normalizeCourse } from '../../utils/arrayUtils.js';

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
    // Local safe helpers (avoid external module mismatch)
    const safeArray = (v) => (Array.isArray(v) ? v : []);
    const safeLength = (v) => (Array.isArray(v) ? v.length : 0);

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

    // Visible data
    const visibleDays = computed(() => {
      const days = validateAndUnwrapArray(props.schoolDays, 'schoolDays');
      return safeArray(days).slice(0, props.maxDays || 7);
    });

    const visiblePeriods = computed(() => {
      const all = safeArray(props.periods);
      if (!focusedPeriodId.value) return all;
      const match = all.filter((p) => p.id === focusedPeriodId.value);
      if (safeLength(match) === 0) {
        console.warn('🚨 [SchedulerGrid] Focused period not found, clearing.', {
          focusedId: focusedPeriodId.value,
          availableIds: all.slice(0, 5).map((p) => p.id),
        });
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
      return teacherIds
        .map((id) => props.teachers.find((t) => t.id === id)?.name || 'Unknown Teacher')
        .join(', ');
    }
    function getAssignmentTeachers(a) {
      if (Array.isArray(a.teacher_names) && a.teacher_names.length) return a.teacher_names.join(', ');
      const ids = a.staff_ids || a.teacher_ids;
      return ids?.length ? getTeacherNames(ids) : '';
    }
    function getRoomName(roomId) {
      if (!roomId) return 'No Room';
      const room = findRoom(roomId);
      return room?.name || 'Unknown Room';
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
      const courseOk = !a.course_id || !!findCourse(a.course_id);
      const classOk = !a.class_id || !!findClass(a.class_id);
      const roomOk = !a.room_id || !!findRoom(a.room_id);
      const teachersOk = !a.teacher_ids?.length || a.teacher_ids.every((id) => props.teachers.some((t) => t.id === id));
      return !(courseOk && classOk && roomOk && teachersOk);
    }

    // Cells
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
      const courseName = getCourseName(assignment.course_id);
      if (!courseName && assignment.subject_id) classes.push('lesson-schedule');
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

    // Context menu positioning (clamp to viewport)
    function computeContextMenuPosition(evt, menuSize = { w: 220, h: 96 }) {
      const vw = window.innerWidth || 1024;
      const vh = window.innerHeight || 768;
      const rect = evt?.currentTarget?.getBoundingClientRect?.();

      console.log('🖱️ [ContextMenu] Right-click event:', {
        clientX: evt?.clientX,
        clientY: evt?.clientY,
        targetTag: evt?.target?.tagName,
        currentTargetTag: evt?.currentTarget?.tagName,
      });

      let x, y;
      if (rect) {
        console.log('📐 [ContextMenu] Using element rect:', rect);
        x = rect.left + 8;
        y = rect.bottom + 6;
      } else {
        x = (evt?.clientX ?? 0) + 6;
        y = (evt?.clientY ?? 0) + 6;
      }

      const before = { x, y };
      if (x + menuSize.w > vw) x = Math.max(8, vw - menuSize.w - 8);
      if (y + menuSize.h > vh) y = Math.max(8, vh - menuSize.h - 8);

      console.log('🧮 [ContextMenu] Clamp:', { before, after: { x, y }, vw, vh });
      return { x, y };
    }

    function handleAssignmentRightClick(event, assignment, dayId, periodId) {
      console.log('➡️ [ContextMenu] Right-click on assignment:', {
        id: assignment?.id,
        course: assignment?.course_name || assignment?.display_cell || getDisplayName(assignment),
        dayId,
        periodId,
        isReadOnly: props.isReadOnly,
      });

      if (editingAssignment.value) cancelInlineEdit();

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
      if (!a) {
        closeContextMenu();
        return;
      }
      if (props.isReadOnly || props.isLiveMode) {
        const fn = props.parentEmit || emit;
        emitSchedulerRemoveEvent(fn, {
          dayId: a.day_id,
          periodId: a.period_id,
          assignmentId: a.id,
          courseId: a.course_id,
          courseName: a.course_name || a.display_cell || '',
        });
      } else {
        deleteInlineAssignment(a);
      }
      closeContextMenu();
    }

    // Inline editor
    function isEditing(id) {
      return editingAssignment.value?.id === id;
    }
    function startInlineEdit(a, dayId, periodId) {
      if (props.isReadOnly) return;
      editingAssignment.value = a;
      editingCell.value = { dayId, periodId };
    }
    function startInlineEditReadOnly(a, dayId, periodId) {
      editingAssignment.value = a;
      editingCell.value = { dayId, periodId };
    }
    function saveInlineEdit(updated) {
      const data = currentSchedules.value;
      const updatedList = data.map((s) => (s.id === updated.id ? updated : s));
      emit('update-assignments', updatedList);
      editingAssignment.value = null;
      editingCell.value = null;
    }
    function cancelInlineEdit() {
      editingAssignment.value = null;
      editingCell.value = null;
    }
    function deleteInlineAssignment(a) {
      if (props.emitDropEvents) {
        const fn = props.parentEmit || emit;
        emitSchedulerRemoveEvent(fn, {
          dayId: a.day_id,
          periodId: a.period_id,
          assignmentId: a.id,
          courseId: a.course_id,
          courseName: a.course_name || a.display_cell || '',
        });
      }
      const data = currentSchedules.value;
      const updated = data.filter((s) => s.id !== a.id);
      emit('update-assignments', updated);
      editingAssignment.value = null;
      editingCell.value = null;
    }

    // Available courses
    function getAvailableCoursesForSlot(dayId, periodId) {
      const normalized = props.courses.map((course, idx) => normalizeCourse(course, idx));
      const available = normalized.filter((course) => {
        const slots = Array.isArray(course.possibleSlots) ? course.possibleSlots : [];
        if (slots.length === 0) return true;
        return slots.some((slot) => slot.dayId === dayId && slot.periodId === periodId);
      });
      console.log('🎯 [SchedulerGrid] Available courses for slot:', {
        dayId,
        periodId,
        availableCount: safeLength(available),
      });
      return available;
    }
    function getNoPreferredDaysCourses() {
      return props.courses.filter((course) => !course.possible_time_slots || safeLength(course.possible_time_slots) === 0);
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
    function assignCourseToFocusedSlot(course) {
      if (props.isReadOnly || !focusedPeriodId.value) return;
      const firstDay = visibleDays.value[0];
      if (firstDay) assignCourseToSlot(course, firstDay.id, focusedPeriodId.value);
    }

    // Drag/drop (kept minimal)
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
        const dragData = JSON.parse(event.dataTransfer.getData('text/plain'));
        if (dragData.type === 'course') {
          const course = dragData.course;
          assignCourseToSlot(course, dayId, periodId);
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
      } catch (error) {
        console.error('🚨 [DragDrop] Error handling drop:', error);
      }
    }

    // Focus helpers
    function togglePeriodFocus(periodId) {
      focusedPeriodId.value = focusedPeriodId.value === periodId ? null : periodId;
      emit('period-focus-changed', focusedPeriodId.value);
    }
    function getFocusedPeriodName() {
      const p = props.periods.find((x) => x.id === focusedPeriodId.value);
      return p?.name || p?.label || 'Unknown Period';
    }

    // Grade stats helpers
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
      const gradeStats = [];
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
              totalSpots += freeSpots;
              totalGradeAllocation += freeSpots / courseGrades.length;
            }
          }
        });
        if (coursesCount > 0 || totalSpots > 0) {
          gradeStats.push({ grade, totalSpots, averageSpots: totalGradeAllocation, coursesCount });
        }
      });
      return gradeStats;
    }

    function handleCourseEdit(courseData) {
      emit('course-edit', courseData);
    }

    return {
      // state
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

      // computed
      visibleDays,
      visiblePeriods,
      currentSchedules,

      // utils
      safeArray,
      safeLength,

      // formatters/lookups
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

      // interactions
      handleCellClick,
      handleAssignmentClick,
      handleAssignmentRightClick,
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

      // modals
      assignCourseToSlot,
      handleTeacherRoomSubmit,
      handleTeacherRoomCancel,
      handleCourseSelectionSubmit,
      handleCourseSelectionCancel,

      // focus + stats
      togglePeriodFocus,
      getFocusedPeriodName,
      getDailyGradeStats,
      allGrades,

      // available courses
      getAvailableCoursesForSlot,
      getCourseCardStyle,
      getNoPreferredDaysCourses,
      assignCourseToFocusedSlot,

      // context menu state
      contextMenu,
    };
  },
};
</script>

<style scoped>
/* All your existing scoped styles from pasted7 (unchanged) */
.scheduler-grid {
  display: flex;
  flex-direction: column;
  width: 100%;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
  background: white;
}
/* ... keep the rest of your pasted7 scoped styles exactly as-is ... */

/* I removed the scoped .context-menu and .context-menu-backdrop rules here,
   because teleported content is outside the component, so scoped CSS won't apply. */
</style>

<!-- Unscoped styles so teleported menu/backdrop are always styled -->
<style>
.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
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
.context-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99998;
}
</style>
