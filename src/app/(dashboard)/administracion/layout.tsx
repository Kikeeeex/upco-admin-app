import type { ReactNode } from "react";
import { AdministrationSubnav } from "@/components/administration-subnav";
import { getAccessContext } from "@/features/auth/access";

export default async function AdministrationLayout({ children }: { children: ReactNode }) {
  const access = await getAccessContext();
  return <>
    <AdministrationSubnav permissions={access.kind === "allowed" ? access.permissions : []} isAdmin={access.kind === "allowed" && access.role === "admin"} />
    {children}
  </>;
}
