import type { ReactNode } from "react";
import { AdministrationSubnav } from "@/components/administration-subnav";

export default function AdministrationLayout({ children }: { children: ReactNode }) {
  return <>
    <AdministrationSubnav />
    {children}
  </>;
}
