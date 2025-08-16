<template>
    <div class="modal-overlay" @click="cancelSelection">
        <div class="modal-content" @click.stop>
            <div class="modal-header">
                <h3>Assign {{ courseName }} to Schedule</h3>
                <button @click="cancelSelection" class="close-btn">&times;</button>
            </div>

            <div class="modal-body">
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
                                selected: selectedTeachers.includes(teacher.id),
                                primary: primaryTeacherId === teacher.id,
                            }"
                            @click="toggleTeacher(teacher.id)"
                        >
                            <div class="teacher-info">
                                <span class="teacher-name">{{
                                    teacher.name || `${teacher.first_name} ${teacher.last_name}`
                                }}</span>
                                <span v-if="teacher.email" class="teacher-email">{{ teacher.email }}</span>
                            </div>
                            <div class="teacher-controls">
                                <button
                                    v-if="selectedTeachers.includes(teacher.id)"
                                    @click.stop="setPrimaryTeacher(teacher.id)"
                                    class="primary-btn"
                                    :class="{ active: primaryTeacherId === teacher.id }"
                                    title="Set as primary teacher"
                                >
                                    {{ primaryTeacherId === teacher.id ? '★' : '☆' }}
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
                            :class="{ selected: selectedRoomId === room.id }"
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
import { computed, ref, watch } from 'vue';

export default {
    name: 'TeacherRoomSelectionModal',
    props: {
        courseId: { type: String, required: true },
        courseName: { type: String, required: true },
        dayId: { type: [String, Number], required: true },
        periodId: { type: String, required: true },
        teachers: { type: Array, default: () => [] },
        rooms: { type: Array, default: () => [] },
    },
    emits: ['submit', 'cancel'],
    setup(props, { emit }) {
        // Search terms
        const teacherSearchTerm = ref('');
        const roomSearchTerm = ref('');

        // Selection state
        const selectedTeachers = ref([]);
        const primaryTeacherId = ref(null);
        const selectedRoomId = ref(null);

        // Filtered lists
        const filteredTeachers = computed(() => {
            if (!teacherSearchTerm.value) return props.teachers;

            const searchLower = teacherSearchTerm.value.toLowerCase();
            return props.teachers.filter(teacher => {
                const name = teacher.name || `${teacher.first_name} ${teacher.last_name}`;
                const email = teacher.email || '';
                return name.toLowerCase().includes(searchLower) || email.toLowerCase().includes(searchLower);
            });
        });

        const filteredRooms = computed(() => {
            if (!roomSearchTerm.value) return props.rooms;

            const searchLower = roomSearchTerm.value.toLowerCase();
            return props.rooms.filter(room => {
                const name = room.name || room.room_name || '';
                return name.toLowerCase().includes(searchLower);
            });
        });

        // Validation
        const isValid = computed(() => {
            // At least one teacher must be selected
            return selectedTeachers.value.length > 0;
        });

        // Watch for primary teacher changes
        watch(selectedTeachers, newTeachers => {
            // If primary teacher is no longer selected, clear it
            if (primaryTeacherId.value && !newTeachers.includes(primaryTeacherId.value)) {
                primaryTeacherId.value = null;
            }

            // If only one teacher selected, make them primary
            if (newTeachers.length === 1) {
                primaryTeacherId.value = newTeachers[0];
            }
        });

        function toggleTeacher(teacherId) {
            const index = selectedTeachers.value.indexOf(teacherId);
            if (index > -1) {
                selectedTeachers.value.splice(index, 1);
            } else {
                selectedTeachers.value.push(teacherId);
            }
        }

        function setPrimaryTeacher(teacherId) {
            if (selectedTeachers.value.includes(teacherId)) {
                primaryTeacherId.value = teacherId;
            }
        }

        function selectRoom(roomId) {
            selectedRoomId.value = selectedRoomId.value === roomId ? null : roomId;
        }

        function submitAssignment() {
            if (!isValid.value) return;

            const payload = {
                courseId: props.courseId,
                courseName: props.courseName,
                teacherIds: selectedTeachers.value,
                primaryTeacherId: primaryTeacherId.value,
                roomId: selectedRoomId.value,
                periodId: props.periodId,
                draftId: null, // Parent will provide draftId when processing event
                dayId: props.dayId,
                schoolId: null, // Parent will provide schoolId when processing event
                source: 'modal-assignment',
                timestamp: new Date().toISOString(),
            };

            emit('submit', payload);
        }

        function cancelSelection() {
            emit('cancel');
        }

        return {
            teacherSearchTerm,
            roomSearchTerm,
            selectedTeachers,
            primaryTeacherId,
            selectedRoomId,
            filteredTeachers,
            filteredRooms,
            isValid,
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
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.modal-content {
    background: white;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    width: 90vw;
    max-width: 600px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #e0e0e0;
}

.modal-header h3 {
    margin: 0;
    color: #333;
    font-size: 18px;
}

.close-btn {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #666;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.close-btn:hover {
    color: #333;
}

.modal-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
}

.selection-section {
    margin-bottom: 24px;
}

.section-label {
    display: block;
    font-weight: bold;
    margin-bottom: 8px;
    color: #333;
}

.search-box {
    margin-bottom: 12px;
}

.search-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
}

.search-input:focus {
    outline: none;
    border-color: #007cba;
    box-shadow: 0 0 0 2px rgba(0, 124, 186, 0.2);
}

.teacher-list,
.room-list {
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
}

.teacher-item,
.room-item {
    padding: 12px;
    border-bottom: 1px solid #f0f0f0;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: background-color 0.2s;
}

.teacher-item:last-child,
.room-item:last-child {
    border-bottom: none;
}

.teacher-item:hover,
.room-item:hover {
    background-color: #f8f9fa;
}

.teacher-item.selected,
.room-item.selected {
    background-color: #e3f2fd;
    border-left: 3px solid #007cba;
}

.teacher-item.primary {
    background-color: #fff3e0;
    border-left: 3px solid #ff9800;
}

.teacher-info {
    display: flex;
    flex-direction: column;
    flex: 1;
}

.teacher-name {
    font-weight: 500;
    color: #333;
}

.teacher-email {
    font-size: 12px;
    color: #666;
    margin-top: 2px;
}

.teacher-controls {
    display: flex;
    align-items: center;
}

.primary-btn {
    background: none;
    border: 1px solid #ddd;
    border-radius: 3px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 14px;
    color: #666;
    transition: all 0.2s;
}

.primary-btn:hover {
    background-color: #f0f0f0;
}

.primary-btn.active {
    background-color: #ff9800;
    border-color: #ff9800;
    color: white;
}

.room-name {
    font-weight: 500;
    color: #333;
}

.room-capacity {
    font-size: 12px;
    color: #666;
}

.modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid #e0e0e0;
}

.cancel-btn,
.submit-btn {
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    border: 1px solid;
    transition: all 0.2s;
}

.cancel-btn {
    background: white;
    border-color: #ddd;
    color: #666;
}

.cancel-btn:hover {
    background-color: #f8f9fa;
}

.submit-btn {
    background: #007cba;
    border-color: #007cba;
    color: white;
}

.submit-btn:hover:not(:disabled) {
    background: #005a84;
    border-color: #005a84;
}

.submit-btn:disabled {
    background: #ccc;
    border-color: #ccc;
    cursor: not-allowed;
    opacity: 0.6;
}
</style>
