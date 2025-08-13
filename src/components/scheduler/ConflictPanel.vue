<template>
    <div class="conflict-panel" v-if="visible">
        <div class="panel-header">
            <h3>
                <span class="conflict-icon">⚠️</span>
                Schedule Conflicts ({{ visibleConflicts.length }})
            </h3>
            <div class="header-actions">
                <select v-model="filterType" class="filter-select">
                    <option value="">All Conflicts</option>
                    <option value="teacher">Teacher Conflicts</option>
                    <option value="room">Room Conflicts</option>
                    <option value="class">Class Conflicts</option>
                    <option value="time">Time Conflicts</option>
                </select>
                <button @click="$emit('close')" class="close-button" title="Close panel">×</button>
            </div>
        </div>

        <div class="panel-content">
            <div v-if="visibleConflicts.length === 0" class="no-conflicts">
                <div class="no-conflicts-icon">✅</div>
                <h4>No Conflicts Found</h4>
                <p>Your schedule is conflict-free!</p>
            </div>

            <div v-else class="conflicts-list">
                <div
                    v-for="conflict in visibleConflicts"
                    :key="conflict.id"
                    class="conflict-item"
                    :class="`conflict-type-${conflict.type}`"
                >
                    <div class="conflict-header">
                        <div class="conflict-title">
                            <span class="conflict-type-badge" :class="`badge-${conflict.type}`">
                                {{ getConflictTypeIcon(conflict.type) }} {{ getConflictTypeName(conflict.type) }}
                            </span>
                            <span class="conflict-severity" :class="`severity-${conflict.severity || 'medium'}`">
                                {{ getSeverityIcon(conflict.severity) }}
                            </span>
                        </div>
                        <div class="conflict-actions">
                            <button
                                @click="navigateToConflict(conflict)"
                                class="navigate-btn"
                                title="Go to conflict location"
                            >
                                📍 Go To
                            </button>
                            <button
                                @click="suggestFix(conflict)"
                                class="suggest-btn"
                                title="Get suggestions to fix"
                                v-if="conflict.type !== 'warning'"
                            >
                                💡 Fix
                            </button>
                        </div>
                    </div>

                    <div class="conflict-description">
                        {{ conflict.message || getDefaultConflictMessage(conflict) }}
                    </div>

                    <div class="conflict-details">
                        <div class="detail-row">
                            <strong>Time:</strong>
                            {{ getDayName(conflict.day_id) }}, {{ getPeriodName(conflict.period_id) }}
                            <span v-if="conflict.start_time && conflict.end_time">
                                ({{ formatTime(conflict.start_time) }} - {{ formatTime(conflict.end_time) }})
                            </span>
                        </div>

                        <div v-if="conflict.affected_courses?.length" class="detail-row">
                            <strong>Courses:</strong>
                            <span class="course-list">
                                <span
                                    v-for="courseId in conflict.affected_courses"
                                    :key="courseId"
                                    class="course-tag"
                                    :style="getCourseStyle(courseId)"
                                >
                                    {{ getCourseName(courseId) }}
                                </span>
                            </span>
                        </div>

                        <div v-if="conflict.affected_teachers?.length" class="detail-row">
                            <strong>Teachers:</strong>
                            <span class="teacher-list">
                                <span
                                    v-for="teacherId in conflict.affected_teachers"
                                    :key="teacherId"
                                    class="teacher-tag"
                                    :style="getTeacherStyle(teacherId)"
                                >
                                    {{ getTeacherName(teacherId) }}
                                </span>
                            </span>
                        </div>

                        <div v-if="conflict.affected_classes?.length" class="detail-row">
                            <strong>Classes:</strong>
                            <span class="class-list">
                                <span
                                    v-for="classId in conflict.affected_classes"
                                    :key="classId"
                                    class="class-tag"
                                    :style="getClassStyle(classId)"
                                >
                                    {{ getClassName(classId) }}
                                </span>
                            </span>
                        </div>

                        <div v-if="conflict.affected_rooms?.length" class="detail-row">
                            <strong>Rooms:</strong>
                            <span class="room-list">
                                <span v-for="roomId in conflict.affected_rooms" :key="roomId" class="room-tag">
                                    {{ getRoomName(roomId) }}
                                </span>
                            </span>
                        </div>
                    </div>

                    <!-- Suggestions (if available) -->
                    <div v-if="conflict.suggestions?.length" class="conflict-suggestions">
                        <div class="suggestions-header">💡 Suggested Solutions:</div>
                        <ul class="suggestions-list">
                            <li v-for="suggestion in conflict.suggestions" :key="suggestion.id" class="suggestion-item">
                                <span class="suggestion-text">{{ suggestion.text }}</span>
                                <button
                                    v-if="suggestion.action"
                                    @click="applySuggestion(suggestion)"
                                    class="apply-suggestion-btn"
                                >
                                    Apply
                                </button>
                            </li>
                        </ul>
                    </div>

                    <!-- Auto-resolve option for low-severity conflicts -->
                    <div v-if="conflict.severity === 'low' || conflict.type === 'warning'" class="auto-resolve">
                        <button @click="ignoreConflict(conflict)" class="ignore-btn">Ignore This Warning</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Panel Footer -->
        <div class="panel-footer" v-if="visibleConflicts.length > 0">
            <div class="conflict-summary">
                <span class="summary-item critical">{{ criticalConflicts }} Critical</span>
                <span class="summary-item high">{{ highConflicts }} High</span>
                <span class="summary-item medium">{{ mediumConflicts }} Medium</span>
                <span class="summary-item low">{{ lowConflicts }} Low</span>
            </div>
            <div class="panel-actions">
                <button @click="autoResolveAll" class="auto-resolve-btn" v-if="autoResolvableConflicts > 0">
                    🔧 Auto-Resolve {{ autoResolvableConflicts }} Conflicts
                </button>
                <button @click="exportConflicts" class="export-btn">📄 Export Report</button>
            </div>
        </div>
    </div>
