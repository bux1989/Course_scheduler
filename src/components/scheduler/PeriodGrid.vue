<template>
    <div class="period-grid" role="grid" aria-label="Weekly schedule by period">
        <!-- Header row with days -->
        <div class="period-grid-header" role="row">
            <div class="period-header-cell period-label-cell" role="columnheader">Period</div>
            <div 
                v-for="(day, index) in days" 
                :key="day.id"
                class="period-header-cell" 
                role="columnheader"
                :aria-colindex="index + 1"
            >
                {{ day.name }}
            </div>
        </div>
        
        <!-- Grid rows for each period -->
        <div 
            v-for="(period, periodIndex) in periods" 
            :key="period.id"
            class="period-grid-row" 
            role="row"
            :aria-rowindex="periodIndex + 1"
        >
            <!-- Period label -->
            <div class="period-label-cell" role="rowheader">
                <div class="period-name">{{ period.name }}</div>
                <div class="period-time">{{ formatTime(period.start_time) }} - {{ formatTime(period.end_time) }}</div>
            </div>
            
            <!-- Cells for each day -->
            <div 
                v-for="day in days" 
                :key="`${period.id}-${day.id}`"
                class="period-cell"
                :class="{ 'has-entry': hasEntry(day.id, period.id) }"
                role="gridcell"
                tabindex="0"
                @click="handleCellClick(day.id, period.id, period)"
                @keydown.enter="handleCellClick(day.id, period.id, period)"
            >
                <template v-if="getEntry(day.id, period.id)">
                    <div class="entry-content">
                        <div class="entry-course">{{ getEntryCourseName(day.id, period.id) }}</div>
                        <div class="entry-details">
                            <span class="entry-room">{{ getEntryRoomName(day.id, period.id) }}</span>
                            <span class="entry-teachers">{{ getEntryTeacherNames(day.id, period.id) }}</span>
                        </div>
                        <button 
                            class="remove-entry" 
                            @click.stop="removeEntry(day.id, period.id)"
                            aria-label="Remove entry"
                        >
                            ×
                        </button>
                    </div>
                </template>
                <div v-else class="empty-cell">
                    <span class="add-icon">+</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { computed } from 'vue';
import { useSchedulerStore } from '../../pinia/scheduler';

