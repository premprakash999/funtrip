import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plane, MapPin, Camera, Users } from 'lucide-react';

const Auth = () => {
  const { user, loading } = useAuth();
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp } = useAuth();

  if (loading) return <div className="flex min-h-screen items-center justify-center gradient-bg"><p className="text-muted-foreground">Loading...</p></div>;
  if (user) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(loginEmail, loginPassword);
    if (error) toast.error(error.message);
    setSubmitting(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName);
    if (error) toast.error(error.message);
    else toast.success('Account created! You can now log in.');
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center gradient-bg p-4">
      <div className="w-full max-w-md">
        {/* Fun icons row */}
        <div className="mb-6 flex justify-center gap-3">
          {['🏖️', '🏔️', '✈️', '🎒', '🌴'].map((emoji, i) => (
            <span key={i} className="text-3xl animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}>{emoji}</span>
          ))}
        </div>

        <Card className="border-none shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-lg">
              <Plane className="h-7 w-7 text-primary-foreground" />
            </div>
            <CardTitle className="text-3xl font-extrabold bg-clip-text text-transparent gradient-primary" style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              FunTrip
            </CardTitle>
            <CardDescription className="text-base">Plan trips, split expenses & make memories 🎉</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex justify-center gap-6 text-muted-foreground">
              <div className="flex flex-col items-center gap-1">
                <div className="rounded-full bg-primary/10 p-2"><MapPin className="h-4 w-4 text-primary" /></div>
                <span className="text-xs">Plan</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="rounded-full bg-secondary/10 p-2"><Users className="h-4 w-4 text-secondary" /></div>
                <span className="text-xs">Split</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="rounded-full bg-accent/10 p-2"><Camera className="h-4 w-4 text-accent" /></div>
                <span className="text-xs">Share</span>
              </div>
            </div>

            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required placeholder="you@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input id="login-password" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required placeholder="••••••" />
                  </div>
                  <Button type="submit" className="w-full gradient-primary border-none text-primary-foreground hover:opacity-90" disabled={submitting}>
                    {submitting ? 'Signing in...' : '🚀 Sign In'}
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Display Name</Label>
                    <Input id="signup-name" value={signupName} onChange={e => setSignupName(e.target.value)} required placeholder="Your name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} required placeholder="you@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input id="signup-password" type="password" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} required minLength={6} placeholder="Min 6 characters" />
                  </div>
                  <Button type="submit" className="w-full gradient-primary border-none text-primary-foreground hover:opacity-90" disabled={submitting}>
                    {submitting ? 'Creating account...' : '🎉 Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
