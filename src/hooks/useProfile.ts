import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/diario";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, student_code, teacher_id, split_ratio")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return (data as Profile) ?? null;
    },
  });
}
