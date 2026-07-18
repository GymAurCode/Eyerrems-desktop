import { api } from "./api";

export interface BookingCreatePayload {
  unit_id?: number;
  [key: string]: any;
}

export interface BookingDetail {
  id: number;
  [key: string]: any;
}

export interface BookingListItem {
  id: number;
  [key: string]: any;
}

export interface BookingStats {
  [key: string]: any;
}

export interface BookingLog { id: number; booking_id: number; action: string; [key: string]: any; }
export interface InstallmentPlan { id: number; booking_id: number; installments: InstallmentItem[]; [key: string]: any; }
export interface InstallmentItem { id: number; installment_no: number; due_date: string; amount: number; paid: boolean; [key: string]: any; }

export const bookingApi = {
  list: async (params?: any): Promise<BookingListItem[]> => {
    const { data } = await api.get("/crm/bookings", { params });
    return Array.isArray(data) ? data : data.items ?? data.data ?? [];
  },
  create: async (payload: BookingCreatePayload): Promise<BookingDetail> => {
    const { data } = await api.post("/crm/bookings", payload);
    return data;
  },
  get: async (id: number): Promise<BookingDetail> => {
    const { data } = await api.get(`/crm/bookings/${id}`);
    return data;
  },
  checkAvailability: async (params: { unit_id: number }): Promise<{ available: boolean }> => {
    const { data } = await api.get("/crm/bookings/check-availability", { params });
    return data;
  },
  payInstallment: async (bookingId: number, installmentId: number, payload: any): Promise<any> => {
    const { data } = await api.post(`/crm/bookings/${bookingId}/installments/${installmentId}/pay`, payload);
    return data;
  },
  stats: async (): Promise<BookingStats> => {
    const { data } = await api.get("/crm/bookings/stats/summary");
    return data;
  },
  updateStatus: async (id: number, payload: any): Promise<void> => {
    await api.patch(`/crm/bookings/${id}/status`, payload);
  },
  extend: async (id: number, additionalDays: number, notes?: string): Promise<void> => {
    await api.post(`/crm/bookings/${id}/extend`, { additional_days: additionalDays, notes });
  },
  createInstallmentPlan: async (bookingId: number, payload: any): Promise<any> => {
    const { data } = await api.post(`/crm/bookings/${bookingId}/installment-plans`, payload);
    return data;
  },
  convertToSale: async (id: number): Promise<void> => {
    await api.post(`/crm/bookings/${id}/convert`);
  },
};
