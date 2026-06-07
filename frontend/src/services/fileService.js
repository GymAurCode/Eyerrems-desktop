const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function getToken() {
  try {
    return localStorage.getItem("token") || sessionStorage.getItem("token") || null;
  } catch {
    return null;
  }
}

async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE_URL}${url}`, { ...options, headers });
  if (!res.ok) {
    let detail = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export const fileService = {
  async uploadFile({
    file,
    module,
    recordType,
    recordId,
    documentType = null,
    description = null,
    expiryDate = null,
    onProgress = null,
  }) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("module", module);
    formData.append("record_type", recordType);
    formData.append("record_id", recordId);
    if (documentType) formData.append("document_type", documentType);
    if (description) formData.append("description", description);
    if (expiryDate) formData.append("expiry_date", expiryDate);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      if (onProgress) {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        });
      }

      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.detail || "Upload failed"));
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Network error during upload"));
      });

      const token = getToken();
      xhr.open("POST", `${API_BASE_URL}/api/files/upload`);
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.send(formData);
    });
  },

  async getFiles(module, recordType, recordId) {
    return apiFetch(`/api/files/list/${module}/${recordType}/${recordId}`);
  },

  async deleteFile(fileId) {
    return apiFetch(`/api/files/${fileId}`, { method: "DELETE" });
  },

  async getFileCount(module, recordType, recordId) {
    return apiFetch(`/api/files/count/${module}/${recordType}/${recordId}`);
  },

  async getFileCountsBatch(module, recordType, ids) {
    const idsStr = Array.isArray(ids) ? ids.join(",") : ids;
    return apiFetch(
      `/api/files/count-batch?module=${module}&record_type=${recordType}&ids=${encodeURIComponent(idsStr)}`
    );
  },

  formatFileSize(bytes) {
    if (!bytes && bytes !== 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },

  getFileIcon(fileType) {
    if (!fileType) return "document";
    if (fileType === "application/pdf") return "pdf";
    if (fileType.startsWith("image/")) return "image";
    if (fileType.includes("word") || fileType.includes("doc")) return "word";
    if (fileType.includes("excel") || fileType.includes("sheet")) return "excel";
    return "document";
  },
};
