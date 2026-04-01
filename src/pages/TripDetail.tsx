import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { simplifyDebts, Balance } from '@/lib/expenses';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Upload, Send, Trash2, ArrowRight, Users, BarChart3, X, Package, Check } from 'lucide-react';

interface Member { user_id: string; display_name: string }
interface Expense { id: string; description: string; amount: number; paid_by: string; created_at: string }
interface TripImage { id: string; image_url: string; caption: string | null; uploaded_by: string; created_at: string }
interface Comment { id: string; comment: string; user_id: string; created_at: string; commenter_name?: string }
interface Poll { id: string; question: string; is_anonymous: boolean; created_by: string; created_at: string }
interface PollOption { id: string; poll_id: string; option_text: string }
interface PollVote { id: string; poll_id: string; option_id: string; user_id: string | null }
interface TripItem { id: string; trip_id: string; brought_by: string; item_name: string; quantity: number; category: string; is_packed: boolean }

const AVATAR_COLORS = ['gradient-primary', 'gradient-teal', 'gradient-warm'];
const CATEGORIES = ['🎒 General', '🍔 Food', '⛺ Gear', '💊 Medicine', '🧴 Toiletries', '👕 Clothing', '🎮 Entertainment', '📷 Electronics'];
const CATEGORY_EMOJIS: Record<string, string> = { general: '🎒', food: '🍔', gear: '⛺', medicine: '💊', toiletries: '🧴', clothing: '👕', entertainment: '🎮', electronics: '📷' };

const getInitials = (name: string) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

