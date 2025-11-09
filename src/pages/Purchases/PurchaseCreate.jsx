import React, { useState, useContext, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import { createPurchase } from "../../services/purchaseService";
import { AuthContext } from "../../context/AuthContext";

/**
 * Improved PurchaseCreate:
 * - Responsive Tailwind UI
 * - Live total calculation & formatted currency preview
 * - Client-side validation with react-hot-toast feedback
 * - Loading state with spinner, accessible labels
 * - Auto-fills month/year from selected date
 * - Optional onCreated callback prop so parent (Dashboard) can refresh lists/charts
 *
 * Usage:
 * <PurchaseCreate onCreated={() => refreshData()} />
 */

export default function PurchaseCreate({ onCreated } = {}) {
  const { user } = useContext(AuthContext);

  const [form, setForm] = useState({
    month: "",
    year: "",
    buyingDate: "",
    itemName: "",
    quantity: "",
    rate: "",
    supplierName: "",
  });

  const [loading, setLoading] = useState(false);

  // Auto-fill month/year when buyingDate changes
  useEffect(() => {
    if (!form.buyingDate) return;
    try {
      const d = new Date(form.buyingDate);
      if (!isNaN(d)) {
        setForm((prev) => ({
          ...prev,
          month: d.toLocaleString(undefined, { month: "long" }),
          year: String(d.getFullYear()),
        }));
      }
    } catch {
      // ignore
    }
  }, [form.buyingDate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // allow numeric fields to be empty or numeric
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const parseNumber = (v) => {
    const n = Number(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const totalAmount = parseNumber(form.quantity) * parseNumber(form.rate);

  const formatCurrency = (value) => {
    // Format as Nepali Rupee with Nepali digits if available; normalize symbol to 'रु'
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

  const validate = () => {
    if (!form.itemName.trim()) {
      toast.error("Item name is required");
      return false;
    }
    if (!form.buyingDate) {
      toast.error("Buying date is required");
      return false;
    }
    if (!form.quantity || parseNumber(form.quantity) <= 0) {
      toast.error("Quantity must be a number greater than 0");
      return false;
    }
    if (!form.rate || parseNumber(form.rate) <= 0) {
      toast.error("Rate must be a number greater than 0");
      return false;
    }
    return true;
  };

  const resetForm = () => {
    setForm({
      month: "",
      year: "",
      buyingDate: "",
      itemName: "",
      quantity: "",
      rate: "",
      supplierName: "",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      ...form,
      quantity: parseNumber(form.quantity),
      rate: parseNumber(form.rate),
      totalAmount,
    };

    setLoading(true);
    try {
      await createPurchase(payload, user.token);
      toast.success("Purchase created");
      resetForm();
      if (typeof onCreated === "function") {
        try {
          onCreated();
        } catch {
          // ignore callback errors
        }
      }
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Failed to create purchase";
      toast.error(message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Toaster position="top-right" />
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="buyingDate" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Buying date
            </label>
            <input
              id="buyingDate"
              name="buyingDate"
              type="date"
              value={form.buyingDate}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
              aria-required="true"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor="month" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Month
              </label>
              <input
                id="month"
                name="month"
                type="text"
                value={form.month}
                onChange={handleChange}
                placeholder="Month"
                className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div className="w-24">
              <label htmlFor="year" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                Year
              </label>
              <input
                id="year"
                name="year"
                type="text"
                value={form.year}
                onChange={handleChange}
                placeholder="Year"
                className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="itemName" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Item name
            </label>
            <input
              id="itemName"
              name="itemName"
              type="text"
              value={form.itemName}
              onChange={handleChange}
              placeholder="e.g., Office Chair"
              className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
              aria-required="true"
            />
          </div>

          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Quantity
            </label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min="0"
              step="1"
              value={form.quantity}
              onChange={handleChange}
              placeholder="0"
              className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 text-right"
              aria-required="true"
            />
          </div>

          <div>
            <label htmlFor="rate" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Rate
            </label>
            <input
              id="rate"
              name="rate"
              type="number"
              min="0"
              step="0.01"
              value={form.rate}
              onChange={handleChange}
              placeholder="0.00"
              className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 text-right"
              aria-required="true"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="supplierName" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Supplier
            </label>
            <input
              id="supplierName"
              name="supplierName"
              type="text"
              value={form.supplierName}
              onChange={handleChange}
              placeholder="Supplier name"
              className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-gray-700 dark:text-gray-200">
            <div className="text-xs text-gray-500">Total</div>
            <div className="text-lg font-semibold">{formatCurrency(totalAmount)}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetForm}
              disabled={loading}
              className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 disabled:opacity-60"
            >
              Reset
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-60"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
              )}
              <span>{loading ? "Adding…" : "Add Purchase"}</span>
            </button>
          </div>
        </div>
      </form>
    </>
  );
}