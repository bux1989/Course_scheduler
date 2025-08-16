<template>
    <div v-if="visible" class="assignment-modal-backdrop" @click="$emit('close')">
        <div class="assignment-modal" @click.stop>
            <div class="modal-header">
                <h3>Assignment Details</h3>
                <button @click="$emit('close')" class="close-btn">×</button>
            </div>
            <div class="modal-body">
                <div v-if="isReadOnly" class="read-only-notice">
                    <p>📖 Read-only mode - Assignment details are shown for information only</p>
                </div>
                <div v-else>
                    <p>This is a simplified assignment modal. Assignment functionality is handled by the SchedulerGrid component.</p>
                    <p>Day: {{ dayId }}, Period: {{ periodId }}</p>
                    <p>Available courses: {{ courses.length }}</p>
                    <p>Existing assignments: {{ existingAssignments.length }}</p>
                </div>
            </div>
            <div class="modal-footer">
                <button @click="$emit('close')" class="btn btn-secondary">Close</button>
                <button v-if="!isReadOnly" @click="handleAddAssignment" class="btn btn-primary">Add Assignment</button>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'AssignmentModal',
    props: {
        visible: { type: Boolean, default: false },
        dayId: { type: [String, Number], default: null },
        periodId: { type: [String, Number], default: null },
        period: { type: Object, default: null },
        courses: { type: Array, default: () => [] },
        teachers: { type: Array, default: () => [] },
        classes: { type: Array, default: () => [] },
        rooms: { type: Array, default: () => [] },
        subjects: { type: Array, default: () => [] },
        schoolDays: { type: Array, default: () => [] },
        existingAssignments: { type: Array, default: () => [] },
        conflicts: { type: Array, default: () => [] },
        isReadOnly: { type: Boolean, default: false },
        preSelectedCourse: { type: Object, default: null },
    },
    emits: ['close', 'add-assignment', 'edit-assignment', 'remove-assignment'],
    methods: {
        handleAddAssignment() {
            // Emit a basic assignment for testing
            this.$emit('add-assignment', {
                id: `temp-${Date.now()}`,
                day_id: this.dayId,
                period_id: this.periodId,
                course_id: this.preSelectedCourse?.id || 'test-course',
                course_name: this.preSelectedCourse?.name || 'Test Course',
                class_id: 'test-class',
                teacher_ids: [],
                room_id: null,
            });
        },
    },
};
</script>

<style scoped>
.assignment-modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.assignment-modal {
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-width: 500px;
    width: 90vw;
    max-height: 80vh;
    overflow-y: auto;
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
}

.close-btn {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #666;
}

.close-btn:hover {
    color: #333;
}

.modal-body {
    padding: 20px;
}

.read-only-notice {
    background: #f0f8ff;
    border: 1px solid #b3d9ff;
    border-radius: 4px;
    padding: 12px;
    margin-bottom: 16px;
}

.modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid #e0e0e0;
}

.btn {
    padding: 8px 16px;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
}

.btn-secondary {
    background: white;
    color: #333;
}

.btn-secondary:hover {
    background: #f5f5f5;
}

.btn-primary {
    background: #007cba;
    color: white;
    border-color: #007cba;
}

.btn-primary:hover {
    background: #005a85;
}
</style>