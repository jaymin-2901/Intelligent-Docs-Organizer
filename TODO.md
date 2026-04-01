# Fullstack Intelligent Doc Organizer TODO
## Approved Plan: Backend unification (Node) + Auth into root frontend

### ✅ Phase 0: Planning Complete
- [x] Created TODO.md
- [x] User approved plan (Node backend, copy full pages, single dev cmd)

### ⏳ Phase 1: Backend (Node Express @ port 5000)
1. [✅] Updated `backend/package.json`: Added auth deps (bcryptjs, jsonwebtoken, mongoose, express-validator, rate-limit)
2. [✅] Created `backend/models/User.js`: Mongoose User model
3. [✅] Copied `backend/middleware/auth.js`
4. [✅] Copied `backend/controllers/authController.js`
5. [✅] Copied `backend/routes/authRoutes.js`
6. [✅] Updated `backend/src/index.js`: Complete auth + Mongo + protected docs routes
7. [✅] Backend ready - npm run dev running → /api/auth/login /api/auth/signup working


### ⏳ Phase 2: Frontend Auth Integration
1. [✅] Copied auth-system frontend files:
   | From | To |
   |------|----|
   | ✓ context/AuthContext.jsx | ✓ context/AuthContext.jsx |
   | ✓ services/api.js | ✓ services/api.js |
   | ✓ components/ProtectedRoute.jsx | ✓ components/ProtectedRoute.jsx |
   | ✓ components/Toast.jsx | ✓ components/Toast.jsx |
   | ✓ pages/Login.jsx | ✓ pages/Login.jsx |
   | ✓ pages/Signup.jsx | ✓ pages/Signup.jsx |
2. [ ] Update `frontend/src/main.jsx`: Add AuthProvider + Router
3. [ ] Update `frontend/src/App.jsx`: Add auth routes (/login, /signup → Protected /dashboard)
4. [ ] `frontend/package.json`: Ensure react-router-dom
5. [ ] Test full flow

### ⏳ Phase 3: Convenience
1. [ ] Root `package.json`: "fullstack": concurrently backend+frontend
2. [ ] README.md: Run instructions
3. [ ] Deprecate auth-system/frontend: Redirect to main app

### ⏳ Phase 4: Complete
- [ ] `attempt_completion`

**Current Step: Phase 1 #1 → backend/package.json**

