<template>
  <div class="course-scheduler-wrapper">
    <!-- Header with Planning Mode Controls -->
    <div class="scheduler-header">
      <h2>Course Scheduler</h2>
      <div class="scheduler-controls">
        <div class="mode-indicator" :class="{ 'read-only': isReadOnly }">
          {{ isReadOnly ? 'Published Schedule (Read-Only) - Event Testing Available' : 'Planning Mode' }}
        </div>
        <div class="header-actions">
          <!-- Always show test button for WeWeb event testing -->
          <button
            @click="testEventEmission"
            class="test-btn"
            style="background: #007bff; color: white; border: none; padding: 8px 12px; border-radius: 4px; margin-right: 8px;"
            title="Test WeWeb events (always available)"
          >
            🧪 Test Event
          </button>
          <!-- Only show editing controls when not read-only -->
          <div v-if="!isReadOnly" class="editing-controls">
            <button @click="undo" :disabled="!canUndo" class="undo-btn">↶ Undo</button>
            <button
              @click="showConflicts = !showConflicts"
              class="conflicts-btn"
              :class="{ active: showConflicts }"
            >
              ⚠️ Conflicts ({{ sl(allConflicts) }})
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Scheduler Grid -->
    <div class="scheduler-content">
      <SchedulerGrid
        :periods="periods"
        :school-days="schoolDays"
        :courses="courses"
        :teachers="teachers"
        :classes="classes"
        :rooms="rooms"
        :subjects="subjects"
        :draft-schedules="draftSchedules"
        :live-schedules="liveSchedules"
        :conflicts="allConflicts"
        :can-undo="canUndo"
        :is-saving="isSaving"
        :is-read-only="isReadOnly"
        :is-live-mode="isLiveModeValue"
        :show-statistics="true"
        :school-id="schoolId"
        :draft-id="draftId"
        :parent-emit="$emit"
        :emit-drop-events="true"
        @cell-click="handleCellClick"
        @assignment-details="handleAssignmentDetails"
        @course-edit="handleCourseEdit"
        @toggle-non-instructional="handleToggleNonInstructional"
        @toggle-lesson-schedules="handleToggleLessonSchedules"
        @period-focus-changed="handlePeriodFocusChanged"
        @filter-year="handleFilterYear"
        @scheduler-drop="handleSchedulerDrop"
        @scheduler-drag-start="handleSchedulerDragStart"
        @scheduler-drag-end="handleSchedulerDragEnd"
        @undo-last="undo"
        @save-draft="saveDraft"
        @update-assignments="updateAssignments"
      />
    </div>

    <!-- Assignment Modal -->
    <AssignmentModal
      :visible="showAssignmentModal"
      :day-id="selectedCell.dayId"
      :period-id="selectedCell.periodId"
      :period="selectedCell.period"
      :courses="availableCoursesForSlot"
      :teachers="teachers"
      :classes="classes"
      :rooms="rooms"
      :subjects="subjects"
      :school-days="schoolDays"
      :existing-assignments="selectedCell.assignments"
      :conflicts="selectedCell.conflicts"
      :is-read-only="isReadOnly"
      :pre-selected-course="selectedCell.preSelectedCourse"
      @close="closeAssignmentModal"
      @add-assignment="addAssignment"
      @edit-assignment="editAssignment"
      @remove-assignment="removeAssignment"
    />

    <!-- Conflict Panel -->
    <div v-if="showConflicts && sl(allConflicts) > 0" class="conflicts-sidebar">
      <ConflictPanel
        :visible="showConflicts"
        :conflicts="allConflicts"
        :courses="courses"
        :teachers="teachers"
        :classes="classes"
        :rooms="rooms"
        :periods="periods"
        :school-days="schoolDays"
        @close="showConflicts = false"
        @navigate-to-conflict="navigateToConflict"
        @apply-suggestion="applySuggestion"
        @ignore-conflict="ignoreConflict"
        @auto-resolve-all="autoResolveConflicts"
      />
    </div>

    <!-- Hidden test section for development -->
    <div v-if="showTestData" class="test-data-section">
      <button @click="showTestData = false" class="close-test">×</button>
      <h3>Component Test Data</h3>
      <div class="test-info">
        <div><strong>School ID:</strong> {{ schoolId }}</div>
        <div><strong>Draft ID:</strong> {{ draftId }}</div>
        <div><strong>Published By:</strong> {{ publishedBy || 'Not Published' }}</div>
        <div>
          <strong>Data Counts:</strong>
          {{ sl(periods) }} periods, {{ sl(courses) }} courses, {{ sl(teachers) }} teachers
        </div>
        <button @click="emitTestEvent" class="test-button">Test Event Emission</button>
      </div>
    </div>

    <!-- Show test data toggle -->
    <button @click="showTestData = !showTestData" class="test-toggle" title="Toggle test data">🧪</button>

    <!-- Debug data button -->
    <button @click="logCurrentData" class="debug-toggle" title="Log current data to console">🐛</button>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue';
