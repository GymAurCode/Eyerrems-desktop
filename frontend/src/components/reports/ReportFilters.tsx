/**
 * ReportFilters — Universal filter panel for all reports.
 *
 * Dynamically shows/hides filter fields based on report type.
 */
import React from "react";
import { Search, Calendar, Filter, X } from "lucide-react";
import { ReportRequest } from "./types";

interface Props {
  filters: ReportRequest;
  onChange: (filters: ReportRequest) => void;
  onApply: () => void;
  onReset: () => void;
  availableFilters?: string[]; // Which filters to show
  loading?: boolean;
}

export default function ReportFilters({
  filters,
  onChange,
  onApply,
  onReset,
  availableFilters = ["search", "date_range", "status"],
  loading = false,
}: Props) {
  const hasFilters = availableFilters.length > 0;

  const updateFilter = (key: keyof ReportRequest, value: any) => {
    onChange({ ...filters, [key]: value });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onApply();
    }
  };

  if (!hasFilters) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Filter size={16} className="text-muted" />
        <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        {availableFilters.includes("search") && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-muted" />
              <input
                type="text"
                value={filters.search || ""}
                onChange={(e) => updateFilter("search", e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Date From */}
        {availableFilters.includes("date_range") && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
            <div className="relative">
              <Calendar size={14} className="absolute left-2.5 top-2.5 text-muted" />
              <input
                type="date"
                value={filters.date_from || ""}
                onChange={(e) => updateFilter("date_from", e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Date To */}
        {availableFilters.includes("date_range") && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
            <div className="relative">
              <Calendar size={14} className="absolute left-2.5 top-2.5 text-muted" />
              <input
                type="date"
                value={filters.date_to || ""}
                onChange={(e) => updateFilter("date_to", e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Status */}
        {availableFilters.includes("status") && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select
              value={filters.status || ""}
              onChange={(e) => updateFilter("status", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="available">Available</option>
              <option value="sold">Sold</option>
              <option value="booked">Booked</option>
            </select>
          </div>
        )}

        {/* Payment Method */}
        {availableFilters.includes("payment_method") && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
            <select
              value={filters.payment_method || ""}
              onChange={(e) => updateFilter("payment_method", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Methods</option>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
            </select>
          </div>
        )}

        {/* Lead Source */}
        {availableFilters.includes("lead_source") && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Lead Source</label>
            <select
              value={filters.lead_source || ""}
              onChange={(e) => updateFilter("lead_source", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Sources</option>
              <option value="website">Website</option>
              <option value="referral">Referral</option>
              <option value="social_media">Social Media</option>
              <option value="walk_in">Walk-in</option>
              <option value="other">Other</option>
            </select>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
        <button
          onClick={onApply}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Applying..." : "Apply Filters"}
        </button>
        <button
          onClick={onReset}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
        >
          <X size={14} />
          Reset
        </button>
      </div>
    </div>
  );
}
