<template>
    <div class="assignment-modal-overlay" @click="closeModal" v-if="visible">
        <div class="assignment-modal" @click.stop>
            <!-- Header -->
            <div class="modal-header">
                <h2>{{ modalTitle }}</h2>
                <button class="close-button" @click="closeModal" aria-label="Close">×</button>
            </div>

            <!-- Period/Time Info -->
            <div class="period-info" v-if="periodInfo">
                <div class="info-item"><strong>Day:</strong> {{ periodInfo.dayName }}</div>
                <div class="info-item"><strong>Period:</strong> {{ periodInfo.periodName }}</div>
                <div class="info-item"><strong>Time:</strong> {{ periodInfo.timeRange }}</div>
            </div>

            <!-- Existing Assignments -->
            <div v-if="existingAssignments.length > 0" class="existing-assignments">
                <h3>Current Assignments ({{ existingAssignments.length }})</h3>
                <div class="assignment-list">
                    <div
                        v-for="(assignment, index) in existingAssignments"
                        :key="index"
                        class="assignment-card"
                        :class="{ 'has-conflicts': hasAssignmentConflicts(assignment) }"
                        :style="getAssignmentCardStyle(assignment)"
                    >
                        <div class="assignment-header">
                            <span class="course-name">{{ getCourseName(assignment.course_id) }}</span>
                            <div class="assignment-actions">
                                <button @click="editAssignment(assignment)" class="edit-btn" title="Edit assignment">
                                    ✏️
                                </button>
                                <button
                                    @click="removeAssignment(assignment)"
                                    class="remove-btn"
                                    title="Remove assignment"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                        <div class="assignment-details">
                            <div v-if="assignment.class_id" class="detail-item">
                                <strong>Class:</strong> {{ getClassName(assignment.class_id) }}
                            </div>
                            <div v-if="assignment.teacher_ids?.length" class="detail-item">
                                <strong>Teachers:</strong> {{ getTeacherNames(assignment.teacher_ids) }}
                            </div>
                            <div v-if="assignment.room_id" class="detail-item">
                                <strong>Room:</strong> {{ getRoomName(assignment.room_id) }}
                            </div>
                            <div v-if="assignment.meeting_name" class="detail-item">
                                <strong>Meeting:</strong> {{ assignment.meeting_name }}
                            </div>
                        </div>

                        <!-- Conflict Warnings -->
                        <div v-if="hasAssignmentConflicts(assignment)" class="conflicts-section">
                            <div class="conflicts-header">⚠️ Conflicts Detected</div>
                            <ul class="conflicts-list">
                                <li v-for="conflict in getAssignmentConflicts(assignment)" :key="conflict.id">
                                    {{ conflict.message }}
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Available Courses Section -->
            <div class="available-courses">
                <h3>Available Courses</h3>

                <!-- Course Filter -->
                <div class="course-filter">
                    <input v-model="courseFilter" type="text" placeholder="Search courses..." class="filter-input" />
                    <select v-model="yearGroupFilter" class="filter-select">
                        <option value="">All Year Groups</option>
                        <option v-for="year in yearGroups" :key="year" :value="year">{{ year }}</option>
                    </select>
                </div>

                <!-- Course List -->
                <div class="course-grid">
                    <div
                        v-for="course in filteredCourses"
                        :key="course.id"
                        class="course-card"
                        :class="{
                            available: isCourseAvailable(course),
                            unavailable: !isCourseAvailable(course),
                            'conflict-warning': wouldCauseConflict(course),
                        }"
                        :style="getCourseCardStyle(course)"
                        @click="selectCourse(course)"
                    >
                        <div class="course-header">
                            <span class="course-name">{{ course.name }}</span>
                            <div class="course-indicators">
                                <span
                                    v-if="!isCourseAvailable(course)"
                                    class="unavailable-badge"
                                    title="Not in possible time slots"
                                    >🚫</span
                                >
                                <span
                                    v-if="wouldCauseConflict(course)"
                                    class="conflict-badge"
                                    title="Would cause conflict"
                                    >⚠️</span
                                >
                            </div>
                        </div>

                        <div v-if="course.description" class="course-description">
                            {{ course.description }}
                        </div>

                        <div class="course-details">
                            <div v-if="course.year_groups?.length" class="detail-small">
                                Years: {{ course.year_groups.join(', ') }}
                            </div>
                            <div v-if="course.duration" class="detail-small">Duration: {{ course.duration }}min</div>
                        </div>
                    </div>
                </div>

                <div v-if="filteredCourses.length === 0" class="no-courses">No courses match your search criteria.</div>
            </div>

            <!-- Quick Assignment Form (appears after selecting course) -->
            <div v-if="selectedCourse" class="quick-assign-form">
                <h3>Assign {{ selectedCourse.name }}</h3>

                <div class="form-grid">
                    <div class="form-group">
                        <label for="assign-class">Class:</label>
                        <select id="assign-class" v-model="assignmentForm.class_id" required>
                            <option value="">Select Class</option>
                            <option v-for="cls in availableClasses" :key="cls.id" :value="cls.id">
                                {{ cls.name }}
                            </option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="assign-room">Room:</label>
                        <select id="assign-room" v-model="assignmentForm.room_id">
                            <option value="">Select Room</option>
                            <option v-for="room in availableRooms" :key="room.id" :value="room.id">
                                {{ room.name }}
                            </option>
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label>Teachers:</label>
                    <div class="teacher-grid">
                        <label v-for="teacher in availableTeachers" :key="teacher.id" class="teacher-checkbox">
                            <input type="checkbox" :value="teacher.id" v-model="assignmentForm.teacher_ids" />
                            {{ teacher.name }}
                        </label>
                    </div>
                </div>

                <div class="form-group">
                    <label for="meeting-name">Meeting Name (optional):</label>
                    <input
                        id="meeting-name"
                        v-model="assignmentForm.meeting_name"
                        type="text"
                        placeholder="Custom meeting name"
                    />
                </div>

                <div class="form-actions">
                    <button @click="cancelSelection" class="cancel-btn">Cancel</button>
                    <button @click="confirmAssignment" class="confirm-btn" :disabled="!isAssignmentValid">
                        Add Assignment
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { computed, ref, watch } from 'vue';

