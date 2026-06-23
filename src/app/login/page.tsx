'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, EyeOff, AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json()) as any;

      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        setError(data.error || 'Access denied. Invalid credentials.');
      }
    } catch (err) {
      setError('An unexpected system error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Visual background details */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[420px] space-y-6 relative z-10 animate-fade-in">
        {/* Brand header */}
        <div className="text-center space-y-2 select-none">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black mx-auto">
            L
          </div>
          <div>
            <h2 className="heading-2xl font-extrabold text-foreground leading-none">
              Leadroom
            </h2>
            <p className="mt-2 text-label-12 font-semibold text-muted-foreground uppercase tracking-widest">
              Internal OS Console
            </p>
          </div>
        </div>
        
        {/* Form Card */}
        <Card className="border border-border">
          <CardContent className="p-8">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email-address" className="text-label-12 uppercase text-muted-foreground">
                    Email Address
                  </Label>
                  <Input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    placeholder="name@agency.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-label-12 uppercase text-muted-foreground">
                      Password
                    </Label>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 my-auto mr-1 text-muted-foreground hover:bg-transparent"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </Button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-destructive/10 text-destructive p-3.5 rounded-md text-label-12 font-semibold border border-destructive/20 animate-fade-in flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-0.5">
                    <span className="block font-semibold">Authentication Failed</span>
                    <span className="text-muted-foreground font-medium">{error}</span>
                  </div>
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full font-semibold">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                    Connecting...
                  </>
                ) : (
                  'Access Console'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Security Trust Note */}
        <div className="text-center flex items-center justify-center gap-1.5 text-label-12 font-semibold text-muted-foreground select-none">
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Restricted to authorized agency operators only.</span>
        </div>
      </div>
    </div>
  );
}
