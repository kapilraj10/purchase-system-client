import { useContext, useEffect, useState, useCallback } from "react";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { AuthContext } from "../../context/AuthContext";
import UserRoleUpdate from "./UserRoleUpdate";

/**
 * Admin Users list with totals (last 35 days).
 * - Shows loading state
 * - Uses react-hot-toast for errors/success
 * - Delete user (with confirm) and role change support
 * - Tailwind CSS for responsive layout
 */

export default function UserList() {
  const { user } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const formatCurrencyNPR = (value) => {
    try {
      const nf = new Intl.NumberFormat("ne-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 2 });
      return nf.format(Number(value || 0)).replace("रू", "रु");
    } catch {
      try {
        const nf = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
        return `रु ${nf.format(Number(value || 0))}`;
      } catch {
        return `रु ${String(value ?? 0)}`;
      }
    }
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/users-total-last-35-days`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      // backend returns { totals }
      setUsers(Array.isArray(res.data.totals) ? res.data.totals : []);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || "Failed to load users";
      toast.error(message);
      console.error(message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [user.token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDelete = async (targetUser) => {
    // prevent deleting yourself
    const myIds = [user?.id, user?._id, user?.userId, user?.username].filter(Boolean).map(String);
    if (myIds.includes(String(targetUser.userId))) {
      toast.error("You cannot delete your own account");
      return;
    }

    const ok = window.confirm(`Delete user "${targetUser.username}"? This action cannot be undone.`);
    if (!ok) return;

    try {
      toast.promise(
        axios.delete(`${process.env.REACT_APP_API_URL}/admin/user/${targetUser.userId}`, {
          headers: { Authorization: `Bearer ${user.token}` },
        }),
        {
          loading: "Deleting user...",
          success: "User deleted",
          error: (err) => err?.response?.data?.message || "Failed to delete user",
        }
      );
      // refresh list after delete completes
      await fetchUsers();
    } catch (err) {
      // axios error handled by toast.promise, still log
      console.error(err);
    }
  };

  return (
    <>
      <Toaster position="top-right" />
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Users & Purchases (Last 35 days)</h3>
          <div>
            <button
              onClick={fetchUsers}
              className="inline-flex items-center gap-2 px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm"
              disabled={loading}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm">
          <table className="min-w-full table-auto">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Username</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Role</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Total (35d)</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>

            <tbody>
              {users.length === 0 && !loading ? (
                <tr>
                  <td colSpan="5" className="px-4 py-6 text-center text-sm text-gray-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={String(u.userId)} className="border-t">
                    <td className="px-4 py-3 text-sm">{u.username || "—"}</td>
                    <td className="px-4 py-3 text-sm">{u.email || "—"}</td>
                    <td className="px-4 py-3 text-sm">{u.role || "—"}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {u.totalAmount != null ? formatCurrencyNPR(u.totalAmount) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      <div className="inline-flex items-center gap-2">
                        <UserRoleUpdate user={u} fetchUsers={fetchUsers} />
                        <button
                          onClick={() => handleDelete(u)}
                          className="px-2 py-1 text-sm rounded bg-red-500 hover:bg-red-600 text-white disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}