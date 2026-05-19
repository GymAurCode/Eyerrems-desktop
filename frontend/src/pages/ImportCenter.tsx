/**
 * Enterprise Import Dashboard
 * Modern card-based interface for bulk data imports
 */

import React, { useState, useEffect } from "react";
import {
  Users, Building2, UserCheck, Handshake, CreditCard, MapPin,
  Home, UserPlus, Database, Download, Upload, FileSpreadsheet,
  CheckCircle2, AlertTriangle, Clock, Shield, RotateCcw, Zap,
  ArrowRight, X, FileText, Calendar, TrendingUp
} from "lucide-react";
import { importApi } from "../lib/importApi";
import { useBulkImport } from "../hooks/useBulkImport";
import MasterImportModal from "../components/import/MasterImportModal";
import SingleImportModal from "../components/import/SingleImportModal";

// Import card configuration
const IMPORT_CARDS = [
  {
    id: "leads",
    title: "Import Leads",
    description: "Upload CRM leads in bulk",
    icon: Users,
    color: "#3b82f6",
    bgColor: "rgba(59,130,246,0.1)",
    borderColor: "rgba(59,130,246,0.2)",
    formats: ["CSV", "XLSX"],
    moduleKey: "crm_leads"
  },
  {
    id: "properties",
    title: "Import Properties",
    description: "Add properties and units",
    icon: Building2,
    color: "#10b981",
    bgColor: "rgba(16,185,129,0.1)",
    borderColor: "rgba(16,185,129,0.2)",
    formats: ["CSV", "XLSX"],
    moduleKey: "properties"
  },
  {
    id: "employees",
    title: "Import Employees",
    description: "Bulk add staff members",
    icon: UserCheck,
    color: "#8b5cf6",
    bgColor: "rgba(139,92,246,0.1)",
    borderColor: "rgba(139,92,246,0.2)",
    formats: ["CSV", "XLSX"],
    moduleKey: "hr_employees"
  },
  {
    id: "dealers",
    title: "Import Dealers",
    description: "Add sales agents & dealers",
    icon: Handshake,
    color: "#f59e0b",
    bgColor: "rgba(245,158,11,0.1)",
    borderColor: "rgba(245,158,11,0.2)",
    formats: ["CSV", "XLSX"],
    moduleKey: "crm_dealers"
  },
  {
    id: "accounts",
    title: "Import Accounts",
    description: "Chart of accounts setup",
    icon: CreditCard,
    color: "#ef4444",
    bgColor: "rgba(239,68,68,0.1)",
    borderColor: "rgba(239,68,68,0.2)",
    formats: ["CSV", "XLSX"],
    moduleKey: "finance_accounts"
  },
  {
    id: "towns",
    title: "Import Towns",
    description: "Town & location data",
    icon: MapPin,
    color: "#06b6d4",
    bgColor: "rgba(6,182,212,0.1)",
    borderColor: "rgba(6,182,212,0.2)",
    formats: ["CSV", "XLSX"],
    moduleKey: "towns"
  },
  {
    id: "units",
    title: "Import Units / Plots",
    description: "Property units and plots",
    icon: Home,
    color: "#84cc16",
    bgColor: "rgba(132,204,22,0.1)",
    borderColor: "rgba(132,204,22,0.2)",
    formats: ["CSV", "XLSX"],
    moduleKey: "property_units"
  },
  {
    id: "tenants",
    title: "Import Tenants",
    description: "Tenant & rental data",
    icon: UserPlus,
    color: "#f97316",
    bgColor: "rgba(249,115,22,0.1)",
    borderColor: "rgba(249,115,22,0.2)",
    formats: ["CSV", "XLSX"],
    moduleKey: "tenants"
  }
];

interface ImportStats {
  totalImports: number;
  lastImportDate: string | null;
  recentCount: number;
}

interface ImportHistory {
  id: number;
  module_key: string;
  file_name: string;
  status: string;
  imported_rows: number;
  failed_rows: number;
  created_at: string;
}

