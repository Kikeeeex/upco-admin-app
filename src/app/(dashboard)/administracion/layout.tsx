import type { ReactNode } from "react";

export default async function AdministrationLayout({ children }: { children: ReactNode }) {
  return <div className="administration-module">{children}</div>;
}