</template>

<script>
import { computed, ref } from 'vue';

export default {
    name: 'ConflictPanel',
    props: {
        visible: { type: Boolean, default: false },
        conflicts: { type: Array, default: () => [] },

        // Data for resolving names
        courses: { type: Array, default: () => [] },
        teachers: { type: Array, default: () => [] },
        classes: { type: Array, default: () => [] },
        rooms: { type: Array, default: () => [] },
        periods: { type: Array, default: () => [] },
        schoolDays: { type: Array, default: () => [] },
    },

    emits: ['close', 'navigate-to-conflict', 'apply-suggestion', 'ignore-conflict', 'auto-resolve-all'],

    setup(props, { emit }) {
        const filterType = ref('');

        const visibleConflicts = computed(() => {
            if (!filterType.value) return props.conflicts;
            return props.conflicts.filter(conflict => conflict.type === filterType.value);
        });

        const criticalConflicts = computed(() => props.conflicts.filter(c => c.severity === 'critical').length);

        const highConflicts = computed(() => props.conflicts.filter(c => c.severity === 'high').length);

        const mediumConflicts = computed(() => props.conflicts.filter(c => c.severity === 'medium').length);

        const lowConflicts = computed(() => props.conflicts.filter(c => c.severity === 'low').length);

        const autoResolvableConflicts = computed(() => props.conflicts.filter(c => c.auto_resolvable).length);

        // Helper functions
        function formatTime(timeString) {
            if (!timeString) return '';
            const parts = timeString.split(':');
            return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : timeString;
        }

        function getDayName(dayId) {
            const day = props.schoolDays.find(d => d.id === dayId);
            return day?.name || 'Unknown Day';
        }

        function getPeriodName(periodId) {
            const period = props.periods.find(p => p.id === periodId);
            return period?.name || 'Unknown Period';
        }

        function getCourseName(courseId) {
            const course = props.courses.find(c => c.id === courseId);
            return course?.name || 'Unknown Course';
        }

        function getTeacherName(teacherId) {
            const teacher = props.teachers.find(t => t.id === teacherId);
            return teacher?.name || 'Unknown Teacher';
        }

        function getClassName(classId) {
            const cls = props.classes.find(c => c.id === classId);
            return cls?.name || 'Unknown Class';
        }

        function getRoomName(roomId) {
            const room = props.rooms.find(r => r.id === roomId);
            return room?.name || 'Unknown Room';
        }

        function getCourseStyle(courseId) {
            const course = props.courses.find(c => c.id === courseId);
            return course?.color ? { backgroundColor: course.color, color: '#fff' } : {};
        }

        function getTeacherStyle(teacherId) {
            const teacher = props.teachers.find(t => t.id === teacherId);
            return teacher?.color ? { backgroundColor: teacher.color, color: '#fff' } : {};
        }

        function getClassStyle(classId) {
            const cls = props.classes.find(c => c.id === classId);
            return cls?.color ? { backgroundColor: cls.color, color: '#fff' } : {};
        }

        function getConflictTypeIcon(type) {
            const icons = {
                teacher: '👨‍🏫',
                room: '🏠',
                class: '👥',
                time: '⏰',
                resource: '📋',
                warning: '⚠️',
            };
            return icons[type] || '⚠️';
        }

        function getConflictTypeName(type) {
            const names = {
                teacher: 'Teacher',
                room: 'Room',
                class: 'Class',
                time: 'Time',
                resource: 'Resource',
                warning: 'Warning',
            };
            return names[type] || 'Unknown';
        }

        function getSeverityIcon(severity) {
            const icons = {
                critical: '🔴',
                high: '🟠',
                medium: '🟡',
                low: '🟢',
            };
            return icons[severity] || '🟡';
        }

        function getDefaultConflictMessage(conflict) {
            switch (conflict.type) {
                case 'teacher':
                    return 'Teacher is assigned to multiple classes at the same time';
                case 'room':
                    return 'Room is booked for multiple classes at the same time';
                case 'class':
                    return 'Class has overlapping assignments';
                case 'time':
                    return 'Time slot conflict detected';
                default:
                    return 'Scheduling conflict detected';
            }
        }

        function navigateToConflict(conflict) {
            emit('navigate-to-conflict', conflict);
        }

        function suggestFix(conflict) {
            // This could trigger AI-powered suggestions
            console.log('Suggesting fixes for conflict:', conflict);
        }

        function applySuggestion(suggestion) {
            emit('apply-suggestion', suggestion);
        }

        function ignoreConflict(conflict) {
            emit('ignore-conflict', conflict);
        }

        function autoResolveAll() {
            emit('auto-resolve-all');
        }

        function exportConflicts() {
            // Export conflicts as CSV or PDF
            const csvContent = props.conflicts.map(conflict => ({
                Type: getConflictTypeName(conflict.type),
                Severity: conflict.severity,
                Day: getDayName(conflict.day_id),
                Period: getPeriodName(conflict.period_id),
                Message: conflict.message || getDefaultConflictMessage(conflict),
            }));

            const csv = [
                Object.keys(csvContent[0]).join(','),
                ...csvContent.map(row => Object.values(row).join(',')),
            ].join('\n');

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'schedule-conflicts.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        return {
            filterType,
            visibleConflicts,
            criticalConflicts,
            highConflicts,
            mediumConflicts,
            lowConflicts,
            autoResolvableConflicts,
            formatTime,
            getDayName,
            getPeriodName,
            getCourseName,
            getTeacherName,
            getClassName,
            getRoomName,
            getCourseStyle,
            getTeacherStyle,
            getClassStyle,
            getConflictTypeIcon,
            getConflictTypeName,
            getSeverityIcon,
            getDefaultConflictMessage,
            navigateToConflict,
            suggestFix,
            applySuggestion,
            ignoreConflict,
            autoResolveAll,
            exportConflicts,
        };
    },
};
</script>

