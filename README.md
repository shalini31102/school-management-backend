# 🖥️ School Management Backend

A **Node.js + Express** REST API server for the School Management App — handling authentication, attendance, tasks, grading, timetables, notifications, and real-time events via Socket.IO.

---

## 🚀 Features

- JWT-based authentication with refresh tokens
- Role-based access control (Admin / Teacher / Student)
- Attendance tracking with QR code support
- Task assignment, submission & grading
- Free period session management
- Timetable creation and retrieval
- Real-time notifications via Socket.IO
- AI-powered features via Groq API
- Rate limiting, input validation & error handling

---

## 🛠️ Tech Stack

- **Node.js** + **Express.js**
- **MongoDB** + **Mongoose**
- **Socket.IO** for real-time events
- **JWT** for authentication
- **Groq API** for AI features
- **Helmet**, **Morgan**, **Compression** for production readiness

---

## 📁 Project Structure

```
school-management-backend/
├── config/           # Database connection
├── controllers/      # Route handler logic
│   ├── adminController.js
│   ├── authController.js
│   ├── teacherController.js
│   ├── studentController.js
│   ├── gradingController.js
│   ├── freePeriodController.js
│   └── customTaskController.js
├── middleware/       # Auth, error handling, validation
├── models/           # Mongoose schemas
├── routes/           # API route definitions
├── socket/           # Socket.IO setup
├── utils/            # Helpers, validators, response utils
├── scripts/          # Seed scripts
├── .env.example      # Environment variable template
└── server.js         # Entry point
```

---

## ⚙️ Setup

### Prerequisites
- Node.js >= 18
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/atlas))

### Installation

```bash
git clone https://github.com/shalini31102/school-management-backend.git
cd school-management-backend
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret
GROQ_API_KEY=your_groq_api_key
CLIENT_URL=http://YOUR_LOCAL_IP:8081
PORT=5000
```

### Run

```bash
# Development
npm run dev

# Production
npm start
```

### Seed Admin (first time setup)

```bash
node scripts/seedAdmin.js
```

---

## 📡 API Routes

| Prefix       | Description              |
|--------------|--------------------------|
| `/api/auth`  | Login, logout, refresh   |
| `/api/admin` | Admin management routes  |
| `/api/teacher` | Teacher routes         |
| `/api/student` | Student routes         |

---

## 🔐 Authentication

All protected routes require a Bearer token:

```
Authorization: Bearer <your_jwt_token>
```