import SchedulerGrid from './components/scheduler/SchedulerGrid.vue';
import AssignmentModal from './components/scheduler/AssignmentModal.vue';
import ConflictPanel from './components/scheduler/ConflictPanel.vue';
// Keep only what’s necessary from utils to avoid collisions/cycles
import { normalizePeriods, normalizeCourse } from './utils/arrayUtils.js';

// Local, collision-proof helpers
const sl = (v) => {
  if (Array.isArray(v)) return v.length;
  if (v == null) return 0;
  const len = v.length;
  return typeof len === 'number' ? len : 0;
};
const toArray = (v) => {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  if (typeof v === 'object') {
    if (Array.isArray(v.data)) return v.data;
    if (Array.isArray(v.items)) return v.items;
    if (Array.isArray(v.value)) return v.value;
  }
  return [v].filter(Boolean);
};
const nonEmpty = (a) => Array.isArray(a) && a.length > 0;

export default {
  name: 'CourseScheduler',
  components: {
    SchedulerGrid,
    AssignmentModal,
    ConflictPanel,
  },
  props: {
    content: {
      type: Object,
      required: true,
      default: () => ({
        schoolId: null,
        draftId: null,
        publishedBy: null,
        periods: [],
        courses: [],
        teachers: [],
        classes: [],
        rooms: [],
        schoolDays: [],
        draftSchedules: [],
        liveSchedules: [],
        subjects: [],
        emitDropEvents: false,
      }),
    },
    isLiveMode: {
      type: [Boolean, String],
      required: false,
      default: false,
    },
    wwElementState: { type: Object, required: true },
    /* wwEditor:start */
    wwEditorState: { type: Object, required: true },
    /* wwEditor:end */
  },
  setup(props, { emit }) {
    // Local state
    const showAssignmentModal = ref(false);
    const showConflicts = ref(false);
    const showTestData = ref(false);
    const isSaving = ref(false);

    // Undo system
    const undoStack = ref([]);
    const maxUndoSteps = 10;

    // Selected cell for modal
    const selectedCell = ref({
      dayId: null,
      periodId: null,
      period: null,
      assignments: [],
      conflicts: [],
      preSelectedCourse: null,
    });

    // Computed properties
    const schoolId = computed(() => props.content.schoolId || 'No School ID');
    const draftId = computed(() => props.content.draftId || 'No Draft ID');
    const publishedBy = computed(() => props.content.publishedBy || null);

    const periods = computed(() => {
      const raw = props.content.periods;
      const normalized = normalizePeriods(raw);
      if (!nonEmpty(normalized)) {
        console.log('📋 [Periods] No periods data available');
        return [];
      }
      return normalized;
    });

    const courses = computed(() => {
      const raw = props.content.courses;
      const arr = toArray(raw);
      if (!nonEmpty(arr)) {
        console.log('🎯 [wwElement] Courses processing: no data available');
      }
      return arr.map((course, idx) => normalizeCourse(course, idx));
    });

    const teachers = computed(() => {
      const raw = props.content.teachers;
      const arr = toArray(raw);
      if (!nonEmpty(arr)) {
        console.log('👥 [wwElement] Teachers processing: no data available');
      }
      return arr;
    });

    const classes = computed(() => {
      const raw = props.content.classes;
      const arr = toArray(raw);
      if (!nonEmpty(arr)) {
        console.log('🏫 [wwElement] Classes processing: no data available');
      }
      return arr;
    });

    const rooms = computed(() => {
      const raw = props.content.rooms;
      const arr = toArray(raw);
      if (!nonEmpty(arr)) {
        console.log('🏠 [wwElement] Rooms processing: no data available');
      }
      return arr;
    });

    const schoolDays = computed(() => {
      const raw = props.content.schoolDays;
      const arr = toArray(raw);
      if (!nonEmpty(arr)) {
        console.log('📅 [wwElement] SchoolDays processing: no data available');
        return [];
      }

      const defaultDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return arr.map((day, index) => {
        const dayName = day.name || day.name_en || day.day_name || defaultDayNames[index] || `Day ${index + 1}`;
        return {
          ...day,
          id: day.day_id || day.id,
          name: dayName,
          date: day.date || day.day_date || null,
          is_active: day.is_active !== undefined ? day.is_active : true,
          day_number: day.day_number || index + 1,
          day_id: day.day_id || day.id,
        };
      });
    });

    const draftSchedules = computed(() => {
      const raw = props.content.draftSchedules;
      const arr = toArray(raw);
      if (!nonEmpty(arr)) {
        console.log('📝 [wwElement] Draft Schedules processing: no data available');
      }
      return arr;
    });

    const liveSchedules = computed(() => {
      const raw = props.content.liveSchedules;
      const arr = toArray(raw);
      if (!nonEmpty(arr)) {
        console.log('📺 [wwElement] Live Schedules processing: no data available');
      }
      return arr;
    });

    const subjects = computed(() => {
      const raw = props.content.subjects;
      const arr = toArray(raw);
      if (!nonEmpty(arr)) {
        console.log('📚 [wwElement] Subjects processing: no data available');
      }
      return arr;
    });

    const isLiveModeValue = computed(() => {
      const rawValue = props.isLiveMode;
      console.log('🔄 [wwElement] isLiveMode evaluation:', {
        rawValue,
        type: typeof rawValue,
        strictBoolean: rawValue === true || rawValue === 'true',
      });
      return rawValue === true || rawValue === 'true';
    });

    const isReadOnly = computed(() => !!publishedBy.value);
    const canUndo = computed(() => sl(undoStack.value) > 0);

    // Conflict detection
    const allConflicts = computed(() => detectConflicts(draftSchedules.value));

    function detectConflicts(schedules) {
      const conflicts = [];
      const conflictId = Date.now();
      const slotMap = new Map();

      schedules.forEach((assignment, index) => {
        const key = `${assignment.day_id}-${assignment.period_id}`;
        if (!slotMap.has(key)) slotMap.set(key, []);
        slotMap.get(key).push({ ...assignment, index });
      });

      slotMap.forEach((assignments, slotKey) => {
        if (sl(assignments) < 2) return;

        const [dayId, periodId] = slotKey.split('-').map(Number);

        // Teacher conflicts
        const teacherMap = new Map();
        assignments.forEach((a) => {
          a.teacher_ids?.forEach((tid) => {
            if (!teacherMap.has(tid)) teacherMap.set(tid, []);
            teacherMap.get(tid).push(a);
          });
        });
        teacherMap.forEach((list, tid) => {
          if (sl(list) > 1) {
            conflicts.push({
              id: `${conflictId}-teacher-${tid}-${slotKey}`,
              type: 'teacher',
              severity: 'high',
              day_id: dayId,
              period_id: periodId,
              affected_teachers: [tid],
              affected_courses: list.map((a) => a.course_id),
              message: `Teacher is assigned to ${sl(list)} courses at the same time`,
              auto_resolvable: false,
            });
          }
        });

        // Room conflicts
        const roomMap = new Map();
        assignments.forEach((a) => {
          if (!a.room_id) return;
          if (!roomMap.has(a.room_id)) roomMap.set(a.room_id, []);
          roomMap.get(a.room_id).push(a);
        });
        roomMap.forEach((list, rid) => {
          if (sl(list) > 1) {
            conflicts.push({
              id: `${conflictId}-room-${rid}-${slotKey}`,
              type: 'room',
              severity: 'high',
              day_id: dayId,
              period_id: periodId,
              affected_rooms: [rid],
              affected_courses: list.map((a) => a.course_id),
              message: `Room is booked for ${sl(list)} courses at the same time`,
              auto_resolvable: true,
            });
          }
        });

        // Class conflicts
        const classMap = new Map();
        assignments.forEach((a) => {
          if (!a.class_id) return;
          if (!classMap.has(a.class_id)) classMap.set(a.class_id, []);
          classMap.get(a.class_id).push(a);
        });
        classMap.forEach((list, cid) => {
          if (sl(list) > 1) {
            conflicts.push({
              id: `${conflictId}-class-${cid}-${slotKey}`,
              type: 'class',
              severity: 'medium',
              day_id: dayId,
              period_id: periodId,
              affected_classes: [cid],
              affected_courses: list.map((a) => a.course_id),
              message: `Class has ${sl(list)} overlapping assignments`,
              auto_resolvable: false,
            });
          }
        });
      });

      return conflicts;
    }

    function saveToUndoStack() {
      const currentState = JSON.stringify(draftSchedules.value);
      undoStack.value.push(currentState);
      if (sl(undoStack.value) > maxUndoSteps) undoStack.value.shift();
    }

    function handleCellClick({ dayId, periodId, period, mode, preSelectedCourse }) {
      if (isReadOnly.value) return;

      const assignments = draftSchedules.value.filter(
        (a) => a.day_id === dayId && a.period_id === periodId
      );
      const conflicts = allConflicts.value.filter(
        (c) => c.day_id === dayId && c.period_id === periodId
      );

      selectedCell.value = {
        dayId,
        periodId,
        period,
        assignments,
        conflicts,
        preSelectedCourse,
      };
      showAssignmentModal.value = true;
    }

    function closeAssignmentModal() {
      showAssignmentModal.value = false;
      selectedCell.value = {
        dayId: null,
        periodId: null,
        period: null,
        assignments: [],
        conflicts: [],
        preSelectedCourse: null,
      };
    }

    function addAssignment(newAssignment) {
      saveToUndoStack();
      const updatedSchedules = [...draftSchedules.value, newAssignment];
      updateDraftSchedules(updatedSchedules);
      closeAssignmentModal();
    }

    function editAssignment(assignment) {
      closeAssignmentModal();
      emit('edit-assignment-requested', assignment);
    }

    function removeAssignment(assignmentToRemove) {
      saveToUndoStack();

      if (props.content.emitDropEvents) {
        emit('trigger-event', {
          name: 'scheduler:remove',
          event: {
            schoolId: props.content.schoolId,
            draftId: props.content.draftId,
            dayId: assignmentToRemove.day_id,
            periodId: assignmentToRemove.period_id,
            assignmentId: assignmentToRemove.id,
            courseId: assignmentToRemove.course_id,
            courseName: assignmentToRemove.course_name || assignmentToRemove.display_cell || '',
          },
        });
      }

      const updated = draftSchedules.value.filter(
        (a) =>
          !(
            a.day_id === assignmentToRemove.day_id &&
            a.period_id === assignmentToRemove.period_id &&
            a.course_id === assignmentToRemove.course_id &&
            a.class_id === assignmentToRemove.class_id
          )
      );
      updateDraftSchedules(updated);
    }

    function updateDraftSchedules(newSchedules) {
      emit('trigger-event', {
        name: 'updateDraftSchedules',
        event: { draftSchedules: newSchedules },
      });
    }

    function undo() {
      if (sl(undoStack.value) === 0) return;
      const previous = undoStack.value.pop();
      updateDraftSchedules(JSON.parse(previous));
    }

    async function saveDraft() {
      isSaving.value = true;
      try {
        emit('trigger-event', {
          name: 'saveDraft',
          event: {
            draftId: draftId.value,
            schedules: draftSchedules.value,
            timestamp: new Date().toISOString(),
            action: 'save_draft',
          },
        });
        emit('save-draft-external', {
          draftId: draftId.value,
          schedules: draftSchedules.value,
          timestamp: new Date().toISOString(),
        });
        await new Promise((r) => setTimeout(r, 1000));
        console.log('💾 [wwElement] Draft saved successfully');
      } catch (e) {
        console.error('❌ [wwElement] Error saving draft:', e);
      } finally {
        isSaving.value = false;
      }
    }

    function handleAssignmentDetails(assignment) {
      emit('trigger-event', {
        name: 'scheduler:assignment-details',
        event: {
          assignment,
          courseId: assignment.course_id || '',
          courseName: assignment.course_name || assignment.display_cell || '',
          courseCode: assignment.course_code || '',
          teacherIds: assignment.teacher_ids || [],
          roomId: assignment.room_id || null,
          dayId: assignment.day_id || 0,
          periodId: assignment.period_id || '',
          timestamp: new Date().toISOString(),
        },
      });
    }

    function handleCourseEdit(courseData) {
      emit('trigger-event', {
        name: 'scheduler:course-edit',
        event: {
          courseId: courseData.courseId || '',
          courseName: courseData.courseName || '',
          courseCode: courseData.courseCode || '',
          source: courseData.source || 'inline-editor',
          timestamp: new Date().toISOString(),
        },
      });
    }

    function handleToggleNonInstructional(show) {
      emit('trigger-event', { name: 'toggleNonInstructional', event: { showNonInstructional: show } });
    }
    function handleToggleLessonSchedules(show) {
      emit('trigger-event', { name: 'toggleLessonSchedules', event: { showLessonSchedules: show } });
    }
    function handlePeriodFocusChanged(periodId) {
      emit('trigger-event', { name: 'periodFocusChanged', event: { focusedPeriodId: periodId } });
    }
    function handleFilterYear(year) {
      emit('trigger-event', { name: 'filterYear', event: { selectedYear: year } });
    }

    function handleSchedulerDrop(eventData) {
      const safeEventData = {
        schoolId: eventData?.schoolId || null,
        draftId: eventData?.draftId || null,
        dayId: eventData?.dayId || 0,
        periodId: eventData?.periodId || '',
        courseId: eventData?.courseId || '',
        courseName: eventData?.courseName || '',
        courseCode: eventData?.courseCode || '',
        teacherIds: Array.isArray(eventData?.teacherIds) ? eventData.teacherIds : [],
        primaryTeacherId: eventData?.primaryTeacherId || null,
        roomId: eventData?.roomId || null,
        source: eventData?.source || 'drag-drop',
        timestamp: eventData?.timestamp || new Date().toISOString(),
        ...(eventData?.fromDayId !== undefined && { fromDayId: eventData.fromDayId }),
        ...(eventData?.fromPeriodId !== undefined && { fromPeriodId: eventData.fromPeriodId }),
        ...(eventData?.action !== undefined && { action: eventData.action }),
      };

      console.log('🚀 [WeWeb Event] scheduler:drop - Emitting trigger-event with data:', safeEventData);
      try {
        emit('trigger-event', { name: 'scheduler:drop', event: safeEventData });
        console.log('✅ [WeWeb Event] scheduler:drop emitted successfully');
      } catch (error) {
        console.error('❌ [WeWeb Event] scheduler:drop emission failed:', error);
      }
    }

    function handleSchedulerDragStart(eventData) {
      const safeEventData = {
        courseId: eventData?.courseId || '',
        courseName: eventData?.courseName || '',
        courseCode: eventData?.courseCode || '',
        source: eventData?.source || 'drag-start',
        timestamp: eventData?.timestamp || new Date().toISOString(),
      };

      console.log('🚀 [WeWeb Event] scheduler:drag-start - Emitting trigger-event with data:', safeEventData);
      try {
        emit('trigger-event', { name: 'scheduler:drag-start', event: safeEventData });
        console.log('✅ [WeWeb Event] scheduler:drag-start emitted successfully');
      } catch (error) {
        console.error('❌ [WeWeb Event] scheduler:drag-start emission failed:', error);
      }
    }

    function handleSchedulerDragEnd(eventData) {
      const safeEventData = {
        courseId: eventData?.courseId || '',
        courseName: eventData?.courseName || '',
        courseCode: eventData?.courseCode || '',
        success: eventData?.success !== undefined ? eventData.success : false,
        source: eventData?.source || 'drag-end',
        timestamp: eventData?.timestamp || new Date().toISOString(),
      };

      console.log('🚀 [WeWeb Event] scheduler:drag-end - Emitting trigger-event with data:', safeEventData);
      try {
        emit('trigger-event', { name: 'scheduler:drag-end', event: safeEventData });
        console.log('✅ [WeWeb Event] scheduler:drag-end emitted successfully');
      } catch (error) {
        console.error('❌ [WeWeb Event] scheduler:drag-end emission failed:', error);
      }
    }

    function testEventEmission() {
      console.log('🧪 [WeWeb Event Test] =================================');
      console.log('🧪 [WeWeb Event Test] Manual scheduler:drop event test');
      console.log('🧪 [WeWeb Event Test] =================================');

      const testData = {
        schoolId: props.content?.schoolId || null,
        draftId: props.content?.draftId || null,
        dayId: 1,
        periodId: 'test-period-id',
        courseId: 'test-course-id',
        courseName: 'Test Course',
        courseCode: 'TEST101',
        source: 'manual-test',
        timestamp: new Date().toISOString(),
      };

      console.log('📋 [WeWeb Event Test] Test event data:', testData);

      try {
        console.log('🚀 [WeWeb Event Test] Attempting to emit scheduler:drop...');
        emit('trigger-event', { name: 'scheduler:drop', event: testData });
        console.log('✅ [WeWeb Event Test] ✅ SUCCESS: scheduler:drop trigger-event emitted!');
        console.log('📌 [WeWeb Event Test] Event data should be accessible directly in workflows');
      } catch (error) {
        console.error('❌ [WeWeb Event Test] scheduler:drop test failed:', error);
      }
    }

    function updateAssignments(payload) {
      if (payload.action === 'move' && payload.assignment) {
        const updatedSchedules = [...draftSchedules.value];
        const idx = updatedSchedules.findIndex((a) => a.id === payload.assignment.id);
        if (idx !== -1) {
          const updatedAssignment = {
            ...updatedSchedules[idx],
            day_id: payload.toDayId,
            period_id: payload.toPeriodId,
            day_name_de: schoolDays.value.find((d) => d.id === payload.toDayId)?.name_de,
            day_name_en: schoolDays.value.find((d) => d.id === payload.toDayId)?.name_en,
          };
          updatedSchedules[idx] = updatedAssignment;
          undoStack.value.push(JSON.stringify(draftSchedules.value));
          updateDraftSchedules(updatedSchedules);
          console.log('✅ [DragDrop] Assignment moved successfully:', {
            assignmentId: payload.assignment.id,
            from: `${payload.fromDayId}-${payload.fromPeriodId}`,
            to: `${payload.toDayId}-${payload.toPeriodId}`,
          });
        } else {
          console.warn('⚠️ [DragDrop] Could not find assignment to move:', payload.assignment.id);
        }
      } else {
        updateDraftSchedules(payload);
      }
    }

    function navigateToConflict(conflict) {
      selectedCell.value = {
        dayId: conflict.day_id,
        periodId: conflict.period_id,
        period: periods.value.find((p) => p.id === conflict.period_id),
        assignments: draftSchedules.value.filter(
          (a) => a.day_id === conflict.day_id && a.period_id === conflict.period_id
        ),
        conflicts: [conflict],
      };
      showAssignmentModal.value = true;
      showConflicts.value = false;
    }

    function applySuggestion(suggestion) {
      emit('trigger-event', { name: 'applySuggestion', event: { suggestion } });
    }

    function ignoreConflict(conflict) {
      emit('trigger-event', { name: 'ignoreConflict', event: { conflictId: conflict.id } });
    }

    function autoResolveConflicts() {
      emit('trigger-event', {
        name: 'autoResolveConflicts',
        event: { conflicts: allConflicts.value.filter((c) => c.auto_resolvable) },
      });
    }

    function emitTestEvent() {
      try {
        emit('element-event', {
          name: 'scheduler:drop',
          event: 'scheduler:drop',
          data: {
            message: 'Test WeWeb element event from Course Scheduler!',
            timestamp: new Date().toISOString(),
            testData: {
              periods: sl(periods.value),
              courses: sl(courses.value),
              teachers: sl(teachers.value),
              classes: sl(classes.value),
              rooms: sl(rooms.value),
              draftSchedules: sl(draftSchedules.value),
              conflicts: sl(allConflicts.value),
              isReadOnly: isReadOnly.value,
            },
          },
        });
        console.log('✅ Test WeWeb element event emitted successfully!');
        alert('Test WeWeb element event emitted successfully!');
      } catch (error) {
        console.error('❌ Failed to emit test WeWeb element event:', error);
        alert('Error emitting WeWeb element event: ' + error.message);
      }
    }

    function logCurrentData() {
      console.log('🐛 [wwElement] === COMPLETE DATA DUMP ===');
      console.log('Raw content object:', props.content);
      console.log('School ID:', schoolId.value);
      console.log('Draft ID:', draftId.value);
      console.log('Published By:', publishedBy.value);

      console.log('📅 PERIODS ANALYSIS:');
      console.log('  Raw periods:', props.content.periods);
      console.log('  Processed periods:', periods.value);
      if (sl(periods.value) > 0) {
        const samplePeriod = periods.value[0];
        console.log('  Sample period object keys:', Object.keys(samplePeriod));
        console.log('  Sample period values:', samplePeriod);
      }

      console.log('🗓️ SCHOOL DAYS ANALYSIS:');
      console.log('  Raw schoolDays:', props.content.schoolDays);
      console.log('  Processed schoolDays:', schoolDays.value);
      if (sl(schoolDays.value) > 0) {
        const sampleDay = schoolDays.value[0];
        console.log('  Sample day object keys:', Object.keys(sampleDay));
        console.log('  Sample day values:', sampleDay);
      }

      console.log('Courses:', sl(courses.value), courses.value.slice(0, 2));
      console.log('Teachers:', sl(teachers.value), teachers.value.slice(0, 2));
      console.log('Classes:', sl(classes.value), classes.value.slice(0, 2));
      console.log('Rooms:', sl(rooms.value), rooms.value.slice(0, 2));
      console.log('Draft Schedules:', sl(draftSchedules.value), draftSchedules.value.slice(0, 2));
      console.log('Live Schedules:', sl(liveSchedules.value), liveSchedules.value.slice(0, 2));
      console.log('Is Read Only:', isReadOnly.value);
      console.log('Can Undo:', canUndo.value);
      console.log('All Conflicts:', sl(allConflicts.value), allConflicts.value);
      console.log('🐛 [wwElement] === END COMPLETE DATA DUMP ===');
    }

    // Auto-save
    let saveTimeout;
    watch(
      draftSchedules,
      () => {
        if (isReadOnly.value) return;
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          saveDraft();
        }, 2000);
      },
      { deep: true }
    );

    onMounted(() => {
      console.log('🚀 [wwElement] Component mounted - Course Scheduler loaded successfully');
    });

    watch(
      () => props.content,
      (next, prev) => {
        if (
          next &&
          prev &&
          ((next?.periods?.length ?? 0) !== (prev?.periods?.length ?? 0) ||
            (next?.schoolDays?.length ?? 0) !== (prev?.schoolDays?.length ?? 0) ||
            (next?.courses?.length ?? 0) !== (prev?.courses?.length ?? 0))
        ) {
          console.log('🔄 [wwElement] Content structure changed:', {
            periods: next?.periods?.length || 0,
            schoolDays: next?.schoolDays?.length || 0,
            courses: next?.courses?.length || 0,
          });
        }
      },
      { deep: true }
    );

    return {
      // Data
      schoolId,
      draftId,
      publishedBy,
      periods,
      courses,
      teachers,
      classes,
      rooms,
      schoolDays,
      draftSchedules,
      liveSchedules,
      subjects,
      isLiveModeValue,

      // State
      showAssignmentModal,
      showConflicts,
      showTestData,
      selectedCell,
      isSaving,

      // Computed
      isReadOnly,
      canUndo,
      allConflicts,
      availableCoursesForSlot: computed(() => {
        if (!selectedCell.value.dayId || !selectedCell.value.periodId) return courses.value;

        const currentDayId = selectedCell.value.dayId;
        const currentPeriodId = selectedCell.value.periodId;

        if (currentDayId && currentPeriodId) {
          console.log('🎯 [wwElement] availableCoursesForSlot filtering:', {
            currentDayId,
            currentPeriodId,
            totalCourses: sl(courses.value),
          });
        }

        return courses.value.filter((course) => {
          if (!Array.isArray(course.possibleSlots) || course.possibleSlots.length === 0) return true;
          return course.possibleSlots.some((slot) => slot.dayId === currentDayId && slot.periodId === currentPeriodId);
        });
      }),

      // Methods
      handleCellClick,
      closeAssignmentModal,
      addAssignment,
      editAssignment,
      removeAssignment,
      updateAssignments,
      undo,
      saveDraft,
      handleAssignmentDetails,
      handleCourseEdit,
      handleToggleNonInstructional,
      handleToggleLessonSchedules,
      handlePeriodFocusChanged,
      handleFilterYear,
      handleSchedulerDrop,
      handleSchedulerDragStart,
      handleSchedulerDragEnd,
      testEventEmission,
      navigateToConflict,
      applySuggestion,
      ignoreConflict,
      autoResolveConflicts,
      emitTestEvent,
      logCurrentData,

      // Expose local helpers for templates
      sl,
    };
  },
};
</script>

