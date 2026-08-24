import client from './client'

// --- Auth ---
export const signup = (data) => client.post('/signup', data)
export const login = (data) => client.post('/login', data)

// --- Subjects ---
export const getSubjects = () => client.get('/subjects')
export const createSubject = (data) => client.post('/subjects', data)
export const deleteSubject = (id) => client.delete(`/subjects/${id}`)
export const getSubjectPercentage = (id) => client.get(`/subjects/${id}/percentage`)

// --- Timetable ---
export const getTimetable = () => client.get('/timetable')
export const createTimetableSlot = (data) => client.post('/timetable', data)
export const deleteTimetableSlot = (id) => client.delete(`/timetable/${id}`)

// --- Attendance ---
export const getAttendance = () => client.get('/attendance')
export const markAttendance = (data) => client.post('/attendance', data)
export const deleteAttendance = (id) => client.delete(`/attendance/${id}`)