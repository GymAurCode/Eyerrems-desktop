import { api } from "./api";

export const spreadsheetApi = {
  listSheets() {
    return api.get("/spreadsheet/sheets").then((r) => r.data);
  },

  getColumns(sheetName) {
    return api.get(`/spreadsheet/sheets/${sheetName}/columns`).then((r) => r.data);
  },

  getRows(sheetName, { offset = 0, limit = 200, search, sort_by, sort_dir } = {}) {
    const params = { offset, limit };
    if (search) params.search = search;
    if (sort_by) params.sort_by = sort_by;
    if (sort_dir) params.sort_dir = sort_dir;
    return api.get(`/spreadsheet/sheets/${sheetName}/rows`, { params }).then((r) => r.data);
  },

  updateCell(sheetName, rowId, column, value) {
    return api.put(`/spreadsheet/sheets/${sheetName}/cells/${rowId}`, { row_id: rowId, column, value }).then((r) => r.data);
  },

  insertRow(sheetName, data) {
    return api.post(`/spreadsheet/sheets/${sheetName}/rows`, { data }).then((r) => r.data);
  },

  deleteRow(sheetName, rowId) {
    return api.delete(`/spreadsheet/sheets/${sheetName}/rows/${rowId}`);
  },

  duplicateRow(sheetName, rowId) {
    return api.post(`/spreadsheet/sheets/${sheetName}/rows/${rowId}/duplicate`).then((r) => r.data);
  },

  bulkUpdateCells(sheetName, rowIds, column, value) {
    return api.put(`/spreadsheet/sheets/${sheetName}/bulk`, { row_ids: rowIds, column, value }).then((r) => r.data);
  },

  getAuditLogs({ sheet_name, limit = 100, offset = 0 } = {}) {
    const params = { limit, offset };
    if (sheet_name) params.sheet_name = sheet_name;
    return api.get("/spreadsheet/audit", { params }).then((r) => r.data);
  },
};
