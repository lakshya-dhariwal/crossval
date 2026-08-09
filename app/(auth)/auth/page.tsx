import { AuthForm } from "@/components/auth/auth-form";
export default function AuthPage() {
  return (
    <main className="auth-page">
      <div className="auth-layout">
        <div className="auth-copy">
          <div className="brand" style={{ padding: 0 }}>
            <span className="brand-mark">C</span>
            <span>Crossval</span>
          </div>
          <h1>Pricing work, with a little more calm.</h1>
          <p>
            Build clear pricing documents, keep every number honest, and turn a
            working draft into a reusable final document.
          </p>
        </div>
        <AuthForm />
      </div>
    </main>
  );
}
