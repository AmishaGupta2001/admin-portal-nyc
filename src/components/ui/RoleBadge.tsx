import { Shield, ShieldCheck, ShieldAlert } from "lucide-react";
import { Badge } from "./Badge";
import { Role, ROLE_META } from "@/lib/roles";

export function RoleBadge({ role }: { role: Role }) {
  if (role === "superadmin") return <Badge variant="accent"><ShieldCheck size={10} className="mr-1" />{ROLE_META.superadmin.label}</Badge>;
  if (role === "admin") return <Badge variant="warning"><Shield size={10} className="mr-1" />{ROLE_META.admin.label}</Badge>;
  if (role === "moderator") return <Badge variant="success"><ShieldAlert size={10} className="mr-1" />{ROLE_META.moderator.label}</Badge>;
  return <Badge variant="default">{ROLE_META.user.label}</Badge>;
}
