# Smart Attendance Tracker

A full-stack web application that helps students track class attendance, manage their weekly timetable, and stay on top of attendance percentage requirements. Built to eliminate manual attendance calculation and give students clear, actionable insight into how many classes they can afford to miss.

## Live Demo

- Frontend: https://student-attendance-tracker-1-ipw0.onrender.com
- Backend API docs: https://student-attendance-tracker-i567.onrender.com/docs

Note: the backend runs on Render's free tier, so the first request after a period of inactivity may take 30-50 seconds while the server wakes up.

## Overview

Students set up their weekly timetable once, including regular classes and lab sessions, and then mark attendance directly from that timetable each day. The app automatically calculates attendance percentage per subject, excludes cancelled classes from the calculation, and shows how many classes can be missed or must be attended to reach a target percentage. Push notifications remind students of upcoming classes.

## Features

- Secure user authentication with JWT-based sessions
- Weekly timetable management, with separate handling for lecture and lab sessions
- Tick-based attendance marking directly from the timetable view
- Support for unplanned or extra classes outside the regular timetable
- Automatic attendance percentage calculation, with cancelled classes excluded
- Per-subject target attendance percentage, with live classes-needed and classes-can-skip calculations
- Browser push notifications 

## Status

Actively used and maintained. Found a bug or have a feature suggestion? Feel free to open an issue on this repo.
