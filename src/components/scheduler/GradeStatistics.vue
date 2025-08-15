<template>
    <div v-if="showStatistics && focusedPeriodId" class="grade-statistics">
        <div class="statistics-header">
            <h3>📊 Grade Statistics for {{ getFocusedPeriodName() }}</h3>
        </div>
        
        <!-- Daily Grade Statistics -->
        <div class="daily-stats-container">
            <div v-for="day in visibleDays" :key="day.id" class="day-stats">
                <h4 class="day-title">{{ day.name }}</h4>
                <div class="grade-stats-grid">
                    <div v-for="gradeStats in getDailyGradeStats(day.id)" :key="`${day.id}-${gradeStats.grade}`" class="grade-stat-card">
                        <div class="grade-label">Grade {{ gradeStats.grade }}</div>
                        <div class="stat-row">
                            <span class="stat-label">Total Spots:</span>
                            <span class="stat-value">{{ gradeStats.totalSpots }}</span>
                        </div>
                        <div class="stat-row" v-if="gradeStats.averageSpots !== gradeStats.totalSpots">
                            <span class="stat-label">Avg Spots:</span>
                            <span class="stat-value">{{ gradeStats.averageSpots.toFixed(1) }}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Courses:</span>
                            <span class="stat-value">{{ gradeStats.coursesCount }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Weekly Summary -->
        <div class="weekly-summary">
            <h4>📅 Weekly Summary</h4>
            <div class="weekly-stats-grid">
                <div v-for="weeklyStats in getWeeklySummary()" :key="`weekly-${weeklyStats.grade}`" class="weekly-stat-card">
                    <div class="grade-label">Grade {{ weeklyStats.grade }}</div>
                    <div class="stat-row">
                        <span class="stat-label">Total Spots (Week):</span>
                        <span class="stat-value">{{ weeklyStats.totalWeeklySpots }}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Total Courses (Week):</span>
                        <span class="stat-value">{{ weeklyStats.totalWeeklyCourses }}</span>
                    </div>
                </div>
                <div class="overall-summary">
                    <div class="grade-label">All Grades Combined</div>
                    <div class="stat-row">
                        <span class="stat-label">Grand Total Spots:</span>
                        <span class="stat-value bold">{{ getGrandTotalSpots() }}</span>
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

        // Get all unique grades from all courses
        const allGrades = computed(() => {
            const gradesSet = new Set();
            
            safeArray(props.courses).forEach(course => {
                const courseGrades = parseGrades(course);
                courseGrades.forEach(grade => gradesSet.add(grade));
            });
            
            return Array.from(gradesSet).sort((a, b) => a - b);
        });

        // Calculate daily grade statistics for a specific day
        function getDailyGradeStats(dayId) {
            if (!props.focusedPeriodId) return [];
            
            const availableCourses = props.getAvailableCoursesForSlot(dayId, props.focusedPeriodId);
            const gradeStats = [];

            allGrades.value.forEach(grade => {
                let totalSpots = 0;
                let coursesCount = 0;
                let totalGradeAllocation = 0; // For calculating average

                availableCourses.forEach(course => {
                    const courseGrades = parseGrades(course);
                    if (courseGrades.includes(grade)) {
                        coursesCount++;
                        const maxStudents = course.max_students || course.capacity || 0;
                        
                        if (courseGrades.length === 1) {
                            // Course is exclusively for this grade
                            totalSpots += maxStudents;
                            totalGradeAllocation += maxStudents;
                        } else {
                            // Course is shared between multiple grades
                            const spotsPerGrade = maxStudents / courseGrades.length;
                            totalSpots += maxStudents; // Total spots available for this grade
                            totalGradeAllocation += spotsPerGrade; // Average spots allocated to this grade
                        }
                    }
                });

                if (coursesCount > 0) {
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

        // Calculate weekly summary across all days
        function getWeeklySummary() {
            const weeklyStats = [];

            allGrades.value.forEach(grade => {
                let totalWeeklySpots = 0;
                let totalWeeklyCourses = 0;
                
                props.visibleDays.forEach(day => {
                    const dailyStats = getDailyGradeStats(day.id);
                    const gradeDaily = dailyStats.find(s => s.grade === grade);
                    if (gradeDaily) {
                        totalWeeklySpots += gradeDaily.totalSpots;
                        totalWeeklyCourses += gradeDaily.coursesCount;
                    }
                });

                if (totalWeeklyCourses > 0) {
                    weeklyStats.push({
                        grade,
                        totalWeeklySpots,
                        totalWeeklyCourses,
                    });
                }
            });

            return weeklyStats;
        }

        // Calculate grand total spots across all grades
        function getGrandTotalSpots() {
            return getWeeklySummary().reduce((total, stats) => total + stats.totalWeeklySpots, 0);
        }

        return {
            allGrades,
            getDailyGradeStats,
            getWeeklySummary,
            getGrandTotalSpots,
            safeLength,
        };
    },
};
</script>

<style scoped>
.grade-statistics {
    padding: 16px;
    background: #f0f8ff;
    border-top: 2px solid #007cba;
    border-radius: 0 0 6px 6px;
    margin-top: 8px;
}

.statistics-header h3 {
    margin: 0 0 16px 0;
    color: #007cba;
    font-size: 1.1em;
    text-align: center;
}

.daily-stats-container {
    margin-bottom: 24px;
}

.day-stats {
    margin-bottom: 20px;
}

.day-title {
    margin: 0 0 12px 0;
    padding: 8px 16px;
    background: #007cba;
    color: white;
    border-radius: 4px;
    text-align: center;
    font-size: 0.95em;
}

.grade-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
}

.grade-stat-card,
.weekly-stat-card {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.grade-label {
    font-weight: bold;
    color: #333;
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid #f0f0f0;
    font-size: 0.9em;
}

.stat-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
    font-size: 0.85em;
}

.stat-label {
    color: #666;
    font-weight: normal;
}

.stat-value {
    font-weight: 500;
    color: #333;
}

.stat-value.bold {
    font-weight: bold;
    color: #007cba;
    font-size: 1.1em;
}

.weekly-summary {
    border-top: 1px solid #ddd;
    padding-top: 16px;
}

.weekly-summary h4 {
    margin: 0 0 16px 0;
    color: #007cba;
    font-size: 1em;
    text-align: center;
}

.weekly-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
}

.overall-summary {
    background: linear-gradient(135deg, #007cba 0%, #005c8a 100%);
    color: white;
    border: none;
    box-shadow: 0 2px 6px rgba(0, 124, 186, 0.3);
}

.overall-summary .grade-label {
    color: white;
    border-bottom-color: rgba(255, 255, 255, 0.3);
}

.overall-summary .stat-label {
    color: rgba(255, 255, 255, 0.9);
}

.overall-summary .stat-value {
    color: white;
    font-weight: bold;
}

/* Responsive Design */
@media (max-width: 768px) {
    .grade-stats-grid,
    .weekly-stats-grid {
        grid-template-columns: 1fr;
    }
    
    .grade-statistics {
        padding: 12px;
    }
}
</style>