<style lang="scss" scoped>
.course-scheduler-wrapper {
  width: 100%;
  min-height: 500px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  position: relative;
}

.scheduler-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
  border-radius: 6px 6px 0 0;

  h2 {
    margin: 0;
    color: #333;
    font-size: 1.3em;
  }

  .scheduler-controls {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .mode-indicator {
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 0.9em;
    font-weight: 500;
    background: #e6f7ff;
    color: #1890ff;

    &.read-only {
      background: #fff2f0;
      color: #ff4d4f;
    }
  }

  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .editing-controls {
    display: flex;
    gap: 8px;
  }

  .undo-btn,
  .conflicts-btn {
    padding: 6px 12px;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 0.9em;
    transition: all 0.2s;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &:hover:not(:disabled) {
      background: #f0f0f0;
      transform: translateY(-1px);
    }
  }

  .conflicts-btn {
    &.active {
      background: #ff4d4f;
      color: white;
      border-color: #ff4d4f;
    }
  }
}

.scheduler-content {
  display: flex;
  gap: 16px;
  position: relative;
}

.conflicts-sidebar {
  width: 400px;
  position: sticky;
  top: 20px;
  height: fit-content;
}

.test-data-section {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 2000;
  min-width: 400px;
}

.close-test {
  position: absolute;
  top: 8px;
  right: 12px;
  background: none;
  border: none;
  font-size: 1.2em;
  cursor: pointer;
  color: #999;
}

.test-info {
  margin-top: 16px;
}

.test-info > div {
  margin-bottom: 8px;
  font-size: 0.9em;
}

.test-button {
  margin-top: 12px;
  padding: 8px 16px;
  background: #007cba;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.test-toggle {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: #007cba;
  color: white;
  font-size: 1.2em;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  transition: all 0.2s;

  &:hover {
    transform: scale(1.1);
  }
}

.debug-toggle {
  position: fixed;
  bottom: 70px;
  right: 20px;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: #ff6b6b;
  color: white;
  font-size: 1.2em;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  transition: all 0.2s;

  &:hover {
    transform: scale(1.1);
  }
}

/* Responsive and accessibility styles omitted for brevity; keep your existing ones */
</style>
