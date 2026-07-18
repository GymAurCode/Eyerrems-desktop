import { api } from "./api";

export interface Department { id: number; [key: string]: any; }
export interface Position { id: number; [key: string]: any; }
export interface Branch { id: number; [key: string]: any; }
export interface Employee { id: number; [key: string]: any; }
export interface Attendance { id: number; [key: string]: any; }
export interface LeaveType { id: number; [key: string]: any; }
export interface Leave { id: number; [key: string]: any; }
export interface LeaveBalance { [key: string]: any; }
export interface Payroll { id: number; [key: string]: any; }
export interface Holiday { id: number; [key: string]: any; }
export interface SalaryStructure { [key: string]: any; }
export interface PayslipData { [key: string]: any; }

export const departmentsApi = {
  list: async (): Promise<Department[]> => {
    const { data } = await api.get("/hr/departments");
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  create: async (payload: any): Promise<Department> => {
    const { data } = await api.post("/hr/departments", payload);
    return data;
  },
  update: async (id: number, payload: any): Promise<void> => {
    await api.patch(`/hr/departments/${id}`, payload);
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/hr/departments/${id}`);
  },
};

export const positionsApi = {
  list: async (): Promise<Position[]> => {
    const { data } = await api.get("/hr/positions");
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  create: async (payload: any): Promise<Position> => {
    const { data } = await api.post("/hr/positions", payload);
    return data;
  },
  update: async (id: number, payload: any): Promise<void> => {
    await api.patch(`/hr/positions/${id}`, payload);
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/hr/positions/${id}`);
  },
};

export const branchesApi = {
  list: async (): Promise<Branch[]> => {
    const { data } = await api.get("/hr/branches");
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  create: async (payload: any): Promise<Branch> => {
    const { data } = await api.post("/hr/branches", payload);
    return data;
  },
  update: async (id: number, payload: any): Promise<void> => {
    await api.patch(`/hr/branches/${id}`, payload);
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/hr/branches/${id}`);
  },
};

export const employeesApi = {
  list: async (params?: any): Promise<Employee[]> => {
    const { data } = await api.get("/hr/employees", { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  get: async (id: number): Promise<Employee> => {
    const { data } = await api.get(`/hr/employees/${id}`);
    return data;
  },
  create: async (payload: any): Promise<Employee> => {
    const { data } = await api.post("/hr/employees", payload);
    return data;
  },
  update: async (id: number, updates?: any): Promise<void> => {
    await api.patch(`/hr/employees/${id}`, updates);
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/hr/employees/${id}`);
  },
  getSalary: async (id: number): Promise<SalaryStructure> => {
    const { data } = await api.get(`/hr/employees/${id}/salary`);
    return data;
  },
  updateSalary: async (id: number, payload: any): Promise<void> => {
    await api.put(`/hr/employees/${id}/salary`, payload);
  },
  createSalary: async (id: number, payload: any): Promise<void> => {
    await api.post(`/hr/employees/${id}/salary`, payload);
  },
};

export const attendanceApi = {
  list: async (params?: any): Promise<Attendance[]> => {
    const { data } = await api.get("/hr/attendance", { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  mark: async (payload: any): Promise<void> => {
    await api.post("/hr/attendance", payload);
  },
  dailyReport: async (date: string, departmentId?: number): Promise<any[]> => {
    const { data } = await api.get("/hr/attendance/report/daily", { params: { date, department_id: departmentId } });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
};

export const leaveTypesApi = {
  list: async (): Promise<LeaveType[]> => {
    const { data } = await api.get("/hr/leave-types");
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  create: async (payload: any): Promise<LeaveType> => {
    const { data } = await api.post("/hr/leave-types", payload);
    return data;
  },
};

export const leavesApi = {
  list: async (params?: any): Promise<Leave[]> => {
    const { data } = await api.get("/hr/leaves", { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  request: async (payload: any): Promise<Leave> => {
    const { data } = await api.post("/hr/leaves", payload);
    return data;
  },
  approve: async (id: number): Promise<void> => {
    await api.patch(`/hr/leaves/${id}/approve`);
  },
  reject: async (id: number, reason?: string): Promise<void> => {
    await api.patch(`/hr/leaves/${id}/reject`, { reason });
  },
  balance: async (employeeId: number): Promise<LeaveBalance> => {
    const { data } = await api.get(`/hr/leaves/balance/${employeeId}`);
    return data;
  },
};

export const payrollApi = {
  list: async (params?: any): Promise<Payroll[]> => {
    const { data } = await api.get("/hr/payroll", { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  summary: async (period?: string): Promise<any> => {
    const { data } = await api.get("/hr/payroll/report/summary", { params: { payroll_period: period } });
    return data;
  },
  calculate: async (employeeId: number, period: string): Promise<void> => {
    await api.post("/hr/payroll/calculate", { employee_id: employeeId, period });
  },
  calculateAll: async (period: string): Promise<void> => {
    await api.post("/hr/payroll/calculate-all", { period });
  },
  approve: async (id: number): Promise<void> => {
    await api.patch(`/hr/payroll/${id}/approve`);
  },
  postAccounting: async (id: number): Promise<void> => {
    await api.post(`/hr/payroll/${id}/post-accounting`);
  },
  markPaid: async (id: number, payload?: any): Promise<void> => {
    await api.patch(`/hr/payroll/${id}/paid`, payload);
  },
  payslip: async (id: number): Promise<PayslipData> => {
    const { data } = await api.get(`/hr/payroll/${id}/payslip`);
    return data;
  },
};

export const holidaysApi = {
  list: async (year?: number): Promise<Holiday[]> => {
    const { data } = await api.get("/hr/holidays", { params: { year } });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  create: async (payload: any): Promise<Holiday> => {
    const { data } = await api.post("/hr/holidays", payload);
    return data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/hr/holidays/${id}`);
  },
};
