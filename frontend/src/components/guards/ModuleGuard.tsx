interface ModuleGuardProps {
  module: string;
  children: React.ReactNode;
}

export default function ModuleGuard({ children }: ModuleGuardProps) {
  return <>{children}</>;
}
