import { useState, useEffect, useContext } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { getPurchases } from "../../services/purchaseService";
import { AuthContext } from "../../context/AuthContext";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

function formatDateShort(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

/**
 * Format number as Nepali Rupee string.
 * Uses Intl.NumberFormat with 'ne-NP' + currency 'NPR' where available,
 * and normalizes the symbol to "रु" for consistent display.
 */
function formatCurrencyNPR(value) {
  try {
    // Use ne-NP if available; fallback to en-IN style number with "रु" prefix
    const nf = new Intl.NumberFormat("ne-NP", { style: "currency", currency: "NPR", maximumFractionDigits: 2 });
    const formatted = nf.format(Number(value || 0));
    // Some environments render the symbol as 'रू' — normalize to 'रु'
    return formatted.replace("रू", "रु");
  } catch {
    // Fallback: insert prefix and use locale separators
    try {
      const nf = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
      return `रु ${nf.format(Number(value || 0))}`;
    } catch {
      return `रु ${String(value)}`;
    }
  }
}

export default function PurchaseList() {
  const { user } = useContext(AuthContext);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPurchases = async () => {
      setLoading(true);
      try {
        const data = await getPurchases(user.token);
        setPurchases(Array.isArray(data) ? data : []);
      } catch (error) {
        const message = error?.response?.data?.message || error?.message || "Failed to load purchases";
        toast.error(message);
        console.error(message);
        setPurchases([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPurchases();
  }, [user.token]);

  // Aggregate totals by day for the chart (use ISO date yyyy-mm-dd)
  const totalsByDayMap = purchases.reduce((acc, p) => {
    const day = p.buyingDate ? new Date(p.buyingDate).toISOString().slice(0, 10) : "unknown";
    const computed = Number(p.totalAmount ?? (p.rate * p.quantity) ?? 0);
    acc[day] = (acc[day] || 0) + (Number.isFinite(computed) ? computed : 0);
    return acc;
  }, {});
  const totalsByDay = Object.entries(totalsByDayMap)
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Chart dataset
  const chartData = {
    labels: totalsByDay.map((d) => formatDateShort(d.date)),
    datasets: [
      {
        label: "Total per day (रु)",
        data: totalsByDay.map((d) => Number(d.total || 0)),
        fill: true,
        backgroundColor: "rgba(34,197,94,0.12)",
        borderColor: "rgba(34,197,94,1)",
        tension: 0.25,
        pointRadius: 2,
      },
    ],
  };

  // Determine dynamic suggested min/max but cap maximum at 20,000 NPR and minimum suggestion at 1,000 NPR
  const dataMax = totalsByDay.length ? Math.max(...totalsByDay.map((d) => Number(d.total || 0))) : 0;
  // If there is no data, set suggestedMax to 20k so the sparkline area is visible
  const suggestedMax = dataMax > 0 ? Math.min(20000, Math.ceil((dataMax * 1.1) / 1000) * 1000) : 20000;
  const suggestedMin = dataMax >= 1000 ? 1000 : 0;
  // Compute nice step size (approx 4-6 ticks) while keeping values whole thousands when possible
  const roughStep = Math.ceil(suggestedMax / 5 / 1000) * 1000 || 2000;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const val = ctx.parsed?.y ?? ctx.parsed;
            return formatCurrencyNPR(val);
          },
        },
      },
    },
    scales: {
      y: {
        suggestedMin,
        suggestedMax,
        ticks: {
          callback: (val) => formatCurrencyNPR(val),
          stepSize: roughStep,
        },
      },
      x: {
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
        },
      },
    },
    elements: {
      point: {
        radius: 2,
      },
    },
  };

  return (
    <>
      <Toaster position="top-right" />
      <div className="space-y-4">
        {/* Header + sparkline (responsive) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Purchases</h3>
            <p className="text-sm text-gray-500">Recent purchases and a 30-day overview (रु)</p>
          </div>

          <div className="w-full sm:w-64 h-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-2 shadow-sm">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <svg className="animate-spin h-5 w-5 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
              </div>
            ) : totalsByDay.length ? (
              <Line data={chartData} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-gray-500">No data</div>
            )}
          </div>
        </div>

        {/* Responsive list/table */}
        <div className="overflow-x-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm">
          {/* Table for md+ */}
          <table className="min-w-full hidden md:table">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Date</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Qty</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Rate (रु)</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Total (रु)</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Supplier</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p._id} className="border-t">
                  <td className="px-4 py-3 text-sm">{p.itemName || "—"}</td>
                  <td className="px-4 py-3 text-sm">{p.buyingDate ? formatDateShort(p.buyingDate) : "—"}</td>
                  <td className="px-4 py-3 text-sm text-right">{p.quantity ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-right">{p.rate != null ? formatCurrencyNPR(p.rate) : "—"}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">{p.totalAmount != null ? formatCurrencyNPR(p.totalAmount) : "—"}</td>
                  <td className="px-4 py-3 text-sm">{p.supplierName || "—"}</td>
                </tr>
              ))}
              {purchases.length === 0 && !loading && (
                <tr>
                  <td colSpan="6" className="px-4 py-6 text-center text-sm text-gray-500">
                    No purchases yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Card list for mobile */}
          <div className="md:hidden divide-y">
            {purchases.length === 0 && !loading ? (
              <div className="p-4 text-sm text-gray-500">No purchases yet.</div>
            ) : (
              purchases.map((p) => (
                <div key={p._id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-medium">{p.itemName || "—"}</div>
                      <div className="text-xs text-gray-500">{p.supplierName || "—"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{p.totalAmount != null ? formatCurrencyNPR(p.totalAmount) : "—"}</div>
                      <div className="text-xs text-gray-500">{p.buyingDate ? formatDateShort(p.buyingDate) : "—"}</div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <div>Qty: {p.quantity ?? "—"}</div>
                    <div>Rate: {p.rate != null ? formatCurrencyNPR(p.rate) : "—"}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}