export default {
    name: 'AssignmentModal',
    props: {
        visible: { type: Boolean, default: false },
        dayId: { type: Number, default: null },
        periodId: { type: Number, default: null },
        period: { type: Object, default: null },

        // Data
        courses: { type: Array, default: () => [] },
        teachers: { type: Array, default: () => [] },
        classes: { type: Array, default: () => [] },
        rooms: { type: Array, default: () => [] },
        subjects: { type: Array, default: () => [] },
        schoolDays: { type: Array, default: () => [] },

        // Assignments
        existingAssignments: { type: Array, default: () => [] },
        conflicts: { type: Array, default: () => [] },

        // Mode
        isReadOnly: { type: Boolean, default: false },
        preSelectedCourse: { type: Object, default: null },
    },

    emits: ['close', 'add-assignment', 'edit-assignment', 'remove-assignment'],

    setup(props, { emit }) {
        // Local state
        const courseFilter = ref('');
        const yearGroupFilter = ref('');
        const selectedCourse = ref(null);
        const assignmentForm = ref({
            class_id: '',
            teacher_ids: [],
            room_id: '',
            meeting_name: '',
        });

        // Watch for pre-selected course
        watch(
            () => props.preSelectedCourse,
            newPreSelectedCourse => {
                if (newPreSelectedCourse && props.visible) {
                    console.log('🎯 [AssignmentModal] Pre-selecting course:', {
                        courseId: newPreSelectedCourse.id,
                        courseName: newPreSelectedCourse.name || newPreSelectedCourse.course_name,
                    });
                    selectCourse(newPreSelectedCourse);
                }
            },
            { immediate: true }
        );

        // Reset when modal closes
        watch(
            () => props.visible,
            isVisible => {
                if (!isVisible) {
                    selectedCourse.value = null;
                    assignmentForm.value = {
                        class_id: '',
                        teacher_ids: [],
                        room_id: '',
                        meeting_name: '',
                    };
                }
            }
        );

        // Computed
        const modalTitle = computed(() => {
            if (!props.period) return 'Manage Assignments';

            // Handle both day.id and day.day_id fields
            const dayData = props.schoolDays.find(d => d.id === props.dayId || d.day_id === props.dayId);
            const dayName = dayData?.name || 'Unknown Day';
            const periodName = props.period?.name || props.period?.label || 'Unknown Period';

            return `${dayName} - ${periodName}`;
        });

        const periodInfo = computed(() => {
            if (!props.period) return null;

            // Handle both day.id and day.day_id fields
            const dayData = props.schoolDays.find(d => d.id === props.dayId || d.day_id === props.dayId);
            const dayName = dayData?.name || 'Unknown Day';
            const periodName = props.period?.name || props.period?.label || 'Unknown Period';
            const timeRange = `${formatTime(props.period.start_time)} - ${formatTime(props.period.end_time)}`;

            return {
                dayName,
                periodName,
                timeRange,
            };
        });

        const yearGroups = computed(() => {
            const years = new Set();
            props.classes.forEach(cls => {
                if (cls.year_group) years.add(cls.year_group);
            });
            return Array.from(years).sort();
        });

        const filteredCourses = computed(() => {
            let courses = props.courses;

            console.log('📚 [AssignmentModal] filteredCourses computation:', {
                totalCourses: props.courses.length,
                courseFilter: courseFilter.value,
                yearGroupFilter: yearGroupFilter.value,
                sampleCourse: props.courses[0],
            });

            // Filter by search text
            if (courseFilter.value) {
                const searchLower = courseFilter.value.toLowerCase();
                courses = courses.filter(course => {
                    // Enhanced search across multiple fields
                    const searchableFields = [
                        course.name,
                        course.course_name,
                        course.title,
                        course.description,
                        course.course_code,
                        course.subject_name, // Add subject_name to search
                        course.important_information, // Add additional info field
                    ].filter(Boolean); // Remove null/undefined values

                    const matches = searchableFields.some(field => field?.toLowerCase().includes(searchLower));

                    if (searchLower === 'archery') {
                        console.log('🔍 [AssignmentModal] Archery search debug:', {
                            courseId: course.id,
                            searchableFields,
                            matches,
                            course: course,
                        });
                    }

                    return matches;
                });

                console.log('📚 [AssignmentModal] Search filtering:', {
                    searchTerm: courseFilter.value,
                    beforeFiltering: props.courses.length,
                    afterFiltering: courses.length,
                    matchedCourses: courses.map(c => ({
                        id: c.id,
                        name: c.name || c.course_name || c.title,
                        code: c.course_code,
                    })),
                });
            }

            // Filter by year group
            if (yearGroupFilter.value) {
                courses = courses.filter(course => course.year_groups?.includes(yearGroupFilter.value));
            }

            console.log('📚 [AssignmentModal] Filtered courses result:', {
                filteredCount: courses.length,
                courses: courses.map(c => ({ id: c.id, name: c.name })),
            });

            return courses;
        });

        const availableClasses = computed(() => {
            if (!selectedCourse.value) return props.classes;

            // Filter classes by year group if course specifies
            if (selectedCourse.value.year_groups?.length) {
                return props.classes.filter(cls => selectedCourse.value.year_groups.includes(cls.year_group));
            }

            return props.classes;
        });

        const availableTeachers = computed(() => {
            if (!selectedCourse.value) return props.teachers;

            // Filter teachers by subject if course specifies
            if (selectedCourse.value.subject_ids?.length) {
                return props.teachers.filter(teacher =>
                    teacher.subject_ids?.some(id => selectedCourse.value.subject_ids.includes(id))
                );
            }

            return props.teachers;
        });

        const availableRooms = computed(() => {
            // Could filter by room type/capacity in the future
            return props.rooms;
        });

        const isAssignmentValid = computed(() => {
            return assignmentForm.value.class_id && assignmentForm.value.teacher_ids.length > 0;
        });

        // Methods
        function formatTime(timeString) {
            if (!timeString) return '';
            const parts = timeString.split(':');
            return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : timeString;
        }

        function getCourseName(courseId) {
            if (!courseId) return 'No Course';
            const course = props.courses.find(c => c.id === courseId);
            return course?.name || course?.course_name || course?.title || 'Unknown Course';
        }

        function getSubjectName(subjectId) {
            if (!subjectId) return '';
            const subject = props.subjects.find(s => s.id === subjectId);
            return subject?.name || subject?.title || subject?.subject_name || `Subject ${subjectId}`;
        }

        function getClassName(classId) {
            if (!classId) return 'No Class';
            const cls = props.classes.find(c => c.id === classId);
            return cls?.name || 'Unknown Class';
        }

        function getTeacherNames(teacherIds) {
            if (!teacherIds?.length) return 'No Teachers';
            const names = teacherIds.map(id => {
                const teacher = props.teachers.find(t => t.id === id);
                return teacher?.name || 'Unknown Teacher';
            });
            return names.join(', ');
        }

        function getRoomName(roomId) {
            if (!roomId) return 'No Room';
            const room = props.rooms.find(r => r.id === roomId);
            return room?.name || 'Unknown Room';
        }

        function hasAssignmentConflicts(assignment) {
            return props.conflicts.some(
                conflict =>
                    conflict.day_id === assignment.day_id &&
                    conflict.period_id === assignment.period_id &&
                    (conflict.assignment_id === assignment.id ||
                        conflict.teacher_ids?.some(id => assignment.teacher_ids?.includes(id)) ||
                        conflict.class_id === assignment.class_id ||
                        conflict.room_id === assignment.room_id)
            );
        }

        function getAssignmentConflicts(assignment) {
            return props.conflicts.filter(
                conflict =>
                    conflict.day_id === assignment.day_id &&
                    conflict.period_id === assignment.period_id &&
                    (conflict.assignment_id === assignment.id ||
                        conflict.teacher_ids?.some(id => assignment.teacher_ids?.includes(id)) ||
                        conflict.class_id === assignment.class_id ||
                        conflict.room_id === assignment.room_id)
            );
        }

        function getAssignmentCardStyle(assignment) {
            const course = props.courses.find(c => c.id === assignment.course_id);
            const cls = props.classes.find(c => c.id === assignment.class_id);

            return {
                borderLeft: `4px solid ${course?.color || cls?.color || '#e0e0e0'}`,
                backgroundColor: course?.color ? `${course.color}10` : cls?.color ? `${cls.color}10` : '#f9f9f9',
            };
        }

        function isCourseAvailable(course) {
            // Check if course is available for this time slot
            if (!course.possible_time_slots?.length) {
                console.log('📚 [AssignmentModal] Course has no time slot restrictions:', {
                    courseId: course.id,
                    courseName: course.name || course.course_name,
                });
                return true; // No restrictions - course can be scheduled anywhere
            }

            // Find current day info - try multiple approaches
            const currentDay = props.schoolDays.find(d => d.id === props.dayId || d.day_id === props.dayId);

            // Get day number from multiple possible sources
            let currentDayNumber = currentDay?.day_number;
            if (!currentDayNumber) {
                // Fall back to finding by index if day_number not available
                const dayIndex = props.schoolDays.findIndex(d => d.id === props.dayId || d.day_id === props.dayId);
                currentDayNumber = dayIndex >= 0 ? dayIndex + 1 : null; // 1-based numbering
            }

            console.log('📚 [AssignmentModal] Checking course availability:', {
                courseId: course.id,
                courseName: course.name || course.course_name,
                possible_time_slots: course.possible_time_slots,
                currentDayId: props.dayId,
                currentPeriodId: props.periodId,
                currentDay: currentDay,
                currentDayNumber: currentDayNumber,
                schoolDaysCount: props.schoolDays.length,
            });

            const isAvailable = course.possible_time_slots.some(slot => {
                // Handle string format "day_number|period_id"
                if (typeof slot === 'string' && slot.includes('|')) {
                    const [dayNumber, periodId] = slot.split('|');
                    const slotDayNumber = parseInt(dayNumber);
                    const match = slotDayNumber === currentDayNumber && periodId === props.periodId;

                    console.log('  Checking string slot:', {
                        slot,
                        slotDayNumber,
                        periodId,
                        currentDayNumber,
                        currentPeriodId: props.periodId,
                        matches: match,
                    });

                    return match;
                }
                // Handle object format {day_id, period_id}
                else if (typeof slot === 'object') {
                    const match = slot.day_id === props.dayId && slot.period_id === props.periodId;

                    console.log('  Checking object slot:', {
                        slot,
                        currentDayId: props.dayId,
                        currentPeriodId: props.periodId,
                        matches: match,
                    });

                    return match;
                }
                return false;
            });

            console.log('📚 [AssignmentModal] Course availability result:', {
                courseId: course.id,
                courseName: course.name || course.course_name,
                isAvailable: isAvailable,
            });

            return isAvailable;
        }

        function wouldCauseConflict(course) {
            // Basic conflict check - could be more sophisticated
            return props.existingAssignments.some(assignment => assignment.course_id === course.id);
        }

        function getCourseCardStyle(course) {
            return {
                backgroundColor: course.color ? `${course.color}15` : '#f9f9f9',
                borderColor: course.color || '#e0e0e0',
            };
        }

        function selectCourse(course) {
            if (props.isReadOnly) return;

            selectedCourse.value = course;

            // Reset form
            assignmentForm.value = {
                class_id: '',
                teacher_ids: [],
                room_id: '',
                meeting_name: '',
            };
        }

        function cancelSelection() {
            selectedCourse.value = null;
        }

        function confirmAssignment() {
            if (!isAssignmentValid.value || !selectedCourse.value) return;

            const newAssignment = {
                schedule_type: 'period',
                day_id: props.dayId,
                period_id: props.periodId,
                start_time: props.period.start_time,
                end_time: props.period.end_time,
                course_id: selectedCourse.value.id,
                subject_id: selectedCourse.value.subject_id || null,
                class_id: assignmentForm.value.class_id,
                teacher_ids: [...assignmentForm.value.teacher_ids],
                room_id: assignmentForm.value.room_id || null,
                meeting_name: assignmentForm.value.meeting_name || null,
                notes: null,
            };

            emit('add-assignment', newAssignment);
            selectedCourse.value = null;
        }

        function editAssignment(assignment) {
            emit('edit-assignment', assignment);
        }

        function removeAssignment(assignment) {
            emit('remove-assignment', assignment);
        }

        function closeModal() {
            selectedCourse.value = null;
            emit('close');
        }

        // Watch for prop changes
        watch(
            () => props.visible,
            newVal => {
                if (!newVal) {
                    selectedCourse.value = null;
                }
            }
        );

        return {
            // State
            courseFilter,
            yearGroupFilter,
            selectedCourse,
            assignmentForm,

            // Computed
            modalTitle,
            periodInfo,
            yearGroups,
            filteredCourses,
            availableClasses,
            availableTeachers,
            availableRooms,
            isAssignmentValid,

            // Methods
            formatTime,
            getCourseName,
            getClassName,
            getTeacherNames,
            getRoomName,
            hasAssignmentConflicts,
            getAssignmentConflicts,
            getAssignmentCardStyle,
            isCourseAvailable,
            wouldCauseConflict,
            getCourseCardStyle,
            selectCourse,
            cancelSelection,
            confirmAssignment,
            editAssignment,
            removeAssignment,
            closeModal,
        };
    },
};
</script>

