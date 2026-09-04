import { useState } from "react";
import type { User } from "../api/client";

export function useAuth() {
  const [user, setUserState] = useState<User | null>(() => {
    const raw = localStorage.getItem("user");
    return raw ? (JSON.parse(raw) as User) : null;
  });
  return {
    user,
    setUser: (u: User | null, token?: string) => {
      setUserState(u);
      if (u && token) {
        localStorage.setItem("user", JSON.stringify(u));
        localStorage.setItem("token", token);
      } else {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
    },
  };
}
