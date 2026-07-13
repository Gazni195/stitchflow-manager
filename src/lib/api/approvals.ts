// Sample approvals: persistent per-role sign-offs on a design's sample.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SampleApproval = {
  id: string;
  designId: string;
  role: string;
  approverName: string;
  approverUserId: string | null;
  approvedAt: string;
  notes: string | null;
};

type DbRow = {
  id: string;
  design_id: string;
  role: string;
  approver_name: string;
  approver_user_id: string | null;
  approved_at: string;
  notes: string | null;
};

function mapRow(r: DbRow): SampleApproval {
  return {
    id: r.id,
    designId: r.design_id,
    role: r.role,
    approverName: r.approver_name,
    approverUserId: r.approver_user_id,
    approvedAt: r.approved_at,
    notes: r.notes,
  };
}

export function useSampleApprovals(designId: string | undefined) {
  return useQuery({
    queryKey: ["sample-approvals", designId],
    enabled: !!designId,
    queryFn: async (): Promise<SampleApproval[]> => {
      const { data, error } = await supabase
        .from("sample_approvals")
        .select("*")
        .eq("design_id", designId!)
        .order("approved_at", { ascending: true });
      if (error) throw error;
      return (data as DbRow[]).map(mapRow);
    },
  });
}

export function useRecordApproval(designId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { role: string; approverName: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("sample_approvals").insert({
        design_id: designId,
        role: v.role,
        approver_name: v.approverName || "—",
        approver_user_id: userData.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sample-approvals", designId] }),
  });
}