<style scoped>
.assignment-modal-overlay {
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
    width: 90%;
    max-width: 900px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-header {
    padding: 16px 20px;
    border-bottom: 1px solid #e0e0e0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    background: white;
    z-index: 1;
}

.modal-header h2 {
    margin: 0;
    color: #333;
    font-size: 1.3em;
}

.close-button {
    background: none;
    border: none;
    font-size: 1.5em;
    cursor: pointer;
    color: #999;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.period-info {
    padding: 16px 20px;
    background: #f8f9fa;
    border-bottom: 1px solid #e0e0e0;
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
}

.info-item {
    font-size: 0.9em;
}

.existing-assignments,
.available-courses {
    padding: 20px;
}

.existing-assignments h3,
.available-courses h3 {
    margin: 0 0 16px 0;
    color: #333;
    font-size: 1.1em;
}

.assignment-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 24px;
}

.assignment-card {
    padding: 12px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    position: relative;
}

.assignment-card.has-conflicts {
    border-color: #ff4d4f;
    background: #fff2f0;
}

.assignment-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
}

.course-name {
    font-weight: 600;
    color: #333;
    font-size: 1em;
}

.assignment-actions {
    display: flex;
    gap: 4px;
}

.edit-btn,
.remove-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px;
    font-size: 0.9em;
    border-radius: 3px;
}

