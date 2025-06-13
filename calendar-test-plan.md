# Calendar Integration Testing Plan

## Critical Issues Found & Fixes Needed

### 🔴 HIGH PRIORITY FIXES

1. **Time Zone Format Issue**
   - Current: Uses `toISOString()` which outputs UTC
   - Problem: Calendar apps may misinterpret times
   - Fix: Use proper TZID format in iCal

2. **Professional Privacy Missing**
   - Current: Shows "Fajr Prayer", "Dhuhr Prayer" 
   - Problem: Not workplace-appropriate for discrete professionals
   - Fix: Add option for "Personal Time" with private descriptions

3. **DST Handling**
   - Current: May not handle daylight saving transitions correctly
   - Fix: Use proper timezone libraries and test across DST boundaries

### 📋 TESTING MATRIX

#### Test Environments:
- **Google Calendar**: Web, Android, iOS
- **Outlook**: Web (outlook.com), Desktop 2021+, Mobile
- **Apple Calendar**: macOS, iOS

#### Test Scenarios:
1. **Basic Import Test**: Today's prayers
2. **Time Zone Test**: Generate in EST, import in PST
3. **DST Transition Test**: Generate calendar spanning DST change
4. **Duration Test**: 15min, 30min, 60min prayer blocks
5. **Professional Mode Test**: "Personal Time" vs "Prayer" titles
6. **Reminder Test**: 5min, 10min, 15min reminders
7. **Recurring vs One-time**: Weekly export vs daily

#### Success Criteria:
✅ Times display correctly in local timezone
✅ No overlap with existing calendar events
✅ Reminders work as expected
✅ Professional descriptions when enabled
✅ Clean import with no errors/warnings
✅ All 5 daily prayers appear
✅ Proper duration (not all-day events)

### 🚨 IMMEDIATE FIXES NEEDED

1. **Fix timezone handling in iCal output**
2. **Add professional/discrete mode**
3. **Improve UID generation for reliability**
4. **Add timezone validation**

### Testing URLs:
- Staging: https://prayersync-3shhsuoer-gfarooqis-projects.vercel.app
- Test files will be generated and tested across platforms

### Next Steps:
1. Implement fixes
2. Generate test calendar files
3. Test import across all platforms
4. Document any platform-specific quirks
5. Create troubleshooting guide for users