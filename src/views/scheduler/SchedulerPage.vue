<template>
    <div class="scheduler-page">
        <h1 class="scheduler-title">Course Scheduler</h1>

        <SchedulerToolbar
            :teachers="teachers"
            :classes="classes"
            :rooms="rooms"
            @open-publish-dialog="showPublishDialog = true"
        />

        <div class="scheduler-content">
            <div class="scheduler-grid">
                <!-- Period Grid View -->
                <PeriodGrid
                    v-if="viewMode === 'period'"
                    :days="days"
                    :courses="courses"
                    :rooms="rooms"
                    :teachers="teachers"
                    :classes="classes"
                    @add-entry="openEntryForm"
                />

                <!-- Time Grid View -->
                <TimeGrid
                    v-else
                    :days="days"
                    :courses="courses"
                    :rooms="rooms"
                    :teachers="teachers"
                    @add-entry="openEntryForm"
                />
            </div>

            <div class="draft-panel">
                <div class="draft-panel-header">
                    <h2>Draft Entries</h2>
                    <span class="entry-count">{{ entries.length }} entries</span>
                </div>

                <div class="draft-entries">
                    <div v-for="(entry, index) in entries" :key="index" class="draft-entry">
                        <div class="entry-day">{{ getDayName(entry.day_id) }}</div>
                        <div class="entry-time">
                            <template v-if="entry.schedule_type === 'period'">
                                {{ getPeriodName(entry.period_id) }}
                            </template>
                            <template v-else>
                                {{ formatTime(entry.start_time) }} - {{ formatTime(entry.end_time) }}
                            </template>
                        </div>
                        <div class="entry-title">
                            {{ getEntryTitle(entry) }}
                        </div>
                        <div class="entry-actions">
                            <button
                                class="edit-entry"
                                @click="openEntryForm({ isEdit: true, entry })"
                                aria-label="Edit entry"
                            >
                                Edit
                            </button>
                            <button class="remove-entry" @click="removeEntry(index)" aria-label="Remove entry">
                                ×
                            </button>
                        </div>
                    </div>

                    <div v-if="entries.length === 0" class="no-entries">
                        No entries in this draft yet. Click on the grid to add entries.
                    </div>
                </div>
            </div>
        </div>

        <!-- Entry Form Dialog -->
        <div v-if="showEntryForm" class="entry-form-overlay" @click="closeEntryForm">
            <div class="entry-form" @click.stop>
                <div class="entry-form-header">
                    <h2>{{ isEditingEntry ? 'Edit Entry' : 'Add Entry' }}</h2>
                    <button class="close-button" @click="closeEntryForm">×</button>
                </div>

                <div class="entry-form-content">
                    <div v-if="conflicts.length > 0" class="conflicts-warning">
                        <h3>Conflicts Detected</h3>
                        <ul>
                            <li v-for="(conflict, index) in conflicts" :key="index">
                                {{ conflict.message || 'Scheduling conflict' }}
                            </li>
                        </ul>
                    </div>

                    <div class="form-group">
                        <label for="entry-type">Schedule Type</label>
                        <select id="entry-type" v-model="entryForm.schedule_type" disabled>
                            <option value="period">Period</option>
                            <option value="adhoc">Time</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="entry-day">Day</label>
                        <select id="entry-day" v-model="entryForm.day_id">
                            <option v-for="day in days" :key="day.id" :value="day.id">
                                {{ day.name }}
                            </option>
                        </select>
                    </div>

                    <template v-if="entryForm.schedule_type === 'period'">
                        <div class="form-group">
                            <label for="entry-period">Period</label>
                            <select id="entry-period" v-model="entryForm.period_id">
                                <option v-for="period in periods" :key="period.id" :value="period.id">
                                    {{ period.name }} ({{ formatTime(period.start_time) }} -
                                    {{ formatTime(period.end_time) }})
                                </option>
                            </select>
                        </div>
                    </template>

                    <template v-else>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="entry-start-time">Start Time</label>
                                <input type="time" id="entry-start-time" v-model="entryForm.start_time" step="900" />
                            </div>

                            <div class="form-group">
                                <label for="entry-end-time">End Time</label>
                                <input type="time" id="entry-end-time" v-model="entryForm.end_time" step="900" />
                            </div>
                        </div>
                    </template>

                    <div class="form-group">
                        <label for="entry-course">Course</label>
                        <select id="entry-course" v-model="entryForm.course_id">
                            <option value="">Select Course</option>
                            <option v-for="course in courses" :key="course.id" :value="course.id">
                                {{ course.name }}
                            </option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="entry-class">Class</label>
                        <select id="entry-class" v-model="entryForm.class_id">
                            <option value="">Select Class</option>
                            <option v-for="cls in classes" :key="cls.id" :value="cls.id">
                                {{ cls.name }}
                            </option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Teachers</label>
                        <div class="teacher-checkboxes">
                            <div v-for="teacher in teachers" :key="teacher.id" class="teacher-checkbox">
                                <input
                                    type="checkbox"
                                    :id="`teacher-${teacher.id}`"
                                    :value="teacher.id"
                                    v-model="entryForm.teacher_ids"
                                />
                                <label :for="`teacher-${teacher.id}`">{{ teacher.name }}</label>
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="entry-room">Room</label>
                        <select id="entry-room" v-model="entryForm.room_id">
                            <option value="">Select Room</option>
                            <option v-for="room in rooms" :key="room.id" :value="room.id">
                                {{ room.name }}
                            </option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="entry-meeting-name">Meeting Name (optional)</label>
                        <input
                            type="text"
                            id="entry-meeting-name"
                            v-model="entryForm.meeting_name"
                            placeholder="Enter meeting name"
                        />
                    </div>

                    <div class="form-group">
                        <label for="entry-notes">Notes (optional)</label>
                        <textarea
                            id="entry-notes"
                            v-model="entryForm.notes"
                            placeholder="Enter any additional notes"
                            rows="3"
                        ></textarea>
                    </div>
                </div>

                <div class="entry-form-footer">
                    <button class="cancel-button" @click="closeEntryForm">Cancel</button>
                    <button class="save-button" @click="saveEntry" :disabled="!isEntryFormValid">
                        {{ isEditingEntry ? 'Update' : 'Add' }} Entry
                    </button>
                </div>
            </div>
        </div>

        <!-- Publish Dialog -->
        <PublishDialog v-if="showPublishDialog" @close="showPublishDialog = false" />
    </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue';
