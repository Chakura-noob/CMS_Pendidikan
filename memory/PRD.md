# Nusantara SMP E-Learning CMS/LMS — PRD

## Original problem statement
Junior High School (SMP) E-Learning CMS/LMS prototype with three roles: Admin, Teacher, Student.
No public registration. No custom video infrastructure. No parent accounts. Design must be easy to port later to Native PHP + MySQL + XAMPP.

## Tech stack
- Backend: FastAPI + Motor (MongoDB) + JWT + pandas/openpyxl for Excel export
- Frontend: React (CRA + Craco), lucide-react icons, axios
- Auth: JWT stored in localStorage; role checked on every protected endpoint

## Core requirements (static)
- Three roles: Admin, Teacher, Student. Only Admin creates users.
- Academic Period: single active period at a time; historical periods retained.
- Admin CRUD: periods, classes, subjects, teachers, students, teaching assignments.
- Teacher: publish materials, build multiple-choice quizzes (server-scored), create file-submission assignments, grade with feedback (final = 0.6*quiz + 0.4*assignment), record attendance (Hadir/Izin/Sakit/Alpa), create PJJ sessions with external meeting URLs, export grades to real .xlsx.
- Student: view active period, materials, take quizzes with auto scoring, submit files, see persistent submission status with final score/feedback, attendance summary, PJJ join links, notifications with mark-as-read.

## User personas
- **Admin (Drs. Budi Santoso)** — school administrator managing master data
- **Teacher (Siti Rahma)** — classroom teacher for VIII-A / VIII-B Mathematics
- **Student (Ahmad Pratama)** — VIII-A student

## What's been implemented (Feb 2026)
- Authentication + role-based dashboards + sidebar/topbar with active period badge
- Admin master-data CRUD for periods (with Activate button, single-active enforced), classes, subjects, teachers, students, teaching assignments
- Teacher: My Classes with material upload / quiz builder (multi-question) / assignment create; Attendance recorder (class+subject+date+per-student status); Grade Reports with inline score+feedback and real .xlsx download; PJJ session creator; Profile
- Student: Dashboard with attendance summary, subjects & materials list, quiz taking + auto score, assignment submission with persistent status showing final grade + feedback, PJJ list with join links, dedicated Attendance page, Profile
- Notifications with in-app mark-as-read (real API, no DOM hacks)
- Real xlsx export via pandas + openpyxl with columns: No, NIS, NISN, Student Name, Quiz Score, Assignment Score, Final Score

## Testing status
- iteration_5: backend 16/16 passing, frontend 95% (all requested flows). MEDIUM bug (period title fallback) fixed post-report.

## Backlog / Next tasks
- **P1** Split App.js (>1000 lines) into per-role folders for maintainability before PHP port
- **P1** Add filters on Teacher Grade Reports (class + subject + academic period)
- **P2** Support inline preview for PDF materials
- **P2** Enable Admin to edit/deactivate teachers & students (current UI is create-only)
- **P2** Attendance history table for teacher view
