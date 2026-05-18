import { useCallback, useState } from "react";
import {
  importApi,
  type DuplicateMode,
  type ImportExecuteResult,
  type ImportModule,
  type ImportRowPreview,
  type ImportValidateResult,
} from "../lib/importApi";

export type ImportStep = "select" | "upload" | "preview" | "importing" | "done";

export function useBulkImport() {
  const [modules, setModules] = useState<ImportModule[]>([]);
  const [moduleKey, setModuleKey] = useState<string>("");
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>("skip");
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<ImportStep>("select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState<ImportValidateResult | null>(null);
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<ImportExecuteResult | null>(null);
  const [progress, setProgress] = useState(0);

  const loadModules = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await importApi.listModules();
      setModules(data);
      if (data.length && !moduleKey) setModuleKey(data[0].key);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load import modules");
    } finally {
      setLoading(false);
    }
  }, [moduleKey]);

  const downloadTemplate = useCallback(async (format: "csv" | "xlsx") => {
    if (!moduleKey) return;
    setError("");
    try {
      await importApi.downloadTemplate(moduleKey, format);
    } catch {
      setError("Template download failed");
    }
  }, [moduleKey]);

  const validateFile = useCallback(async () => {
    if (!file || !moduleKey) return;
    setLoading(true);
    setError("");
    setProgress(30);
    try {
      const res = await importApi.validate(moduleKey, file, duplicateMode);
      setValidation(res);
      setExcludedRows(new Set());
      setStep("preview");
      setProgress(100);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === "string" ? msg : "Validation failed");
    } finally {
      setLoading(false);
    }
  }, [file, moduleKey, duplicateMode]);

  const toggleRow = useCallback((rowNumber: number) => {
    setExcludedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }, []);

  const rowsToImport = useCallback((): ImportRowPreview[] => {
    if (!validation) return [];
    return validation.rows.filter(
      (r) => r.status === "valid" && !excludedRows.has(r.row_number),
    );
  }, [validation, excludedRows]);

  const executeImport = useCallback(async () => {
    if (!validation?.batch_id || !moduleKey) return;
    setStep("importing");
    setLoading(true);
    setError("");
    setProgress(10);
    try {
      const rowNumbers = rowsToImport().map((r) => r.row_number);
      setProgress(50);
      const res = await importApi.execute({
        module_key: moduleKey,
        duplicate_mode: duplicateMode,
        batch_id: validation.batch_id,
        row_numbers: rowNumbers,
      });
      setResult(res);
      setStep("done");
      setProgress(100);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof msg === "string" ? msg : "Import failed");
      setStep("preview");
    } finally {
      setLoading(false);
    }
  }, [validation, moduleKey, duplicateMode, rowsToImport]);

  const reset = useCallback(() => {
    setFile(null);
    setValidation(null);
    setResult(null);
    setExcludedRows(new Set());
    setStep("select");
    setError("");
    setProgress(0);
  }, []);

  return {
    modules,
    moduleKey,
    setModuleKey,
    duplicateMode,
    setDuplicateMode,
    file,
    setFile,
    step,
    setStep,
    loading,
    error,
    setError,
    validation,
    excludedRows,
    toggleRow,
    rowsToImport,
    result,
    progress,
    loadModules,
    downloadTemplate,
    validateFile,
    executeImport,
    reset,
  };
}
