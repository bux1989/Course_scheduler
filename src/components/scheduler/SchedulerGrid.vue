<template>
  <div class="scheduler-grid" @click="closeContextMenu">
    <!-- Header -->
    <div class="grid-header" ref="gridHeaderRef">
      <div class="period-header-cell">Period</div>
      <div
        v-for="day in visibleDays"
        :key="day.id"
        class="day-header-cell"
      >
        <div class="day-name">{{ day.name }}</div>
        <div class="day-date">{{ formatDate(day.date) }}</div>
      </div>
    </div>

    <!-- Body -->
    <div class="grid-body">
      <div
        v-for="period in visiblePeriods"
        :key="period.id"
        class="grid-row"
        :class="{ 'non-instructional': !period.is_instructional }"
      >
        <!-- Period label / focus -->
        <div
          class="period-label-cell"
          :class="{ focused: isFocused(period.id) }"
          @click.stop="togglePeriodFocus(period.id)"
        >
          <div class="period-name">{{ period.name }}</div>
          <div class="period-time">{{ formatTime(period.start_time) }} – {{ formatTime(period.end_time) }}</div>
        </div>

        <!-- Cells -->
        <div
          v-for="day in visibleDays"
          :key="`${day.id}|${period.id}`"
          class="schedule-cell"
          :class="getCellClasses(day.id, period.id)"
          :aria-label="getCellAriaLabel(day.id, period.id)"
          @click.stop="handleCellClick(day.id, period.id)"
          @dragover.prevent="handleCellDragOver($event, day.id, period.id)"
          @dragenter="handleCellDragEnter($event, day.id, period.id)"
          @dragleave="handleCellDragLeave($event, day.id, period.id)"
          @drop.prevent="handleCellDrop($event, day.id, period.id)"
        >
          <!-- Assignments -->
          <div
            v-for="assignment in getCellAssignments(day.id, period.id)"
            :key="assignment.id"
            class="assignment-item draggable-assignment"
            :class="getAssignmentClasses(assignment)"
            :style="getAssignmentStyles(assignment)"
            @click.stop="handleAssignmentClick(assignment, day.id, period.id)"
            @contextmenu.stop.prevent="openContextMenu($event, assignment, day.id, period.id)"
            :draggable="(!isReadOnly && !isLiveMode) && !isEditing(assignment.id)"
            @dragstart="handleAssignmentDragStart($event, assignment)"
            @dragend="handleAssignmentDragEnd($event, assignment)"
          >
            <div class="assignment-title">{{ getDisplayName(assignment) }}</div>
            <div class="assignment-meta">
              <span v-if="getTeacherNames(assignment).length">{{ getTeacherNames(assignment).join(', ') }}</span>
              <span v-if="getRoomName(assignment)" class="room-tag">• {{ getRoomName(assignment) }}</span>
            </div>
          </div>

          <!-- Available courses (slot-aware) -->
          <div class="available-courses" v-if="getAvailableCoursesForSlot(day.id, period.id).length">
            <div
              v-for="course in getAvailableCoursesForSlot(day.id, period.id)"
              :key="course.id"
              class="course-card"
              :style="getCourseCardStyle(course)"
              draggable="true"
              @dragstart="handleCourseDragStart($event, course, day.id, period.id)"
              @dragend="handleCourseDragEnd($event, course)"
              @click.stop="assignCourseToSlot(course, day.id, period.id)"
            >
              <div class="course-title">{{ getCourseName(course) }}</div>
              <div class="course-subtitle">{{ getSubjectName(course) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Context menu -->
    <teleport to="body">
      <div v-if="contextMenu.show" class="context-menu-backdrop" @click="closeContextMenu"></div>
      <div
        v-if="contextMenu.show"
        class="context-menu"
        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
        tabindex="-1"
        ref="contextMenuRef"
        @blur="closeContextMenu"
      >
        <div class="context-menu-item" @click.stop="editAssignmentFromContext">✏️ Edit</div>
        <div class="context-menu-item delete" @click.stop="deleteAssignmentFromContext">🗑️ Delete</div>
      </div>
    </teleport>

    <!-- Inline editor (unchanged in v168) -->
    <teleport to="body">
      <div v-if="isEditing()" class="assignment-editor-backdrop" @click="cancelInlineEdit"></div>
      <div v-if="isEditing()" class="assignment-editor-modal" role="dialog" aria-modal="true">
        <div class="editor-modal-header">
          <div class="editor-modal-title">{{ editorModalTitle }}</div>
          <button class="editor-modal-close" @click="cancelInlineEdit" aria-label="Close">&times;</button>
        </div>
        <div class="editor-modal-body">
          <!-- ... your existing editor body ... -->
        </div>
      </div>
    </teleport>

    <!-- Teacher/Room modal -->
    <TeacherRoomSelectionModal
      v-if="showTeacherRoomModal && modalCourseData"
      :courseId="modalCourseData.courseId"
      :courseName="modalCourseData.courseName"
      :dayId="modalCourseData.dayId"
      :periodId="modalCourseData.periodId"
      :teachers="teachers"
      :rooms="rooms"
      :preselectedTeacherIds="modalCourseData.preselectedTeacherIds || []"
      :preselectedRoomId="modalCourseData.preselectedRoomId"
      @submit="handleTeacherRoomSubmit"
      @cancel="handleTeacherRoomCancel"
    />
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import TeacherRoomSelectionModal from './TeacherRoomSelectionModal.vue';

export default {
  name: 'SchedulerGrid',
  components: { TeacherRoomSelectionModal },
  props: {
    // data
    periods: Array,
    schoolDays: Array,
    schedules: Array,
    courses: Array,
    teachers: Array,
    rooms: Array,

    // flags
    isReadOnly: Boolean,
    isLiveMode: Boolean,
    hideScheduledInAvailable: { type: Boolean, default: true },
  },
  emits: [
    // drag+drop & modal events
    'scheduler-drop', 'scheduler-drag-end',
    'period-focus-changed'
  ],
  setup(props, { emit }) {
    // ----------------
    // DOM Refs
    // ----------------
    const gridHeaderRef = ref(null);
    const availableGridRef = ref(null);
    const availableGridTemplate = ref('1fr');

    // ----------------
    // State
    // ----------------
    const focusedPeriodId = ref(null);
    const draggedCourse = ref(null);
    const draggedAssignment = ref(null);
    const optimisticallyScheduled = ref(new Set());
    const recurringWhitelist = ref(new Set());

    const editingAssignment = ref(null);
    const editingCell = ref(null);

    const contextMenu = ref({ show: false, x: 0, y: 0, assignment: null, dayId: null, periodId: null });
    const contextMenuRef = ref(null);

    const showTeacherRoomModal = ref(false);
    const modalCourseData = ref(null);

    // ----------------
    // Utils
    // ----------------
    const normId = (v) => (v == null ? null : String(v));
    const isSameId = (a, b) => normId(a) === normId(b);
    const safeArray = (x) => Array.isArray(x) ? x : (x ? [x] : []);
    const safeLength = (x) => safeArray(x).length;
    const formatTime = (t) => String(t || '').slice(0,5);
    const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : '');
    const formatInt = (n) => isNaN(parseInt(n, 10)) ? '' : String(parseInt(n, 10));

    // ----------------
    // Computed
    // ----------------
    const visibleDays = computed(() => props.schoolDays || []);
    const visiblePeriods = computed(() => props.periods || []);
    const currentSchedules = computed(() => props.schedules || []);
    const hasData = computed(() => (visiblePeriods.value.length && visibleDays.value.length));

    const editorModalTitle = computed(() => {
      if (!editingAssignment.value) return 'Edit Assignment';
      return `Edit: ${getDisplayName(editingAssignment.value)}`;
    });

    // ----------------
    // Helpers for cells/assignments (abbrev; keep your originals as-is)
    // ----------------
    const getCellAssignments = (dayId, periodId) =>
      safeArray(currentSchedules.value).filter((a) => isSameId(a.day_id, dayId) && isSameId(a.period_id, periodId));

    const getCellClasses = (dayId, periodId) => ({
      focused: isFocused(periodId),
      'has-assignments': getCellAssignments(dayId, periodId).length > 0,
    });

    const getCellAriaLabel = (dayId, periodId) => {
      const count = getCellAssignments(dayId, periodId).length;
      return `Cell: ${count} assignment${count === 1 ? '' : 's'}`;
    };

    const getAssignmentClasses = (a) => ({
      assignment: true,
      conflict: hasConflicts(a),
      deleted: hasDeletedEntities(a),
    });

    const getAssignmentStyles = () => ({});

    const getCourseName = (course) =>
      course?.name || course?.course_name || course?.title || 'Course';

    const getSubjectName = (course) => course?.subject_name || '';

    const getDisplayName = (a) => a?.course_name || a?.title || 'Assignment';

    const getClassName = (a) => a?.class_name || '';

    const getAssignmentTeachers = (a) => safeArray(a?.teacher_names || a?.teachers || []);
    const getTeacherNames = (a) => getAssignmentTeachers(a);
    const getRoomName = (a) => a?.room_name || a?.room || '';

    const hasConflicts = () => false;
    const hasDeletedEntities = () => false;

    // ----------------
    // Allowed slots & labels (unchanged helper shape)
    // ----------------
    const normalizeSlots = (course) => {
      const out = [];
      const pushIfValid = (d, p) => {
        if (d == null || p == null) return;
        out.push({ dayId: normId(d), periodId: normId(p) });
      };

      const src = course?.possible_time_slots || course?.time_slots || [];
      safeArray(src).forEach((s) => {
        if (s && typeof s === 'object') {
          const d = s.dayId ?? s.day_id ?? s.day ?? s.day_number ?? s.dayNumber;
          const p = s.periodId ?? s.period_id ?? s.blockId ?? s.block_id ?? s.period ?? s.periodId;
          pushIfValid(d, p);
        }
      });
      return out;
    };

    const isCourseAllowedForSlot = (course, dayId, periodId) => {
      const slots = normalizeSlots(course);
      if (!slots.length) return true;
      const d = normId(dayId), p = normId(periodId);
      return slots.some((s) => isSameId(s.dayId, d) && isSameId(s.periodId, p));
    };

    const buildAllowedSlotsLabel = (course) => {
      const slots = normalizeSlots(course);
      if (!slots.length) return 'any day and period';
      const byDay = {};
      slots.forEach(({ dayId, periodId }) => {
        const dayName = props.schoolDays.find((d) => isSameId(d.id, dayId))?.name || `Day ${dayId}`;
        const perName = props.periods.find((p) => isSameId(p.id, periodId))?.name || 'Period';
        byDay[dayName] = byDay[dayName] ? [...byDay[dayName], perName] : [perName];
      });
      return Object.entries(byDay).map(([dn, per]) => `${dn} (${Array.from(new Set(per)).join(', ')})`).join('; ');
    };

    // ----------------
    // Context menu (brought from v163)
    // ----------------
    const computeContextMenuPosition = (evt, menuSize = { w: 220, h: 96 }) => {
      const vw = window.innerWidth || 1024;
      const vh = window.innerHeight || 768;
      let x = (evt?.clientX ?? 0) + 6;
      let y = (evt?.clientY ?? 0) + 6;
      if (x + menuSize.w > vw) x = Math.max(8, vw - menuSize.w - 8);
      if (y + menuSize.h > vh) y = Math.max(8, vh - menuSize.h - 8);
      return { x, y };
    };
    const openContextMenu = (event, assignment, dayId, periodId) => {
      event.stopPropagation();
      event.preventDefault();
      const pos = computeContextMenuPosition(event);
      contextMenu.value = { show: true, x: pos.x, y: pos.y, assignment, dayId, periodId };
      nextTick(() => contextMenuRef.value?.focus?.());
    };
    const closeContextMenu = () => (contextMenu.value.show = false);
    const editAssignmentFromContext = () => {
      if (!contextMenu.value.assignment) return;
      if (props.isReadOnly || props.isLiveMode) startInlineEditReadOnly(contextMenu.value.assignment, contextMenu.value.dayId, contextMenu.value.periodId);
      else startInlineEdit(contextMenu.value.assignment, contextMenu.value.dayId, contextMenu.value.periodId);
      closeContextMenu();
    };
    const deleteAssignmentFromContext = () => {
      const a = contextMenu.value.assignment;
      if (!a || props.isReadOnly || props.isLiveMode) { closeContextMenu(); return; }
      deleteInlineAssignment(a);
      closeContextMenu();
    };

    // ----------------
    // Click handlers
    // ----------------
    const handleCellClick = (dayId, periodId) => {
      closeContextMenu();
      editingCell.value = { dayId, periodId };
    };

    const handleAssignmentClick = (assignment, dayId, periodId) => {
      closeContextMenu();
      startInlineEdit(assignment, dayId, periodId);
    };

    // ----------------
    // Inline editor stubs (keep your real implementations)
    // ----------------
    const isEditing = (id) => (!!editingAssignment.value && (!id || editingAssignment.value.id === id));
    const startInlineEdit = (assignment, dayId, periodId) => { editingAssignment.value = { ...assignment, dayId, periodId }; };
    const startInlineEditReadOnly = (assignment, dayId, periodId) => { editingAssignment.value = { ...assignment, dayId, periodId, readonly: true }; };
    const saveInlineEdit = () => { editingAssignment.value = null; };
    const cancelInlineEdit = () => { editingAssignment.value = null; };
    const deleteInlineAssignment = () => { editingAssignment.value = null; };
    const onEditorSave = () => saveInlineEdit();
    const onEditorDelete = () => deleteInlineAssignment();
    const handleCourseEdit = () => {};

    // ----------------
    // Drag & drop (keep your details)
    // ----------------
    const handleCourseDragStart = (evt, course, dayId, periodId) => { draggedCourse.value = { course, dayId, periodId }; };
    const handleCourseDragEnd = () => { draggedCourse.value = null; };
    const handleAssignmentDragStart = (evt, assignment) => { draggedAssignment.value = assignment; };
    const handleAssignmentDragEnd = () => { draggedAssignment.value = null; };
    const handleCellDragOver = () => {};
    const handleCellDragEnter = () => {};
    const handleCellDragLeave = () => {};
    const handleCellDrop = () => {};

    // ----------------
    // Modal open from course → preselect teachers + room
    // ----------------
    const getProposedTeacherIds = (course) => {
      const ids = [];
      if (Array.isArray(course?.possible_staff_ids)) ids.push(...course.possible_staff_ids);
      if (course?.possible_staff_ids && typeof course.possible_staff_ids === 'object' && !Array.isArray(course.possible_staff_ids)) {
        Object.keys(course.possible_staff_ids).forEach((k) => ids.push(course.possible_staff_ids[k]));
      }
      return ids.map((x) => String(x)).filter((x) => !!x && x !== 'null' && x !== 'undefined');
    };
    const getProposedRoomId = (course) => {
      const rid = course?.possible_room_id ?? course?.room_id ?? null;
      return rid == null ? null : String(rid);
    };

    const assignCourseToSlot = (course, dayId, periodId) => {
      closeContextMenu();

      // Warning if course is not allowed in this slot
      if (!isCourseAllowedForSlot(course, dayId, periodId)) {
        const allowedText = buildAllowedSlotsLabel(course);
        const dayName = props.schoolDays.find((d) => isSameId(d.id, dayId))?.name || 'this day';
        const perName = props.periods.find((p) => isSameId(p.id, periodId))?.name || 'this period';
        const ok = window.confirm(
          `${getCourseName(course)} is configured to be available for: ${allowedText}.\n\nYou are scheduling it on ${dayName} – ${perName}.\n\nAre you sure you want to continue?`
        );
        if (!ok) return;
      }

      modalCourseData.value = {
        courseId: course.id,
        courseName: getCourseName(course),
        courseCode: course.code || course.course_code || '',
        dayId, periodId,
        preselectedTeacherIds: getProposedTeacherIds(course),
        preselectedRoomId: getProposedRoomId(course), // <— NEW
      };
      showTeacherRoomModal.value = true;
    };

    const handleTeacherRoomSubmit = (payload) => {
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
    };
    const handleTeacherRoomCancel = () => {
      showTeacherRoomModal.value = false;
      modalCourseData.value = null;
    };

    // ----------------
    // Period focus
    // ----------------
    const togglePeriodFocus = (periodId) => {
      const pid = normId(periodId);
      focusedPeriodId.value = isSameId(focusedPeriodId.value, pid) ? null : pid;
      emit('period-focus-changed', focusedPeriodId.value);
    };
    const isFocused = (id) => isSameId(focusedPeriodId.value, id);
    const getFocusedPeriodName = () =>
      props.periods.find((p) => isSameId(p.id, focusedPeriodId.value))?.name || 'Unknown Period';

    // ----------------
    // Available courses for a given slot
    // ----------------
    const getAvailableCoursesForSlot = (dayId, periodId) => {
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
        if (props.hideScheduledInAvailable && optimisticallyScheduled.value.has(k)) return false;
        if (scheduledIds.has(cid) && !recurringWhitelist.value.has(k)) return false;
        return true;
      });
    };

    // ----------------
    // Layout / events (keep v168 behavior)
    // ----------------
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        contextMenu.value.show = false;
        if (editingAssignment.value) editingAssignment.value = null;
      }
    };
    const measureAndApplyAvailableColumns = () => { /* your v168 implementation */ };
    const onWindowResize = () => {
      contextMenu.value.show = false;
      measureAndApplyAvailableColumns();
    };
    const onAnyScroll = () => { contextMenu.value.show = false; };

    onMounted(async () => {
      window.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('resize', onWindowResize, { passive: true });
      window.addEventListener('scroll', onAnyScroll, { passive: true, capture: true });

      await nextTick();
      measureAndApplyAvailableColumns();
    });
    watch(() => visibleDays.value.length, async () => {
      await nextTick();
      measureAndApplyAvailableColumns();
    });

    onBeforeUnmount(() => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('scroll', onAnyScroll, true);
    });

    return {
      // DOM
      gridHeaderRef,
      availableGridRef,
      availableGridTemplate,

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
      hasData,
      editorModalTitle,

      // helpers + formatters
      safeArray,
      safeLength,
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
      openContextMenu,
      closeContextMenu,
      editAssignmentFromContext,
      deleteAssignmentFromContext,
      handleCellClick,
      handleAssignmentClick,

      // inline editor (popup)
      isEditing,
      startInlineEdit,
      startInlineEditReadOnly,
      saveInlineEdit,
      cancelInlineEdit,
      deleteInlineAssignment,
      onEditorSave,
      onEditorDelete,
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

      // available courses
      getAvailableCoursesForSlot,
      getNoPreferredDaysCourses: () => [], // keep API surface
      getCourseCardStyle: () => ({}),
      isDraggingCourse: () => !!draggedCourse.value,
    };
  },
};
</script>