<style scoped>
.conflict-panel {
    background: white;
    border: 1px solid #ff4d4f;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(255, 77, 79, 0.15);
    max-height: 500px;
    display: flex;
    flex-direction: column;
}

.panel-header {
    padding: 12px 16px;
    background: #fff2f0;
    border-bottom: 1px solid #ffccc7;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.panel-header h3 {
    margin: 0;
    color: #ff4d4f;
    font-size: 1em;
    display: flex;
    align-items: center;
    gap: 6px;
}

.conflict-icon {
    font-size: 1.1em;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.filter-select {
    padding: 4px 8px;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    font-size: 0.85em;
}

.close-button {
    background: none;
    border: none;
    font-size: 1.2em;
    cursor: pointer;
    color: #999;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 0;
}

.no-conflicts {
    padding: 40px 20px;
    text-align: center;
    color: #52c41a;
}

.no-conflicts-icon {
    font-size: 2em;
    margin-bottom: 8px;
}

.no-conflicts h4 {
    margin: 0 0 8px 0;
    color: #333;
}

.no-conflicts p {
    margin: 0;
    color: #666;
    font-size: 0.9em;
}

.conflicts-list {
    padding: 0;
}

.conflict-item {
    padding: 16px;
    border-bottom: 1px solid #f0f0f0;
    transition: background-color 0.2s;
}

.conflict-item:hover {
    background: #f9f9f9;
}

.conflict-item:last-child {
    border-bottom: none;
}

.conflict-type-critical {
    border-left: 4px solid #ff4d4f;
    background: #fff2f0;
}

.conflict-type-high {
    border-left: 4px solid #fa8c16;
    background: #fff7e6;
}

.conflict-type-medium {
    border-left: 4px solid #fadb14;
    background: #feffe6;
}

.conflict-type-low {
    border-left: 4px solid #52c41a;
    background: #f6ffed;
}

.conflict-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
}

