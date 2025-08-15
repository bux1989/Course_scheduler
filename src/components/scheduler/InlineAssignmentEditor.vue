<template>
    <div class="inline-editor" @click.stop>
        <!-- Assignment Info (Read-only) -->
        <div class="editor-field info-field">
            <label>Course:</label>
            <span class="course-info">{{ assignment.course_name || assignment.display_cell || 'Unknown Course' }}</span>
        </div>

        <!-- Teacher Selection -->
        <div class="editor-field">
            <label>Teacher:</label>
            <select v-model="selectedTeacherId" class="editor-select">
                <option value="">Select Teacher</option>
                <option v-for="teacher in teachers" :key="teacher.id" :value="teacher.id">
                    {{ teacher.name || `${teacher.first_name} ${teacher.last_name}` }}
                </option>
            </select>
        </div>

        <!-- Room Selection -->
        <div class="editor-field">
            <label>Room:</label>
            <select v-model="editableAssignment.room_id" class="editor-select">
                <option value="">Select Room</option>
                <option v-for="room in rooms" :key="room.id" :value="room.id">
                    {{ room.name || room.room_name }}
                </option>
            </select>
        </div>

        <!-- Action Buttons -->
        <div class="editor-actions">
            <button @click="saveChanges" class="save-btn" :disabled="!isValid">✅ Save</button>
            <button @click="cancelEdit" class="cancel-btn">❌ Cancel</button>
            <button @click="deleteAssignment" class="delete-btn" title="Delete assignment">🗑️ Delete</button>
            <button @click="editCourse" class="edit-course-btn" title="Edit full course details">📝 Edit Course</button>
        </div>
    </div>
</template>

<script>
import { computed, ref, watch } from 'vue';

export default {
    name: 'InlineAssignmentEditor',
    props: {
        assignment: { type: Object, required: true },
        courses: { type: Array, default: () => [] },
        teachers: { type: Array, default: () => [] },
        classes: { type: Array, default: () => [] },
        rooms: { type: Array, default: () => [] },
        subjects: { type: Array, default: () => [] },
    },
    emits: ['save', 'cancel', 'delete', 'edit-course'],
    setup(props, { emit }) {
        // Create editable copy of assignment
        const editableAssignment = ref({ ...props.assignment });
        const selectedTeacherId = ref(
            props.assignment.teacher_ids && props.assignment.teacher_ids.length > 0
                ? props.assignment.teacher_ids[0]
                : ''
        );

        // Watch for teacher selection changes
        watch(selectedTeacherId, newTeacherId => {
            editableAssignment.value.teacher_ids = newTeacherId ? [newTeacherId] : [];
        });

        // Validation - Always valid since we're just editing teacher/room assignments
        const isValid = computed(() => {
            // Assignment is always valid since we're not changing the core course assignment
            return true;
        });

        function saveChanges() {
            if (!isValid.value) return;

            // Ensure teacher_ids is properly set
            if (selectedTeacherId.value && !editableAssignment.value.teacher_ids.includes(selectedTeacherId.value)) {
                editableAssignment.value.teacher_ids = [selectedTeacherId.value];
            }

            emit('save', editableAssignment.value);
        }

        function cancelEdit() {
            emit('cancel');
        }

        function deleteAssignment() {
            if (confirm('Are you sure you want to delete this assignment?')) {
                emit('delete', props.assignment);
            }
        }

        function editCourse() {
            // Use the assignment's existing course information
            emit('edit-course', {
                courseId: props.assignment.course_id,
                courseName: props.assignment.course_name || props.assignment.display_cell || '',
                courseCode: props.assignment.course_code || '',
                source: 'inline-editor',
            });
        }

        return {
            editableAssignment,
            selectedTeacherId,
            isValid,
            saveChanges,
            cancelEdit,
            deleteAssignment,
            editCourse,
        };
    },
};
</script>

<style scoped>
.inline-editor {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(2px);
    border: 2px solid #007cba;
    border-radius: 6px;
    padding: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25), 0 0 0 1000px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
}

.editor-field {
    display: flex;
    align-items: center;
    gap: 4px;
}

.editor-field.info-field {
    background: rgba(0, 124, 186, 0.1);
    padding: 4px;
    border-radius: 3px;
    border: 1px solid rgba(0, 124, 186, 0.2);
}

.course-info {
    font-weight: bold;
    color: #007cba;
    flex: 1;
    font-size: 11px;
}

.editor-field label {
    font-weight: bold;
    min-width: 50px;
    font-size: 11px;
}

.editor-select {
    flex: 1;
    padding: 2px 4px;
    border: 1px solid #ddd;
    border-radius: 3px;
    font-size: 11px;
    background: white;
}

.editor-actions {
    display: flex;
    gap: 4px;
    margin-top: 4px;
    justify-content: space-between;
}

.save-btn,
.cancel-btn,
.delete-btn {
    padding: 4px 8px;
    border: none;
    border-radius: 3px;
    font-size: 11px;
    cursor: pointer;
    font-weight: bold;
    transition: all 0.2s;
}

.save-btn {
    background: #4caf50;
    color: white;
}

.save-btn:hover {
    background: #45a049;
}

.save-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
}

.cancel-btn {
    background: #f44336;
    color: white;
}

.cancel-btn:hover {
    background: #da190b;
}

.delete-btn {
    background: #ff9800;
    color: white;
}

.delete-btn:hover {
    background: #f57c00;
}

.edit-course-btn {
    background: #2196f3;
    color: white;
}

.edit-course-btn:hover {
    background: #1976d2;
}
</style>
