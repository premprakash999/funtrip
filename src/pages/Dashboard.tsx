import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Plane, LogOut, MapPin } from 'lucide-react';

interface Trip {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

const AVATAR_COLORS = [
  'gradient-primary',
  'gradient-teal',
  'gradient-warm',
];

const getInitials = (name: string) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripMembers, setTripMembers] = useState<Record<string, { user_id: string; display_name: string }[]>>({});
  const [loading, setLoading] = useState(true);
  const [newTripName, setNewTripName] = useState('');
  const [newTripDesc, setNewTripDesc] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [profile, setProfile] = useState<{ display_name: string } | null>(null);

  const fetchTrips = async () => {
    const { data, error } = await supabase.from('trips').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setTrips(data);
      // Fetch members for each trip
      const memberMap: Record<string, { user_id: string; display_name: string }[]> = {};
      for (const trip of data) {
        const { data: members } = await supabase.from('trip_members').select('user_id').eq('trip_id', trip.id);
        if (members) {
          const userIds = members.map(m => m.user_id);
          const { data: profiles } = await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds);
          memberMap[trip.id] = profiles?.map(p => ({ user_id: p.user_id, display_name: p.display_name || 'Unknown' })) || [];
        }
      }
      setTripMembers(memberMap);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTrips();
    if (user) {
      supabase.from('profiles').select('display_name').eq('user_id', user.id).single().then(({ data }) => {
        if (data) setProfile(data);
      });
    }
  }, [user]);

  const createTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { data, error } = await supabase.from('trips').insert({ name: newTripName, description: newTripDesc || null, created_by: user.id }).select().single();
    if (error) { toast.error(error.message); return; }
    await supabase.from('trip_members').insert({ trip_id: data.id, user_id: user.id });
    setNewTripName(''); setNewTripDesc(''); setDialogOpen(false);
    toast.success('Trip created! 🎉'); fetchTrips();
  };

  return (
    <div className="min-h-screen gradient-bg">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-md">
              <Plane className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-extrabold bg-clip-text text-transparent gradient-primary" style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>FunTrip</h1>
          </div>
          <div className="flex items-center gap-3">
            {profile && (
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="gradient-primary text-primary-foreground text-xs font-bold">
                    {getInitials(profile.display_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium hidden sm:inline">{profile.display_name}</span>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-extrabold">My Trips ✈️</h2>
            <p className="text-muted-foreground mt-1">Your adventures await!</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary border-none text-primary-foreground shadow-lg hover:opacity-90">
                <Plus className="mr-2 h-4 w-4" /> New Trip
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create a New Trip 🗺️</DialogTitle></DialogHeader>
              <form onSubmit={createTrip} className="space-y-4">
                <div className="space-y-2">
                  <Label>Trip Name</Label>
                  <Input value={newTripName} onChange={e => setNewTripName(e.target.value)} placeholder="Goa Trip 2026 🏖️" required />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={newTripDesc} onChange={e => setNewTripDesc(e.target.value)} placeholder="Fun trip with the squad!" />
                </div>
                <Button type="submit" className="w-full gradient-primary border-none text-primary-foreground">Create Trip</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading trips...</p>
        ) : trips.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center py-16">
              <div className="mb-4 text-6xl">🌍</div>
              <p className="text-xl font-bold">No trips yet</p>
              <p className="text-muted-foreground mt-1">Create your first trip and invite your friends!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip, idx) => {
              const members = tripMembers[trip.id] || [];
              return (
                <Link key={trip.id} to={`/trip/${trip.id}`}>
                  <Card className="transition-all hover:shadow-xl hover:-translate-y-1 overflow-hidden group">
                    <div className={`h-2 ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`} />
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">{trip.name}</CardTitle>
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                      </div>
                      {trip.description && <CardDescription>{trip.description}</CardDescription>}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        {/* Member avatars */}
                        <div className="flex -space-x-2">
                          {members.slice(0, 4).map((m, i) => (
                            <Avatar key={m.user_id} className="h-7 w-7 border-2 border-background">
                              <AvatarFallback className={`${AVATAR_COLORS[i % AVATAR_COLORS.length]} text-primary-foreground text-[10px] font-bold`}>
                                {getInitials(m.display_name)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {members.length > 4 && (
                            <Avatar className="h-7 w-7 border-2 border-background">
                              <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
                                +{members.length - 4}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(trip.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
