/**
 * FeatureGuard — conditionally render children if feature is enabled.
 *
 * Usage:
 *   <FeatureGuard feature="hr_module">
 *     <Link to="/hr">HR</Link>
 *   </FeatureGuard>
 */
import { ReactNode } from "react";
import { useAuthStore } from "../store/auth";

type Props = {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
};

export default function FeatureGuard({ feature, children, fallback = null }: Props) {
  const hasFeature = useAuthStore((s) => s.hasFeature);

  if (!hasFeature(feature)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
