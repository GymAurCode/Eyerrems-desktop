import { api } from "./api";

export interface Property {
  id: number;
  name: string;
  [key: string]: any;
}

export interface Unit {
  id: number;
  property_id: number;
  [key: string]: any;
}

export interface PropertyDetail extends Property {
  units?: Unit[];
  [key: string]: any;
}

export interface PropertyAttachment {
  id: number;
  property_id: number;
  filename: string;
  [key: string]: any;
}

export interface Location {
  id: number;
  [key: string]: any;
}

export interface Amenity {
  id: number;
  [key: string]: any;
}

export interface FloorWithUnits {
  floor: string;
  units: Unit[];
}

export interface PropertyCategory { id: number; name: string; [key: string]: any; }
export interface Floor { id: number; property_id: number; name: string; [key: string]: any; }
export interface Contact { id: number; name: string; [key: string]: any; }
export interface ContactDocument { id: number; contact_id: number; filename: string; [key: string]: any; }
export interface ContactInteraction { id: number; contact_id: number; type: string; [key: string]: any; }
export interface Lease { id: number; property_id: number; tenant_id: number; [key: string]: any; }
export interface LeaseDetail extends Lease { payments?: LeasePayment[]; [key: string]: any; }
export interface LeasePayment { id: number; lease_id: number; amount: number; [key: string]: any; }
export interface PropertySale { id: number; property_id: number; buyer_id: number; [key: string]: any; }
export interface Buyer { id: number; name: string; [key: string]: any; }
export interface Seller { id: number; name: string; [key: string]: any; }
export interface SaleInstalment { id: number; sale_id: number; amount: number; due_date: string; [key: string]: any; }

const fromResponse = (res: any) => {
  const d = res?.data !== undefined ? res.data : res;
  return Array.isArray(d) ? d : d?.items ?? d?.data ?? d ?? [];
};

const single = (res: any) => (res?.data !== undefined ? res.data : res);

