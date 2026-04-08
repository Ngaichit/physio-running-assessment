import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useLocation } from "wouter";

type Mode = "signin" | "register";

export default function Login() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const body =
        mode === "signin"
          ? { email, password }
          : { name, email, accessCode: password };

      const res = await fetch(
        mode === "signin" ? "/api/auth/login" : "/api/auth/register",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        }
      );

      if (res.ok) {
        setLocation("/");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  const isSignIn = mode === "signin";

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[oklch(0.45_0.12_230/0.05)] via-background to-[oklch(0.72_0.17_55/0.05)]">
      <div className="flex flex-col gap-8 p-8 max-w-sm w-full">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            Running Assessment Platform
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {isSignIn ? "Sign in to continue" : "Create a new account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isSignIn && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">
              {isSignIn ? "Password" : "Access code"}
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete={isSignIn ? "current-password" : "off"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            {!isSignIn && (
              <p className="text-xs text-muted-foreground">
                Ask your clinic administrator for the access code.
              </p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? isSignIn ? "Signing in..." : "Creating account..."
              : isSignIn ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="text-sm text-center text-muted-foreground">
          {isSignIn ? (
            <>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("register")}
                className="text-primary underline-offset-4 hover:underline"
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="text-primary underline-offset-4 hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </p>

        <p className="text-xs text-muted-foreground/60 text-center">
          Hong Kong Sports Clinic &middot; Women's and Pelvic Health &middot; Jockey Performance Institute
        </p>
      </div>
    </div>
  );
}
