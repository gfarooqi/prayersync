# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a Salat Planner web application that helps Muslims track and plan their 5 daily prayers with calendar integration features.

## Project Structure

- `index.html` - Main HTML file with the app UI
- `styles.css` - All styling for the application
- `script.js` - Core JavaScript logic including:
  - Prayer time calculations
  - Calendar integration (iCal export)
  - Location services
  - Local storage for settings and prayer tracking
  - Notification system
- `manifest.json` - PWA manifest for app installation
- `service-worker.js` - Offline functionality
- `README.md` - User documentation

## Key Features

1. **Prayer Time Calculation**: Uses astronomical calculations with multiple calculation methods
2. **Calendar Integration**: Exports prayer times as .ics files compatible with all major calendar apps
3. **Progressive Web App**: Can be installed and works offline
4. **Notifications**: Browser-based prayer reminders

## Development Commands

This is a static web app with no build process required. To run:
1. Open `index.html` in a web browser
2. For development, use a local web server (e.g., `python -m http.server 8000`)

## Architecture Notes

- **No Framework Dependencies**: Pure JavaScript implementation for maximum compatibility
- **Client-Side Only**: All calculations done in browser, no server required
- **Local Storage**: Used for settings persistence and prayer tracking
- **Geolocation API**: For automatic location detection
- **Service Worker**: Enables offline functionality

## Important Considerations

- The Google Calendar integration requires setting up Google OAuth credentials
- The app uses the browser's Notification API which requires HTTPS in production
- Prayer calculations are based on astronomical formulas and may need adjustment based on local practices