export const propApi = {
  getProperties: async (): Promise<Property[]> => {
    const res = await api.get("/properties/");
    return fromResponse(res);
  },
  create: async (payload: any): Promise<Property> => {
    const res = await api.post("/properties/", payload);
    return single(res);
  },
  createProperty: async (payload: any): Promise<Property> => {
    const res = await api.post("/properties/", payload);
    return single(res);
  },
  updateProperty: async (id: number | string, payload: any): Promise<Property> => {
    const res = await api.patch(`/properties/${id}`, payload);
    return single(res);
  },
  deleteProperty: async (id: number | string): Promise<void> => {
    await api.delete(`/properties/${id}`);
  },
  getProperty: async (id: number | string): Promise<PropertyDetail> => {
    const res = await api.get(`/properties/${id}`);
    return single(res);
  },
  getCategories: async (): Promise<PropertyCategory[]> => {
    const res = await api.get("/properties/categories");
    return fromResponse(res);
  },
  createCategory: async (payload: any): Promise<PropertyCategory> => {
    const res = await api.post("/properties/categories", payload);
    return single(res);
  },
  deleteCategory: async (id: number): Promise<void> => {
    await api.delete(`/properties/categories/${id}`);
  },
  getAmenities: async (): Promise<Amenity[]> => {
    const res = await api.get("/properties/amenities");
    return fromResponse(res);
  },
  createAmenity: async (payload: any): Promise<Amenity> => {
    const res = await api.post("/properties/amenities", payload);
    return single(res);
  },
  getLocations: async (): Promise<Location[]> => {
    const res = await api.get("/properties/locations");
    return fromResponse(res);
  },
  createLocation: async (payload: any): Promise<Location> => {
    const res = await api.post("/properties/locations", payload);
    return single(res);
  },
  checkTid: async (tid: string): Promise<{ available: boolean; message?: string }> => {
    const res = await api.get("/properties/check-tid", { params: { tid } });
    return single(res);
  },
  getUnits: async (): Promise<Unit[]> => {
    const res = await api.get("/properties/units/all");
    return fromResponse(res);
  },
  createUnit: async (payload: any): Promise<Unit> => {
    const res = await api.post("/properties/units", payload);
    return single(res);
  },
  updateUnit: async (id: number | string, payload: any): Promise<Unit> => {
    const res = await api.patch(`/properties/units/${id}`, payload);
    return single(res);
  },
  deleteUnit: async (id: number | string): Promise<void> => {
    await api.delete(`/properties/units/${id}`);
  },
  getFloors: async (propertyId: number | string): Promise<Floor[]> => {
    const res = await api.get(`/properties/${propertyId}/floors`);
    return fromResponse(res);
  },
  createFloor: async (payload: any): Promise<Floor> => {
    const res = await api.post("/properties/floors", payload);
    return single(res);
  },
  getLeases: async (): Promise<Lease[]> => {
    const res = await api.get("/leases");
    return fromResponse(res);
  },
  getLeaseDetail: async (id: number | string): Promise<LeaseDetail> => {
    const res = await api.get(`/properties/leases/${id}`);
    return single(res);
  },
  createLease: async (payload: any): Promise<Lease> => {
    const res = await api.post("/properties/leases", payload);
    return single(res);
  },
  renewLease: async (id: number | string, payload: any): Promise<Lease> => {
    const res = await api.post(`/properties/leases/${id}/renew`, payload);
    return single(res);
  },
  terminateLease: async (id: number | string, payload: any): Promise<Lease> => {
    const res = await api.post(`/properties/leases/${id}/terminate`, payload);
    return single(res);
  },
  getRentSchedule: async (id: number | string): Promise<any[]> => {
    const res = await api.get(`/properties/leases/${id}/schedule`);
    return fromResponse(res);
  },
  recordPayment: async (leaseId: number | string, payload: any): Promise<LeasePayment> => {
    const res = await api.post(`/properties/leases/${leaseId}/payments`, payload);
    return single(res);
  },
  getBuyers: async (): Promise<Buyer[]> => {
    const res = await api.get("/properties/buyers/all");
    return fromResponse(res);
  },
  getSellers: async (): Promise<Seller[]> => {
    const res = await api.get("/properties/sellers/all");
    return fromResponse(res);
  },
  getContact: async (id: number | string): Promise<Contact> => {
    const res = await api.get(`/properties/contacts/${id}`);
    return single(res);
  },
  createContact: async (payload: any): Promise<Contact> => {
    const res = await api.post("/properties/contacts", payload);
    return single(res);
  },
  updateContact: async (id: number | string, payload: any): Promise<Contact> => {
    const res = await api.patch(`/properties/contacts/${id}`, payload);
    return single(res);
  },
  getContactTransactions: async (id: number | string): Promise<any[]> => {
    const res = await api.get(`/properties/contacts/${id}/transactions`);
    return fromResponse(res);
  },
  listContactDocuments: async (contactId: number | string): Promise<ContactDocument[]> => {
    const res = await api.get(`/properties/contacts/${contactId}/documents`);
    return fromResponse(res);
  },
  uploadContactDocument: async (contactId: number | string, formData: FormData): Promise<ContactDocument> => {
    const res = await api.post(`/properties/contacts/${contactId}/documents`, formData);
    return single(res);
  },
  updateContactDocumentStatus: async (contactId: number | string, docId: number | string, status: string): Promise<ContactDocument> => {
    const res = await api.patch(`/properties/contacts/${contactId}/documents/${docId}`, { status });
    return single(res);
  },
  listContactInteractions: async (contactId: number | string): Promise<ContactInteraction[]> => {
    const res = await api.get(`/properties/contacts/${contactId}/interactions`);
    return fromResponse(res);
  },
  logContactInteraction: async (contactId: number | string, payload: any): Promise<ContactInteraction> => {
    const res = await api.post(`/properties/contacts/${contactId}/interactions`, payload);
    return single(res);
  },
  addContactRole: async (contactId: number | string, roleName: string): Promise<Contact> => {
    const res = await api.post(`/properties/contacts/${contactId}/add-role`, { role: roleName });
    return single(res);
  },
  uploadImage: async (propertyId: number | string, file: File): Promise<any> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await api.post(`/properties/${propertyId}/images`, fd);
    return single(res);
  },
  uploadAttachment: async (propertyId: number | string, file: File): Promise<PropertyAttachment> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await api.post(`/properties/${propertyId}/attachments`, fd);
    return single(res);
  },
  updateAttachmentMeta: async (attachmentId: number | string, payload: any): Promise<PropertyAttachment> => {
    const res = await api.patch(`/properties/attachments/${attachmentId}`, payload);
    return single(res);
  },
  deleteAttachment: async (attachmentId: number | string): Promise<void> => {
    await api.delete(`/properties/attachments/${attachmentId}`);
  },
  createSale: async (payload: any): Promise<PropertySale> => {
    const res = await api.post("/properties/sales", payload);
    return single(res);
  },
  getSale: async (saleId: number | string): Promise<PropertySale> => {
    const res = await api.get(`/properties/sales/${saleId}`);
    return single(res);
  },
  recordSalePayment: async (saleId: number | string, payload: any): Promise<any> => {
    const res = await api.post(`/properties/sales/${saleId}/payments`, payload);
    return single(res);
  },
  getSaleInstalments: async (saleId: number | string): Promise<SaleInstalment[]> => {
    const res = await api.get(`/properties/sales/${saleId}/instalments`);
    return fromResponse(res);
  },
  updateSaleStage: async (saleId: number | string, payload: any): Promise<PropertySale> => {
    const res = await api.post(`/properties/sales/${saleId}/stage`, payload);
    return single(res);
  },
  completeSale: async (saleId: number | string): Promise<PropertySale> => {
    const res = await api.post(`/properties/sales/${saleId}/complete`);
    return single(res);
  },
  cancelSale: async (saleId: number | string, payload: any): Promise<PropertySale> => {
    const res = await api.post(`/properties/sales/${saleId}/cancel`, payload);
    return single(res);
  },
  uploadSaleDocument: async (saleId: number | string, formData: FormData): Promise<any> => {
    const res = await api.post(`/properties/sales/${saleId}/documents`, formData);
    return single(res);
  },
  previewTid: async (): Promise<{ tid: string }> => {
    const res = await api.get("/properties/preview-tid");
    return single(res);
  },
};
