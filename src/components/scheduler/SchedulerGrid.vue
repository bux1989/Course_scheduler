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

    <!-- Inline Assignment Editor (top-level to avoid positioning conflicts) -->
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
    // Local "safe" helpers (avoid external conflicts)
    const safeArray = (v) => (Array.isArray(v) ? v : []);
    const safeLength = (v) => (Array.isArray(v) ? v.length : 0);

    // Focus
    const focusedPeriodId = ref(null);

    // Inline edit
    const editingAssignment = ref(null);
    const editingCell = ref(null);

    // Modals
    const showTeacherRoomModal = ref(false);
    const modalCourseData = ref(null);
    const showCourseSelectionModal = ref(false);
    const courseSelectionData = ref(null);

    // Context menu
    const contextMenu = ref({ show: false, x: 0, y: 0, assignment: null, dayId: null, periodId: null });
    const contextMenuRef = ref(null);

    // Visible data
    const visibleDays = computed(() => {
      const validated = validateAndUnwrapArray(props.schoolDays, 'schoolDays');
      if (safeLength(validated) === 0) return [];
      return validated.slice(0, props.maxDays || 7);
    });
    const visiblePeriods = computed(() => {
      const all = safeArray(props.periods);
      if (safeLength(all) === 0) return [];
      if (!focusedPeriodId.value) return all;
      const match = all.filter((p) => p.id === focusedPeriodId.value);
      if (safeLength(match) === 0) {
        console.warn('Focused period not found; clearing focus', { focus: focusedPeriodId.value });
        focusedPeriodId.value = null;
        return all;
      }
      return match;
    });
    const currentSchedules = computed(() => (props.isLiveMode ? props.liveSchedules : props.draftSchedules));

    // Debug mode change
    watch(
      () => props.isLiveMode,
      (m, old) => {
        if (m !== old) {
          const mode = m ? 'live' : 'planner';
          console.log('🔄 [SchedulerGrid] Mode changed to:', mode);
          emit('mode-changed', mode);
        }
      },
      { immediate: true }
    );

    // Formatting
    const formatTime = (t) => {
      if (!t) return '';
      const parts = String(t).split(':');
      return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : String(t);
    };
    const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');

    // Lookups
    const findCourse = (id) => props.courses.find((c) => c.id === id);
    const findClass = (id) => props.classes.find((c) => c.id === id);
    const findRoom = (id) => props.rooms.find((r) => r.id === id);
    const findSubject = (id) => props.subjects.find((s) => s.id === id);

    const getCourseName = (courseId) => {
      if (!courseId) return null;
      const course = findCourse(courseId);
      return course?.name || course?.course_name || course?.title || null;
    };
    const getSubjectName = (subjectId) => {
      if (!subjectId) return null;
      const subject = findSubject(subjectId);
      return subject?.name || subject?.title || subject?.subject_name || null;
    };
    const getDisplayName = (a) => getCourseName(a.course_id) || getSubjectName(a.subject_id) || 'No Course';
    const getClassName = (classId) => (classId ? findClass(classId)?.name || 'No Class' : '');
    const getTeacherNames = (ids) => {
      if (!ids?.length) return 'No Teacher';
      return ids
        .map((id) => props.teachers.find((t) => t.id === id)?.name || 'Unknown Teacher')
        .join(', ');
    };
    const getAssignmentTeachers = (a) => {
      if (Array.isArray(a.teacher_names) && a.teacher_names.length) return a.teacher_names.join(', ');
      const ids = a.staff_ids || a.teacher_ids;
      return ids?.length ? getTeacherNames(ids) : '';
    };
    const getRoomName = (roomId) => (roomId ? findRoom(roomId)?.name || 'Unknown Room' : 'No Room');

    // Conflict/deleted checks
    const hasConflicts = (a) =>
      props.conflicts.some(
        (c) =>
          c.day_id === a.day_id &&
          c.period_id === a.period_id &&
          (c.assignment_id === a.id ||
            c.teacher_ids?.some((id) => a.teacher_ids?.includes(id)) ||
            c.class_id === a.class_id ||
            c.room_id === a.room_id)
      );
    const hasDeletedEntities = (a) => {
      const courseOk = !a.course_id || !!findCourse(a.course_id);
      const classOk = !a.class_id || !!findClass(a.class_id);
      const roomOk = !a.room_id || !!findRoom(a.room_id);
      const teachersOk = !a.teacher_ids?.length || a.teacher_ids.every((id) => props.teachers.some((t) => t.id === id));
      return !(courseOk && classOk && roomOk && teachersOk);
    };

    // Cell helpers
    const getCellAssignments = (dayId, periodId) => {
      const entries = currentSchedules.value;
      const list = entries.filter((a) => {
        const dayMatch =
          a.day_id === dayId ||
          a.day_number === props.schoolDays.find((d) => d.id === dayId)?.day_number ||
          a.day_name_en === props.schoolDays.find((d) => d.id === dayId)?.name ||
          a.day_name_en === props.schoolDays.find((d) => d.id === dayId)?.name_en;

        const period = props.periods.find((p) => p.id === periodId);
        const periodMatch = a.period_id === periodId || (a.block_number && a.block_number === period?.blockNumber);
        return dayMatch && periodMatch;
      });

      return list.sort((a, b) => {
        const ca = getClassName(a.class_id);
        const cb = getClassName(b.class_id);
        if (ca !== cb) return ca.localeCompare(cb);
        const pa = getDisplayName(a);
        const pb = getDisplayName(b);
        return pa.localeCompare(pb);
      });
    };

    const getCellClasses = (dayId, periodId) => {
      const as = getCellAssignments(dayId, periodId);
      const classes = [];
      if (safeLength(as) > 0) {
        classes.push('has-assignments');
        if (safeLength(as) > 1) classes.push('multiple-assignments');
      }
      if (as.some((a) => props.conflicts.some((c) => c.day_id === dayId && c.period_id === periodId))) {
        classes.push('has-conflicts');
      }
      return classes;
    };

    const getCellAriaLabel = (day, period) => {
      const as = getCellAssignments(day.id, period.id);
      if (safeLength(as) === 0) return `${day.name} ${period.name}: Empty, click to add assignment`;
      const names = as.map((a) => getDisplayName(a)).join(', ');
      return `${day.name} ${period.name}: ${names}, ${safeLength(as)} assignment${safeLength(as) > 1 ? 's' : ''}`;
    };

    const getAssignmentClasses = (assignment) => {
      const classes = [];
      if (hasConflicts(assignment)) classes.push('has-conflict');
      if (hasDeletedEntities(assignment)) classes.push('has-deleted-entities');
      const courseName = getCourseName(assignment.course_id);
      if (!courseName && assignment.subject_id) classes.push('lesson-schedule');
      return classes;
    };
    const getAssignmentStyles = (assignment) => {
      const course = findCourse(assignment.course_id);
      const cls = findClass(assignment.class_id);
      return {
        borderLeft: `4px solid ${course?.color || cls?.color || '#e0e0e0'}`,
        backgroundColor: course?.color ? `${course.color}15` : cls?.color ? `${cls.color}15` : '#f9f9f9',
      };
    };

    // Interactions
    const handleCellClick = (dayId, periodId, period) => {
      if (props.isReadOnly) return;
      const as = getCellAssignments(dayId, periodId);
      if (as.length === 0) return;
      emit('cell-click', { dayId, periodId, period });
    };

    const handleAssignmentClick = (assignment) => {
      emit('assignment-details', assignment);
    };

    // Context menu positioning + logs
    const computeContextMenuPosition = (evt, menuSize = { w: 220, h: 96 }) => {
      const vw = window.innerWidth || 1024;
      const vh = window.innerHeight || 768;
      const rect = evt?.currentTarget?.getBoundingClientRect?.();
      let x, y;

      console.log('🖱️ [ContextMenu] Right-click event:', {
        clientX: evt?.clientX,
        clientY: evt?.clientY,
        targetTag: evt?.target?.tagName,
        currentTargetTag: evt?.currentTarget?.tagName,
      });

      if (rect) {
        x = rect.left + 8;
        y = rect.bottom + 6;
        console.log('📐 [ContextMenu] Using element rect:', rect);
      } else {
        x = (evt?.clientX ?? 0) + 6;
        y = (evt?.clientY ?? 0) + 6;
        console.log('📐 [ContextMenu] Using cursor fallback.');
      }

      const before = { x, y };
      if (x + menuSize.w > vw) x = Math.max(8, vw - menuSize.w - 8);
      if (y + menuSize.h > vh) y = Math.max(8, vh - menuSize.h - 8);
      console.log('🧮 [ContextMenu] Clamp:', { before, after: { x, y }, vw, vh });

      return { x, y };
    };

    const measureContextMenuRender = () => {
      nextTick(() => {
        const el = contextMenuRef.value;
        if (!el) {
          console.log('❓ [ContextMenu] Ref not set');
          return;
        }
        const rect = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        console.log('📏 [ContextMenu] Render rect:', rect, 'style:', { zIndex: cs.zIndex, pos: cs.position });

        // Re-clamp with actual size if needed
        const vw = window.innerWidth || 1024;
        const vh = window.innerHeight || 768;
        let x = contextMenu.value.x;
        let y = contextMenu.value.y;
        let changed = false;
        const w = rect.width || 220;
        const h = rect.height || 96;
        if (x + w > vw) {
          x = Math.max(8, vw - w - 8);
          changed = true;
        }
        if (y + h > vh) {
          y = Math.max(8, vh - h - 8);
          changed = true;
        }
        if (changed) {
          console.log('🔧 [ContextMenu] Adjust after measure:', { x, y, w, h, vw, vh });
          contextMenu.value.x = x;
          contextMenu.value.y = y;
        }
      });
    };

    watch(
      () => contextMenu.value.show,
      (show) => {
        if (show) {
          console.log('▶️ [ContextMenu] Show at:', { x: contextMenu.value.x, y: contextMenu.value.y });
          measureContextMenuRender();
        } else {
          console.log('⏹️ [ContextMenu] Hidden');
        }
      }
    );

    const handleAssignmentRightClick = (event, assignment, dayId, periodId) => {
      console.log('➡️ [ContextMenu] Right-click on assignment:', {
        id: assignment?.id,
        course: assignment?.course_name || assignment?.display_cell || getDisplayName(assignment),
        dayId,
        periodId,
        isReadOnly: props.isReadOnly,
      });

      if (editingAssignment.value) {
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
    };

    const closeContextMenu = () => {
      contextMenu.value.show = false;
    };

    const editAssignmentFromContext = () => {
      if (!contextMenu.value.assignment) return;
      if (props.isReadOnly || props.isLiveMode) {
        startInlineEditReadOnly(contextMenu.value.assignment, contextMenu.value.dayId, contextMenu.value.periodId);
      } else {
        startInlineEdit(contextMenu.value.assignment, contextMenu.value.dayId, contextMenu.value.periodId);
      }
      closeContextMenu();
    };

    const deleteAssignmentFromContext = () => {
      if (!contextMenu.value.assignment) {
        closeContextMenu();
        return;
      }
      if (props.isReadOnly || props.isLiveMode) {
        // fire test remove for workflows
        const a = contextMenu.value.assignment;
        const fn = props.parentEmit || emit;
        emitSchedulerRemoveEvent(fn, {
          dayId: a.day_id,
          periodId: a.period_id,
          assignmentId: a.id,
          courseId: a.course_id,
          courseName: a.course_name || a.display_cell || '',
        });
      } else {
        deleteInlineAssignment(contextMenu.value.assignment);
      }
      closeContextMenu();
    };

    // Inline editor
    const isEditing = (id) => editingAssignment.value?.id === id;
    const startInlineEdit = (a, dayId, periodId) => {
      if (props.isReadOnly) return;
      editingAssignment.value = a;
      editingCell.value = { dayId, periodId };
    };
    const startInlineEditReadOnly = (a, dayId, periodId) => {
      editingAssignment.value = a;
      editingCell.value = { dayId, periodId };
    };
    const saveInlineEdit = (updated) => {
      const data = currentSchedules.value;
      const updatedList = data.map((s) => (s.id === updated.id ? updated : s));
      emit('update-assignments', updatedList);
      editingAssignment.value = null;
      editingCell.value = null;
    };
    const cancelInlineEdit = () => {
      editingAssignment.value = null;
      editingCell.value = null;
    };
    const deleteInlineAssignment = (a) => {
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
    };

    // Course selection and assignment flow
    const getAvailableCoursesForSlot = (dayId, periodId) => {
      const normalized = props.courses.map((c, i) => normalizeCourse(c, i));
      const available = normalized.filter((course) => {
        const slots = course.possibleSlots || [];
        if (slots.length === 0) return true;
        return slots.some((s) => s.dayId === dayId && s.periodId === periodId);
      });
      console.log('🎯 [SchedulerGrid] Available courses for slot:', {
        dayId,
        periodId,
        availableCount: safeLength(available),
      });
      return available;
    };

    const getCourseCardStyle = (course) => ({
      borderLeft: `4px solid ${course.color || '#007cba'}`,
      backgroundColor: course.color ? `${course.color}15` : '#f0f8ff',
    });

    const assignCourseToSlot = (course, dayId, periodId) => {
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
    };

    const handleTeacherRoomSubmit = (payload) => {
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
    };
    const handleTeacherRoomCancel = () => {
      showTeacherRoomModal.value = false;
      modalCourseData.value = null;
    };

    const handleCourseSelectionSubmit = (payload) => {
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
    };
    const handleCourseSelectionCancel = () => {
      showCourseSelectionModal.value = false;
      courseSelectionData.value = null;
    };

    const getNoPreferredDaysCourses = () =>
      props.courses.filter((course) => !course.possible_time_slots || safeLength(course.possible_time_slots) === 0);

    const assignCourseToFocusedSlot = (course) => {
      if (props.isReadOnly || !focusedPeriodId.value) return;
      const firstDay = visibleDays.value[0];
      if (firstDay) assignCourseToSlot(course, firstDay.id, focusedPeriodId.value);
    };

    // Drag & Drop (minimal – only to support visual feedback if you use it)
    const draggedCourse = ref(null);
    const draggedAssignment = ref(null);
    const dragOverCell = ref(null);

    const handleCourseDragStart = (event, course) => {
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
    };
    const handleCourseDragEnd = (event) => {
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
    };
    const handleAssignmentDragStart = (event, assignment, dayId, periodId) => {
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
    };
    const handleAssignmentDragEnd = (event) => {
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
    };
    const handleCellDragOver = (event) => {
      if (!draggedCourse.value && !draggedAssignment.value) return false;
      event.dataTransfer.dropEffect = draggedAssignment.value ? 'move' : 'copy';
      return false;
    };
    const handleCellDragEnter = (event, dayId, periodId) => {
      if (!draggedCourse.value && !draggedAssignment.value) return;
      dragOverCell.value = `${dayId}-${periodId}`;
      event.currentTarget.classList.add('drag-over');
    };
    const handleCellDragLeave = (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        dragOverCell.value = null;
        event.currentTarget.classList.remove('drag-over');
      }
    };
    const handleCellDrop = (event, dayId, periodId) => {
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
      } catch (e) {
        console.error('🚨 [DragDrop] Error handling drop:', e);
      }
    };

    // Misc
    const togglePeriodFocus = (id) => {
      focusedPeriodId.value = focusedPeriodId.value === id ? null : id;
      emit('period-focus-changed', focusedPeriodId.value);
    };
    const getFocusedPeriodName = () => props.periods.find((p) => p.id === focusedPeriodId.value)?.name || 'Unknown Period';

    // Stats (unchanged)
    const parseGrades = (course) => {
      const out = [];
      if (course.is_for_year_g && typeof course.is_for_year_g === 'object') {
        for (const [, grade] of Object.entries(course.is_for_year_g)) if (grade && grade > 0) out.push(Number(grade));
      } else if (Array.isArray(course.is_for_year_groups)) {
        out.push(...course.is_for_year_groups.map((g) => Number(g)).filter((g) => g > 0));
      } else if (Array.isArray(course.year_groups)) {
        out.push(...course.year_groups.map((g) => Number(g)).filter((g) => g > 0));
      }
      return [...new Set(out)].sort((a, b) => a - b);
    };
    const allGrades = computed(() => {
      const set = new Set();
      safeArray(props.courses).forEach((c) => parseGrades(c).forEach((g) => set.add(g)));
      return Array.from(set).sort((a, b) => a - b);
    });
    const findCourseById = (id) => safeArray(props.courses).find((c) => c.id === id);
    const getScheduledCoursesForSlot = (dayId, periodId) => {
      const scheduled = [];
      const entries = safeArray(currentSchedules.value).filter((e) => e.day_id === dayId && e.period_id === periodId);
      entries.forEach((entry) => {
        const course = findCourseById(entry.course_id);
        if (course) {
          const totalSpots = course.max_students || course.capacity || 0;
          const freeSpots = entry.free_spaces !== undefined ? entry.free_spaces : totalSpots;
          scheduled.push({ ...course, scheduledEntry: entry, freeSpots, totalSpots });
        }
      });
      return scheduled;
    };
    const getDailyGradeStats = (dayId, periodId) => {
      if (!periodId) return [];
      const scheduledCourses = getScheduledCoursesForSlot(dayId, periodId);
      const out = [];
      allGrades.value.forEach((grade) => {
        let totalSpots = 0;
        let coursesCount = 0;
        let totalGradeAllocation = 0;
        scheduledCourses.forEach((course) => {
          const grades = parseGrades(course);
          if (grades.includes(grade)) {
            coursesCount++;
            const free = course.freeSpots || 0;
            if (grades.length === 1) {
              totalSpots += free;
              totalGradeAllocation += free;
            } else {
              totalSpots += free;
              totalGradeAllocation += free / grades.length;
            }
          }
        });
        if (coursesCount > 0 || totalSpots > 0) out.push({ grade, totalSpots, averageSpots: totalGradeAllocation, coursesCount });
      });
      return out;
    };

    // Course edit event for parent
    const handleCourseEdit = (courseData) => {
      emit('course-edit', courseData);
    };

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

      // Utils exposed to template
      safeArray,
      safeLength,

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
      handleAssignmentClick,
      handleAssignmentRightClick,
      closeContextMenu,
      editAssignmentFromContext,
      deleteAssignmentFromContext,

      isEditing,
      startInlineEdit,
      startInlineEditReadOnly,
      saveInlineEdit,
      cancelInlineEdit,
      deleteInlineAssignment,
      handleCourseEdit,

      handleCourseDragStart,
      handleCourseDragEnd,
      handleAssignmentDragStart,
      handleAssignmentDragEnd,
      handleCellDragOver,
      handleCellDragEnter,
      handleCellDragLeave,
      handleCellDrop,

      assignCourseToSlot,
      handleTeacherRoomSubmit,
      handleTeacherRoomCancel,
      handleCourseSelectionSubmit,
      handleCourseSelectionCancel,

      togglePeriodFocus,
      getFocusedPeriodName,

      getAvailableCoursesForSlot,
      getCourseCardStyle,
      getNoPreferredDaysCourses,
      assignCourseToFocusedSlot,

      getDailyGradeStats,
      allGrades,

      contextMenu,
      contextMenuRef,
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
  background: white;
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
.add-text {
  opacity: 0.8;
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

/* Drag/drop */
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

/* Grade Statistics Row */
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
  font-size: 0.85em;
  font-weight: 600;
}
.stats-emoji {
  font-size: 1.1em;
}
.day-statistics-cell {
  flex: 1;
  border-right: 1px solid #ddd;
  padding: 8px;
  background: white;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 100px;
}
.stats-headers {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2px;
  margin-bottom: 4px;
  padding: 2px;
  background: rgba(0, 124, 186, 0.1);
  border-radius: 3px;
}
.stat-header {
  font-size: 0.9em;
  text-align: center;
  cursor: help;
  padding: 2px 4px;
  border-radius: 2px;
  flex: 1;
}
.stat-header:hover {
  background: rgba(0, 124, 186, 0.2);
}
.stats-rows {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-grow: 1;
}
.grade-stats-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 2px;
  padding: 2px 4px;
  font-size: 0.75em;
}
.grade-number {
  font-weight: 600;
  color: #333;
  min-width: 20px;
  font-size: 0.8em;
}
.stat-value {
  text-align: center;
  padding: 1px 2px;
  background: white;
  border-radius: 2px;
  font-size: 0.7em;
  color: #666;
  min-width: 18px;
  flex: 1;
}

/* Context Menu (teleported) */
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

/* Read-only */
.scheduler-grid[data-readonly='true'] .schedule-cell {
  cursor: default;
}
.scheduler-grid[data-readonly='true'] .schedule-cell:hover {
  background: inherit;
}
.scheduler-grid[data-readonly='true'] .draggable-course,
.scheduler-grid[data-readonly='true'] .draggable-assignment {
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

/* Debug panels */
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
</style>
