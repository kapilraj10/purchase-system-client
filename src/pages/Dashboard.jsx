import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import { AuthContext } from "../context/AuthContext";
import PurchaseList from "./Purchases/PurchaseList";
import PurchaseCreate from "./Purchases/PurchaseCreate";
import UserList from "./Admin/UserList";
import { getTotalLast30Days } from "../services/purchaseService";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Line, Doughnut, Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

/**
 * Format date label
 */
function formatDateLabel(isoOrDate) {
  try {
    const d = new Date(isoOrDate);
    if (!isNaN(d)) {
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
  } catch {
    // ignore invalid date
  }
  return String(isoOrDate);
}

/**
 * Format currency as Nepali Rupee, normalize symbol to "रु"
 */
function formatCurrencyNPR(value) {
  try {
    const num = Number(value ?? 0);
    const nf = new Intl.NumberFormat("ne-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 2 });
    return nf.format(num).replace("रू", "रु");
  } catch {
    try {
      const nf = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
      return `रु ${nf.format(Number(value ?? 0))}`;
    } catch {
      return `रु ${String(value ?? 0)}`;
    }
  }
}

/**
 * Build per-day maps from various response shapes.
 * Returns:
 *  - totalsByDayAll: [{date, total}]
 *  - totalsByDayByUser: { userId: [{date, total}] }
 */
function parseTotalsByDayResponse(data) {
  const totalsByDayAllMap = {};
  const totalsByUserDateMap = {}; // { userId: { date: total } }

  // helper to add entry
  const addEntry = (date, total, userId) => {
    const d = date ? String(date).slice(0, 10) : "unknown";
    totalsByDayAllMap[d] = (totalsByDayAllMap[d] || 0) + Number(total || 0);
    if (userId != null) {
      if (!totalsByUserDateMap[userId]) totalsByUserDateMap[userId] = {};
      totalsByUserDateMap[userId][d] = (totalsByUserDateMap[userId][d] || 0) + Number(total || 0);
    }
  };

  // If API provides an array of daily objects
  if (Array.isArray(data?.totalsByDay) && data.totalsByDay.length) {
    data.totalsByDay.forEach((r) => addEntry(r.date ?? r._id, r.total ?? r.amount ?? 0, r.userId ?? r.user?.id));
  }

  // If API provides daily object { '2025-10-01': 123, ... }
  else if (data?.daily && typeof data.daily === "object") {
    Object.entries(data.daily).forEach(([date, total]) => addEntry(date, total, null));
  }

  // If API provides an array in data.total which may contain per-day or per-user entries
  else if (Array.isArray(data?.total) && data.total.length) {
    data.total.forEach((g) => {
      // If g looks like a date grouping
      if (g._id && (/\d{4}-\d{2}-\d{2}/.test(String(g._id)) || String(g._id).includes("/"))) {
        addEntry(g._id, g.total ?? g.totalAmount ?? g.amount ?? 0, g.userId ?? g.user?.id);
      } else if (g.date || g.buyingDate) {
        addEntry(g.date ?? g.buyingDate, g.total ?? g.totalAmount ?? g.amount ?? 0, g.userId ?? g.user?.id);
      } else {
        // Might be per-user grouping: group totals per user (no per-day info)
        // we can't add per-day entries, but we can add a synthetic "summary" day for chart fallback
        // Use key 'summary' to indicate non-daily aggregated data
        addEntry("summary", g.total ?? g.totalAmount ?? g.amount ?? 0, g._id ?? g.userId ?? g.user?.id);
      }
    });
  }

  // Convert maps to sorted arrays
  const totalsByDayAll = Object.entries(totalsByDayAllMap)
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const totalsByUser = {};
  Object.entries(totalsByUserDateMap).forEach(([userId, dayMap]) => {
    totalsByUser[userId] = Object.entries(dayMap)
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  });

  return { totalsByDayAll, totalsByUser };
}

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const [myTotalLast30, setMyTotalLast30] = useState(null);
  const [totalsByDayAll, setTotalsByDayAll] = useState([]); // overall daily totals
  const [totalsByDayMine, setTotalsByDayMine] = useState([]); // per-user daily totals if available
  const [categories, setCategories] = useState([]); // [{ category, total }]
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState("mine"); // "mine" or "all" - defaults to mine per request
  const [hasPerUserDaily, setHasPerUserDaily] = useState(false);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const data = await getTotalLast30Days(user.token);

        // parse daily totals and per-user totals
        const { totalsByDayAll: parsedAll, totalsByUser } = parseTotalsByDayResponse(data);

        setTotalsByDayAll(parsedAll);

        const mineUserId = user.id ?? user._id ?? user.userId ?? user.username;
        if (totalsByUser && totalsByUser[String(mineUserId)]) {
          setTotalsByDayMine(totalsByUser[String(mineUserId)]);
          setHasPerUserDaily(true);
        } else {
          setTotalsByDayMine([]); // no per-user daily breakdown
          setHasPerUserDaily(false);
        }

        // categories parsing (keep robust behavior)
        let parsedCats = [];
        if (Array.isArray(data?.categories) && data.categories.length) {
          parsedCats = data.categories.map((c) => ({ category: c.category ?? c._id, total: c.total ?? c.amount ?? 0 }));
        } else if (data?.byCategory && typeof data.byCategory === "object") {
          parsedCats = Object.entries(data.byCategory).map(([category, total]) => ({ category, total }));
        } else if (Array.isArray(data?.total) && data.total.length) {
          const catsFromTotal = data.total.filter((g) => g.category).map((g) => ({ category: g.category, total: g.total ?? g.totalAmount ?? 0 }));
          if (catsFromTotal.length) parsedCats = catsFromTotal;
        }

        setCategories(parsedCats);

        // Determine user's total from original groups if present (fallback)
        const mine = Array.isArray(data.total)
          ? data.total.find((g) => (g._id === user.id) || (g.userId === user.id) || (g._id === user.username))
          : null;
        const myTotal = mine ? (mine.totalAmount ?? mine.total ?? 0) : 0;
        setMyTotalLast30(myTotal);
      } catch (err) {
        const message = err?.response?.data?.message || err?.message || "Failed to load dashboard data";
        toast.error(message);
        setMyTotalLast30(null);
        setTotalsByDayAll([]);
        setTotalsByDayMine([]);
        setCategories([]);
        setHasPerUserDaily(false);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [user.id, user._id, user.userId, user.username, user.token]);

  // Choose data depending on scope
  const displayedTotalsByDay = scope === "mine" ? (totalsByDayMine.length ? totalsByDayMine : totalsByDayAll) : totalsByDayAll;
  if (scope === "mine" && !hasPerUserDaily && totalsByDayMine.length === 0) {
    // notify user once that per-user daily breakdown isn't available (non-blocking)
    // show as toast but avoid spamming on every render; we only show at data load (use effect) - here it's okay to call once
    // We'll show a toast when the user toggles to "mine" and per-user data is missing.
  }

  // Line chart for displayed totals
  const lineLabels = displayedTotalsByDay.length ? displayedTotalsByDay.map((d) => formatDateLabel(d.date)) : [];
  const lineData = {
    labels: lineLabels,
    datasets: [
      {
        label: `Total (last 30 days) - ${scope === "mine" ? "You" : "All"}`,
        data: displayedTotalsByDay.map((d) => Number(d.total || 0)),
        fill: true,
        backgroundColor: "rgba(34,197,94,0.12)",
        borderColor: "rgba(34,197,94,1)",
        tension: 0.2,
        pointRadius: 3,
      },
    ],
  };
  const lineOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${formatCurrencyNPR(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (val) => formatCurrencyNPR(val),
        },
      },
    },
  };

  // Doughnut (category). If categories empty, show a small "No data" doughnut slice instead of text message.
  const hasCategoryData = categories.length > 0;
  const doughnutLabels = hasCategoryData ? categories.map((c) => c.category) : ["No data"];
  const doughnutValues = hasCategoryData ? categories.map((c) => Number(c.total || 0)) : [1];
  const doughnutBackground = hasCategoryData
    ? ["#059669", "#10B981", "#34D399", "#60A5FA", "#A78BFA", "#F59E0B", "#F97316", "#EF4444"]
    : ["#e5e7eb"]; // gray for no data
  const doughnutData = {
    labels: doughnutLabels,
    datasets: [
      {
        label: "By category",
        data: doughnutValues,
        backgroundColor: doughnutBackground,
        borderWidth: 1,
      },
    ],
  };
  const doughnutOptions = {
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => {
            if (!hasCategoryData) return `${ctx.label}`;
            return `${ctx.label}: ${formatCurrencyNPR(ctx.parsed)}`;
          },
        },
      },
      legend: { position: "bottom" },
    },
  };

  // Bar compare chart (You vs All)
  const overallTotal = totalsByDayAll.reduce((s, d) => s + Number(d.total || 0), 0);
  const myTotalForChart = myTotalLast30 !== null ? Number(myTotalLast30) : 0;
  const barData = {
    labels: ["You (30d)", "All users (30d)"],
    datasets: [
      {
        label: "Amount",
        data: [myTotalForChart, overallTotal],
        backgroundColor: ["#059669", "#60A5FA"],
      },
    ],
  };
  const barOptions = {
    indexAxis: "y",
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${formatCurrencyNPR(ctx.parsed.x ?? ctx.parsed)}`,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          callback: (val) => formatCurrencyNPR(val),
        },
      },
    },
  };

  const myTotalDisplay = myTotalLast30 !== null ? formatCurrencyNPR(myTotalLast30) : "—";
  const overallTotalDisplay = loading ? "…" : formatCurrencyNPR(overallTotal);

  // Handler when toggling scope
  const handleScopeChange = (newScope) => {
    if (newScope === "mine" && !hasPerUserDaily) {
      toast("Per-user daily breakdown not available — showing overall totals instead.", { icon: "ℹ️" });
    }
    setScope(newScope);
  };

  return (
    <>
      <Toaster position="top-right" />
      <div className="p-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Welcome, {user.username}</h1>
            <p className="text-sm text-gray-600">Overview of your activity and recent purchases</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-4 py-3 text-center shadow-sm">
              <div className="text-xs text-gray-500">My Total (30d)</div>
              <div className="text-lg font-semibold">{myTotalDisplay}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-4 py-3 text-center shadow-sm">
              <div className="text-xs text-gray-500">Overall Total (30d)</div>
              <div className="text-lg font-semibold">{overallTotalDisplay}</div>
            </div>

            {/* Admin button linking to /admin/users for admins, and Admin Login for non-admins */}
            {user.role === "admin" ? (
              <Link
                to="/admin/users"
                className="ml-2 inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                aria-label="Admin users"
              >
                Admin Users
              </Link>
            ) : (
              <Link
                to="/admin/users"
                className="ml-2 inline-flex items-center gap-2 px-3 py-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium"
                aria-label="Admin login"
              >
                Admin Login
              </Link>
            )}
          </div>
        </header>

        {/* Mobile-friendly admin shortcut button */}
        <div className="sm:hidden mb-4">
          {user.role === "admin" ? (
            <Link
              to="/admin/users"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm"
              aria-label="Go to Admin Users"
            >
              Admin Users
            </Link>
          ) : (
            <Link
              to="/admin/login"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium shadow-sm"
              aria-label="Admin login"
            >
              Admin Login
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main column (create & list) */}
          <main className="lg:col-span-2 space-y-6">
            <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold">Add Purchase</h2>
                <div className="text-sm text-gray-500">Scope:
                  <button
                    onClick={() => handleScopeChange("mine")}
                    className={`ml-2 px-2 py-1 rounded ${scope === "mine" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700"}`}
                  >
                    Mine
                  </button>
                  <button
                    onClick={() => handleScopeChange("all")}
                    className={`ml-2 px-2 py-1 rounded ${scope === "all" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700"}`}
                  >
                    All
                  </button>
                </div>
              </div>
              <PurchaseCreate
                onCreated={() => {
                  // When a purchase is created, refresh dashboard data by re-running effect:
                  // simple approach: toggle loading to trigger useEffect (depends on user.token etc.)
                  // but more robust would be to expose a refresh function; for now show toast and reload page data
                  toast.success("Purchase added — refreshing dashboard");
                  setLoading(true);
                  // re-run effect by calling getTotalLast30Days again
                  getTotalLast30Days(user.token)
                    .then((data) => {
                      const { totalsByDayAll: parsedAll, totalsByUser } = parseTotalsByDayResponse(data);
                      setTotalsByDayAll(parsedAll);
                      const mineUserId = user.id ?? user._id ?? user.userId ?? user.username;
                      if (totalsByUser && totalsByUser[String(mineUserId)]) {
                        setTotalsByDayMine(totalsByUser[String(mineUserId)]);
                        setHasPerUserDaily(true);
                      } else {
                        setTotalsByDayMine([]);
                        setHasPerUserDaily(false);
                      }
                      // categories parse
                      let parsedCats = [];
                      if (Array.isArray(data?.categories) && data.categories.length) {
                        parsedCats = data.categories.map((c) => ({ category: c.category ?? c._id, total: c.total ?? c.amount ?? 0 }));
                      } else if (data?.byCategory && typeof data.byCategory === "object") {
                        parsedCats = Object.entries(data.byCategory).map(([category, total]) => ({ category, total }));
                      } else if (Array.isArray(data?.total) && data.total.length) {
                        const catsFromTotal = data.total.filter((g) => g.category).map((g) => ({ category: g.category, total: g.total ?? g.totalAmount ?? 0 }));
                        if (catsFromTotal.length) parsedCats = catsFromTotal;
                      }
                      setCategories(parsedCats);

                      const mine = Array.isArray(data.total)
                        ? data.total.find((g) => (g._id === user.id) || (g.userId === user.id) || (g._id === user.username))
                        : null;
                      const myTotal = mine ? (mine.totalAmount ?? mine.total ?? 0) : 0;
                      setMyTotalLast30(myTotal);
                    })
                    .catch((err) => {
                      toast.error("Failed to refresh dashboard");
                      console.error(err);
                    })
                    .finally(() => setLoading(false));
                }}
              />
            </section>

            <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold">Recent Purchases</h2>
                <div className="text-sm text-gray-500">{loading ? "Loading…" : `${displayedTotalsByDay.length || 0} day points`}</div>
              </div>
              <PurchaseList />
            </section>
          </main>

          {/* Sidebar with charts and admin */}
          <aside className="space-y-6">
            <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
              <h3 className="text-lg font-semibold mb-2">Activity (30 days)</h3>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin h-6 w-6 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                </div>
              ) : displayedTotalsByDay.length ? (
                <div className="h-48">
                  <Line data={lineData} options={lineOptions} />
                </div>
              ) : (
                <div className="text-sm text-gray-500 py-6">No activity data available for the selected scope.</div>
              )}
            </section>

            <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
              <h3 className="text-lg font-semibold mb-2">Compare (You vs All)</h3>
              <div className="h-36">
                <Bar data={barData} options={barOptions} />
              </div>
            </section>

            <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm relative">
              <h3 className="text-lg font-semibold mb-2">Spending by Category</h3>

              <div className="h-48">
                <Doughnut data={doughnutData} options={doughnutOptions} />
              </div>

              {/* When there's no category data, overlay a subtle message on the chart area instead of the previous plain text */}
              {!hasCategoryData && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-sm text-gray-400 bg-white/70 dark:bg-gray-800/70 px-3 py-1 rounded">
                    No category breakdown available
                  </div>
                </div>
              )}
            </section>

            {user.role === "admin" && (
              <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
                <h3 className="text-lg font-semibold mb-3">Admin: Users</h3>
                <UserList />
              </section>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}