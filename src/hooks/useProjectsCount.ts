import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Custom hook to fetch the count of projects from Supabase.
 * @param category - "all" for all projects, or a specific category (e.g., "featured")
 */
export function useProjectsCount(category: string) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    async function fetchCount() {
      let query = supabase.from("projects").select("*", { count: "exact", head: true });
      if (category !== "all") {
        query = query.eq("category", category);
      }
      const { count, error } = await query;
      if (!error) setCount(count ?? 0);
      else setCount(0);
    }
    fetchCount();
  }, [category]);

  return count;
}
