import { useState, type FormEvent } from "react";
import { api, type User } from "../api/client";

export function LoginPage({
  onLogin,
}: {
  onLogin: (u: User, token: string) => void;
}) {
  const [email, setEmail] = useState("ops@darines.local");
  const [password, setPassword] = useState("ChangeMe123!");
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await api.login(email, password);
      onLogin(res.user, res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }
  return (
    <div className="login-page">
      <form className="login-card stack" onSubmit={submit}>
        <h2 style={{ margin: 0 }}>quote-me</h2>
        <p className="muted">Sign in to manage catering quotations</p>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="username"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
        />
        {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
        <button type="submit">Sign in</button>
      </form>
    </div>
  );
}
