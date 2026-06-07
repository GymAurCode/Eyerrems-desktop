/**
 * Master Import Modal
 * Premium enterprise feature for importing multiple modules together
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  Download, FileSpreadsheet, CheckCircle2,
  Users, Building2, UserCheck, Shield, Zap, ArrowRight,
  FileText, AlertCircle, RefreshCw, Upload
} from "lucide-react";
import AppDialog from "../ui/AppDialog";
import { useDropzone, DropzoneOptions } from "react-dropzone";
import { importApi } from "../../lib/importApi";

interface FileGroup {
  type: 'employees' | 'properties' | 'leads';
  file: File | null;
  status: 'pending' | 'uploaded' | 'validated' | 'error';
  validation?: {
    total_rows: number;
    valid_count: number;
    invalid_count: number;
    errors: string[];
  };
}

interface MasterImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const FILE_GROUPS: Array<{
  type: FileGroup['type'];
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  templateKey: string;
}> = [
  {
    type: 'employees',
    title: 'Employees File',
    description: 'HR staff and employee data',
    icon: UserCheck,
    color: '#8b5cf6',
    bgColor: 'rgba(139,92,246,0.1)',
    templateKey: 'hr_employees'
  },
  {
    type: 'properties',
    title: 'Properties File',
    description: 'Property and unit listings',
    icon: Building2,
    color: '#10b981',
    bgColor: 'rgba(16,185,129,0.1)',
    templateKey: 'properties'
  },
  {
    type: 'leads',
    title: 'Leads File',
    description: 'CRM leads and prospects',
    icon: Users,
    color: '#3b82f6',
    bgColor: 'rgba(59,130,246,0.1)',
    templateKey: 'crm_leads'
  }
];

export default function MasterImportModal({ onClose, onSuccess }: MasterImportModalProps) {
  const [step, setStep] = useState<'upload' | 'validate' | 'import' | 'complete'>('upload');
  const [fileGroups, setFileGroups] = useState<Record<string, FileGroup>>({
    employees: { type: 'employees', file: null, status: 'pending' },
    properties: { type: 'properties', file: null, status: 'pending' },
    leads: { type: 'leads', file: null, status: 'pending' }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any>(null);

  const onDrop = useCallback((acceptedFiles: File[], groupType: FileGroup['type']) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setFileGroups(prev => ({
        ...prev,
        [groupType]: {
          ...prev[groupType],
          file,
          status: 'uploaded'
        }
      }));
    }
  }, []);

  const dropzoneOptions = useMemo((): DropzoneOptions => ({
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1,
    multiple: false
  }), []);

  const downloadAllTemplates = async () => {
    try {
      setLoading(true);
      // Download templates for all three modules
      for (const group of FILE_GROUPS) {
        await importApi.downloadTemplate(group.templateKey, 'xlsx');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to download templates');
    } finally {
      setLoading(false);
    }
  };

  const validatePackage = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const validationPromises = Object.entries(fileGroups)
        .filter(([_, group]) => group.file)
        .map(async ([key, group]) => {
          const moduleKey = FILE_GROUPS.find(g => g.type === group.type)?.templateKey || '';
          
          try {
            const result = await importApi.validate(moduleKey, group.file!, "skip");
            return { key, result };
          } catch (error) {
            return { key, error };
          }
        });

      const results = await Promise.all(validationPromises);
      
      const updatedGroups = { ...fileGroups };
      let hasErrors = false;

      results.forEach(({ key, result, error }: { key: string; result?: typeof importApi extends { validate: (...args: any[]) => Promise<infer R> } ? R : never; error?: any }) => {
        if (error) {
          updatedGroups[key] = {
            ...updatedGroups[key],
            status: 'error'
          };
          hasErrors = true;
        } else if (result) {
          updatedGroups[key] = {
            ...updatedGroups[key],
            status: 'validated',
            validation: {
              total_rows: result.total_rows,
              valid_count: result.valid_count,
              invalid_count: result.invalid_count,
              errors: result.rows?.filter((r: any) => r.status === "invalid").flatMap((r: any) => r.errors) ?? [],
            }
          };
        }
      });

      setFileGroups(updatedGroups);
      
      if (!hasErrors) {
        setStep('validate');
      }
    } catch (err: any) {
      setError(err.message || 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  const startImport = async () => {
    try {
      setLoading(true);
      setError(null);
      setStep('import');

      // Execute imports sequentially for safety
      const results = [];
      
      for (const [key, group] of Object.entries(fileGroups)) {
        if (group.file && group.status === 'validated') {
          const moduleKey = FILE_GROUPS.find(g => g.type === group.type)?.templateKey || '';
          const result = await importApi.execute({
            module_key: moduleKey,
            duplicate_mode: "skip",
            batch_id: null,
          });
          results.push({ type: group.type, result });
        }
      }

      setImportResult(results);
      setStep('complete');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const uploadedCount = Object.values(fileGroups).filter(g => g.file).length;
  const validatedCount = Object.values(fileGroups).filter(g => g.status === 'validated').length;
  const totalRows = Object.values(fileGroups).reduce((sum, g) => sum + (g.validation?.total_rows || 0), 0);
  const validRows = Object.values(fileGroups).reduce((sum, g) => sum + (g.validation?.valid_count || 0), 0);
  const invalidRows = Object.values(fileGroups).reduce((sum, g) => sum + (g.validation?.invalid_count || 0), 0);

  return (
    <AppDialog isOpen={true} onClose={onClose} title="Complete System Update" subtitle="Import multiple modules together with transaction safety" size="xl" icon={<Upload size={20} />}>
      {/* Progress Indicator */}
      <div className="py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-4">
          {[
            { key: 'upload', label: 'Upload Files', active: step === 'upload' },
            { key: 'validate', label: 'Validate Data', active: step === 'validate' },
            { key: 'import', label: 'Import Data', active: step === 'import' },
            { key: 'complete', label: 'Complete', active: step === 'complete' }
          ].map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: s.active ? "#3b82f6" : "var(--hover-bg)",
                  color: s.active ? "white" : "var(--text-muted)"
                }}
              >
                {i + 1}
              </div>
              <span 
                className="text-sm font-medium"
                style={{ color: s.active ? "#3b82f6" : "var(--text-muted)" }}
              >
                {s.label}
              </span>
              {i < 3 && <ArrowRight size={16} style={{ color: "var(--text-muted)" }} />}
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4">
          {error && (
            <div 
              className="flex items-center gap-2 p-4 rounded-lg mb-6"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <AlertCircle size={16} style={{ color: "#ef4444" }} />
              <span className="text-sm" style={{ color: "#ef4444" }}>{error}</span>
            </div>
          )}

          {/* Upload Step */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Download Templates */}
              <div className="text-center">
                <button 
                  onClick={downloadAllTemplates}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors mx-auto"
                  style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)" }}
                >
                  {loading ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                  Download All Templates
                </button>
                <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                  Download templates, fill with your data, then upload below
                </p>
              </div>

              {/* File Upload Areas */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {FILE_GROUPS.map((group) => {
                  const fileGroup = fileGroups[group.type];
                  const Icon = group.icon;
                  const dz = useDropzone({
                    ...dropzoneOptions,
                    onDrop: (accepted: File[]) => onDrop(accepted, group.type),
                  });

                  return (
                    <div key={group.type} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ background: group.bgColor }}
                        >
                          <Icon size={16} style={{ color: group.color }} />
                        </div>
                        <div>
                          <h4 className="font-medium text-primary">{group.title}</h4>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {group.description}
                          </p>
                        </div>
                      </div>

                      <div 
                        {...dz.getRootProps()}
                        className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors"
                        style={{ 
                          borderColor: fileGroup.file ? group.color : "var(--border)",
                          background: fileGroup.file ? group.bgColor : "var(--hover-bg)"
                        }}
                      >
                        <input {...dz.getInputProps()} />
                        {fileGroup.file ? (
                          <div>
                            <CheckCircle2 size={24} className="mx-auto mb-2" style={{ color: group.color }} />
                            <p className="text-sm font-medium" style={{ color: group.color }}>
                              {fileGroup.file.name}
                            </p>
                            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                              {(fileGroup.file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        ) : (
                          <div>
                            <Upload size={24} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
                            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                              Drop {group.title.toLowerCase()} file here
                            </p>
                            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                              CSV or XLSX
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Upload Summary */}
              <div 
                className="flex items-center justify-between p-4 rounded-lg"
                style={{ background: "var(--hover-bg)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={16} style={{ color: "var(--text-muted)" }} />
                  <span className="text-sm font-medium text-primary">
                    {uploadedCount} of 3 files uploaded
                  </span>
                </div>
                <button 
                  onClick={validatePackage}
                  disabled={uploadedCount === 0 || loading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-50"
                  style={{ background: "#3b82f6", color: "white" }}
                >
                  {loading ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Validate Package
                </button>
              </div>
            </div>
          )}

          {/* Validation Step */}
          {step === 'validate' && (
            <div className="space-y-6">
              {/* Validation Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg" style={{ background: "var(--hover-bg)" }}>
                  <p className="text-2xl font-bold text-primary">{totalRows}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Total Rows</p>
                </div>
                <div className="text-center p-4 rounded-lg" style={{ background: "rgba(16,185,129,0.1)" }}>
                  <p className="text-2xl font-bold" style={{ color: "#10b981" }}>{validRows}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Valid Rows</p>
                </div>
                <div className="text-center p-4 rounded-lg" style={{ background: "rgba(239,68,68,0.1)" }}>
                  <p className="text-2xl font-bold" style={{ color: "#ef4444" }}>{invalidRows}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Invalid Rows</p>
                </div>
                <div className="text-center p-4 rounded-lg" style={{ background: "rgba(59,130,246,0.1)" }}>
                  <p className="text-2xl font-bold" style={{ color: "#3b82f6" }}>{validRows}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>To Import</p>
                </div>
              </div>

              {/* File Details */}
              <div className="space-y-4">
                {Object.entries(fileGroups)
                  .filter(([_, group]) => group.file)
                  .map(([key, group]) => {
                    const groupConfig = FILE_GROUPS.find(g => g.type === group.type)!;
                    const Icon = groupConfig.icon;
                    
                    return (
                      <div 
                        key={key}
                        className="flex items-center justify-between p-4 rounded-lg"
                        style={{ background: "var(--hover-bg)", border: "1px solid var(--border)" }}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ background: groupConfig.bgColor }}
                          >
                            <Icon size={18} style={{ color: groupConfig.color }} />
                          </div>
                          <div>
                            <h4 className="font-medium text-primary">{groupConfig.title}</h4>
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                              {group.file?.name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span style={{ color: "#10b981" }}>
                            {group.validation?.valid_count || 0} valid
                          </span>
                          {(group.validation?.invalid_count || 0) > 0 && (
                            <span style={{ color: "#ef4444" }}>
                              {group.validation?.invalid_count} invalid
                            </span>
                          )}
                          <CheckCircle2 size={16} style={{ color: "#10b981" }} />
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => setStep('upload')}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
                  style={{ background: "var(--hover-bg)", color: "var(--text-muted)" }}
                >
                  <ArrowRight size={14} className="rotate-180" />
                  Back to Upload
                </button>
                <button 
                  onClick={startImport}
                  disabled={validRows === 0 || loading}
                  className="flex items-center gap-2 px-6 py-2 rounded-lg font-medium text-sm disabled:opacity-50"
                  style={{ background: "#10b981", color: "white" }}
                >
                  {loading ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                  Start Import ({validRows} rows)
                </button>
              </div>
            </div>
          )}

          {/* Import Step */}
          {step === 'import' && (
            <div className="text-center space-y-6">
              <div>
                <RefreshCw size={48} className="mx-auto animate-spin mb-4" style={{ color: "#3b82f6" }} />
                <h3 className="text-lg font-semibold text-primary mb-2">Importing Data...</h3>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Please wait while we safely import your data with transaction protection
                </p>
              </div>
              
              <div className="flex items-center justify-center gap-4">
                <Shield size={16} style={{ color: "#10b981" }} />
                <span className="text-sm" style={{ color: "#10b981" }}>Transaction Safe</span>
                <Zap size={16} style={{ color: "#f59e0b" }} />
                <span className="text-sm" style={{ color: "#f59e0b" }}>Duplicate Detection Active</span>
              </div>
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && importResult && (
            <div className="text-center space-y-6">
              <div>
                <CheckCircle2 size={48} className="mx-auto mb-4" style={{ color: "#10b981" }} />
                <h3 className="text-lg font-semibold text-primary mb-2">Import Complete!</h3>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  All data has been successfully imported into the system
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {importResult.map((result: any, index: number) => {
                  const groupConfig = FILE_GROUPS.find(g => g.type === result.type)!;
                  const Icon = groupConfig.icon;
                  
                  return (
                    <div 
                      key={result.type}
                      className="p-4 rounded-lg"
                      style={{ background: groupConfig.bgColor, border: `1px solid ${groupConfig.color}30` }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Icon size={16} style={{ color: groupConfig.color }} />
                        <span className="font-medium" style={{ color: groupConfig.color }}>
                          {groupConfig.title}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span style={{ color: "var(--text-muted)" }}>Created:</span>
                          <span style={{ color: "#10b981" }}>{result.result.imported}</span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: "var(--text-muted)" }}>Updated:</span>
                          <span style={{ color: "#3b82f6" }}>{result.result.updated}</span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: "var(--text-muted)" }}>Skipped:</span>
                          <span style={{ color: "var(--text-muted)" }}>{result.result.skipped}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button 
                onClick={onClose}
                className="px-6 py-3 rounded-lg font-medium"
                style={{ background: "#3b82f6", color: "white" }}
              >
                Close
              </button>
            </div>
          )}
      </div>
    </AppDialog>
  );
}