export default function ImportCenter() {
  const [stats, setStats] = useState<Record<string, ImportStats>>({});
  const [history, setHistory] = useState<ImportHistory[]>([]);
  const [showMasterModal, setShowMasterModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const historyData = await importApi.history();
      setHistory(historyData);

      // Calculate stats for each import type
      const statsMap: Record<string, ImportStats> = {};
      
      IMPORT_CARDS.forEach(card => {
        const cardHistory = historyData.filter(h => h.module_key === card.moduleKey);
        const recentHistory = cardHistory.filter(h => {
          const date = new Date(h.created_at);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return date > thirtyDaysAgo;
        });

        statsMap[card.id] = {
          totalImports: cardHistory.length,
          lastImportDate: cardHistory.length > 0 ? cardHistory[0].created_at : null,
          recentCount: recentHistory.reduce((sum, h) => sum + h.imported_rows, 0)
        };
      });

      setStats(statsMap);
    } catch (error) {
      console.error('Failed to load import data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (cardId: string) => {
    setSelectedCard(cardId);
  };

  const handleMasterImport = () => {
    setShowMasterModal(true);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return "Today";
    if (diffDays === 2) return "Yesterday";
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="p-6 space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Import Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Enterprise data import center • Template-based • Transaction safe
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" 
               style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <CheckCircle2 size={16} style={{ color: "#10b981" }} />
            <span className="text-xs font-medium" style={{ color: "#10b981" }}>
              All systems operational
            </span>
          </div>
        </div>
      </div>

      {/* Master Import Card */}
      <div className="relative">
        <div 
          className="p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
          style={{ 
            background: "linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(139,92,246,0.1) 100%)",
            border: "2px solid rgba(59,130,246,0.3)",
            boxShadow: "0 8px 32px rgba(59,130,246,0.1)"
          }}
          onClick={handleMasterImport}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(59,130,246,0.2)" }}
              >
                <Database size={28} style={{ color: "#3b82f6" }} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-primary mb-2">Complete System Update</h3>
                <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
                  Import Employees + Properties + Leads together safely
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                       style={{ background: "rgba(16,185,129,0.2)", color: "#10b981" }}>
                    <Shield size={12} />
                    Transaction Safe
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                       style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b" }}>
                    <Zap size={12} />
                    Duplicate Detection
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                       style={{ background: "rgba(139,92,246,0.2)", color: "#8b5cf6" }}>
                    <CheckCircle2 size={12} />
                    Auto Validation
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                       style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444" }}>
                    <RotateCcw size={12} />
                    Rollback Protection
                  </div>
                </div>
              </div>
            </div>
            <ArrowRight size={24} style={{ color: "#3b82f6" }} />
          </div>
          <div className="flex items-center gap-3 mt-6">
            <button 
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors"
              style={{ background: "rgba(59,130,246,0.2)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.3)" }}
            >
              <Download size={16} />
              Download All Templates
            </button>
            <button 
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors"
              style={{ background: "#3b82f6", color: "white" }}
            >
              <Upload size={16} />
              Upload Combined Files
            </button>
          </div>
        </div>
      </div>

      {/* Import Cards Grid */}
      <div>
        <h2 className="text-lg font-semibold text-primary mb-4">Individual Imports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {IMPORT_CARDS.map((card) => {
            const cardStats = stats[card.id] || { totalImports: 0, lastImportDate: null, recentCount: 0 };
            const Icon = card.icon;
            
            return (
              <div
                key={card.id}
                className="p-5 rounded-xl border cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-md"
                style={{ 
                  background: "var(--bg-surface)",
                  border: `1px solid ${card.borderColor}`,
                  boxShadow: `0 4px 16px ${card.bgColor}`
                }}
                onClick={() => handleCardClick(card.id)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: card.bgColor }}
                  >
                    <Icon size={20} style={{ color: card.color }} />
                  </div>
                  <div className="flex items-center gap-1">
                    {card.formats.map((format) => (
                      <span 
                        key={format}
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{ background: "var(--hover-bg)", color: "var(--text-muted)" }}
                      >
                        {format}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Content */}
                <div className="mb-4">
                  <h3 className="font-semibold text-primary mb-1">{card.title}</h3>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {card.description}
                  </p>
                </div>

                {/* Stats */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: "var(--text-muted)" }}>Recent imports:</span>
                    <span className="font-medium" style={{ color: card.color }}>
                      {cardStats.recentCount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: "var(--text-muted)" }}>Last import:</span>
                    <span className="font-medium text-primary">
                      {formatDate(cardStats.lastImportDate)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <button 
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: card.bgColor, color: card.color, border: `1px solid ${card.borderColor}` }}
                  >
                    <Download size={14} />
                    Download Template
                  </button>
                  <button 
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: card.color, color: "white" }}
                  >
                    <Upload size={14} />
                    Import File
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      {history.length > 0 && (
        <div className="detail-container">
          <div className="detail-section">
            <div className="flex items-center justify-between mb-4">
              <h3 className="detail-section-title flex items-center gap-2 mb-0">
                <Clock size={16} />
                Recent Import Activity
              </h3>
              <button 
                onClick={loadData}
                className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs transition-colors"
                style={{ background: "var(--hover-bg)", color: "var(--text-muted)" }}
              >
                <RotateCcw size={12} />
                Refresh
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>File</th>
                    <th>Status</th>
                    <th className="text-right">Imported</th>
                    <th className="text-right">Failed</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 10).map((item) => {
                    const card = IMPORT_CARDS.find(c => c.moduleKey === item.module_key);
                    const Icon = card?.icon || FileText;
                    
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-6 h-6 rounded flex items-center justify-center"
                              style={{ background: card?.bgColor || "var(--hover-bg)" }}
                            >
                              <Icon size={12} style={{ color: card?.color || "var(--text-muted)" }} />
                            </div>
                            <span className="text-xs font-medium">
                              {card?.title || item.module_key.replace(/_/g, " ")}
                            </span>
                          </div>
                        </td>
                        <td className="max-w-[200px] truncate text-xs" style={{ color: "var(--text-muted)" }}>
                          {item.file_name}
                        </td>
                        <td>
                          <span 
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                            style={{
                              background: item.status === "completed" ? "rgba(16,185,129,0.1)" : 
                                         item.status === "failed" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
                              color: item.status === "completed" ? "#10b981" : 
                                    item.status === "failed" ? "#ef4444" : "#f59e0b"
                            }}
                          >
                            {item.status === "completed" && <CheckCircle2 size={10} className="mr-1" />}
                            {item.status === "failed" && <AlertTriangle size={10} className="mr-1" />}
                            {item.status}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className="text-xs font-medium" style={{ color: "#10b981" }}>
                            {item.imported_rows.toLocaleString()}
                          </span>
                        </td>
                        <td className="text-right">
                          {item.failed_rows > 0 ? (
                            <button 
                              className="text-xs font-medium underline"
                              style={{ color: "#ef4444" }}
                              onClick={() => importApi.downloadErrors(item.id)}
                            >
                              {item.failed_rows.toLocaleString()}
                            </button>
                          ) : (
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>0</span>
                          )}
                        </td>
                        <td className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {formatDate(item.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showMasterModal && (
        <MasterImportModal 
          onClose={() => setShowMasterModal(false)}
          onSuccess={loadData}
        />
      )}
      
      {selectedCard && (
        <SingleImportModal
          card={IMPORT_CARDS.find(c => c.id === selectedCard)!}
          onClose={() => setSelectedCard(null)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}