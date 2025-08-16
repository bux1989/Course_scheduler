# Course Scheduler - WeWeb Component

A comprehensive Vue 3 Course Scheduler component built for WeWeb platform, providing period-based and time-based scheduling with draft management and conflict resolution.

## 🎯 Features

### ✅ Implemented Features

- **Vue 3 Composition API** - All components use modern Vue 3 syntax
- **Pinia Store** - Centralized state management for schedule data
- **Period Grid View** - Weekly view with periods and clickable cells
- **Time Grid View** - Drag-and-drop time-based scheduling (15-minute intervals)
- **Entry Forms** - Modal dialogs for adding/editing schedule entries
- **Conflict Checking** - API integration for slot validation
- **Draft Management** - Save drafts and publish functionality
- **Filtering** - Teacher, class, and room filters in toolbar
- **Accessibility** - Keyboard navigation and ARIA labels
- **Mock API Mode** - Fallback when backend is unavailable
- **WeWeb Integration** - Custom element wrapper for WeWeb platform
- **Responsive Design** - Mobile-friendly layout

## 🏗️ Component Structure

### Core Components

- **`SchedulerPage.vue`** - Main container with entry forms and dialogs
- **`SchedulerToolbar.vue`** - View toggle, filters, and action buttons
- **`PeriodGrid.vue`** - Period-based weekly grid with clickable cells
- **`TimeGrid.vue`** - Time-based drag-and-drop interface
- **`PublishDialog.vue`** - Publish confirmation modal

### Supporting Infrastructure

- **`src/api/scheduler.js`** - Axios client with mock data support
- **`src/pinia/scheduler.js`** - Pinia store with actions and getters
- **`src/wwElement.vue`** - WeWeb component wrapper
- **`ww-config.js`** - WeWeb component configuration

## 🚀 Usage

### WeWeb Integration

The Course Scheduler is configured as a WeWeb element with the following properties:

- **School ID** (schoolId) - UUID for the school
- **Draft ID** (draftId) - UUID for the draft schedule
- **Published By** (publishedBy) - UUID of the publisher (optional)

### API Endpoints

The component expects the following endpoints:

```javascript
// Get schedule periods
GET /schedule-periods?school_id={schoolId}

// Save draft entries
POST /schedule-drafts/{schoolId}/entries
Body: { draft_id, entries }

// Check slot availability
POST /schedule-drafts/{schoolId}/check-slot
Body: { draft_id, schedule_type, day_id, period_id?, start_time?, end_time?, teacher_ids[], class_id?, room_id? }

// Publish schedule
POST /schedule-drafts/{schoolId}/publish
Body: { draft_id, published_by }
```

### Mock Mode

When APIs are unavailable, enable mock mode in the store:

```javascript
const store = useSchedulerStore();
store.toggleMockMode(); // Enables mock data
```

## 🎮 User Interface

### Period View

- **7-column grid** (Sunday to Saturday) with period rows
- **Click cells** to add/edit schedule entries
- **Visual indicators** for occupied slots
- **Period information** displays time ranges

### Time View

- **Drag to create** time blocks (15-minute snap)
- **Vertical time grid** from 8:00 AM to 5:00 PM
- **Visual time slots** with drag-and-drop functionality
- **Existing entries** displayed as colored blocks

### Toolbar Features

- **View Toggle** - Switch between Period and Time views
- **Teacher Filters** - Click teacher chips to filter
- **Class/Room Filters** - Dropdown selections
- **Save Draft** - Persist changes to backend
- **Publish** - Make schedule visible to users

### Draft Panel

- **Live entry count** and list
- **Edit/Remove** buttons for each entry
- **Real-time updates** as entries are modified

## 🔧 Technical Implementation

### Entry Data Structure

```javascript
{
  "schedule_type": "period" | "adhoc",
  "day_id": 0-6, // Sunday=0, Saturday=6
  "period_id": "uuid|null",
  "start_time": "HH:MM[:SS]|null",
  "end_time": "HH:MM[:SS]|null",
  "course_id": "uuid|null",
  "subject_id": "uuid|null",
  "class_id": "uuid|null",
  "teacher_ids": ["uuid", ...],
  "room_id": "uuid|null",
  "meeting_name": "string|null",
  "notes": "string|null"
}
```

### State Management (Pinia)

- **schoolId, draftId, publishedBy** - Core identifiers
- **viewMode** - 'period' | 'time'
- **periods[]** - Available time periods
- **entries[]** - Current schedule entries
- **selectedTeacherIds[], selectedClassId, selectedRoomId** - Active filters
- **isLoading, error, isDraftSaved** - UI state

### Actions Available

- `initialize(school, draft, publisher)` - Setup component
- `loadPeriods()` - Fetch available periods
- `checkPlacement(payload)` - Validate slot availability
- `upsertEntry(entry)` - Add/update schedule entry
- `removeEntry(index)` - Remove entry
- `persistDraft()` - Save to backend
- `publish()` - Publish schedule
- `setViewMode(mode)` - Toggle views
- `toggleTeacher(id)` - Filter by teacher
- `clearFilters()` - Reset all filters

## 🎯 Demo & Testing

A working demo is available in `test-scheduler.html` which demonstrates:

- **Interactive grid** with clickable cells
- **Entry management** with add/remove functionality
- **Real-time updates** in the draft panel
- **View switching** between Period and Time modes
- **Visual feedback** and hover states

## 🚧 Resolution of "Blank Square" Issue

The original issue mentioned seeing "only a blank square" with "no way to input data." This has been resolved by:

1. **Proper WeWeb Integration** - Updated `wwElement.vue` to correctly render the SchedulerPage component
2. **Component Configuration** - Modified `ww-config.js` to define Course Scheduler properties
3. **State Management** - Ensured Pinia store integration works in WeWeb environment
4. **Mock Data** - Provided fallback data when APIs are unavailable
5. **Visual Testing** - Created demo to verify full functionality

The scheduler now provides a rich, interactive interface with multiple input methods and comprehensive schedule management capabilities.

## 📱 Accessibility Features

- **Keyboard Navigation** - Full keyboard support for all interactions
- **ARIA Labels** - Proper screen reader support
- **Focus Management** - Clear focus indicators
- **Semantic HTML** - Proper heading hierarchy and roles
- **Live Regions** - Announcements for dynamic content changes

## 🔄 Build & Development

```bash
# Install dependencies
npm install

# For WeWeb development
npm run serve --port=[PORT]
# Then go to WeWeb editor, open developer popup and add your custom element

# Build for production
npm run build --name=course-scheduler

# For standalone testing, serve test-scheduler.html
python3 -m http.server 8080
```

The Course Scheduler is now fully functional and resolves the original "blank square" issue with a comprehensive scheduling interface.
