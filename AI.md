---
name: course-scheduler
description: A comprehensive course scheduling system with period and time views, conflict checking, and publishing capabilities.
keywords:
- scheduler
- course
- timetable
- calendar
- education
- period
- time
- schedule
---

#### CourseScheduler

***Purpose:***
A flexible course scheduling system that allows educational institutions to create, manage, and publish course schedules with both period-based and time-based views.

***Features:***
- Toggle between Period view (structured time blocks) and Time view (custom time blocks)
- Drag-and-drop interface for creating time-based entries
- Click-to-add interface for period-based entries
- Conflict detection when scheduling overlapping resources
- Draft management with save and publish capabilities
- Filtering by teacher, class, and room
- Keyboard accessibility for navigation and entry creation

***Properties:***
- schoolId: string - UUID of the school for which the schedule is being created
- draftId: string - UUID of the current draft being edited
- publishedBy: string|null - UUID of the user publishing the schedule, or null if not published

***Context data (only accessible to this element and its children):***
- store.viewMode - Current view mode ('period' or 'time')
- store.periods - Array of available periods for the school
- store.entries - Array of schedule entries in the current draft
- store.selectedTeacherIds - Array of currently selected teacher IDs for filtering
- store.selectedClassId - Currently selected class ID for filtering
- store.selectedRoomId - Currently selected room ID for filtering

***Events:***
- add-entry: Triggered when a new entry is added to the schedule
- open-publish-dialog: Triggered when the publish dialog should be opened

***Exposed Actions:***
- `setViewMode`: Switch between period and time views. Args: mode ('period'|'time')
- `toggleTeacher`: Toggle selection of a teacher for filtering. Args: teacherId (string)
- `setSelectedClass`: Set the selected class for filtering. Args: classId (string|null)
- `setSelectedRoom`: Set the selected room for filtering. Args: roomId (string|null)
- `clearFilters`: Clear all active filters
- `persistDraft`: Save the current draft to the server
- `publish`: Publish the current draft, making it visible to all users

***Exposed Variables:***
- viewMode: Current view mode ('period' or 'time')
- entries: Array of all schedule entries
- filteredEntries: Array of entries after applying filters
- isDraftSaved: Boolean indicating if the current draft has been saved

***Notes:***
- The component uses Pinia for state management and Axios for API communication
- Mock mode is available for development when backend APIs are not available
- The scheduler supports both structured periods and custom time blocks
- Conflict detection helps prevent double-booking of teachers, classes, or rooms
- All views are responsive and work on both desktop and mobile devices
- Keyboard navigation is supported for accessibility
