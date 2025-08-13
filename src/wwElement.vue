<template>
    <div class="course-scheduler-wrapper">
        <div class="scheduler-header">
            <h2>Course Scheduler</h2>
            <div class="scheduler-info">
                <span class="info-item">Periods: {{ periods.length }}</span>
                <span class="info-item">Courses: {{ courses.length }}</span>
                <span class="info-item">Teachers: {{ teachers.length }}</span>
                <span class="info-item">Classes: {{ classes.length }}</span>
                <span class="info-item">Rooms: {{ rooms.length }}</span>
            </div>
        </div>

        <div class="scheduler-content">
            <div class="data-summary">
                <div class="summary-section">
                    <h3>Available Data</h3>
                    <div class="data-grid">
                        <div v-if="periods.length > 0" class="data-category">
                            <h4>Periods ({{ periods.length }})</h4>
                            <div class="data-items">
                                <span v-for="period in periods.slice(0, 3)" :key="period.id" class="data-item">
                                    {{ period.name || period.id }}
                                </span>
                                <span v-if="periods.length > 3" class="data-item">
                                    +{{ periods.length - 3 }} more
                                </span>
                            </div>
                        </div>

                        <div v-if="courses.length > 0" class="data-category">
                            <h4>Courses ({{ courses.length }})</h4>
                            <div class="data-items">
                                <span
                                    v-for="course in courses.slice(0, 3)"
                                    :key="course.id"
                                    class="data-item course-item"
                                    :style="{ backgroundColor: course.color || '#e0e0e0' }"
                                >
                                    {{ course.name || course.id }}
                                </span>
                                <span v-if="courses.length > 3" class="data-item">
                                    +{{ courses.length - 3 }} more
                                </span>
                            </div>
                        </div>

                        <div v-if="teachers.length > 0" class="data-category">
                            <h4>Teachers ({{ teachers.length }})</h4>
                            <div class="data-items">
                                <span
                                    v-for="teacher in teachers.slice(0, 3)"
                                    :key="teacher.id"
                                    class="data-item teacher-item"
                                    :style="{ backgroundColor: teacher.color || '#e0e0e0' }"
                                >
                                    {{ teacher.name || teacher.id }}
                                </span>
                                <span v-if="teachers.length > 3" class="data-item">
                                    +{{ teachers.length - 3 }} more
                                </span>
                            </div>
                        </div>

                        <div v-if="classes.length > 0" class="data-category">
                            <h4>Classes ({{ classes.length }})</h4>
                            <div class="data-items">
                                <span
                                    v-for="cls in classes.slice(0, 3)"
                                    :key="cls.id"
                                    class="data-item class-item"
                                    :style="{ backgroundColor: cls.color || '#e0e0e0' }"
                                >
                                    {{ cls.name || cls.id }}
                                </span>
                                <span v-if="classes.length > 3" class="data-item">
                                    +{{ classes.length - 3 }} more
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="summary-section">
                    <h3>Current Schedules</h3>
                    <div class="schedules-info">
                        <div class="schedule-type">
                            <strong>Draft Schedules:</strong> {{ draftSchedules.length }} entries
                        </div>
                        <div class="schedule-type">
                            <strong>Live Schedules:</strong> {{ liveSchedules.length }} entries
                        </div>
                    </div>
                </div>

                <div class="actions-section">
                    <button @click="emitTestEvent" class="test-button">Test Event Emission</button>
                    <button @click="showDetails = !showDetails" class="toggle-button">
                        {{ showDetails ? 'Hide' : 'Show' }} Details
                    </button>
                </div>

                <div v-if="showDetails" class="details-section">
                    <h3>Detailed Data</h3>
                    <div class="details-content">
                        <pre>{{ {
                            schoolId,
                            draftId,
                            publishedBy,
                            periodsCount: periods.length,
                            coursesCount: courses.length,
                            teachersCount: teachers.length,
                            classesCount: classes.length,
                            roomsCount: rooms.length,
                            draftSchedulesCount: draftSchedules.length,
                            liveSchedulesCount: liveSchedules.length
                        } }}</pre>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'CourseScheduler',
    props: {
        content: {
            type: Object,
            required: true,
            default: () => ({
                schoolId: null,
                draftId: null,
                publishedBy: null,
                periods: [],
                courses: [],
                teachers: [],
                classes: [],
                rooms: [],
                schoolDays: [],
                draftSchedules: [],
                liveSchedules: [],
            }),
        },
        wwElementState: { type: Object, required: true },
        /* wwEditor:start */
        wwEditorState: { type: Object, required: true },
        /* wwEditor:end */
    },
    data() {
        return {
            showDetails: false,
        };
    },
    computed: {
        schoolId() {
            return this.content.schoolId || 'No School ID';
        },
        draftId() {
            return this.content.draftId || 'No Draft ID';
        },
        publishedBy() {
            return this.content.publishedBy || 'Not Published';
        },
        periods() {
            return this.content.periods || [];
        },
        courses() {
            return this.content.courses || [];
        },
        teachers() {
            return this.content.teachers || [];
        },
        classes() {
            return this.content.classes || [];
        },
        rooms() {
            return this.content.rooms || [];
        },
        schoolDays() {
            return this.content.schoolDays || [];
        },
        draftSchedules() {
            return this.content.draftSchedules || [];
        },
        liveSchedules() {
            return this.content.liveSchedules || [];
        },
    },
    methods: {
        emitTestEvent() {
            try {
                // Test event emission
                this.$emit('trigger-event', {
                    name: 'testEvent',
                    event: {
                        message: 'Course Scheduler component is working!',
                        timestamp: new Date().toISOString(),
                        data: {
                            periods: this.periods.length,
                            courses: this.courses.length,
                            teachers: this.teachers.length,
                        },
                    },
                });
                alert('Test event emitted successfully!');
            } catch (error) {
                console.error('Error emitting event:', error);
                alert('Error emitting event: ' + error.message);
            }
        },
    },
};
</script>

