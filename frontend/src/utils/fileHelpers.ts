export const getFileIcon = (fileType: string): string => {
  if (fileType.startsWith("image/")) return "\u{1F5BC}\uFE0F";
  if (fileType === "application/pdf") return "\u{1F4C4}";
  if (fileType.includes("word") || fileType.includes("doc")) return "\u{1F4DD}";
  if (fileType.includes("excel") || fileType.includes("sheet")) return "\u{1F4CA}";
  if (fileType.includes("text")) return "\u{1F4C3}";
  return "\u{1F4CE}";
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

export const isImage = (fileType: string): boolean =>
  fileType.startsWith("image/");

export const isPDF = (fileType: string): boolean =>
  fileType === "application/pdf";

export const isInlineViewable = (fileType: string): boolean =>
  isImage(fileType) || isPDF(fileType);