.conflict-title {
    display: flex;
    align-items: center;
    gap: 8px;
}

.conflict-type-badge {
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.75em;
    font-weight: 500;
}

.badge-teacher {
    background: #e6f7ff;
    color: #1890ff;
}
.badge-room {
    background: #f6ffed;
    color: #52c41a;
}
.badge-class {
    background: #fff7e6;
    color: #fa8c16;
}
.badge-time {
    background: #fff2f0;
    color: #ff4d4f;
}
.badge-warning {
    background: #feffe6;
    color: #fadb14;
}

.conflict-severity {
    font-size: 0.9em;
}

.conflict-actions {
    display: flex;
    gap: 6px;
}

.navigate-btn,
.suggest-btn {
    padding: 2px 6px;
    border: 1px solid #d9d9d9;
    border-radius: 3px;
    background: white;
    font-size: 0.75em;
    cursor: pointer;
    transition: all 0.2s;
}

.navigate-btn:hover,
.suggest-btn:hover {
    background: #f0f0f0;
    transform: translateY(-1px);
}

.conflict-description {
    margin-bottom: 12px;
    color: #333;
    font-size: 0.9em;
    line-height: 1.4;
}

.conflict-details {
    margin-bottom: 12px;
}

.detail-row {
    margin-bottom: 6px;
    font-size: 0.85em;
    display: flex;
    align-items: flex-start;
    gap: 8px;
}

.course-list,
.teacher-list,
.class-list,
.room-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.course-tag,
.teacher-tag,
.class-tag,
.room-tag {
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.8em;
    font-weight: 500;
    background: #f0f0f0;
    color: #333;
}

.conflict-suggestions {
    margin-top: 12px;
    padding: 8px;
    background: #f0f9ff;
    border: 1px solid #bae7ff;
    border-radius: 4px;
}

.suggestions-header {
    font-weight: 500;
    margin-bottom: 6px;
    font-size: 0.85em;
    color: #1890ff;
}

.suggestions-list {
    margin: 0;
    padding: 0;
    list-style: none;
}

.suggestion-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    font-size: 0.8em;
}

.suggestion-text {
    flex: 1;
    color: #666;
}

.apply-suggestion-btn {
    padding: 2px 8px;
    background: #1890ff;
    color: white;
    border: none;
    border-radius: 3px;
    font-size: 0.75em;
    cursor: pointer;
}

.auto-resolve {
    margin-top: 8px;
    text-align: right;
}

.ignore-btn {
    padding: 4px 8px;
    background: #f0f0f0;
    border: 1px solid #d9d9d9;
    border-radius: 3px;
    font-size: 0.8em;
    cursor: pointer;
    color: #666;
}

.panel-footer {
    padding: 12px 16px;
    background: #fafafa;
    border-top: 1px solid #e0e0e0;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.conflict-summary {
    display: flex;
    gap: 12px;
    font-size: 0.8em;
}

.summary-item {
    padding: 2px 6px;
    border-radius: 3px;
    font-weight: 500;
}

.summary-item.critical {
    background: #fff2f0;
    color: #ff4d4f;
}
.summary-item.high {
    background: #fff7e6;
    color: #fa8c16;
}
.summary-item.medium {
    background: #feffe6;
    color: #fadb14;
}
.summary-item.low {
    background: #f6ffed;
    color: #52c41a;
}

.panel-actions {
    display: flex;
    gap: 8px;
}

.auto-resolve-btn,
.export-btn {
    padding: 6px 12px;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    background: white;
    font-size: 0.8em;
    cursor: pointer;
    transition: all 0.2s;
}

.auto-resolve-btn {
    background: #1890ff;
    color: white;
    border-color: #1890ff;
}

.auto-resolve-btn:hover,
.export-btn:hover {
    transform: translateY(-1px);
}

/* Responsive */
@media (max-width: 768px) {
    .panel-header {
        flex-direction: column;
        gap: 8px;
        align-items: stretch;
    }

    .header-actions {
        justify-content: space-between;
    }

    .conflict-header {
        flex-direction: column;
        gap: 8px;
    }

    .panel-footer {
        flex-direction: column;
        gap: 12px;
        align-items: stretch;
    }

    .conflict-summary {
        justify-content: space-around;
    }
}
</style>
