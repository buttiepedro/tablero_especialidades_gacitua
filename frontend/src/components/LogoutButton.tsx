"use client";

import { useRouter } from "next/navigation";
import { logoutAction } from "@/actions/auth";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await logoutAction();
    router.push("/login");
  }

  return (
    <button className="btn btn-ghost" onClick={handleLogout} style={{ fontSize: "0.8rem" }}>
      Cerrar sesión
    </button>
  );
}
