"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/general", label: "General" },
  { href: "/especialidades", label: "Especialidades" },
  { href: "/faqs", label: "FAQs" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="page-nav">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`nav-link${pathname === link.href ? " active" : ""}`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
