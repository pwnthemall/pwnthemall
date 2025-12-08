import { useState, useCallback } from "react";
import axios from "@/lib/axios";
import { Challenge } from "@/models/Challenge";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";

export function useChallengeOrder() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  const fetchChallengesByCategory = useCallback(async (categoryId: number) => {
    setLoading(true);
    try {
      const response = await axios.get<Challenge[]>(`/api/admin/challenges`);
      const filtered = response.data.filter(c => c.challengeCategoryId === categoryId);
      // Sort by order field
      filtered.sort((a, b) => (a.order || 0) - (b.order || 0));
      setChallenges(filtered);
    } catch (error) {
      console.error("Failed to fetch challenges:", error);
      toast.error(t('failed_to_load_challenges'));
      setChallenges([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const reorderChallenges = useCallback(async (categoryId: number, challengeIds: number[]) => {
    setLoading(true);
    try {
      await axios.put(`/api/challenge-categories/${categoryId}/reorder`, {
        challengeIds
      });
      // Dismiss all previous toasts before showing new success toast to avoid spam
      toast.dismiss();
      toast.success(t('challenge_order_updated_success'));
      return true;
    } catch (error: any) {
      console.error("Failed to reorder challenges:", error);
      toast.dismiss();
      toast.error(t(error.response?.data?.error) || t('failed_to_update_challenge_order'));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    challenges,
    loading,
    fetchChallengesByCategory,
    reorderChallenges
  };
}
