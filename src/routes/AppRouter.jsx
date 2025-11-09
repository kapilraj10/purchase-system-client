import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

// Pages
import Login from "../pages/Login";
import Register from "../pages/Register";
import Dashboard from "../pages/Dashboard";
import UserList from "../pages/Admin/UserList"; // Admin page

// Protected Route wrapper
const ProtectedRoute = ({ children, role }) => {
  const { user, ready } = useContext(AuthContext);

  // Wait for auth hydration so we don't redirect before local data loads
  if (!ready) return null; // or a small loader

  if (!user) return <Navigate to="/login" />; // not logged in
  if (role && user.role !== role) return <Navigate to="/dashboard" />; // role mismatch
  return children;
};

export default function AppRouter() {
  const { user } = useContext(AuthContext);

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={!user ? <Login /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/register"
          element={!user ? <Register /> : <Navigate to="/dashboard" />}
        />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Admin-Only Route */}
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute role="admin">
              <UserList />
            </ProtectedRoute>
          }
        />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
      </Routes>
    </Router>
  );
}