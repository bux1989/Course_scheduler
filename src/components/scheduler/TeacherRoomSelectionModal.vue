<template>
  <div class="modal-overlay" @click="cancelSelection">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Assign {{ courseName }} to Schedule</h3>
        <button @click="cancelSelection" class="close-btn" aria-label="Close">&times;</button>
      </div>

      <div class="modal-body">
        <!-- Scheduling options -->
        <div class="selection-section scheduling-options">
          <label class="section-label">Scheduling options:</label>
          <label class="checkbox-row">
            <input
              type="checkbox"
              v-model="isRecurring"
              class="checkbox-input"
              aria-describedby="recurring-help"
            />
            <span>Schedule multiple times this week</span>
          </label>
          <p id="recurring-help" class="help-text">
            If checked, you can add this course to multiple day/period slots without it being hidden from the Available list.
          </p>
        </div>

        <!-- Teacher Selection -->
        <div class="selection-section">
          <label class="section-label">Teachers:</label>
          <div class="search-box">
            <input
              v-model="teacherSearchTerm"
              type="text"
              placeholder="Search teachers..."
              class="search-input"
            />
          </div>
          <div class="teacher-list">
            <div
              v-for="teacher in filteredTeachers"
              :key="teacher.id"
              class="teacher-item"
              :class="{
                selected: isTeacherSelected(teacher.id),
                primary: isPrimary(teacher.id),
              }"
              @click="toggleTeacher(teacher.id)"
            >
              <div class="teacher-info">
                <span class="teacher-name">{{ teacher.name || `${teacher.first_name ?? ''} ${teacher.last_name ?? ''}` }}</span>
                <span v-if="teacher.email" class="teacher-email">{{ teacher.email }}</span>
              </div>
              <div class="teacher-controls">
                <button
                  v-if="isTeacherSelected(teacher.id)"
                  @click.stop="setPrimaryTeacher(teacher.id)"
                  class="primary-btn"
                  :class="{ active: isPrimary(teacher.id) }"
                  title="Set as primary teacher"
                >
                  {{ isPrimary(teacher.id) ? '★' : '☆' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Room Selection -->
        <div class="selection-section">
          <label class="section-label">Room:</label>
          <div class="search-box">
            <input
              v-model="roomSearchTerm"
              type="text"
              placeholder="Search rooms..."
              class="search-input"
            />
          </div>
          <div class="room-list">
            <div
              v-for="room in filteredRooms"
              :key="room.id"
              class="room-item"
              :class="{ selected: selectedRoomId === asId(room.id) }"
              @click="selectRoom(room.id)"
            >
              <span class="room-name">{{ room.name || room.room_name }}</span>
              <span v-if="room.capacity" class="room-capacity">Capacity: {{ room.capacity }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button @click="cancelSelection" class="cancel-btn">Cancel</button>
        <button @click="submitAssignment" class="submit-btn" :disabled="!isValid">Assign Course</button>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, ref, watch, onMounted } from 'vue';

export default {
  name: 'TeacherRoomSelectionModal',
  props: {
    courseId: { type: [String, Number], required: true },
    courseName: { type: String, required: true },
    dayId: { type: [String, Number], required: true },
    periodId: { type: [String, Number], required: true },
    teachers: { type: Array, default: () => [] },
    rooms: { type: Array, default: () => [] },
    // NEW: proposed teachers to preselect (possible_staff_ids from the course)
    preselectedTeacherIds: { type: Array, default: () => [] },
  },
  emits: ['submit', 'cancel'],
  setup(props, { emit }) {
    // Helpers
    const asId = (v) => (v == null ? null : String(v));
    const uniq = (arr) => Array.from(new Set(arr));

    // Scheduling option
    const isRecurring = ref(false); // unchecked by default → one-off

    // Search terms
    const teacherSearchTerm = ref('');
    const roomSearchTerm = ref('');

    // Selection state
    const selectedTeachers = ref([]); // array of string ids
    const primaryTeacherId = ref(null); // string id
    const selectedRoomId = ref(null); // string id

    // Track if user changed selection to avoid overriding with new preselect data
    const userEdited = ref(false);

    // Filtered lists
    const filteredTeachers = computed(() => {
      if (!teacherSearchTerm.value) return props.teachers;
      const q = teacherSearchTerm.value.toLowerCase();
      return props.teachers.filter((t) => {
        const name = (t.name || `${t.first_name ?? ''} ${t.last_name ?? ''}`).trim();
        const email = t.email || '';
        return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
      });
    });

    const filteredRooms = computed(() => {
      if (!roomSearchTerm.value) return props.rooms;
      const q = roomSearchTerm.value.toLowerCase();
      return props.rooms.filter((r) => (r.name || r.room_name || '').toLowerCase().includes(q));
    });

    // Validation: at least one teacher required
    const isValid = computed(() => selectedTeachers.value.length > 0);

    // Keep primary in sync
    watch(selectedTeachers, (newList) => {
      if (primaryTeacherId.value && !newList.includes(primaryTeacherId.value)) {
        primaryTeacherId.value = null;
      }
      if (!primaryTeacherId.value && newList.length === 1) {
        primaryTeacherId.value = newList[0];
      }
    });

    function isTeacherSelected(id) {
      const sid = asId(id);
      return selectedTeachers.value.includes(sid);
    }
    function isPrimary(id) {
      return primaryTeacherId.value === asId(id);
    }

    function toggleTeacher(id) {
      userEdited.value = true;
      const sid = asId(id);
      const idx = selectedTeachers.value.indexOf(sid);
      if (idx > -1) selectedTeachers.value.splice(idx, 1);
      else selectedTeachers.value.push(sid);
    }

    function setPrimaryTeacher(id) {
      userEdited.value = true;
      const sid = asId(id);
      if (selectedTeachers.value.includes(sid)) {
        primaryTeacherId.value = sid;
      }
    }

    function selectRoom(id) {
      const sid = asId(id);
      selectedRoomId.value = selectedRoomId.value === sid ? null : sid;
    }

    function submitAssignment() {
      if (!isValid.value) return;
      const payload = {
        courseId: asId(props.courseId),
        courseName: props.courseName,
        teacherIds: selectedTeachers.value.slice(), // strings
        primaryTeacherId: primaryTeacherId.value,
        roomId: selectedRoomId.value,
        periodId: asId(props.periodId),
        dayId: asId(props.dayId),
        frequency: isRecurring.value ? 'recurring' : 'one-off',
        source: 'modal-assignment',
        timestamp: new Date().toISOString(),
      };
      emit('submit', payload);
    }

    function cancelSelection() {
      emit('cancel');
    }

    // Initialize selection from preselectedTeacherIds (possible_staff_ids)
    function initPreselection() {
      // Only run if we haven't let user edit yet (fresh open)
      if (userEdited.value) return;

      // intersect preselected with the teachers actually available in this modal
      const teacherIdSet = new Set(props.teachers.map((t) => asId(t.id)));
      const pre = uniq((props.preselectedTeacherIds || []).map(asId)).filter((id) => id && teacherIdSet.has(id));

      selectedTeachers.value = pre;
      primaryTeacherId.value = pre.length ? pre[0] : null;
    }

    onMounted(() => {
      initPreselection();
    });

    // If the course changes while the modal remains mounted, re-init
    watch(
      () => [props.courseId, props.preselectedTeacherIds, props.teachers],
      () => {
        userEdited.value = false; // treat as fresh open for a different course
        initPreselection();
      },
      { deep: true }
    );

    return {
      // helpers
      asId,

      // scheduling
      isRecurring,

      // search and state
      teacherSearchTerm,
      roomSearchTerm,
      selectedTeachers,
      primaryTeacherId,
      selectedRoomId,

      // computed
      filteredTeachers,
      filteredRooms,
      isValid,

      // class helpers
      isTeacherSelected,
      isPrimary,

      // actions
      toggleTeacher,
      setPrimaryTeacher,
      selectRoom,
      submitAssignment,
      cancelSelection,
    };
  },
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex; justify-content: center; align-items: center;
  z-index: 1000;
}
.modal-content {
  background: white; border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  width: 90vw; max-width: 600px; max-height: 80vh;
  display: flex; flex-direction: column;
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid #e0e0e0;
}
.modal-header h3 { margin: 0; color: #333; font-size: 18px; }
.close-btn {
  background: none; border: none; font-size: 24px; cursor: pointer; color: #666;
  padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
}
.close-btn:hover { color: #333; }
.modal-body { padding: 20px; overflow-y: auto; flex: 1; }
.selection-section { margin-bottom: 24px; }
.scheduling-options { margin-top: -8px; }
.section-label { display: block; font-weight: bold; margin-bottom: 8px; color: #333; }
.checkbox-row { display: inline-flex; align-items: center; gap: 8px; user-select: none; }
.checkbox-input { width: 16px; height: 16px; }
.help-text { margin: 6px 0 0; font-size: 12px; color: #666; }

.search-box { margin-bottom: 12px; }
.search-input {
  width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;
}
.search-input:focus { outline: none; border-color: #007cba; box-shadow: 0 0 0 2px rgba(0, 124, 186, 0.2); }

.teacher-list, .room-list {
  max-height: 200px; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 4px;
}
.teacher-item, .room-item {
  padding: 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer;
  display: flex; justify-content: space-between; align-items: center; transition: background-color 0.2s;
}
.teacher-item:last-child, .room-item:last-child { border-bottom: none; }
.teacher-item:hover, .room-item:hover { background-color: #f8f9fa; }
.teacher-item.selected, .room-item.selected { background-color: #e3f2fd; border-left: 3px solid #007cba; }
.teacher-item.primary { background-color: #fff3e0; border-left: 3px solid #ff9800; }

.teacher-info { display: flex; flex-direction: column; flex: 1; }
.teacher-name { font-weight: 500; color: #333; }
.teacher-email { font-size: 12px; color: #666; margin-top: 2px; }
.teacher-controls { display: flex; align-items: center; }

.primary-btn {
  background: none; border: 1px solid #ddd; border-radius: 3px; padding: 4px 8px; cursor: pointer;
  font-size: 14px; color: #666; transition: all 0.2s;
}
.primary-btn:hover { background-color: #f0f0f0; }
.primary-btn.active { background-color: #ff9800; border-color: #ff9800; color: white; }

.room-name { font-weight: 500; color: #333; }
.room-capacity { font-size: 12px; color: #666; }

.modal-footer {
  display: flex; justify-content: flex-end; gap: 12px;
  padding: 16px 20px; border-top: 1px solid #e0e0e0;
}
.cancel-btn, .submit-btn {
  padding: 8px 16px; border-radius: 4px; font-size: 14px; cursor: pointer; border: 1px solid; transition: all 0.2s;
}
.cancel-btn { background: white; border-color: #ddd; color: #666; }
.cancel-btn:hover { background-color: #f8f9fa; }
.submit-btn { background: #007cba; border-color: #007cba; color: white; }
.submit-btn:hover:not(:disabled) { background: #005a84; border-color: #005a84; }
.submit-btn:disabled { background: #ccc; border-color: #ccc; cursor: not-allowed; opacity: 0.6; }
</style>
