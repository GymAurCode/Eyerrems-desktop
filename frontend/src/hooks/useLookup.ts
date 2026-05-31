import { useState, useEffect, useCallback } from "react";
import { lookupApi, LookupValue } from "../lib/lookupApi";

const cache: Record<string, LookupValue[]> = {};

export function useLookup(category: string | null | undefined) {
  const [options, setOptions] = useState<LookupValue[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!category) {
      setOptions([]);
      return;
    }
    if (cache[category]) {
      setOptions(cache[category]);
      return;
    }
    setLoading(true);
    lookupApi
      .getByCategory(category)
      .then((data) => {
        cache[category] = data;
        setOptions(data);
      })
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [category]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const invalidateCache = useCallback(() => {
    if (category) delete cache[category];
  }, [category]);

  return { options, loading, refresh, invalidateCache };
}

export function invalidateLookupCache(category?: string) {
  if (category) {
    delete cache[category];
  } else {
    Object.keys(cache).forEach((k) => delete cache[k]);
  }
}
