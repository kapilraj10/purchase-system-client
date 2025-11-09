import React, { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import { registerUser, loginUser } from "../services/userService";
import { AuthContext } from "../context/AuthContext";

export default function Register() {
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    if (!form.username.trim()) {
      toast.error("Username is required");
      return false;
    }
    if (!form.email.trim()) {
      toast.error("Email is required");
      return false;
    }
    // simple email check
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(form.email)) {
      toast.error("Please enter a valid email address");
      return false;
    }
    if (!form.password) {
      toast.error("Password is required");
      return false;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await registerUser(form);
      toast.success("Registration successful — signing you in…");

      // Log in immediately to get token and set auth state
      const loginRes = await loginUser({
        username: form.username,
        password: form.password,
      });

      login({ ...loginRes.user, token: loginRes.token });
      navigate("/dashboard");
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || "Registration failed";
      toast.error(message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Toaster position="top-center" />
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-6">
          <h1 className="text-center text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Create an account</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Username</span>
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="Your username"
                className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                autoComplete="username"
                aria-label="username"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</span>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                autoComplete="email"
                aria-label="email"
                required
              />
            </label>

            <label className="block relative">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Password</span>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Create a password"
                className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 pr-20"
                autoComplete="new-password"
                aria-label="password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-9 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-300"
                aria-pressed={showPassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-60"
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
              <span>{loading ? "Creating account…" : "Create account"}</span>
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-300">
            Already have an account?{" "}
            <Link to="/login" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}