export default {
    name: 'PeriodGrid',
    props: {
        days: {
            type: Array,
            default: () => [
                { id: 0, name: 'Sunday' },
                { id: 1, name: 'Monday' },
                { id: 2, name: 'Tuesday' },
                { id: 3, name: 'Wednesday' },
                { id: 4, name: 'Thursday' },
                { id: 5, name: 'Friday' },
                { id: 6, name: 'Saturday' }
            ]
        },
        courses: {
            type: Array,
            default: () => [
                { id: 'course1', name: 'Mathematics' },
                { id: 'course2', name: 'Science' },
                { id: 'course3', name: 'English' },
                { id: 'course4', name: 'History' }
            ]
        },
        rooms: {
            type: Array,
            default: () => [
                { id: 'r1', name: 'Room 101' },
                { id: 'r2', name: 'Room 102' },
                { id: 'r3', name: 'Lab 1' },
                { id: 'r4', name: 'Gym' }
            ]
        },
        teachers: {
            type: Array,
            default: () => [
                { id: 't1', name: 'Mr. Smith' },
                { id: 't2', name: 'Mrs. Johnson' },
                { id: 't3', name: 'Dr. Williams' },
                { id: 't4', name: 'Ms. Brown' }
            ]
        },
        classes: {
            type: Array,
            default: () => [
                { id: 'c1', name: 'Class 1A' },
                { id: 'c2', name: 'Class 2B' },
                { id: 'c3', name: 'Class 3C' }
            ]
        }
    },
    emits: ['add-entry'],
    setup(props, { emit }) {
        const store = useSchedulerStore();
        
        const periods = computed(() => store.periods);
        const entries = computed(() => store.filteredEntries);
        
        function formatTime(timeString) {
            if (!timeString) return '';
            
            // Simple time formatting (HH:MM)
            const parts = timeString.split(':');
            if (parts.length >= 2) {
                return `${parts[0]}:${parts[1]}`;
            }
            return timeString;
        }
        
        function hasEntry(dayId, periodId) {
            return entries.value.some(entry => 
                entry.day_id === dayId && 
                entry.period_id === periodId &&
                entry.schedule_type === 'period'
            );
        }
        
        function getEntry(dayId, periodId) {
            return entries.value.find(entry => 
                entry.day_id === dayId && 
                entry.period_id === periodId &&
                entry.schedule_type === 'period'
            );
        }
        
        function getEntryCourseName(dayId, periodId) {
            const entry = getEntry(dayId, periodId);
            if (!entry || !entry.course_id) return '';
            
            const course = props.courses.find(c => c.id === entry.course_id);
            return course ? course.name : '';
        }
        
        function getEntryRoomName(dayId, periodId) {
            const entry = getEntry(dayId, periodId);
            if (!entry || !entry.room_id) return '';
            
            const room = props.rooms.find(r => r.id === entry.room_id);
            return room ? room.name : '';
        }
        
        function getEntryTeacherNames(dayId, periodId) {
            const entry = getEntry(dayId, periodId);
            if (!entry || !entry.teacher_ids || !entry.teacher_ids.length) return '';
            
            const teacherNames = entry.teacher_ids
                .map(id => {
                    const teacher = props.teachers.find(t => t.id === id);
                    return teacher ? teacher.name : '';
                })
                .filter(name => name);
                
            return teacherNames.join(', ');
        }
        
        async function handleCellClick(dayId, periodId, period) {
            const existingEntry = getEntry(dayId, periodId);
            
            if (existingEntry) {
                // If entry exists, emit event to edit it
                emit('add-entry', { 
                    isEdit: true, 
                    entry: existingEntry,
                    period
                });
            } else {
                // Check if slot is available
                const checkData = {
                    schedule_type: 'period',
                    day_id: dayId,
                    period_id: periodId,
                    start_time: period.start_time,
                    end_time: period.end_time
                };
                
                const result = await store.checkPlacement(checkData);
                
                // Emit event to add new entry
                emit('add-entry', { 
                    isEdit: false, 
                    conflicts: result.conflicts || [],
                    period,
                    dayId,
                    periodId
                });
            }
        }
        
        function removeEntry(dayId, periodId) {
            const entry = getEntry(dayId, periodId);
            if (entry) {
                const index = entries.value.indexOf(entry);
                if (index !== -1) {
                    store.removeEntry(index);
                }
            }
        }
        
        return {
            periods,
            formatTime,
            hasEntry,
            getEntry,
            getEntryCourseName,
            getEntryRoomName,
            getEntryTeacherNames,
            handleCellClick,
            removeEntry
        };
    }
};
</script>

<style scoped>
.period-grid {
    display: flex;
    flex-direction: column;
    border: 1px solid #ddd;
    border-radius: 4px;
    overflow: hidden;
}

.period-grid-header {
    display: flex;
    background-color: #f5f5f5;
    font-weight: bold;
    border-bottom: 1px solid #ddd;
}

.period-header-cell {
    flex: 1;
    padding: 12px;
    text-align: center;
    border-right: 1px solid #ddd;
}

.period-header-cell:last-child {
    border-right: none;
}

.period-grid-row {
    display: flex;
    border-bottom: 1px solid #ddd;
}

.period-grid-row:last-child {
    border-bottom: none;
}

.period-label-cell {
    width: 120px;
    padding: 12px;
    background-color: #f9f9f9;
    border-right: 1px solid #ddd;
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.period-name {
    font-weight: 500;
}

.period-time {
    font-size: 0.85em;
    color: #666;
    margin-top: 4px;
}

.period-cell {
    flex: 1;
    min-height: 80px;
    border-right: 1px solid #ddd;
    position: relative;
cursor: pointer;
transition: background-color 0.2s;
}

.period-cell:last-child {
border-right: none;
}

.period-cell:hover {
background-color: #f0f7ff;
}

.empty-cell {
display: flex;
justify-content: center;
align-items: center;
height: 100%;
color: #ccc;
}

.add-icon {
font-size: 24px;
opacity: 0.5;
}

.has-entry {
background-color: #e6f7ff;
}

.entry-content {
padding: 8px;
height: 100%;
position: relative;
}

.entry-course {
font-weight: 500;
margin-bottom: 4px;
}

.entry-details {
font-size: 0.85em;
color: #666;
display: flex;
flex-direction: column;
gap: 2px;
}

.remove-entry {
position: absolute;
top: 4px;
right: 4px;
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
opacity: 0;
transition: opacity 0.2s;
}

.entry-content:hover .remove-entry {
opacity: 1;
}
</style>
