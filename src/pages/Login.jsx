import React, { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import { loginUser } from "../services/userService";
import { AuthContext } from "../context/AuthContext";

/**
 * Improved Login component:
 * - Tailwind CSS styling
 * - Loading state + spinner
 * - Client-side validation
 * - Show/hide password toggle
 * - Uses react-hot-toast for success/error notifications
 * - Adds link to /register
 *
 * Make sure you have react-hot-toast installed:
 *   npm install react-hot-toast
 *
 * If your app already renders a <Toaster /> at a higher level (e.g. App.jsx),
 * you can remove the <Toaster /> element here.
 */
export default function Login() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Simple client-side validation
    if (!form.username.trim() || !form.password) {
      toast.error("Please enter both username and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await loginUser(form); // expected to return { user, token }
      login({ ...res.user, token: res.token });
      toast.success("Signed in successfully!");
      navigate("/dashboard");
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || "Login failed";
      toast.error(message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Toaster position="top-right" />
      <div className="max-w-md mx-auto mt-12 p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow">
        <h1 className="text-2xl sm:text-3xl font-semibold text-center mb-6">Sign in</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Username</span>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="Your username"
              className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              autoComplete="username"
              aria-label="username"
            />
          </label>

          <label className="block relative">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Password</span>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent pr-20"
              autoComplete="current-password"
              aria-label="password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-9 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100 px-2 py-1"
              aria-pressed={showPassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-60"
          >
            {loading && (
              <svg
                className="animate-spin h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
            )}
            <span>{loading ? "Signing in..." : "Sign in"}</span>
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-300">
          Don't have an account?{" "}
          <Link to="/register" className="text-green-600 dark:text-green-400 hover:underline font-medium">
            Register
          </Link>
        </div>
      </div>
    </>
  );
}