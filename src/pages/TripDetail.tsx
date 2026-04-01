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
import { toast } from 'sonner';
import { ArrowLeft, Plus, Upload, Send, Trash2, ArrowRight, Users, BarChart3, X } from 'lucide-react';

interface Member { user_id: string; display_name: string }
interface Expense { id: string; description: string; amount: number; paid_by: string; created_at: string }
interface TripImage { id: string; image_url: string; caption: string | null; uploaded_by: string; created_at: string }
interface Comment { id: string; comment: string; user_id: string; created_at: string; commenter_name?: string }
interface Poll { id: string; question: string; is_anonymous: boolean; created_by: string; created_at: string }
interface PollOption { id: string; poll_id: string; option_text: string }
interface PollVote { id: string; poll_id: string; option_id: string; user_id: string | null }

const TripDetail = () => {
  const { id: tripId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [trip, setTrip] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [images, setImages] = useState<TripImage[]>([]);
  const [settlements, setSettlements] = useState<Balance[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

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

  // Form states
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageCaption, setImageCaption] = useState('');
  const [memberEmail, setMemberEmail] = useState('');

  const fetchAll = async () => {
    if (!tripId) return;

    const [tripRes, membersRes, expensesRes, imagesRes, pollsRes] = await Promise.all([
      supabase.from('trips').select('*').eq('id', tripId).single(),
      supabase.from('trip_members').select('user_id').eq('trip_id', tripId),
      supabase.from('expenses').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }),
      supabase.from('trip_images').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }),
      supabase.from('polls').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }),
    ]);

    if (tripRes.data) setTrip(tripRes.data);

    if (membersRes.data) {
      const userIds = membersRes.data.map(m => m.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      const profileMap: Record<string, string> = {};
      profilesData?.forEach(p => { profileMap[p.user_id] = p.display_name || 'Unknown'; });
      setProfiles(profileMap);
      setMembers(membersRes.data.map(m => ({ user_id: m.user_id, display_name: profileMap[m.user_id] || 'Unknown' })));
    }

    if (expensesRes.data) setExpenses(expensesRes.data);
    if (imagesRes.data) setImages(imagesRes.data);

    // Settlements
    if (expensesRes.data && membersRes.data) {
      const { data: shares } = await supabase
        .from('expense_shares')
        .select('*')
        .in('expense_id', expensesRes.data.map(e => e.id));

      const netBalances: Record<string, number> = {};
      membersRes.data.forEach(m => { netBalances[m.user_id] = 0; });
      expensesRes.data.forEach(exp => {
        netBalances[exp.paid_by] = (netBalances[exp.paid_by] || 0) + Number(exp.amount);
      });
      shares?.forEach(share => {
        netBalances[share.user_id] = (netBalances[share.user_id] || 0) - Number(share.amount);
      });
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
      optionsRes.data?.forEach(o => {
        if (!optMap[o.poll_id]) optMap[o.poll_id] = [];
        optMap[o.poll_id].push(o);
      });
      setPollOptions(optMap);

      const voteMap: Record<string, PollVote[]> = {};
      votesRes.data?.forEach(v => {
        if (!voteMap[v.poll_id]) voteMap[v.poll_id] = [];
        voteMap[v.poll_id].push(v);
      });
      setPollVotes(voteMap);
    } else {
      setPolls([]);
      setPollOptions({});
      setPollVotes({});
    }
  };

  useEffect(() => { fetchAll(); }, [tripId]);

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tripId) return;
    const amount = parseFloat(expAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }

    const { data: expense, error } = await supabase
      .from('expenses')
      .insert({ trip_id: tripId, paid_by: user.id, description: expDesc, amount })
      .select().single();
    if (error) { toast.error(error.message); return; }

    const shareAmount = Math.round((amount / members.length) * 100) / 100;
    await supabase.from('expense_shares').insert(
      members.map(m => ({ expense_id: expense.id, user_id: m.user_id, amount: shareAmount }))
    );

    setExpDesc(''); setExpAmount(''); setExpenseDialog(false);
    toast.success('Expense added!');
    fetchAll();
  };

  const deleteExpense = async (expenseId: string) => {
    await supabase.from('expenses').delete().eq('id', expenseId);
    toast.success('Expense deleted'); fetchAll();
  };

  const uploadImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tripId || !imageFile) return;
    const fileExt = imageFile.name.split('.').pop();
    const filePath = `${user.id}/${tripId}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('trip-images').upload(filePath, imageFile);
    if (uploadError) { toast.error(uploadError.message); return; }
    const { data: { publicUrl } } = supabase.storage.from('trip-images').getPublicUrl(filePath);
    await supabase.from('trip_images').insert({ trip_id: tripId, uploaded_by: user.id, image_url: publicUrl, caption: imageCaption || null });
    setImageFile(null); setImageCaption(''); setImageDialog(false);
    toast.success('Image uploaded!'); fetchAll();
  };

  const openImageComments = async (image: TripImage) => {
    setSelectedImage(image);
    const { data } = await supabase.from('image_comments').select('*').eq('image_id', image.id).order('created_at', { ascending: true });
    if (data) {
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: commentProfiles } = await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds);
      const pMap: Record<string, string> = {};
      commentProfiles?.forEach(p => { pMap[p.user_id] = p.display_name || 'Unknown'; });
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
    const { data: profileData } = await supabase.from('profiles').select('user_id, display_name');
    const matchedProfile = profileData?.find(p => p.display_name?.toLowerCase() === memberEmail.toLowerCase());
    if (!matchedProfile) { toast.error('User not found. They need to sign up first.'); return; }
    const { error } = await supabase.from('trip_members').insert({ trip_id: tripId, user_id: matchedProfile.user_id });
    if (error) { error.code === '23505' ? toast.error('User is already a member') : toast.error(error.message); return; }
    setMemberEmail(''); setMemberDialog(false); toast.success('Member added!'); fetchAll();
  };

  // Poll functions
  const createPoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tripId) return;
    const validOptions = pollOptionTexts.filter(t => t.trim());
    if (validOptions.length < 2) { toast.error('Add at least 2 options'); return; }

    const { data: poll, error } = await supabase
      .from('polls')
      .insert({ trip_id: tripId, created_by: user.id, question: pollQuestion, is_anonymous: pollIsAnonymous })
      .select().single();
    if (error) { toast.error(error.message); return; }

    await supabase.from('poll_options').insert(
      validOptions.map(text => ({ poll_id: poll.id, option_text: text.trim() }))
    );

    setPollQuestion(''); setPollIsAnonymous(false); setPollOptionTexts(['', '']); setPollDialog(false);
    toast.success('Poll created!'); fetchAll();
  };

  const votePoll = async (pollId: string, optionId: string, isAnonymous: boolean) => {
    if (!user) return;
    const { error } = await supabase.from('poll_votes').insert({
      poll_id: pollId,
      option_id: optionId,
      user_id: isAnonymous ? null : user.id,
    });
    if (error) {
      if (error.code === '23505') toast.error('You already voted on this poll');
      else toast.error(error.message);
      return;
    }
    toast.success('Vote recorded!'); fetchAll();
  };

  const deletePoll = async (pollId: string) => {
    await supabase.from('polls').delete().eq('id', pollId);
    toast.success('Poll deleted'); fetchAll();
  };

  const hasUserVoted = (pollId: string) => {
    const votes = pollVotes[pollId] || [];
    return votes.some(v => v.user_id === user?.id);
  };

  if (!trip) return <div className="flex min-h-screen items-center justify-center"><p>Loading trip...</p></div>;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4">
          <Link to="/"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div>
            <h1 className="text-xl font-bold">{trip.name}</h1>
            {trip.description && <p className="text-sm text-muted-foreground">{trip.description}</p>}
          </div>
          <div className="ml-auto flex gap-2">
            <Dialog open={memberDialog} onOpenChange={setMemberDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm"><Users className="mr-2 h-4 w-4" /> Add Member</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Trip Member</DialogTitle></DialogHeader>
                <form onSubmit={addMember} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Member Display Name</Label>
                    <Input value={memberEmail} onChange={e => setMemberEmail(e.target.value)} placeholder="Enter their display name" required />
                  </div>
                  <Button type="submit" className="w-full">Add Member</Button>
                </form>
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Current Members ({members.length})</p>
                  {members.map(m => (
                    <p key={m.user_id} className="text-sm text-muted-foreground">{m.display_name}</p>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Tabs defaultValue="expenses">
          <TabsList className="mb-6">
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="settle">Settle Up</TabsTrigger>
            <TabsTrigger value="polls">Polls</TabsTrigger>
            <TabsTrigger value="gallery">Gallery</TabsTrigger>
          </TabsList>

          {/* EXPENSES TAB */}
          <TabsContent value="expenses">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Expenses</h3>
              <Dialog open={expenseDialog} onOpenChange={setExpenseDialog}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" /> Add Expense</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
                  <form onSubmit={addExpense} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="Lunch at restaurant" required />
                    </div>
                    <div className="space-y-2">
                      <Label>Amount (₹)</Label>
                      <Input type="number" step="0.01" value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="500" required />
                    </div>
                    <p className="text-sm text-muted-foreground">Split equally among {members.length} members</p>
                    <Button type="submit" className="w-full">Add Expense</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            {expenses.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No expenses yet</CardContent></Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Paid By</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Date</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map(exp => (
                      <TableRow key={exp.id}>
                        <TableCell className="font-medium">{exp.description}</TableCell>
                        <TableCell>{profiles[exp.paid_by] || 'Unknown'}</TableCell>
                        <TableCell className="text-right">₹{Number(exp.amount).toFixed(2)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{new Date(exp.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          {exp.paid_by === user?.id && (
                            <Button variant="ghost" size="icon" onClick={() => deleteExpense(exp.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {/* SETTLE TAB */}
          <TabsContent value="settle">
            <h3 className="mb-4 text-lg font-semibold">Simplified Settlements</h3>
            {settlements.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">All settled up! 🎉</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {settlements.map((s, i) => (
                  <Card key={i}>
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{profiles[s.from] || 'Unknown'}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{profiles[s.to] || 'Unknown'}</span>
                      </div>
                      <span className="text-lg font-bold text-primary">₹{s.amount.toFixed(2)}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* POLLS TAB */}
          <TabsContent value="polls">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Polls</h3>
              <Dialog open={pollDialog} onOpenChange={setPollDialog}>
                <DialogTrigger asChild>
                  <Button><BarChart3 className="mr-2 h-4 w-4" /> Create Poll</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create a Poll</DialogTitle></DialogHeader>
                  <form onSubmit={createPoll} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Question</Label>
                      <Input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Where should we eat tonight?" required />
                    </div>
                    <div className="space-y-2">
                      <Label>Options</Label>
                      {pollOptionTexts.map((opt, idx) => (
                        <div key={idx} className="flex gap-2">
                          <Input
                            value={opt}
                            onChange={e => {
                              const updated = [...pollOptionTexts];
                              updated[idx] = e.target.value;
                              setPollOptionTexts(updated);
                            }}
                            placeholder={`Option ${idx + 1}`}
                          />
                          {pollOptionTexts.length > 2 && (
                            <Button type="button" variant="ghost" size="icon" onClick={() => setPollOptionTexts(pollOptionTexts.filter((_, i) => i !== idx))}>
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" onClick={() => setPollOptionTexts([...pollOptionTexts, ''])}>
                        <Plus className="mr-1 h-3 w-3" /> Add Option
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="anonymous"
                        checked={pollIsAnonymous}
                        onCheckedChange={(checked) => setPollIsAnonymous(checked === true)}
                      />
                      <Label htmlFor="anonymous" className="cursor-pointer">Anonymous voting</Label>
                    </div>
                    <Button type="submit" className="w-full">Create Poll</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {polls.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No polls yet. Create one to get the group's opinion!</CardContent></Card>
            ) : (
              <div className="space-y-4">
                {polls.map(poll => {
                  const options = pollOptions[poll.id] || [];
                  const votes = pollVotes[poll.id] || [];
                  const totalVotes = votes.length;
                  const voted = hasUserVoted(poll.id);

                  return (
                    <Card key={poll.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">{poll.question}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-1">
                              by {profiles[poll.created_by] || 'Unknown'} • {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
                              {poll.is_anonymous && ' • 🔒 Anonymous'}
                            </p>
                          </div>
                          {poll.created_by === user?.id && (
                            <Button variant="ghost" size="icon" onClick={() => deletePoll(poll.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {options.map(opt => {
                          const optVotes = votes.filter(v => v.option_id === opt.id).length;
                          const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;

                          return (
                            <div key={opt.id}>
                              {!voted ? (
                                <Button
                                  variant="outline"
                                  className="w-full justify-start"
                                  onClick={() => votePoll(poll.id, opt.id, poll.is_anonymous)}
                                >
                                  {opt.option_text}
                                </Button>
                              ) : (
                                <div className="space-y-1">
                                  <div className="flex justify-between text-sm">
                                    <span>{opt.option_text}</span>
                                    <span className="text-muted-foreground">{pct}% ({optVotes})</span>
                                  </div>
                                  <Progress value={pct} className="h-2" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {!poll.is_anonymous && voted && totalVotes > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs text-muted-foreground mb-1">Voters:</p>
                            {votes.filter(v => v.user_id).map(v => (
                              <span key={v.id} className="text-xs text-muted-foreground mr-2">
                                {profiles[v.user_id!] || 'Unknown'}
                              </span>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* GALLERY TAB */}
          <TabsContent value="gallery">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Trip Gallery</h3>
              <Dialog open={imageDialog} onOpenChange={setImageDialog}>
                <DialogTrigger asChild>
                  <Button><Upload className="mr-2 h-4 w-4" /> Upload Image</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Upload Image</DialogTitle></DialogHeader>
                  <form onSubmit={uploadImage} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Image</Label>
                      <Input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Caption (optional)</Label>
                      <Input value={imageCaption} onChange={e => setImageCaption(e.target.value)} placeholder="Beach sunset" />
                    </div>
                    <Button type="submit" className="w-full">Upload</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            {images.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No images yet. Upload your first trip photo!</CardContent></Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {images.map(img => (
                  <Card key={img.id} className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md" onClick={() => openImageComments(img)}>
                    <div className="aspect-square overflow-hidden">
                      <img src={img.image_url} alt={img.caption || 'Trip photo'} className="h-full w-full object-cover" />
                    </div>
                    <CardContent className="p-3">
                      {img.caption && <p className="text-sm font-medium">{img.caption}</p>}
                      <p className="text-xs text-muted-foreground">{profiles[img.uploaded_by] || 'Unknown'} • {new Date(img.created_at).toLocaleDateString()}</p>
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
                        <div key={c.id} className="rounded-md bg-muted p-2">
                          <p className="text-sm"><span className="font-medium">{c.commenter_name}</span> <span className="text-muted-foreground text-xs">{new Date(c.created_at).toLocaleString()}</span></p>
                          <p className="text-sm">{c.comment}</p>
                        </div>
                      ))}
                      {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet</p>}
                    </div>
                    <div className="flex gap-2">
                      <Input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment..." onKeyDown={e => e.key === 'Enter' && addComment()} />
                      <Button size="icon" onClick={addComment}><Send className="h-4 w-4" /></Button>
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
