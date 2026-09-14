# Nusantara SMP E-Learning CMS Prototype

## Original problem statement
Build a functional, visually polished Junior High School (SMP) Educational Content Management System / Learning Management System with exactly Admin, Teacher, and Student roles, simple relational relationships, secure role-based authentication, realistic sample data, and responsive role-specific dashboards. Initial scope selected: authentication, admin master data, and role dashboards.

## Architecture decisions
- React frontend with FastAPI API and MongoDB collections shaped like relational entities for easy PHP/MySQL migration.
- JWT bearer sessions, bcrypt-compatible prototype password handling, and role checks on protected endpoints.
- Seeded fictional school data; API reads only configured environment URLs and database values.

## Personas
- Admin: manages academic periods and master data.
- Teacher: sees assigned teaching workspace.
- Student: sees a friendly learning dashboard for their class.

## Implemented (2026-03-12)
- Role-based login for all three demo users; no registration.
- Seeded active/inactive academic periods, classes, subjects, users, assignments, materials, tasks, attendance, PJJ, and grades.
- Admin dashboard plus master-data views and add-record modal for academic periods, teachers, students, classes, subjects, and teaching assignments.
- Teacher dashboard with assigned classes, review activity, active period, and stats.
- Student dashboard with class context, attendance, subjects, upcoming work, and external meeting join link.
- Responsive sidebar/topbar visual system based on the supplied blueprint direction.

## Backlog
- P0: complete teacher content creation, quiz attempts, assignment submissions, grading, and attendance writes.
- P1: profile pages, notification read states, upload validation/storage, and Excel export.
- P2: edit/deactivate flows, richer subject detail pages, and migration-ready SQL schema documentation.