const TripDetail = () => {
  const { id: tripId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [trip, setTrip] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [images, setImages] = useState<TripImage[]>([]);
  const [settlements, setSettlements] = useState<Balance[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  // Items state
  const [items, setItems] = useState<TripItem[]>([]);
  const [itemDialog, setItemDialog] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemCategory, setItemCategory] = useState('general');

  // Poll state
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollOptions, setPollOptions] = useState<Record<string, PollOption[]>>({});
  const [pollVotes, setPollVotes] = useState<Record<string, PollVote[]>>({});
  const [pollDialog, setPollDialog] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollIsAnonymous, setPollIsAnonymous] = useState(false);
  const [pollOptionTexts, setPollOptionTexts] = useState(['', '']);

  // Dialog states
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [imageDialog, setImageDialog] = useState(false);
  const [memberDialog, setMemberDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<TripImage | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageCaption, setImageCaption] = useState('');
  const [memberEmail, setMemberEmail] = useState('');

  const fetchAll = async () => {
    if (!tripId) return;
    const [tripRes, membersRes, expensesRes, imagesRes, pollsRes, itemsRes] = await Promise.all([
      supabase.from('trips').select('*').eq('id', tripId).single(),
      supabase.from('trip_members').select('user_id').eq('trip_id', tripId),
      supabase.from('expenses').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }),
      supabase.from('trip_images').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }),
      supabase.from('polls').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }),
      supabase.from('trip_items').select('*').eq('trip_id', tripId).order('created_at', { ascending: true }),
    ]);

    if (tripRes.data) setTrip(tripRes.data);
    if (itemsRes.data) setItems(itemsRes.data);

    if (membersRes.data) {
      const userIds = membersRes.data.map(m => m.user_id);
      const { data: profilesData } = await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds);
      const profileMap: Record<string, string> = {};
      profilesData?.forEach(p => { profileMap[p.user_id] = p.display_name || 'Unknown'; });
      setProfiles(profileMap);
      setMembers(membersRes.data.map(m => ({ user_id: m.user_id, display_name: profileMap[m.user_id] || 'Unknown' })));
    }

    if (expensesRes.data) setExpenses(expensesRes.data);
    if (imagesRes.data) setImages(imagesRes.data);

    // Settlements
    if (expensesRes.data && membersRes.data) {
      const { data: shares } = await supabase.from('expense_shares').select('*').in('expense_id', expensesRes.data.map(e => e.id));
      const netBalances: Record<string, number> = {};
      membersRes.data.forEach(m => { netBalances[m.user_id] = 0; });
      expensesRes.data.forEach(exp => { netBalances[exp.paid_by] = (netBalances[exp.paid_by] || 0) + Number(exp.amount); });
      shares?.forEach(share => { netBalances[share.user_id] = (netBalances[share.user_id] || 0) - Number(share.amount); });
      setSettlements(simplifyDebts(netBalances));
    }

    // Polls
    if (pollsRes.data && pollsRes.data.length > 0) {
      setPolls(pollsRes.data);
      const pollIds = pollsRes.data.map(p => p.id);
      const [optionsRes, votesRes] = await Promise.all([
        supabase.from('poll_options').select('*').in('poll_id', pollIds),
        supabase.from('poll_votes').select('*').in('poll_id', pollIds),
      ]);
      const optMap: Record<string, PollOption[]> = {};
      optionsRes.data?.forEach(o => { if (!optMap[o.poll_id]) optMap[o.poll_id] = []; optMap[o.poll_id].push(o); });
      setPollOptions(optMap);
      const voteMap: Record<string, PollVote[]> = {};
      votesRes.data?.forEach(v => { if (!voteMap[v.poll_id]) voteMap[v.poll_id] = []; voteMap[v.poll_id].push(v); });
      setPollVotes(voteMap);
    } else { setPolls([]); setPollOptions({}); setPollVotes({}); }
  };

  useEffect(() => { fetchAll(); }, [tripId]);

  // --- Action handlers ---
  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tripId) return;
    const amount = parseFloat(expAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }
    const { data: expense, error } = await supabase.from('expenses').insert({ trip_id: tripId, paid_by: user.id, description: expDesc, amount }).select().single();
    if (error) { toast.error(error.message); return; }
    const shareAmount = Math.round((amount / members.length) * 100) / 100;
    await supabase.from('expense_shares').insert(members.map(m => ({ expense_id: expense.id, user_id: m.user_id, amount: shareAmount })));
    setExpDesc(''); setExpAmount(''); setExpenseDialog(false); toast.success('Expense added! 💸'); fetchAll();
  };
  const deleteExpense = async (id: string) => { await supabase.from('expenses').delete().eq('id', id); toast.success('Deleted'); fetchAll(); };

  const uploadImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tripId || !imageFile) return;
    const filePath = `${user.id}/${tripId}/${Date.now()}.${imageFile.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('trip-images').upload(filePath, imageFile);
    if (error) { toast.error(error.message); return; }
    const { data: { publicUrl } } = supabase.storage.from('trip-images').getPublicUrl(filePath);
    await supabase.from('trip_images').insert({ trip_id: tripId, uploaded_by: user.id, image_url: publicUrl, caption: imageCaption || null });
    setImageFile(null); setImageCaption(''); setImageDialog(false); toast.success('Uploaded! 📸'); fetchAll();
  };

  const openImageComments = async (image: TripImage) => {
    setSelectedImage(image);
    const { data } = await supabase.from('image_comments').select('*').eq('image_id', image.id).order('created_at', { ascending: true });
    if (data) {
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: cp } = await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds);
      const pMap: Record<string, string> = {};
      cp?.forEach(p => { pMap[p.user_id] = p.display_name || 'Unknown'; });
      setComments(data.map(c => ({ ...c, commenter_name: pMap[c.user_id] || 'Unknown' })));
    }
  };
  const addComment = async () => {
    if (!user || !selectedImage || !newComment.trim()) return;
    await supabase.from('image_comments').insert({ image_id: selectedImage.id, user_id: user.id, comment: newComment.trim() });
    setNewComment(''); openImageComments(selectedImage);
  };

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripId) return;
    const { data } = await supabase.from('profiles').select('user_id, display_name');
    const match = data?.find(p => p.display_name?.toLowerCase() === memberEmail.toLowerCase());
    if (!match) { toast.error('User not found. They need to sign up first.'); return; }
    const { error } = await supabase.from('trip_members').insert({ trip_id: tripId, user_id: match.user_id });
    if (error) { error.code === '23505' ? toast.error('Already a member') : toast.error(error.message); return; }
    setMemberEmail(''); setMemberDialog(false); toast.success('Member added! 🤝'); fetchAll();
  };

  // Poll
  const createPoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tripId) return;
    const opts = pollOptionTexts.filter(t => t.trim());
    if (opts.length < 2) { toast.error('Add at least 2 options'); return; }
    const { data: poll, error } = await supabase.from('polls').insert({ trip_id: tripId, created_by: user.id, question: pollQuestion, is_anonymous: pollIsAnonymous }).select().single();
    if (error) { toast.error(error.message); return; }
    await supabase.from('poll_options').insert(opts.map(text => ({ poll_id: poll.id, option_text: text.trim() })));
    setPollQuestion(''); setPollIsAnonymous(false); setPollOptionTexts(['', '']); setPollDialog(false); toast.success('Poll created! 📊'); fetchAll();
  };
  const votePoll = async (pollId: string, optionId: string, isAnonymous: boolean) => {
    if (!user) return;
    const { error } = await supabase.from('poll_votes').insert({ poll_id: pollId, option_id: optionId, user_id: isAnonymous ? null : user.id });
    if (error) { error.code === '23505' ? toast.error('Already voted') : toast.error(error.message); return; }
    toast.success('Voted! ✅'); fetchAll();
  };
  const deletePoll = async (id: string) => { await supabase.from('polls').delete().eq('id', id); toast.success('Deleted'); fetchAll(); };
  const hasUserVoted = (pollId: string) => (pollVotes[pollId] || []).some(v => v.user_id === user?.id);

  // Items / Inventory
  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tripId) return;
    const qty = parseInt(itemQty);
    if (isNaN(qty) || qty < 1) { toast.error('Enter valid quantity'); return; }
    const { error } = await supabase.from('trip_items').insert({ trip_id: tripId, brought_by: user.id, item_name: itemName, quantity: qty, category: itemCategory });
    if (error) { toast.error(error.message); return; }
    setItemName(''); setItemQty('1'); setItemCategory('general'); setItemDialog(false); toast.success('Item added! 📦'); fetchAll();
  };
  const togglePacked = async (item: TripItem) => {
    await supabase.from('trip_items').update({ is_packed: !item.is_packed }).eq('id', item.id);
    fetchAll();
  };
  const deleteItem = async (id: string) => { await supabase.from('trip_items').delete().eq('id', id); toast.success('Removed'); fetchAll(); };

  if (!trip) return <div className="flex min-h-screen items-center justify-center gradient-bg"><p className="text-muted-foreground">Loading trip...</p></div>;

  // Group items by category
  const itemsByCategory = items.reduce<Record<string, TripItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link to="/"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-extrabold truncate">{trip.name}</h1>
            {trip.description && <p className="text-sm text-muted-foreground truncate">{trip.description}</p>}
          </div>
          {/* Member avatars in header */}
          <div className="flex -space-x-2 mr-2">
            {members.slice(0, 5).map((m, i) => (
              <Avatar key={m.user_id} className="h-8 w-8 border-2 border-background" title={m.display_name}>
                <AvatarFallback className={`${AVATAR_COLORS[i % AVATAR_COLORS.length]} text-primary-foreground text-[10px] font-bold`}>
                  {getInitials(m.display_name)}
                </AvatarFallback>
              </Avatar>
            ))}
            {members.length > 5 && (
              <Avatar className="h-8 w-8 border-2 border-background">
                <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">+{members.length - 5}</AvatarFallback>
              </Avatar>
            )}
          </div>
          <Dialog open={memberDialog} onOpenChange={setMemberDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0"><Users className="mr-2 h-4 w-4" /> Add</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Trip Member 🤝</DialogTitle></DialogHeader>
              <form onSubmit={addMember} className="space-y-4">
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input value={memberEmail} onChange={e => setMemberEmail(e.target.value)} placeholder="Enter their display name" required />
                </div>
                <Button type="submit" className="w-full gradient-primary border-none text-primary-foreground">Add Member</Button>
              </form>
              <div className="mt-4">
                <p className="text-sm font-medium mb-3">Members ({members.length})</p>
                <div className="space-y-2">
                  {members.map((m, i) => (
                    <div key={m.user_id} className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className={`${AVATAR_COLORS[i % AVATAR_COLORS.length]} text-primary-foreground text-[10px] font-bold`}>
                          {getInitials(m.display_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{m.display_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Tabs defaultValue="expenses">
          <TabsList className="mb-6 bg-background/60 backdrop-blur-sm">
            <TabsTrigger value="expenses">💸 Expenses</TabsTrigger>
            <TabsTrigger value="settle">🤝 Settle</TabsTrigger>
            <TabsTrigger value="inventory">📦 Inventory</TabsTrigger>
            <TabsTrigger value="polls">📊 Polls</TabsTrigger>
            <TabsTrigger value="gallery">📸 Gallery</TabsTrigger>
          </TabsList>

          {/* EXPENSES */}
          <TabsContent value="expenses">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-lg font-bold">Expenses</h3>
              <Dialog open={expenseDialog} onOpenChange={setExpenseDialog}>
                <DialogTrigger asChild><Button className="gradient-primary border-none text-primary-foreground"><Plus className="mr-2 h-4 w-4" /> Add</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Expense 💰</DialogTitle></DialogHeader>
                  <form onSubmit={addExpense} className="space-y-4">
                    <div className="space-y-2"><Label>Description</Label><Input value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="Lunch at restaurant" required /></div>
                    <div className="space-y-2"><Label>Amount (₹)</Label><Input type="number" step="0.01" value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="500" required /></div>
                    <p className="text-sm text-muted-foreground">Split equally among {members.length} members</p>
                    <Button type="submit" className="w-full gradient-primary border-none text-primary-foreground">Add Expense</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            {expenses.length === 0 ? (
              <Card className="border-dashed border-2"><CardContent className="py-10 text-center"><p className="text-4xl mb-2">💸</p><p className="text-muted-foreground">No expenses yet</p></CardContent></Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Description</TableHead><TableHead>Paid By</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Date</TableHead><TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {expenses.map(exp => (
                      <TableRow key={exp.id}>
                        <TableCell className="font-medium">{exp.description}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6"><AvatarFallback className="gradient-primary text-primary-foreground text-[9px]">{getInitials(profiles[exp.paid_by] || '')}</AvatarFallback></Avatar>
                            {profiles[exp.paid_by] || 'Unknown'}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">₹{Number(exp.amount).toFixed(2)}</TableCell>
                        <TableCell className="text-right text-muted-foreground text-sm">{new Date(exp.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          {exp.paid_by === user?.id && <Button variant="ghost" size="icon" onClick={() => deleteExpense(exp.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {/* SETTLE */}
          <TabsContent value="settle">
            <h3 className="mb-4 text-lg font-bold">Simplified Settlements</h3>
            {settlements.length === 0 ? (
              <Card className="border-dashed border-2"><CardContent className="py-10 text-center"><p className="text-4xl mb-2">🎉</p><p className="text-muted-foreground">All settled up!</p></CardContent></Card>
            ) : (
              <div className="space-y-3">
                {settlements.map((s, i) => (
                  <Card key={i} className="overflow-hidden">
                    <div className="h-1 gradient-warm" />
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8"><AvatarFallback className="gradient-primary text-primary-foreground text-xs">{getInitials(profiles[s.from] || '')}</AvatarFallback></Avatar>
                        <span className="font-medium">{profiles[s.from] || 'Unknown'}</span>
                        <ArrowRight className="h-4 w-4 text-accent" />
                        <Avatar className="h-8 w-8"><AvatarFallback className="gradient-teal text-primary-foreground text-xs">{getInitials(profiles[s.to] || '')}</AvatarFallback></Avatar>
                        <span className="font-medium">{profiles[s.to] || 'Unknown'}</span>
                      </div>
                      <Badge variant="secondary" className="text-base font-bold px-3 py-1">₹{s.amount.toFixed(2)}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* INVENTORY */}
          <TabsContent value="inventory">
            <div className="mb-4 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Trip Inventory 📦</h3>
                <p className="text-sm text-muted-foreground">Who's bringing what — so nothing gets left behind!</p>
              </div>
              <Dialog open={itemDialog} onOpenChange={setItemDialog}>
                <DialogTrigger asChild><Button className="gradient-teal border-none text-primary-foreground"><Package className="mr-2 h-4 w-4" /> Add Item</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>I'm Bringing... 🎒</DialogTitle></DialogHeader>
                  <form onSubmit={addItem} className="space-y-4">
                    <div className="space-y-2"><Label>Item Name</Label><Input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="Sunscreen, Tent, Snacks..." required /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Quantity</Label><Input type="number" min="1" value={itemQty} onChange={e => setItemQty(e.target.value)} /></div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={itemCategory} onValueChange={setItemCategory}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map(cat => {
                              const val = cat.split(' ').slice(1).join(' ').toLowerCase();
                              return <SelectItem key={val} value={val}>{cat}</SelectItem>;
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button type="submit" className="w-full gradient-teal border-none text-primary-foreground">Add to Inventory</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {items.length === 0 ? (
              <Card className="border-dashed border-2"><CardContent className="py-10 text-center"><p className="text-4xl mb-2">📦</p><p className="text-muted-foreground">No items yet. Add what you're bringing!</p></CardContent></Card>
            ) : (
              <div className="space-y-6">
                {/* Summary bar */}
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Packing Progress</span>
                      <span className="text-sm text-muted-foreground">{items.filter(i => i.is_packed).length}/{items.length} packed</span>
                    </div>
                    <Progress value={(items.filter(i => i.is_packed).length / items.length) * 100} className="h-3" />
                  </CardContent>
                </Card>

                {Object.entries(itemsByCategory).map(([category, catItems]) => (
                  <div key={category}>
                    <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                      <span className="text-lg">{CATEGORY_EMOJIS[category] || '📦'}</span>
                      <span className="capitalize">{category}</span>
                      <Badge variant="outline" className="ml-1">{catItems.length}</Badge>
                    </h4>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {catItems.map((item, idx) => (
                        <Card key={item.id} className={`transition-all ${item.is_packed ? 'opacity-60' : ''}`}>
                          <CardContent className="flex items-center gap-3 py-3 px-4">
                            {item.brought_by === user?.id && (
                              <Checkbox checked={item.is_packed} onCheckedChange={() => togglePacked(item)} />
                            )}
                            {item.brought_by !== user?.id && (
                              item.is_packed ? <Check className="h-4 w-4 text-secondary" /> : <div className="h-4 w-4" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${item.is_packed ? 'line-through' : ''}`}>
                                {item.item_name} {item.quantity > 1 && <span className="text-muted-foreground">×{item.quantity}</span>}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Avatar className="h-5 w-5">
                                  <AvatarFallback className={`${AVATAR_COLORS[idx % AVATAR_COLORS.length]} text-primary-foreground text-[8px]`}>
                                    {getInitials(profiles[item.brought_by] || '')}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-muted-foreground">{profiles[item.brought_by] || 'Unknown'}</span>
                              </div>
                            </div>
                            {item.brought_by === user?.id && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteItem(item.id)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* POLLS */}
          <TabsContent value="polls">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-lg font-bold">Polls</h3>
              <Dialog open={pollDialog} onOpenChange={setPollDialog}>
                <DialogTrigger asChild><Button className="gradient-warm border-none text-primary-foreground"><BarChart3 className="mr-2 h-4 w-4" /> Create Poll</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create a Poll 📊</DialogTitle></DialogHeader>
                  <form onSubmit={createPoll} className="space-y-4">
                    <div className="space-y-2"><Label>Question</Label><Input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Where should we eat tonight?" required /></div>
                    <div className="space-y-2">
                      <Label>Options</Label>
                      {pollOptionTexts.map((opt, idx) => (
                        <div key={idx} className="flex gap-2">
                          <Input value={opt} onChange={e => { const u = [...pollOptionTexts]; u[idx] = e.target.value; setPollOptionTexts(u); }} placeholder={`Option ${idx + 1}`} />
                          {pollOptionTexts.length > 2 && <Button type="button" variant="ghost" size="icon" onClick={() => setPollOptionTexts(pollOptionTexts.filter((_, i) => i !== idx))}><X className="h-4 w-4" /></Button>}
                        </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" onClick={() => setPollOptionTexts([...pollOptionTexts, ''])}><Plus className="mr-1 h-3 w-3" /> Add Option</Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="anonymous" checked={pollIsAnonymous} onCheckedChange={(c) => setPollIsAnonymous(c === true)} />
                      <Label htmlFor="anonymous" className="cursor-pointer">🔒 Anonymous voting</Label>
                    </div>
                    <Button type="submit" className="w-full gradient-warm border-none text-primary-foreground">Create Poll</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            {polls.length === 0 ? (
              <Card className="border-dashed border-2"><CardContent className="py-10 text-center"><p className="text-4xl mb-2">📊</p><p className="text-muted-foreground">No polls yet. Ask the group something!</p></CardContent></Card>
            ) : (
              <div className="space-y-4">
                {polls.map(poll => {
                  const options = pollOptions[poll.id] || [];
                  const votes = pollVotes[poll.id] || [];
                  const totalVotes = votes.length;
                  const voted = hasUserVoted(poll.id);
                  return (
                    <Card key={poll.id} className="overflow-hidden">
                      <div className="h-1 gradient-warm" />
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">{poll.question}</CardTitle>
                            <div className="flex items-center gap-2 mt-1.5">
                              <Avatar className="h-5 w-5"><AvatarFallback className="gradient-primary text-primary-foreground text-[8px]">{getInitials(profiles[poll.created_by] || '')}</AvatarFallback></Avatar>
                              <span className="text-xs text-muted-foreground">{profiles[poll.created_by] || 'Unknown'} • {totalVotes} vote{totalVotes !== 1 ? 's' : ''}{poll.is_anonymous && ' • 🔒'}</span>
                            </div>
                          </div>
                          {poll.created_by === user?.id && <Button variant="ghost" size="icon" onClick={() => deletePoll(poll.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {options.map(opt => {
                          const optVotes = votes.filter(v => v.option_id === opt.id).length;
                          const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
                          return !voted ? (
                            <Button key={opt.id} variant="outline" className="w-full justify-start hover:border-primary" onClick={() => votePoll(poll.id, opt.id, poll.is_anonymous)}>{opt.option_text}</Button>
                          ) : (
                            <div key={opt.id} className="space-y-1">
                              <div className="flex justify-between text-sm"><span>{opt.option_text}</span><span className="text-muted-foreground font-medium">{pct}% ({optVotes})</span></div>
                              <Progress value={pct} className="h-2" />
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* GALLERY */}
          <TabsContent value="gallery">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-lg font-bold">Trip Gallery</h3>
              <Dialog open={imageDialog} onOpenChange={setImageDialog}>
                <DialogTrigger asChild><Button className="gradient-primary border-none text-primary-foreground"><Upload className="mr-2 h-4 w-4" /> Upload</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Upload Image 📸</DialogTitle></DialogHeader>
                  <form onSubmit={uploadImage} className="space-y-4">
                    <div className="space-y-2"><Label>Image</Label><Input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} required /></div>
                    <div className="space-y-2"><Label>Caption (optional)</Label><Input value={imageCaption} onChange={e => setImageCaption(e.target.value)} placeholder="Beach sunset 🌅" /></div>
                    <Button type="submit" className="w-full gradient-primary border-none text-primary-foreground">Upload</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            {images.length === 0 ? (
              <Card className="border-dashed border-2"><CardContent className="py-10 text-center"><p className="text-4xl mb-2">📸</p><p className="text-muted-foreground">No photos yet. Capture the memories!</p></CardContent></Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {images.map(img => (
                  <Card key={img.id} className="cursor-pointer overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1 group" onClick={() => openImageComments(img)}>
                    <div className="aspect-square overflow-hidden">
                      <img src={img.image_url} alt={img.caption || 'Trip photo'} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    </div>
                    <CardContent className="p-3">
                      {img.caption && <p className="text-sm font-medium">{img.caption}</p>}
                      <div className="flex items-center gap-1.5 mt-1">
                        <Avatar className="h-5 w-5"><AvatarFallback className="gradient-primary text-primary-foreground text-[8px]">{getInitials(profiles[img.uploaded_by] || '')}</AvatarFallback></Avatar>
                        <p className="text-xs text-muted-foreground">{profiles[img.uploaded_by] || 'Unknown'} • {new Date(img.created_at).toLocaleDateString()}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <Dialog open={!!selectedImage} onOpenChange={(open) => { if (!open) setSelectedImage(null); }}>
              <DialogContent className="max-w-2xl">
                {selectedImage && (
                  <>
                    <img src={selectedImage.image_url} alt={selectedImage.caption || ''} className="max-h-80 w-full rounded-md object-contain" />
                    {selectedImage.caption && <p className="font-medium">{selectedImage.caption}</p>}
                    <div className="max-h-60 space-y-2 overflow-y-auto">
                      {comments.map(c => (
                        <div key={c.id} className="rounded-lg bg-muted p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Avatar className="h-5 w-5"><AvatarFallback className="gradient-teal text-primary-foreground text-[8px]">{getInitials(c.commenter_name || '')}</AvatarFallback></Avatar>
                            <span className="text-sm font-medium">{c.commenter_name}</span>
                            <span className="text-muted-foreground text-xs">{new Date(c.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-sm pl-7">{c.comment}</p>
                        </div>
                      ))}
                      {comments.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No comments yet. Be the first! 💬</p>}
                    </div>
                    <div className="flex gap-2">
                      <Input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment..." onKeyDown={e => e.key === 'Enter' && addComment()} />
                      <Button size="icon" className="gradient-primary border-none text-primary-foreground" onClick={addComment}><Send className="h-4 w-4" /></Button>
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default TripDetail;
