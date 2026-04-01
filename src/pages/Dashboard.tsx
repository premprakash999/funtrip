import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Plane, LogOut } from 'lucide-react';

interface Trip {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTripName, setNewTripName] = useState('');
  const [newTripDesc, setNewTripDesc] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchTrips = async () => {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setTrips(data);
    setLoading(false);
  };

  useEffect(() => { fetchTrips(); }, []);

  const createTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { data, error } = await supabase
      .from('trips')
      .insert({ name: newTripName, description: newTripDesc || null, created_by: user.id })
      .select()
      .single();

    if (error) { toast.error(error.message); return; }

    // Add creator as member
    await supabase.from('trip_members').insert({ trip_id: data.id, user_id: user.id });

    setNewTripName('');
    setNewTripDesc('');
    setDialogOpen(false);
    toast.success('Trip created!');
    fetchTrips();
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Plane className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">FunTrip</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">My Trips</h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> New Trip</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create a New Trip</DialogTitle></DialogHeader>
              <form onSubmit={createTrip} className="space-y-4">
                <div className="space-y-2">
                  <Label>Trip Name</Label>
                  <Input value={newTripName} onChange={e => setNewTripName(e.target.value)} placeholder="Goa Trip 2026" required />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={newTripDesc} onChange={e => setNewTripDesc(e.target.value)} placeholder="Fun trip with the squad!" />
                </div>
                <Button type="submit" className="w-full">Create Trip</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading trips...</p>
        ) : trips.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12">
              <Plane className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">No trips yet</p>
              <p className="text-muted-foreground">Create your first trip to get started!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map(trip => (
              <Link key={trip.id} to={`/trip/${trip.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg">{trip.name}</CardTitle>
                    {trip.description && <CardDescription>{trip.description}</CardDescription>}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Created {new Date(trip.created_at).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