<style lang="scss" scoped>
.course-scheduler-wrapper {
    width: 100%;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.scheduler-header {
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid #e0e0e0;

    h2 {
        margin: 0 0 10px 0;
        color: #333;
    }

    .scheduler-info {
        display: flex;
        gap: 15px;
        flex-wrap: wrap;

        .info-item {
            padding: 4px 8px;
            background-color: #f5f5f5;
            border-radius: 4px;
            font-size: 0.9em;
            color: #666;
        }
    }
}

.scheduler-content {
    .data-summary {
        .summary-section {
            margin-bottom: 25px;

            h3 {
                margin: 0 0 15px 0;
                color: #333;
                font-size: 1.2em;
            }

            .data-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 15px;
            }

            .data-category {
                padding: 15px;
                background-color: #f9f9f9;
                border-radius: 8px;
                border: 1px solid #e0e0e0;

                h4 {
                    margin: 0 0 10px 0;
                    color: #555;
                    font-size: 1em;
                }

                .data-items {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;

                    .data-item {
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 0.85em;
                        color: #333;

                        &.course-item,
                        &.teacher-item,
                        &.class-item {
                            color: white;
                            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
                        }

                        &:not(.course-item):not(.teacher-item):not(.class-item) {
                            background-color: #e0e0e0;
                        }
                    }
                }
            }

            .schedules-info {
                padding: 15px;
                background-color: #f0f8ff;
                border-radius: 8px;
                border: 1px solid #b0d4ff;

                .schedule-type {
                    margin-bottom: 8px;
                    color: #333;

                    &:last-child {
                        margin-bottom: 0;
                    }
                }
            }
        }

        .actions-section {
            margin: 20px 0;
            display: flex;
            gap: 10px;

            .test-button,
            .toggle-button {
                padding: 10px 16px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.9em;
                transition: background-color 0.2s;

                &.test-button {
                    background-color: #007cba;
                    color: white;

                    &:hover {
                        background-color: #005a87;
                    }
                }

                &.toggle-button {
                    background-color: #6c757d;
                    color: white;

                    &:hover {
                        background-color: #545b62;
                    }
                }
            }
        }

        .details-section {
            padding: 20px;
            background-color: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #dee2e6;

            h3 {
                margin: 0 0 15px 0;
                color: #333;
            }

            .details-content {
                pre {
                    background-color: #ffffff;
                    padding: 15px;
                    border-radius: 4px;
                    border: 1px solid #e0e0e0;
                    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                    font-size: 0.85em;
                    overflow-x: auto;
                    margin: 0;
                    white-space: pre-wrap;
                }
            }
        }
    }
}

@media (max-width: 768px) {
    .course-scheduler-wrapper {
        padding: 15px;
    }

    .scheduler-info {
        .info-item {
            font-size: 0.8em;
        }
    }

    .data-grid {
        grid-template-columns: 1fr;
    }

    .actions-section {
        flex-direction: column;

        .test-button,
        .toggle-button {
            width: 100%;
        }
    }
}
</style>