import { useSchedulerStore } from '../../pinia/scheduler';
import SchedulerToolbar from '../../components/scheduler/SchedulerToolbar.vue';
import PeriodGrid from '../../components/scheduler/PeriodGrid.vue';
import TimeGrid from '../../components/scheduler/TimeGrid.vue';
import PublishDialog from '../../components/scheduler/PublishDialog.vue';

export default {
    name: 'SchedulerPage',
    components: {
        SchedulerToolbar,
        PeriodGrid,
        TimeGrid,
        PublishDialog,
    },
    props: {
        schoolId: {
            type: String,
            required: true,
        },
        draftId: {
            type: String,
            required: true,
        },
        publishedBy: {
            type: String,
            default: null,
        },
    },
    setup(props) {
        const store = useSchedulerStore();

        // Mock data for development
        const days = [
            { id: 0, name: 'Sunday' },
            { id: 1, name: 'Monday' },
            { id: 2, name: 'Tuesday' },
            { id: 3, name: 'Wednesday' },
            { id: 4, name: 'Thursday' },
            { id: 5, name: 'Friday' },
            { id: 6, name: 'Saturday' },
        ];

        const courses = [
            { id: 'course1', name: 'Mathematics' },
            { id: 'course2', name: 'Science' },
            { id: 'course3', name: 'English' },
            { id: 'course4', name: 'History' },
            { id: 'course5', name: 'Physical Education' },
            { id: 'course6', name: 'Art' },
            { id: 'course7', name: 'Music' },
        ];

        const teachers = [
            { id: 't1', name: 'Mr. Smith' },
            { id: 't2', name: 'Mrs. Johnson' },
            { id: 't3', name: 'Dr. Williams' },
            { id: 't4', name: 'Ms. Brown' },
            { id: 't5', name: 'Mr. Davis' },
            { id: 't6', name: 'Mrs. Miller' },
        ];

        const classes = [
            { id: 'c1', name: 'Class 1A' },
            { id: 'c2', name: 'Class 2B' },
            { id: 'c3', name: 'Class 3C' },
            { id: 'c4', name: 'Class 4D' },
        ];

        const rooms = [
            { id: 'r1', name: 'Room 101' },
            { id: 'r2', name: 'Room 102' },
            { id: 'r3', name: 'Lab 1' },
            { id: 'r4', name: 'Gym' },
            { id: 'r5', name: 'Music Room' },
            { id: 'r6', name: 'Art Studio' },
        ];

        // UI state
        const showEntryForm = ref(false);
        const showPublishDialog = ref(false);
        const isEditingEntry = ref(false);
        const entryForm = ref(createEmptyEntry());
        const conflicts = ref([]);

        // Store state
        const viewMode = computed(() => store.viewMode);
        const periods = computed(() => store.periods);
        const entries = computed(() => store.entries);

        // Initialize store
        onMounted(() => {
            store.initialize(props.schoolId, props.draftId, props.publishedBy);
        });

        // Watch for props changes
        watch(
            () => props.schoolId,
            newVal => {
                if (newVal) {
                    store.initialize(props.schoolId, props.draftId, props.publishedBy);
                }
            }
        );

        // Form validation
        const isEntryFormValid = computed(() => {
            const form = entryForm.value;

            // Basic validation
            if (form.schedule_type === 'period' && !form.period_id) return false;
            if (form.schedule_type === 'adhoc' && (!form.start_time || !form.end_time)) return false;
            if (!form.course_id && !form.meeting_name) return false;
            if (!form.teacher_ids.length) return false;
            if (!form.room_id) return false;

            return true;
        });

        // Helper functions
        function createEmptyEntry() {
            return {
                schedule_type: 'period',
                day_id: 1, // Monday
                period_id: null,
                start_time: null,
                end_time: null,
                course_id: '',
                subject_id: null,
                class_id: '',
                teacher_ids: [],
                room_id: '',
                meeting_name: '',
                notes: '',
            };
        }

        function formatTime(timeString) {
            if (!timeString) return '';
            const parts = timeString.split(':');
            if (parts.length >= 2) {
                return `${parts[0]}:${parts[1]}`;
            }
            return timeString;
        }

        function getDayName(dayId) {
            const day = days.find(d => d.id === dayId);
            return day ? day.name : '';
        }

        function getPeriodName(periodId) {
            const period = periods.value.find(p => p.id === periodId);
            return period ? period.name : '';
        }

        function getEntryTitle(entry) {
            if (entry.meeting_name) return entry.meeting_name;
            if (entry.course_id) {
                const course = courses.find(c => c.id === entry.course_id);
                return course ? course.name : '';
            }
            return 'Untitled';
        }

        async function openEntryForm(options) {
            const { isEdit, entry, conflicts: entryConflicts, period, dayId, periodId, startTime, endTime } = options;

            isEditingEntry.value = isEdit;
            conflicts.value = entryConflicts || [];

            if (isEdit && entry) {
                // Edit existing entry
                entryForm.value = { ...entry };
            } else {
                // Create new entry
                entryForm.value = createEmptyEntry();

                if (dayId !== undefined) {
                    entryForm.value.day_id = dayId;
                }

                if (period) {
                    entryForm.value.schedule_type = 'period';
                    entryForm.value.period_id = periodId;
                    entryForm.value.start_time = period.start_time;
                    entryForm.value.end_time = period.end_time;
                } else if (startTime && endTime) {
                    entryForm.value.schedule_type = 'adhoc';
                    entryForm.value.start_time = startTime;
                    entryForm.value.end_time = endTime;
                }
            }

            showEntryForm.value = true;
        }

        function closeEntryForm() {
            showEntryForm.value = false;
            entryForm.value = createEmptyEntry();
            conflicts.value = [];
        }

        async function saveEntry() {
            // Check for conflicts first
            const checkData = {
                schedule_type: entryForm.value.schedule_type,
                day_id: entryForm.value.day_id,
                period_id: entryForm.value.schedule_type === 'period' ? entryForm.value.period_id : null,
                start_time: entryForm.value.start_time,
                end_time: entryForm.value.end_time,
                teacher_ids: entryForm.value.teacher_ids,
                class_id: entryForm.value.class_id,
                room_id: entryForm.value.room_id,
            };

            const result = await store.checkPlacement(checkData);

            if (result.conflicts && result.conflicts.length > 0) {
                conflicts.value = result.conflicts;
                return;
            }

            // Save the entry
            store.upsertEntry({ ...entryForm.value });
            closeEntryForm();
        }

        function removeEntry(index) {
            store.removeEntry(index);
        }

        return {
            days,
            courses,
            teachers,
            classes,
            rooms,
            viewMode,
            periods,
            entries,
            showEntryForm,
            showPublishDialog,
            isEditingEntry,
            entryForm,
            conflicts,
            isEntryFormValid,
            formatTime,
            getDayName,
            getPeriodName,
            getEntryTitle,
            openEntryForm,
            closeEntryForm,
            saveEntry,
            removeEntry,
        };
    },
};
</script>

