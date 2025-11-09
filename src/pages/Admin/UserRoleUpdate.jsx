import { useContext, useState, useMemo } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { AuthContext } from "../../context/AuthContext";

/**
 * Button to promote/demote user.
 * - Disables demote for self-admin
 * - Shows react-hot-toast notifications for success/error
 */

export default function UserRoleUpdate({ user: u, fetchUsers }) {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);

  const myIds = useMemo(
    () => [user?.id, user?._id, user?.userId, user?.username].filter(Boolean).map(String),
    [user]
  );

  const isSelf = useMemo(() => myIds.includes(String(u.userId)) || myIds.includes(String(u.username)), [u.userId, u.username, myIds]);

  const toggleRole = async () => {
    const newRole = u.role === "admin" ? "user" : "admin";
    // Prevent attempting to demote self
    if (isSelf && newRole !== "admin") {
      toast.error("You cannot demote your own admin account");
      return;
    }

    setLoading(true);
    try {
      await axios.put(
        `${process.env.REACT_APP_API_URL}/admin/user/${u.userId}/role`,
        { role: newRole },
        { headers: { Authorization: `Bearer ${user.token}`, "Content-Type": "application/json" } }
      );

      toast.success(`User ${u.username} is now ${newRole}`);
      // refresh list
      if (typeof fetchUsers === "function") {
        await fetchUsers();
      }
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || "Failed to update role";
      toast.error(message);
      console.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggleRole}
      disabled={loading || (isSelf && u.role === "admin")}
      title={isSelf && u.role === "admin" ? "You cannot demote your own admin account" : "Change role"}
      className={`px-3 py-1 rounded text-sm font-medium ${
        u.role === "admin" ? "bg-red-500 hover:bg-red-600 text-white" : "bg-green-600 hover:bg-green-700 text-white"
      } disabled:opacity-60 disabled:cursor-not-allowed`}
    >
      {loading ? "Working…" : u.role === "admin" ? "Demote" : "Promote"}
    </button>
  );
}