.edit-btn:hover,
.remove-btn:hover {
    background: #f0f0f0;
}

.assignment-details {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 8px;
    margin-bottom: 8px;
}

.detail-item {
    font-size: 0.85em;
    color: #666;
}

.conflicts-section {
    margin-top: 12px;
    padding: 8px;
    background: #fff2f0;
    border: 1px solid #ffccc7;
    border-radius: 4px;
}

.conflicts-header {
    font-weight: 600;
    color: #ff4d4f;
    margin-bottom: 6px;
    font-size: 0.9em;
}

.conflicts-list {
    margin: 0;
    padding-left: 20px;
    font-size: 0.85em;
    color: #666;
}

.course-filter {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
}

.filter-input,
.filter-select {
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.9em;
}

.filter-input {
    flex: 1;
    min-width: 200px;
}

.filter-select {
    min-width: 150px;
}

.course-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
}

.course-card {
    padding: 12px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
}

.course-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.course-card.available {
    border-color: #52c41a;
}

.course-card.unavailable {
    border-color: #faad14;
    background: #fffbe6;
}

.course-card.conflict-warning {
    border-color: #ff4d4f;
}

.course-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
}

.course-indicators {
    display: flex;
    gap: 4px;
}

.unavailable-badge,
.conflict-badge {
    font-size: 0.8em;
}

