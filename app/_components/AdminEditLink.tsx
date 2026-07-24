import Link from "next/link";
import { ShieldIcon } from "./icons";

/**
 * Small shield affordance linking to an item's admin editor. Purely presentational —
 * the page decides whether the viewer is an admin and only renders this when so.
 */
export function AdminEditLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="admin-edit-link" title={label} aria-label={label}>
      <ShieldIcon />
    </Link>
  );
}
