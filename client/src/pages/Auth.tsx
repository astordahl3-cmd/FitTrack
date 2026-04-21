import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Dumbbell } from "lucide-react";

export default function Auth() {
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleSignup = async () => {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name || email.split("@")[0] } },
    });
    if (error) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Account created!", description: "Check your email to confirm your account, then log in." });
      setMode("login");
    }
    setLoading(false);
  };

  const handleReset = async () => {
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/FitTrack/",
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setResetSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Dumbbell className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">FitTrack</h1>
            <p className="text-sm text-muted-foreground">Your personal fitness tracker</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password"}
            </CardTitle>
            <CardDescription>
              {mode === "login" ? "Welcome back" : mode === "signup" ? "Start tracking your fitness journey" : "Enter your email to reset your password"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {resetSent ? (
              <div className="text-center py-4 space-y-2">
                <p className="text-sm font-medium text-primary">Check your email</p>
                <p className="text-xs text-muted-foreground">We sent a password reset link to {email}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => { setMode("login"); setResetSent(false); }}>
                  Back to login
                </Button>
              </div>
            ) : (
              <>
                {mode === "signup" && (
                  <div>
                    <Label>Name (optional)</Label>
                    <Input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Your name"
                      autoComplete="name"
                    />
                  </div>
                )}

                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    onKeyDown={e => e.key === "Enter" && (mode === "login" ? handleLogin() : mode === "signup" ? handleSignup() : handleReset())}
                  />
                </div>

                {mode !== "reset" && (
                  <div>
                    <Label>Password</Label>
                    <Input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={mode === "signup" ? "Min 6 characters" : "Your password"}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      onKeyDown={e => e.key === "Enter" && (mode === "login" ? handleLogin() : handleSignup())}
                    />
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={mode === "login" ? handleLogin : mode === "signup" ? handleSignup : handleReset}
                  disabled={loading || !email || (mode !== "reset" && !password)}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
                </Button>

                <div className="flex flex-col gap-2 text-center text-sm">
                  {mode === "login" && (
                    <>
                      <button onClick={() => setMode("signup")} className="text-primary hover:underline">
                        Don't have an account? Sign up
                      </button>
                      <button onClick={() => setMode("reset")} className="text-muted-foreground hover:underline text-xs">
                        Forgot password?
                      </button>
                    </>
                  )}
                  {mode === "signup" && (
                    <button onClick={() => setMode("login")} className="text-primary hover:underline">
                      Already have an account? Sign in
                    </button>
                  )}
                  {mode === "reset" && (
                    <button onClick={() => setMode("login")} className="text-muted-foreground hover:underline">
                      Back to login
                    </button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Your data is private and secure — only you can see it.
        </p>
      </div>
    </div>
  );
}