.course-description {
    font-size: 0.85em;
    color: #666;
    margin-bottom: 8px;
    line-height: 1.3;
}

.course-details {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
}

.detail-small {
    font-size: 0.8em;
    color: #888;
}

.no-courses {
    text-align: center;
    padding: 40px;
    color: #999;
    font-style: italic;
}

.quick-assign-form {
    padding: 20px;
    border-top: 1px solid #e0e0e0;
    background: #f8f9fa;
}

.quick-assign-form h3 {
    margin: 0 0 16px 0;
    color: #333;
    font-size: 1.1em;
}

.form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 16px;
}

.form-group {
    margin-bottom: 16px;
}

.form-group label {
    display: block;
    margin-bottom: 6px;
    font-weight: 500;
    color: #333;
    font-size: 0.9em;
}

.form-group select,
.form-group input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.9em;
}

.teacher-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 8px;
    max-height: 120px;
    overflow-y: auto;
    padding: 8px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    background: white;
}

.teacher-checkbox {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85em;
    cursor: pointer;
    padding: 4px;
    border-radius: 3px;
}

.teacher-checkbox:hover {
    background: #f0f0f0;
}

.form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid #e0e0e0;
}

.cancel-btn,
.confirm-btn {
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 0.9em;
    cursor: pointer;
    transition: all 0.2s;
}

.cancel-btn {
    background: white;
    border: 1px solid #ddd;
    color: #666;
}

.cancel-btn:hover {
    background: #f0f0f0;
}

.confirm-btn {
    background: #007cba;
    border: 1px solid #007cba;
    color: white;
}

.confirm-btn:hover:not(:disabled) {
    background: #005a87;
}

.confirm-btn:disabled {
    background: #a0aee9;
    cursor: not-allowed;
}

/* Responsive */
@media (max-width: 768px) {
    .assignment-modal {
        width: 95%;
        max-height: 95vh;
    }

    .period-info {
        flex-direction: column;
        gap: 8px;
    }

    .course-filter {
        flex-direction: column;
    }

    .form-grid {
        grid-template-columns: 1fr;
    }

    .course-grid {
        grid-template-columns: 1fr;
    }

    .teacher-grid {
        grid-template-columns: 1fr;
    }
}
</style>