<style scoped>
/* Root */
.scheduler-grid { display: flex; flex-direction: column; width: 100%; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; background: #fff; }

/* Header row */
.grid-header { display: flex !important; align-items: stretch; background: #f5f5f5; border-bottom: 1px solid #ddd; font-weight: 600; }
.period-header-cell { width: 140px; min-width: 140px; max-width: 140px; padding: 10px 8px; border-right: 1px solid #ddd; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.day-header-cell { flex: 1 1 0; min-width: 160px; padding: 10px 8px; border-right: 1px solid #ddd; text-align: center; display: flex; flex-direction: column; gap: 2px; box-sizing: border-box; }
.day-header-cell:last-child { border-right: 0; }
.day-name { font-size: 0.95em; }
.day-date { font-size: 0.8em; color: #666; }

/* Body */
.grid-body { display: block; }
.grid-row { display: flex !important; align-items: stretch; border-bottom: 1px solid #ddd; min-height: 72px; }
.grid-row:last-child { border-bottom: 0; }
.grid-row.non-instructional { background: #f8f9fa; }

.period-label-cell { width: 140px; min-width: 140px; max-width: 140px; padding: 8px; border-right: 1px solid #ddd; background: #f9f9f9;
  display: flex; align-items: center; cursor: pointer; transition: background-color 0.2s; box-sizing: border-box; }
.period-label-cell:hover { background: #f0f7ff !important; }

.schedule-cell { flex: 1 1 0; min-width: 160px; padding: 8px; border-right: 1px solid #eee; position: relative; }
.schedule-cell:last-child { border-right: 0; }
.schedule-cell.focused { background: #f9fbff; }
.schedule-cell.has-assignments { background: #fafafa; }

/* Assignment chips */
.assignment-item { background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 6px 8px; margin: 4px 0; cursor: pointer; user-select: none; }
.assignment-item.conflict { border-color: #fbbf24; background: #fffbeb; color: #92400e; }
.assignment-item.deleted { opacity: 0.55; }
.assignment-title { font-weight: 600; font-size: 13px; }
.assignment-meta { font-size: 12px; color: #555; }
.room-tag { opacity: 0.9; }

/* Available courses */
.available-courses { display: grid; grid-template-columns: v-bind(availableGridTemplate); gap: 8px; margin-top: 8px; }
.course-card { border: 1px dashed #ddd; border-radius: 8px; padding: 6px 8px; background: #fff; cursor: grab; }
.course-card:active { cursor: grabbing; }
.course-title { font-weight: 600; }
.course-subtitle { font-size: 12px; color: #666; }

/* Warnings */
.warning { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; margin: 8px 8px 0; color: #92400e; }

/* Assignment editor popup */
.assignment-editor-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 2147483600; }
.assignment-editor-modal {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: min(920px, 92vw); max-height: 86vh; overflow: auto;
  background: #fff; border-radius: 8px; box-shadow: 0 16px 48px rgba(0,0,0,0.35);
  z-index: 2147483601; display: flex; flex-direction: column;
}
.editor-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid #e5e5e5; }
.editor-modal-title { font-weight: 600; color: #333; }
.editor-modal-close { appearance: none; border: 0; background: transparent; font-size: 22px; line-height: 1; cursor: pointer; color: #666; }
.editor-modal-close:hover { color: #222; }
.editor-modal-body { padding: 12px 14px; }

/* Responsive */
@media (max-width: 1024px) { .day-header-cell, .schedule-cell, .day-statistics-cell { min-width: 200px; } }
@media (max-width: 768px) {
  .period-header-cell, .period-label-cell, .stats-label-cell { width: 120px; min-width: 120px; max-width: 120px; }
  .day-header-cell, .schedule-cell, .day-statistics-cell, .day-courses-column { min-width: 180px; }
}
</style>

<!-- Context menu styles -->
<style>
.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #ccc;
  border-radius: 6px;
  box-shadow: 0 12px 32px rgba(0,0,0,0.18);
  z-index: 2147483647;
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
.context-menu-backdrop { position: fixed; inset: 0; z-index: 2147483646; }
</style>
