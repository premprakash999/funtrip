import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { CreditCard, Home, LogOut, Map, MessageSquareText, Package, Plus, Shield, Users, Vote } from 'lucide-react';

interface Trip { id: string; name: string; description: string | null; created_at: string }
interface MemberRow { user_id: string; display_name: string }
interface ProfileRow { user_id: string; display_name: string | null; role: AppRole }
type AppRole = Database['public']['Enums']['app_role'];
type Section = 'dashboard' | 'trips' | 'members';

const NAV = [
  { group: 'Main', items: [
    { key: 'dashboard' as Section, label: 'Dashboard', icon: Home },
    { key: 'trips' as Section, label: 'Trips', icon: Map },
  ]},
  { group: 'Trip Tools', items: [
    { key: null, label: 'Expenses', icon: CreditCard, tab: 'expenses' },
    { key: null, label: 'Inventory', icon: Package, tab: 'inventory' },
    { key: null, label: 'Forum', icon: MessageSquareText, tab: 'forum' },
    { key: null, label: 'Polls', icon: Vote, tab: 'polls' },
  ]},
  { group: 'Admin', items: [
    { key: 'members' as Section, label: 'Members', icon: Users },
  ]},
];

const COLORS = ['gradient-primary', 'gradient-teal', 'gradient-warm'];
const getInitials = (name: string) => name?.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2) || '?';
const fmtDate = (value: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
const greeting = () => new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

const Dashboard = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>('dashboard');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [newTripDesc, setNewTripDesc] = useState('');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripMembers, setTripMembers] = useState<Record<string, MemberRow[]>>({});
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [profile, setProfile] = useState<{ display_name: string | null; role: AppRole } | null>(null);

  const fetchProfile = async () => {
    if (!user) return;
    const primary = await supabase.from('profiles').select('display_name, role').eq('user_id', user.id).single();
    if (!primary.error && primary.data) {
      setProfile(primary.data);
      return;
    }
    const fallback = await supabase.from('profiles').select('display_name').eq('user_id', user.id).single();
    if (fallback.data) setProfile({ display_name: fallback.data.display_name, role: 'admin' });
  };

  const fetchProfiles = async () => {
    const primary = await supabase.from('profiles').select('user_id, display_name, role').order('created_at', { ascending: true });
    if (!primary.error && primary.data) {
      setProfiles(primary.data);
      return primary.data;
    }
    const fallback = await supabase.from('profiles').select('user_id, display_name').order('created_at', { ascending: true });
    const mapped = (fallback.data || []).map(item => ({ ...item, role: 'admin' as AppRole }));
    setProfiles(mapped);
    return mapped;
  };

  const loadDashboard = async () => {
    setLoading(true);
    const [allProfiles, tripRes] = await Promise.all([
      fetchProfiles(),
      supabase.from('trips').select('*').order('created_at', { ascending: false }),
    ]);

    if (!tripRes.error && tripRes.data) {
      setTrips(tripRes.data);
      const ids = tripRes.data.map(trip => trip.id);
      const memberMap: Record<string, MemberRow[]> = Object.fromEntries(ids.map(id => [id, []]));
      if (ids.length > 0) {
        const members = await supabase.from('trip_members').select('trip_id, user_id').in('trip_id', ids);
        const profileMap = Object.fromEntries(allProfiles.map(item => [item.user_id, item.display_name || 'Unknown']));
        members.data?.forEach(member => {
          memberMap[member.trip_id]?.push({ user_id: member.user_id, display_name: profileMap[member.user_id] || 'Unknown' });
        });
      }
      setTripMembers(memberMap);
    } else {
      setTrips([]);
      setTripMembers({});
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth', { replace: true });
      return;
    }

    if (!user) return;

    fetchProfile();
    loadDashboard();
  }, [authLoading, navigate, user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  const createTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (profile?.role !== 'super_admin') {
      toast.error('Only the super admin can create trips.');
      return;
    }
    const tripId = crypto.randomUUID();
    const tripInsert = await supabase.from('trips').insert({ id: tripId, name: newTripName, description: newTripDesc || null, created_by: user.id });
    if (tripInsert.error) {
      toast.error(tripInsert.error.message);
      return;
    }
    const memberInsert = await supabase.from('trip_members').insert({ trip_id: tripId, user_id: user.id });
    if (memberInsert.error) {
      toast.error(memberInsert.error.message);
      return;
    }
    setNewTripName('');
    setNewTripDesc('');
    setDialogOpen(false);
    toast.success('Trip created!');
    await loadDashboard();
    navigate(`/trip/${tripId}`);
  };

  const latestTrip = trips[0] || null;
  const canCreateTrips = profile?.role === 'super_admin';
  const travelerCount = new Set(Object.values(tripMembers).flat().map(item => item.user_id)).size;

  const openLatestTrip = (tab?: string) => {
    if (!latestTrip) {
      toast.error('No trip is available yet.');
      return;
    }
    navigate(`/trip/${latestTrip.id}${tab ? `?tab=${tab}` : ''}`);
  };

  const overview = (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-white/60 bg-white/85 p-4 shadow-sm md:hidden">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a796b]">Workspace</p>
            <p className="mt-2 text-2xl font-extrabold text-foreground">{greeting()}, {profile?.display_name || 'Traveler'}</p>
            <p className="mt-2 text-sm text-muted-foreground">Open trips, members, and planning tools without the desktop-heavy dashboard shell.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{trips.length} trips</Badge>
            <Badge variant="outline">{travelerCount} travelers</Badge>
            <Badge variant="outline">{profile?.role === 'super_admin' ? 'Super Admin' : 'Admin'}</Badge>
          </div>
          {latestTrip && <Button className="w-full gradient-primary border-none text-primary-foreground" onClick={() => openLatestTrip()}>Open Latest Trip</Button>}
        </div>
      </div>

      <div className="hidden rounded-[28px] bg-[linear-gradient(135deg,#f76707_0%,#d9480f_45%,#617a43_100%)] px-6 py-6 text-white shadow-[0_30px_60px_-30px_rgba(217,72,15,0.8)] md:block sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-3xl font-extrabold">{greeting()}, {profile?.display_name || 'Traveler'}</p>
            <p className="mt-2 max-w-xl text-sm text-white/85 sm:text-base">Welcome back to your travel workspace. Keep trips, members, and planning details tidy in one place.</p>
            <p className="mt-3 text-sm text-white/80">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          {latestTrip && <Button className="border-none bg-white/15 text-white hover:bg-white/25" onClick={() => openLatestTrip()}>Open Latest Trip</Button>}
        </div>
      </div>

      <div className="hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Trips', value: trips.length, icon: Map },
          { label: 'Travelers', value: travelerCount, icon: Users },
          { label: 'Your Role', value: profile?.role === 'super_admin' ? 'SA' : 'AD', icon: Shield },
          { label: 'Latest Trip', value: latestTrip ? fmtDate(latestTrip.created_at) : '--', icon: Home },
        ].map((item, index) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="border-white/60 shadow-sm">
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${COLORS[index % COLORS.length]}`}>
                  <Icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{item.value}</p>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-white/60 shadow-sm">
        <CardHeader>
          <CardTitle>Recent Trips</CardTitle>
          <CardDescription>Open any trip directly from here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {trips.length === 0 ? <p className="text-sm text-muted-foreground">No trips yet.</p> : trips.slice(0, 4).map((trip, index) => {
            const members = tripMembers[trip.id] || [];
            return (
              <button key={trip.id} type="button" onClick={() => navigate(`/trip/${trip.id}`)} className="flex w-full flex-col gap-3 rounded-2xl border border-border/70 bg-background px-4 py-4 text-left transition hover:border-primary/30 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">{trip.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{trip.description || 'No description yet.'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {members.slice(0, 3).map((member, memberIndex) => (
                      <Avatar key={member.user_id} className="h-8 w-8 border-2 border-background">
                        <AvatarFallback className={`${COLORS[(index + memberIndex) % COLORS.length]} text-[10px] font-bold text-primary-foreground`}>{getInitials(member.display_name)}</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <Badge variant="outline">{members.length} members</Badge>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );

  const tripList = (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Trips</h2>
          <p className="text-sm text-muted-foreground">Manage and open trip workspaces.</p>
        </div>
        {canCreateTrips && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary border-none text-primary-foreground"><Plus className="mr-2 h-4 w-4" /> New Trip</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create a New Trip</DialogTitle></DialogHeader>
              <form onSubmit={createTrip} className="space-y-4">
                <div className="space-y-2"><Label>Trip Name</Label><Input value={newTripName} onChange={e => setNewTripName(e.target.value)} placeholder="Goa Weekend" required /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={newTripDesc} onChange={e => setNewTripDesc(e.target.value)} placeholder="Add a quick summary for your group." /></div>
                <Button type="submit" className="w-full gradient-primary border-none text-primary-foreground">Create Trip</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {trips.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground">No trips available.</CardContent></Card> : trips.map((trip, index) => {
          const members = tripMembers[trip.id] || [];
          return (
            <Card key={trip.id} className="border-white/60 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{trip.name}</CardTitle>
                    <CardDescription className="mt-1">{trip.description || 'No description added.'}</CardDescription>
                  </div>
                  <div className={`h-11 w-11 rounded-2xl ${COLORS[index % COLORS.length]}`} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{members.length} members</Badge>
                  <Badge variant="outline">{fmtDate(trip.created_at)}</Badge>
                </div>
                <Button variant="outline" onClick={() => navigate(`/trip/${trip.id}`)}>Open Trip</Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );

  const memberList = (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Members</h2>
        <p className="text-sm text-muted-foreground">Visible users and their current roles.</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {profiles.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground">No members found.</CardContent></Card> : profiles.map((member, index) => (
          <Card key={member.user_id} className="border-white/60 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className={`${COLORS[index % COLORS.length]} text-sm font-bold text-primary-foreground`}>{getInitials(member.display_name || '')}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{member.display_name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">{member.user_id}</p>
                </div>
              </div>
              <Badge variant="outline" className="capitalize">{member.role === 'super_admin' ? 'Super Admin' : 'Admin'}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eff8f7_0%,#fff7f1_30%,#fffdfb_100%)]">
      <header className="sticky top-0 z-30 border-b border-[#eadfd4] bg-white/90 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ff8a3d_0%,#f76707_100%)] shadow-[0_12px_30px_-18px_rgba(247,103,7,0.9)] sm:h-11 sm:w-11">
              <Home className="h-4 w-4 text-white sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xl font-bold text-[#f76707] sm:text-2xl">FunTrip</p>
              <p className="hidden text-xs uppercase tracking-[0.2em] text-[#8a796b] sm:block">Travel Hub</p>
            </div>
            <Badge className="hidden rounded-full border border-[#ffd8bf] bg-[#fff2e8] px-4 py-1 text-[#d9480f] hover:bg-[#fff2e8] sm:inline-flex">Group Planning Workspace</Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 rounded-full border border-[#eadfd4] bg-white px-3 py-2 shadow-sm sm:flex">
              <Avatar className="h-10 w-10"><AvatarFallback className="bg-[linear-gradient(135deg,#ff8a3d_0%,#f76707_100%)] text-sm font-bold text-white">{getInitials(profile?.display_name || '')}</AvatarFallback></Avatar>
              <div>
                <p className="text-sm font-semibold">{profile?.display_name || 'Traveler'}</p>
                <p className="text-xs text-muted-foreground">{profile?.role === 'super_admin' ? 'Super Admin' : 'Admin'}</p>
              </div>
            </div>
            <Button variant="outline" className="rounded-full px-3 sm:px-4" onClick={handleSignOut}><LogOut className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Sign Out</span></Button>
          </div>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="sticky top-[65px] z-20 border-b border-[#eadfd4] bg-white/85 px-4 py-3 backdrop-blur-sm lg:static lg:min-h-[calc(100vh-81px)] lg:border-b-0 lg:border-r lg:px-5 lg:py-5">
          <div className="hidden space-y-6 lg:block">
            {NAV.map(sectionGroup => (
              <div key={sectionGroup.group}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#8a796b]">{sectionGroup.group}</p>
                <div className="space-y-2">
                  {sectionGroup.items.map(item => {
                    const Icon = item.icon;
                    const isActive = item.key ? section === item.key : false;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => item.key ? setSection(item.key) : openLatestTrip(item.tab)}
                        className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition ${isActive ? 'bg-[#fff0e7] text-[#d9480f] shadow-sm' : 'text-[#5f534a] hover:bg-[#faf3ee]'}`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="font-medium">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 overflow-x-auto py-1 lg:hidden">
            {NAV.flatMap(sectionGroup => sectionGroup.items).map(item => {
              const Icon = item.icon;
              const isActive = item.key ? section === item.key : false;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => item.key ? setSection(item.key) : openLatestTrip(item.tab)}
                  className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm ${isActive ? 'border-[#ffcfb0] bg-[#fff0e7] text-[#d9480f]' : 'border-[#eadfd4] bg-white text-[#5f534a]'}`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="px-4 py-4 sm:px-6 sm:py-6">
          {loading ? (
            <Card className="border-white/60 shadow-sm"><CardContent className="py-16 text-center text-muted-foreground">Loading dashboard...</CardContent></Card>
          ) : section === 'dashboard' ? overview : section === 'trips' ? tripList : memberList}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