<style scoped>
.scheduler-page {
    padding: 20px;
    max-width: 1400px;
    margin: 0 auto;
}

.scheduler-title {
    margin-bottom: 20px;
    color: #333;
}

.scheduler-content {
    display: flex;
    gap: 20px;
    margin-top: 20px;
}

.scheduler-grid {
    flex: 1;
    min-width: 0; /* Prevent flex item from overflowing */
}

.draft-panel {
    width: 300px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background-color: white;
    display: flex;
    flex-direction: column;
}

.draft-panel-header {
    padding: 12px;
    border-bottom: 1px solid #ddd;
    background-color: #f5f5f5;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.draft-panel-header h2 {
    margin: 0;
    font-size: 1.1rem;
}

.entry-count {
    font-size: 0.9rem;
    color: #666;
}

.draft-entries {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
}

.draft-entry {
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    margin-bottom: 8px;
    background-color: #f9f9f9;
    position: relative;
}

.entry-day {
    font-weight: 500;
    margin-bottom: 4px;
}

.entry-time {
    font-size: 0.9em;
    color: #666;
    margin-bottom: 4px;
}

.entry-title {
    font-weight: 500;
}

.entry-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 4px;
}

.edit-entry {
    padding: 2px 6px;
    background-color: #f0f0f0;
    border: 1px solid #ddd;
    border-radius: 3px;
    font-size: 0.8em;
    cursor: pointer;
}

