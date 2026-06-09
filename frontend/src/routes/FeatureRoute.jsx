import { Navigate } from "react-router-dom";
import { useFeatures } from "../hooks/useFeatures";

export default function FeatureRoute({ feature, children }) {
  const features = useFeatures();

  if (!features[feature]) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
