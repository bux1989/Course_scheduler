<template>
    <div class="inline-editor" @click.stop>
        <!-- Course Selection -->
        <div class="editor-field">
            <label>Course:</label>
            <select v-model="editableAssignment.course_id" class="editor-select">
                <option value="">Select Course</option>
                <option v-for="course in availableCourses" :key="course.id" :value="course.id">
                    {{ course.name || course.course_name || course.title }}
                </option>
            </select>
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

        <!-- Class Selection -->
        <div class="editor-field">
            <label>Class:</label>
            <select v-model="editableAssignment.class_id" class="editor-select">
                <option value="">Select Class</option>
                <option v-for="cls in classes" :key="cls.id" :value="cls.id">
                    {{ cls.name || cls.class_name }}
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

        // Available courses (could be filtered based on context)
        const availableCourses = computed(() => {
            return props.courses.filter(course => {
                // Filter courses based on current context if needed
                return true;
            });
        });

        // Validation
        const isValid = computed(() => {
            // At minimum, we need either a course_id or subject_id
            return editableAssignment.value.course_id || editableAssignment.value.subject_id;
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
            // Find the course details for the current assignment
            const course = props.courses.find(c => c.id === editableAssignment.value.course_id);

            emit('edit-course', {
                courseId: editableAssignment.value.course_id,
                courseName: course?.name || course?.course_name || '',
                courseCode: course?.course_code || course?.code || '',
                source: 'inline-editor',
            });
        }

        return {
            editableAssignment,
            selectedTeacherId,
            availableCourses,
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
    background: white;
    border: 2px solid #007cba;
    border-radius: 6px;
    padding: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 100;
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