.remove-entry {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background-color: #ff4d4f;
    color: white;
    border: none;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 14px;
    cursor: pointer;
}

.no-entries {
    padding: 20px;
    text-align: center;
    color: #999;
    font-style: italic;
}

/* Entry Form Dialog */
.entry-form-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.entry-form {
    background-color: white;
    border-radius: 8px;
    width: 90%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.entry-form-header {
    padding: 16px;
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    background-color: white;
    z-index: 1;
}

.entry-form-header h2 {
    margin: 0;
    font-size: 1.2rem;
}

.close-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #999;
}

.entry-form-content {
    padding: 16px;
}

.conflicts-warning {
    background-color: #fff2f0;
    border: 1px solid #ffccc7;
    border-radius: 4px;
    padding: 12px;
    margin-bottom: 16px;
}

.conflicts-warning h3 {
    margin-top: 0;
    color: #ff4d4f;
    font-size: 1rem;
}

.conflicts-warning ul {
    margin-bottom: 0;
    padding-left: 20px;
}

.form-group {
    margin-bottom: 16px;
}

.form-row {
    display: flex;
    gap: 16px;
}

.form-row .form-group {
    flex: 1;
}

label {
    display: block;
    margin-bottom: 6px;
    font-weight: 500;
}

select,
input[type='text'],
input[type='time'],
textarea {
    width: 100%;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
}

.teacher-checkboxes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
}

.teacher-checkbox {
    display: flex;
    align-items: center;
    gap: 6px;
}

.teacher-checkbox label {
    margin-bottom: 0;
    font-weight: normal;
}

.entry-form-footer {
    padding: 16px;
    border-top: 1px solid #eee;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    position: sticky;
    bottom: 0;
    background-color: white;
}

.cancel-button {
    padding: 8px 16px;
    background-color: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
}

.save-button {
    padding: 8px 16px;
    background-color: #4a6cf7;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.save-button:disabled {
    background-color: #a0aee9;
    cursor: not-allowed;
}

@media (max-width: 768px) {
    .scheduler-content {
        flex-direction: column;
    }

    .draft-panel {
        width: 100%;
    }

    .form-row {
        flex-direction: column;
        gap: 16px;
    }
}
</style>
