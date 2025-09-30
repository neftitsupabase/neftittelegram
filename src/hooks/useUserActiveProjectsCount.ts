import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Custom hook to fetch the count of active projects for a specific user.
 * @param userAddress - The wallet address or user identifier
 */
export function useUserActiveProjectsCount(userAddress: string | null) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!userAddress) {
      setCount(0);
      return;
    }
    async function fetchCount() {
      const { count, error } = await supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("user_address", userAddress); // Change this field if your schema uses a different one

      if (!error) setCount(count ?? 0);
      else setCount(0);
    }
    fetchCount();
  }, [userAddress]);

  return count;
} 