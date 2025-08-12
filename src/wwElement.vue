<template>
    <div class="course-scheduler-wrapper">
        <!-- Course Scheduler Component -->
        <div class="scheduler-container">
            <div class="scheduler-header">
                <h2>Course Scheduler</h2>
                <div class="view-toggle">
                    <button 
                        @click="setViewMode('period')" 
                        :class="{ active: viewMode === 'period' }"
                        class="toggle-btn"
                    >
                        Period View
                    </button>
                    <button 
                        @click="setViewMode('time')" 
                        :class="{ active: viewMode === 'time' }"
                        class="toggle-btn"
                    >
                        Time View
                    </button>
                </div>
            </div>

            <!-- Period View -->
            <div v-if="viewMode === 'period'" class="period-view">
                <div class="period-grid">
                    <div class="period-header">
                        <div class="period-cell period-label">Period</div>
                        <div 
                            v-for="day in days" 
                            :key="day.id" 
                            class="period-cell day-header"
                        >
                            {{ day.name }}
                        </div>
                    </div>
                    <div 
                        v-for="period in periods" 
                        :key="period.id" 
                        class="period-row"
                    >
                        <div class="period-cell period-label">{{ period.name }}</div>
                        <div 
                            v-for="day in days" 
                            :key="`${period.id}-${day.id}`" 
                            class="period-cell period-slot"
                            @click="addPeriodEntry(period.id, day.id)"
                        >
                            <div 
                                v-if="getPeriodEntry(period.id, day.id)"
                                class="period-entry"
                            >
                                {{ getPeriodEntry(period.id, day.id).title }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Time View -->
            <div v-if="viewMode === 'time'" class="time-view">
                <div class="time-grid">
                    <div class="time-header">
                        <div class="time-cell time-label">Time</div>
                        <div 
                            v-for="day in days" 
                            :key="day.id" 
                            class="time-cell day-header"
                        >
                            {{ day.name }}
                        </div>
                    </div>
                    <div 
                        v-for="timeSlot in timeSlots" 
                        :key="timeSlot.id" 
                        class="time-row"
                    >
                        <div class="time-cell time-label">{{ timeSlot.time }}</div>
                        <div 
                            v-for="day in days" 
                            :key="`${timeSlot.id}-${day.id}`" 
                            class="time-cell time-slot"
                            @click="addTimeEntry(timeSlot.id, day.id)"
                        >
                            <div 
                                v-if="getTimeEntry(timeSlot.id, day.id)"
                                class="time-entry"
                            >
                                {{ getTimeEntry(timeSlot.id, day.id).title }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Controls -->
            <div class="scheduler-controls">
                <button @click="saveDraft" class="control-btn">Save Draft</button>
                <button @click="publish" class="control-btn primary">Publish</button>
                <div class="entry-count">Entries: {{ entries.length }}</div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'CourseScheduler',
    props: {
        content: { type: Object, required: true },
        wwElementState: { type: Object, required: true },
        /* wwEditor:start */
        wwEditorState: { type: Object, required: true },
        /* wwEditor:end */
    },
    emits: ['update:content:effect', 'update:content', 'element-event'],
    data() {
        return {
            viewMode: 'period',
            entries: [],
            days: [
                { id: 'mon', name: 'Monday' },
                { id: 'tue', name: 'Tuesday' },
                { id: 'wed', name: 'Wednesday' },
                { id: 'thu', name: 'Thursday' },
                { id: 'fri', name: 'Friday' },
            ],
            periods: [
                { id: 'p1', name: 'Period 1' },
                { id: 'p2', name: 'Period 2' },
                { id: 'p3', name: 'Period 3' },
                { id: 'p4', name: 'Period 4' },
                { id: 'p5', name: 'Period 5' },
                { id: 'p6', name: 'Period 6' },
            ],
            timeSlots: [
                { id: 't800', time: '8:00 AM' },
                { id: 't830', time: '8:30 AM' },
                { id: 't900', time: '9:00 AM' },
                { id: 't930', time: '9:30 AM' },
                { id: 't1000', time: '10:00 AM' },
                { id: 't1030', time: '10:30 AM' },
                { id: 't1100', time: '11:00 AM' },
                { id: 't1130', time: '11:30 AM' },
                { id: 't1200', time: '12:00 PM' },
                { id: 't1230', time: '12:30 PM' },
                { id: 't1300', time: '1:00 PM' },
                { id: 't1330', time: '1:30 PM' },
                { id: 't1400', time: '2:00 PM' },
                { id: 't1430', time: '2:30 PM' },
                { id: 't1500', time: '3:00 PM' },
                { id: 't1530', time: '3:30 PM' },
                { id: 't1600', time: '4:00 PM' },
                { id: 't1630', time: '4:30 PM' },
            ],
        };
    },
    computed: {
        schoolId() {
            return this.content.schoolId || 'demo-school';
        },
        draftId() {
            return this.content.draftId || 'demo-draft';
        },
        publishedBy() {
            return this.content.publishedBy || null;
        },
    },
    methods: {
        setViewMode(mode) {
            this.viewMode = mode;
        },
        addPeriodEntry(periodId, dayId) {
            const existingIndex = this.entries.findIndex(
                entry => entry.periodId === periodId && entry.dayId === dayId
            );
            
            if (existingIndex >= 0) {
                // Remove existing entry
                this.entries.splice(existingIndex, 1);
            } else {
                // Add new entry
                this.entries.push({
                    id: `entry-${Date.now()}`,
                    periodId,
                    dayId,
                    title: `Course ${this.entries.length + 1}`,
                    type: 'period'
                });
            }
        },
        addTimeEntry(timeSlotId, dayId) {
            const existingIndex = this.entries.findIndex(
                entry => entry.timeSlotId === timeSlotId && entry.dayId === dayId
            );
            
            if (existingIndex >= 0) {
                // Remove existing entry
                this.entries.splice(existingIndex, 1);
            } else {
                // Add new entry
                this.entries.push({
                    id: `entry-${Date.now()}`,
                    timeSlotId,
                    dayId,
                    title: `Course ${this.entries.length + 1}`,
                    type: 'time'
                });
            }
        },
        getPeriodEntry(periodId, dayId) {
            return this.entries.find(
                entry => entry.periodId === periodId && entry.dayId === dayId
            );
        },
        getTimeEntry(timeSlotId, dayId) {
            return this.entries.find(
                entry => entry.timeSlotId === timeSlotId && entry.dayId === dayId
            );
        },
        saveDraft() {
            console.log('Draft saved:', {
                schoolId: this.schoolId,
                draftId: this.draftId,
                entries: this.entries
            });
            alert('Draft saved successfully!');
        },
        publish() {
            console.log('Schedule published:', {
                schoolId: this.schoolId,
                draftId: this.draftId,
                publishedBy: this.publishedBy,
                entries: this.entries
            });
            alert('Schedule published successfully!');
        }
    }
};
</script>

<style lang="scss" scoped>
.course-scheduler-wrapper {
    width: 100%;
    min-height: 600px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.scheduler-container {
    background: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.scheduler-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    
    h2 {
        margin: 0;
        color: #333;
    }
}

.view-toggle {
    display: flex;
    gap: 8px;
}

.toggle-btn {
    padding: 8px 16px;
    border: 2px solid #ddd;
    background: white;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover {
        border-color: #007bff;
    }
    
    &.active {
        background: #007bff;
        color: white;
        border-color: #007bff;
    }
}

.period-grid, .time-grid {
    border: 1px solid #ddd;
    border-radius: 4px;
    overflow: hidden;
}

.period-header, .time-header, .period-row, .time-row {
    display: flex;
}

.period-cell, .time-cell {
    flex: 1;
    padding: 12px;
    border-right: 1px solid #ddd;
    border-bottom: 1px solid #ddd;
    
    &:last-child {
        border-right: none;
    }
    
    &.period-label, &.time-label {
        flex: 0 0 100px;
        background: #f8f9fa;
        font-weight: 600;
        text-align: center;
    }
    
    &.day-header {
        background: #f8f9fa;
        font-weight: 600;
        text-align: center;
    }
    
    &.period-slot, &.time-slot {
        cursor: pointer;
        min-height: 40px;
        transition: background-color 0.2s;
        
        &:hover {
            background: #f0f8ff;
        }
    }
}

.period-entry, .time-entry {
    background: #007bff;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    text-align: center;
    font-size: 12px;
    font-weight: 500;
}

.scheduler-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 20px;
    padding: 16px;
    background: #f8f9fa;
    border-radius: 4px;
}

.control-btn {
    padding: 8px 16px;
    border: 1px solid #ddd;
    background: white;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover {
        background: #f8f9fa;
    }
    
    &.primary {
        background: #28a745;
        color: white;
        border-color: #28a745;
        
        &:hover {
            background: #218838;
        }
    }
}

.entry-count {
    font-weight: 600;
    color: #666;
}
</style>