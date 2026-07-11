// Supabase-backed worker roster (shop-wide, read-only from the client).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Worker = {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  department: string;
  dailyWage: number;
  active: boolean;
};

// Matches the mockup's own numbers: a Rahman on ₹900/day shows as ₹105.88/hr.
export const HOURS_PER_DAY = 8.5;

export function hourlyRate(dailyWage: number): number {
  return dailyWage / HOURS_PER_DAY;
}

export function useWorkers() {
  return useQuery({
    queryKey: ["workers"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Worker[]> => {
      const { data, error } = await supabase
        .from("workers")
        .select("*")
        .eq("active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data as Array<{
        id: string;
        name: string;
        role: string;
        phone: string | null;
        department: string;
        daily_wage: number;
        active: boolean;
      }>).map((w) => ({
        id: w.id,
        name: w.name,
        role: w.role,
        phone: w.phone,
        department: w.department,
        dailyWage: w.daily_wage,
        active: w.active,
      }));
    },
  });
}
