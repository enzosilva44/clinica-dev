import { useAuth } from "../contexts/AuthContext";
import { getFeatures } from "../config/features";

export function useFeatures() {
  const { user } = useAuth();
  const planFeatures = getFeatures(user?.plan ?? "solo");
  const overrides    = user?.featureOverrides ?? {};
  return { ...planFeatures, ...overrides };
}
