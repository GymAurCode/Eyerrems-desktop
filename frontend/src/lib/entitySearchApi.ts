import { api } from "./api";

interface EntityResult {
  id: number | string;
  name: string;
  subtitle: string;
  status?: string;
  type: string;
}

const SEARCH_ENDPOINTS: Record<string, string> = {
  client: "/crm/clients/search",
  booking: "/crm/bookings/search",
  tenant: "/tenants/search",
  property: "/properties/search",
  deal: "/crm/deals/search",
  employee: "/hr/employees/search",
};

export async function searchEntities(
  entityType: string,
  query: string
): Promise<EntityResult[]> {
  const endpoint = SEARCH_ENDPOINTS[entityType];
  if (!endpoint) return [];

  try {
    const { data } = await api.get(endpoint, {
      params: { q: query, limit: 10 },
    });
    const items = Array.isArray(data) ? data : data.items || data.results || [];
    return items.map((item: any) => ({
      id: item.id,
      name: item.name || item.full_name || item.title || `#${item.id}`,
      subtitle: item.address || item.email || item.phone || "",
      status: item.status,
      type: entityType,
    }));
  } catch (e) {
    console.error(`Entity search failed for ${entityType}:`, e);
    return [];
  }
}
