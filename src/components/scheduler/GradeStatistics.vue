<template>
    <div v-if="showStatistics && focusedPeriodId" class="grade-statistics">
        <!-- Compact Statistics Display -->
        <div class="compact-stats-container">
            <div v-for="day in visibleDays" :key="day.id" class="day-compact-stats">
                <h4 class="day-title">{{ day.name }}</h4>
                <div class="stats-row">
                    <div
                        v-for="gradeStats in getDailyGradeStats(day.id)"
                        :key="`${day.id}-${gradeStats.grade}`"
                        class="grade-compact-stat"
                    >
                        <div class="grade-number">{{ gradeStats.grade }}:</div>
                        <div class="stats-icons">
                            <span class="stat-icon" :title="`📊 Total free spots: ${gradeStats.totalSpots}`">{{
                                gradeStats.totalSpots
                            }}</span>
                            <span
                                class="stat-icon"
                                :title="`⚖️ Average spots available: ${gradeStats.averageSpots.toFixed(1)}`"
                                >{{ gradeStats.averageSpots.toFixed(1) }}</span
                            >
                            <span class="stat-icon" :title="`📚 Amount of courses: ${gradeStats.coursesCount}`">{{
                                gradeStats.coursesCount
                            }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { computed } from 'vue';
import { safeLength, safeArray } from '../../utils/arrayUtils.js';

export default {
    name: 'GradeStatistics',
    props: {
        // Data props
        courses: { type: Array, default: () => [] },
        draftSchedules: { type: Array, default: () => [] },
        visibleDays: { type: Array, default: () => [] },
        periods: { type: Array, default: () => [] },
        focusedPeriodId: { type: String, default: null },
        showStatistics: { type: Boolean, default: true },

        // Functions passed from parent
        getAvailableCoursesForSlot: { type: Function, required: true },
        getFocusedPeriodName: { type: Function, required: true },
    },

    setup(props) {
        // Parse grade from is_for_year_g object
        function parseGrades(course) {
            const grades = [];

            if (course.is_for_year_g && typeof course.is_for_year_g === 'object') {
                // Handle format like { 0: 6, 1: 5, 2: 4 } where keys are indices and values are grades
                for (const [index, grade] of Object.entries(course.is_for_year_g)) {
                    if (grade && grade > 0) {
                        grades.push(Number(grade));
                    }
                }
            } else if (course.is_for_year_groups && Array.isArray(course.is_for_year_groups)) {
                // Handle array format like [4, 5, 6]
                grades.push(...course.is_for_year_groups.map(g => Number(g)).filter(g => g > 0));
            } else if (course.year_groups && Array.isArray(course.year_groups)) {
                // Handle alternative year_groups format
                grades.push(...course.year_groups.map(g => Number(g)).filter(g => g > 0));
            }

            return [...new Set(grades)].sort((a, b) => a - b); // Remove duplicates and sort
        }

        // Find course by courseId in courses array
        function findCourseById(courseId) {
            return safeArray(props.courses).find(course => course.id === courseId);
        }

        // Get scheduled courses for a specific day and period from draft schedules
        function getScheduledCoursesForSlot(dayId, periodId) {
            const scheduledCourses = [];

            // Find all draft schedule entries for this specific day and period
            const scheduledEntries = safeArray(props.draftSchedules).filter(
                entry => entry.day_id === dayId && entry.period_id === periodId
            );

            // For each scheduled entry, find the corresponding course and calculate remaining spots
            scheduledEntries.forEach(entry => {
                const course = findCourseById(entry.course_id);
                if (course) {
                    // Calculate remaining spots (free_spaces if available, otherwise max_students)
                    const totalSpots = course.max_students || course.capacity || 0;
                    const usedSpots = 0; // For now, assume all spots are available as we're looking at free_spaces
                    const freeSpots = entry.free_spaces !== undefined ? entry.free_spaces : totalSpots;

                    scheduledCourses.push({
                        ...course,
                        scheduledEntry: entry,
                        freeSpots: freeSpots,
                        totalSpots: totalSpots,
                    });
                }
            });

            return scheduledCourses;
        }

        // Get all unique grades from all courses
        const allGrades = computed(() => {
            const gradesSet = new Set();

            safeArray(props.courses).forEach(course => {
                const courseGrades = parseGrades(course);
                courseGrades.forEach(grade => gradesSet.add(grade));
            });

            return Array.from(gradesSet).sort((a, b) => a - b);
        });

        // Calculate daily grade statistics for a specific day using draft schedules
        function getDailyGradeStats(dayId) {
            if (!props.focusedPeriodId) return [];

            // Get courses that are actually scheduled in this day/period from draft schedules
            const scheduledCourses = getScheduledCoursesForSlot(dayId, props.focusedPeriodId);
            const gradeStats = [];

            allGrades.value.forEach(grade => {
                let totalSpots = 0;
                let coursesCount = 0;
                let totalGradeAllocation = 0; // For calculating average

                scheduledCourses.forEach(course => {
                    const courseGrades = parseGrades(course);
                    if (courseGrades.includes(grade)) {
                        coursesCount++;
                        const freeSpots = course.freeSpots || 0;

                        if (courseGrades.length === 1) {
                            // Course is exclusively for this grade
                            totalSpots += freeSpots;
                            totalGradeAllocation += freeSpots;
                        } else {
                            // Course is shared between multiple grades
                            const spotsPerGrade = freeSpots / courseGrades.length;
                            totalSpots += freeSpots; // Total spots available for this grade
                            totalGradeAllocation += spotsPerGrade; // Average spots allocated to this grade
                        }
                    }
                });

                if (coursesCount > 0 || totalSpots > 0) {
                    gradeStats.push({
                        grade,
                        totalSpots,
                        averageSpots: totalGradeAllocation,
                        coursesCount,
                    });
                }
            });

            return gradeStats;
        }

        return {
            allGrades,
            getDailyGradeStats,
            safeLength,
        };
    },
};
</script>

<style scoped>
.grade-statistics {
    padding: 8px 16px;
    background: #f0f8ff;
    border-top: 2px solid #007cba;
    border-radius: 0 0 6px 6px;
    margin-top: 8px;
}

.compact-stats-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.day-compact-stats {
    display: flex;
    flex-direction: column;
}

.day-title {
    margin: 0 0 4px 0;
    padding: 4px 12px;
    background: #007cba;
    color: white;
    border-radius: 3px;
    text-align: center;
    font-size: 0.85em;
    font-weight: 500;
}

.stats-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
}

.grade-compact-stat {
    display: flex;
    align-items: center;
    gap: 4px;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 0.8em;
}

.grade-number {
    font-weight: 600;
    color: #333;
    min-width: 20px;
}

.stats-icons {
    display: flex;
    gap: 6px;
}

.stat-icon {
    padding: 2px 4px;
    background: #f8f9fa;
    border-radius: 2px;
    font-size: 0.75em;
    color: #666;
    cursor: help;
    transition: background-color 0.2s ease;
}

.stat-icon:hover {
    background: #e9ecef;
    color: #333;
}

/* Responsive Design */
@media (max-width: 768px) {
    .grade-statistics {
        padding: 6px 12px;
    }

    .stats-row {
        flex-direction: column;
        align-items: stretch;
    }

    .grade-compact-stat {
        justify-content: space-between;
    }
}
</style>
