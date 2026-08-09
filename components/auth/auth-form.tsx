"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const supabase = createClient();
    const result =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          });
    setBusy(false);
    if (result.error) toast.error(result.error.message);
    else if (mode === "sign-up")
      toast.success("Check your email to confirm your account.", {
        duration: 9000,
      });
    else router.push("/documents");
  }
  async function google() {
    setBusy(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      toast.error(error.message);
      setBusy(false);
    }
  }
  return (
    <section className="auth-form" aria-labelledby="auth-heading">
      <h2 id="auth-heading">
        {mode === "sign-in" ? "Welcome back" : "Create your account"}
      </h2>
      <p className="supporting">
        {mode === "sign-in"
          ? "Sign in to continue to your workspace."
          : "Start with a sample document you can make your own."}
      </p>
      <button
        className="button"
        style={{ width: "100%", marginTop: 20 }}
        onClick={google}
        disabled={busy}
      >
        {busy && <LoaderCircle size={15} className="spin" aria-hidden="true" />}
        Continue with Google
      </button>
      <div className="divider">or use email</div>
      <form className="form-stack" onSubmit={submit}>
        <label className="form-field">
          <span className="field-label">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label className="form-field">
          <span className="field-label">Password</span>
          <input
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
          />
        </label>
        <button className="button primary" type="submit" disabled={busy}>
          {busy && (
            <LoaderCircle size={15} className="spin" aria-hidden="true" />
          )}
          {busy
            ? mode === "sign-in"
              ? "Signing in…"
              : "Signing up…"
            : mode === "sign-in"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>
      <p className="auth-switch">
        {mode === "sign-in" ? "New to Crossval?" : "Already have an account?"}{" "}
        <button
          className="text-link"
          onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
        >
          {mode === "sign-in" ? "Create one" : "Sign in"}
        </button>
      </p>
    </section>
  );
}
