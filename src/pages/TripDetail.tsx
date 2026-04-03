import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, BarChart3, Camera, CreditCard, HandCoins, Home, LogOut, MessageSquareText, Package, Pencil, Plus, Send, Shield, ThumbsUp, Trash2, Upload, Users, X } from 'lucide-react';

interface Member { user_id: string; display_name: string }
interface Expense { id: string; description: string; amount: number; paid_by: string; created_by: string; created_at: string }
interface SettlementPayment { id: string; trip_id: string; from_user_id: string; to_user_id: string; amount: number; notes: string | null; recorded_by: string; created_at: string }
interface TripImage { id: string; image_url: string; caption: string | null; uploaded_by: string; created_at: string }
interface Comment { id: string; comment: string; user_id: string; created_at: string; commenter_name?: string }
interface ImageReaction { id: string; image_id: string; user_id: string; reaction_type: 'like'; created_at: string }
interface Poll { id: string; question: string; is_anonymous: boolean; created_by: string; created_at: string }
interface PollOption { id: string; poll_id: string; option_text: string }
interface PollVote { id: string; poll_id: string; option_id: string; user_id: string | null }
type InventoryStatus = 'new' | 'buying' | 'bought' | 'expired' | 'not_needed';
type ExpenseSplitMode = 'equal' | 'exact' | 'percentage';
type ViewerRole = 'super_admin' | 'admin';
type TripTab = 'expenses' | 'settle' | 'inventory' | 'forum' | 'polls' | 'gallery' | 'members';
type ForumCategory = 'general' | 'infrastructure' | 'cleanliness' | 'security' | 'suggestions' | 'appreciation';
interface TripItem { id: string; trip_id: string; brought_by: string; item_name: string; quantity: number; category: string; status: InventoryStatus; created_at: string }
interface ForumPost { id: string; trip_id: string; created_by: string; title: string; body: string | null; category: ForumCategory; created_at: string; updated_at: string }
interface ForumComment { id: string; post_id: string; user_id: string; comment: string; created_at: string; commenter_name?: string }
interface ForumReaction { id: string; post_id: string; user_id: string; reaction_type: 'upvote'; created_at: string }
interface ExpenseShareSummary { user_id: string; amount: number }

const AVATAR_COLORS = ['gradient-primary', 'gradient-teal', 'gradient-warm'];
const CATEGORIES = ['🎒 General', '🍔 Food', '⛺ Gear', '💊 Medicine', '🧴 Toiletries', '👕 Clothing', '🎮 Entertainment', '📷 Electronics'];
const CATEGORY_EMOJIS: Record<string, string> = { general: '🎒', food: '🍔', gear: '⛺', medicine: '💊', toiletries: '🧴', clothing: '👕', entertainment: '🎮', electronics: '📷' };

const INVENTORY_STATUSES: { value: InventoryStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'buying', label: 'Buying' },
  { value: 'bought', label: 'Bought' },
  { value: 'expired', label: 'Expired' },
  { value: 'not_needed', label: 'Not Needed' },
];
const STATUS_BADGE_CLASSES: Record<InventoryStatus, string> = {
  new: 'bg-slate-100 text-slate-800 border-slate-200',
  buying: 'bg-amber-100 text-amber-900 border-amber-200',
  bought: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  expired: 'bg-rose-100 text-rose-900 border-rose-200',
  not_needed: 'bg-zinc-100 text-zinc-700 border-zinc-200',
};
const STATUS_ORDER: InventoryStatus[] = ['new', 'buying', 'bought', 'expired', 'not_needed'];
const EXPENSE_SPLIT_MODES: { value: ExpenseSplitMode; label: string; helper: string }[] = [
  { value: 'equal', label: 'Equal split', helper: 'Everyone selected shares the cost equally.' },
  { value: 'exact', label: 'Exact amounts', helper: 'Enter the exact amount each selected member owes.' },
  { value: 'percentage', label: 'Percentages', helper: 'Enter percentages for selected members. Total must be 100%.' },
];
const FORUM_CATEGORIES: { value: ForumCategory; label: string; emoji: string; badgeClass: string }[] = [
  { value: 'general', label: 'General', emoji: '💬', badgeClass: 'bg-stone-100 text-stone-700 border-stone-200' },
  { value: 'infrastructure', label: 'Infrastructure', emoji: '🔧', badgeClass: 'bg-rose-100 text-rose-700 border-rose-200' },
  { value: 'cleanliness', label: 'Cleanliness', emoji: '🧹', badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'security', label: 'Security', emoji: '🔒', badgeClass: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'suggestions', label: 'Suggestions', emoji: '💡', badgeClass: 'bg-sky-100 text-sky-700 border-sky-200' },
  { value: 'appreciation', label: 'Appreciation', emoji: '🌟', badgeClass: 'bg-violet-100 text-violet-700 border-violet-200' },
];
const SHELL_COLORS = ['gradient-primary', 'gradient-teal', 'gradient-warm'];
const TRIP_NAV: { group: string; items: { key: TripTab; label: string; icon: typeof Home }[] }[] = [
  {
    group: 'Main',
    items: [
      { key: 'expenses', label: 'Expenses', icon: CreditCard },
      { key: 'settle', label: 'Settle', icon: HandCoins },
    ],
  },
  {
    group: 'Trip Tools',
    items: [
      { key: 'inventory', label: 'Inventory', icon: Package },
      { key: 'forum', label: 'Forum', icon: MessageSquareText },
      { key: 'polls', label: 'Polls', icon: BarChart3 },
      { key: 'gallery', label: 'Gallery', icon: Camera },
    ],
  },
  {
    group: 'Admin',
    items: [
      { key: 'members', label: 'Members', icon: Users },
    ],
  },
];

const getInitials = (name: string) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
const formatInventoryStatus = (status: InventoryStatus) => INVENTORY_STATUSES.find(option => option.value === status)?.label || status;
const formatCurrency = (value: number) => `₹${value.toFixed(2)}`;
const getForumCategoryMeta = (category: ForumCategory) =>
  FORUM_CATEGORIES.find(option => option.value === category) || FORUM_CATEGORIES[0];
const formatCurrentDate = (value: Date = new Date()) =>
  value.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const formatRelativeDate = (value: string) => {
  const diffMs = new Date().getTime() - new Date(value).getTime();
  const diffHours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));

  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
};

const TripDetail = () => {
  const { id: tripId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseSharesByExpense, setExpenseSharesByExpense] = useState<Record<string, ExpenseShareSummary[]>>({});
  const [images, setImages] = useState<TripImage[]>([]);
  const [settlements, setSettlements] = useState<Balance[]>([]);
  const [settlementPayments, setSettlementPayments] = useState<SettlementPayment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [viewerProfile, setViewerProfile] = useState<{ display_name: string | null; role: ViewerRole }>({ display_name: null, role: 'admin' });

  // Items state
  const [items, setItems] = useState<TripItem[]>([]);
  const [itemDialog, setItemDialog] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemCategory, setItemCategory] = useState('general');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState('');
  const [editingItemQty, setEditingItemQty] = useState('1');
  const [editingItemCategory, setEditingItemCategory] = useState('general');
  const [forumPosts, setForumPosts] = useState<ForumPost[]>([]);
  const [forumComments, setForumComments] = useState<Record<string, ForumComment[]>>({});
  const [forumReactions, setForumReactions] = useState<Record<string, ForumReaction[]>>({});
  const [forumDialog, setForumDialog] = useState(false);
  const [forumTitle, setForumTitle] = useState('');
  const [forumBody, setForumBody] = useState('');
  const [forumCategory, setForumCategory] = useState<ForumCategory>('general');
  const [forumFilter, setForumFilter] = useState<'all' | ForumCategory>('all');
  const [forumCommentDrafts, setForumCommentDrafts] = useState<Record<string, string>>({});
  const [expandedForumPosts, setExpandedForumPosts] = useState<string[]>([]);

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
  const [imageCommentCounts, setImageCommentCounts] = useState<Record<string, number>>({});
  const [imageReactions, setImageReactions] = useState<Record<string, ImageReaction[]>>({});
  const [newComment, setNewComment] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expensePaidBy, setExpensePaidBy] = useState('');
  const [expenseSplitMode, setExpenseSplitMode] = useState<ExpenseSplitMode>('equal');
  const [expenseParticipantIds, setExpenseParticipantIds] = useState<string[]>([]);
  const [expenseCustomShares, setExpenseCustomShares] = useState<Record<string, string>>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageCaption, setImageCaption] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<Balance | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [activeTab, setActiveTab] = useState<TripTab>('expenses');
  const [memberNetBalances, setMemberNetBalances] = useState<Record<string, number>>({});
  const [currentDateLabel, setCurrentDateLabel] = useState(() => formatCurrentDate());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentDateLabel(formatCurrentDate());
    }, 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const nextTab = searchParams.get('tab');
    const allowedTabs = new Set<TripTab>(['expenses', 'settle', 'inventory', 'forum', 'polls', 'gallery', 'members']);
    setActiveTab(nextTab && allowedTabs.has(nextTab as TripTab) ? (nextTab as TripTab) : 'expenses');
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    const nextParticipantIds = members.map(member => member.user_id);
    setExpenseParticipantIds(nextParticipantIds);
    setExpenseCustomShares(Object.fromEntries(nextParticipantIds.map(memberId => [memberId, ''])));
    setExpensePaidBy(current => {
      if (current && nextParticipantIds.includes(current)) return current;
      if (user?.id && nextParticipantIds.includes(user.id)) return user.id;
      return nextParticipantIds[0] || '';
    });
  }, [members, user?.id]);

  const fetchViewerProfile = async () => {
    if (!user) return;

    const primary = await supabase
      .from('profiles')
      .select('display_name, role')
      .eq('user_id', user.id)
      .single();

    if (!primary.error && primary.data) {
      setViewerProfile({
        display_name: primary.data.display_name,
        role: primary.data.role || 'admin',
      });
      return;
    }

    const fallback = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .single();

    setViewerProfile({
      display_name: fallback.data?.display_name || null,
      role: 'admin',
    });
  };

  const fetchProfilesMap = async (userIds: string[]) => {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
    if (uniqueUserIds.length === 0) return {} as Record<string, string>;

    const { data } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', uniqueUserIds);

    return Object.fromEntries(
      (data || []).map(profile => [profile.user_id, profile.display_name || 'Unknown']),
    );
  };

  const toggleExpenseParticipant = (memberId: string, checked: boolean) => {
    setExpenseParticipantIds(current => {
      if (checked) {
        return current.includes(memberId) ? current : [...current, memberId];
      }
      return current.filter(id => id !== memberId);
    });
  };

  const setExpenseCustomShare = (memberId: string, value: string) => {
    setExpenseCustomShares(current => ({ ...current, [memberId]: value }));
  };

  const buildEqualShares = (amount: number, participantIds: string[]) => {
    const totalCents = Math.round(amount * 100);
    const baseShare = Math.floor(totalCents / participantIds.length);
    const remainder = totalCents % participantIds.length;

    return participantIds.map((userId, index) => ({
      user_id: userId,
      amount: (baseShare + (index < remainder ? 1 : 0)) / 100,
    }));
  };

  const buildWeightedShares = (
    amount: number,
    weightedValues: { user_id: string; weight: number }[],
  ) => {
    const totalWeight = weightedValues.reduce((sum, item) => sum + item.weight, 0);
    const totalCents = Math.round(amount * 100);
    let allocatedCents = 0;

    const computed = weightedValues.map((item, index) => {
      const exactCents = (item.weight / totalWeight) * totalCents;
      const cents = Math.floor(exactCents);
      allocatedCents += cents;
      return {
        user_id: item.user_id,
        cents,
        remainder: exactCents - cents,
        index,
      };
    });

    let remainingCents = totalCents - allocatedCents;
    [...computed]
      .sort((a, b) => b.remainder - a.remainder)
      .forEach(item => {
        if (remainingCents <= 0) return;
        item.cents += 1;
        remainingCents -= 1;
      });

    return computed
      .sort((a, b) => a.index - b.index)
      .map(item => ({
        user_id: item.user_id,
        amount: item.cents / 100,
      }));
  };

  const buildExpenseShares = (amount: number, participantIds: string[]) => {
    if (expenseSplitMode === 'equal') {
      return { shares: buildEqualShares(amount, participantIds) };
    }

    const numericInputs = participantIds.map(memberId => ({
      user_id: memberId,
      value: Number(expenseCustomShares[memberId] || 0),
    }));

    if (numericInputs.some(item => !Number.isFinite(item.value) || item.value < 0)) {
      return { error: expenseSplitMode === 'percentage' ? 'Enter valid percentages for every selected member.' : 'Enter valid amounts for every selected member.' };
    }

    if (expenseSplitMode === 'exact') {
      const totalExact = numericInputs.reduce((sum, item) => sum + item.value, 0);
      if (totalExact <= 0) {
        return { error: 'Enter an amount for at least one selected member.' };
      }
      if (Math.abs(totalExact - amount) > 0.01) {
        return { error: `Exact split must total ${formatCurrency(amount)}.` };
      }

      const normalized = numericInputs.map((item, index) => {
        if (index === numericInputs.length - 1) {
          const previousTotal = numericInputs
            .slice(0, -1)
            .reduce((sum, entry) => sum + Math.round(entry.value * 100), 0);
          return {
            user_id: item.user_id,
            amount: (Math.round(amount * 100) - previousTotal) / 100,
          };
        }
        return {
          user_id: item.user_id,
          amount: Math.round(item.value * 100) / 100,
        };
      });

      return { shares: normalized };
    }

    const totalPercentage = numericInputs.reduce((sum, item) => sum + item.value, 0);
    if (totalPercentage <= 0) {
      return { error: 'Enter percentages for the selected members.' };
    }
    if (Math.abs(totalPercentage - 100) > 0.01) {
      return { error: 'Percentage split must total 100%.' };
    }

    return {
      shares: buildWeightedShares(
        amount,
        numericInputs.map(item => ({ user_id: item.user_id, weight: item.value })),
      ),
    };
  };

  const resetExpenseForm = () => {
    setEditingExpenseId(null);
    setExpDesc('');
    setExpAmount('');
    setExpenseSplitMode('equal');
    const nextParticipantIds = members.map(member => member.user_id);
    setExpenseParticipantIds(nextParticipantIds);
    setExpenseCustomShares(Object.fromEntries(nextParticipantIds.map(member => [member, ''])));
    setExpensePaidBy(user?.id && nextParticipantIds.includes(user.id) ? user.id : nextParticipantIds[0] || '');
  };

  const openEditExpenseDialog = (expense: Expense) => {
    const shares = expenseSharesByExpense[expense.id] || [];
    const participantIds = shares.map(share => share.user_id);
    const isEqualSplit =
      shares.length > 0 &&
      shares.every(share => Math.abs(Number(share.amount) - Number(shares[0].amount)) < 0.01);

    setEditingExpenseId(expense.id);
    setExpDesc(expense.description);
    setExpAmount(String(Number(expense.amount)));
    setExpensePaidBy(expense.paid_by);
    setExpenseParticipantIds(participantIds);
    setExpenseSplitMode(isEqualSplit ? 'equal' : 'exact');
    setExpenseCustomShares(
      Object.fromEntries(
        participantIds.map(memberId => {
          const share = shares.find(item => item.user_id === memberId);
          return [memberId, share ? String(Number(share.amount)) : ''];
        }),
      ),
    );
    setExpenseDialog(true);
  };

  const fetchTripBasics = async () => {
    if (!tripId) return { memberIds: [] as string[], profileMap: {} as Record<string, string> };

    const [tripRes, membersRes] = await Promise.all([
      supabase.from('trips').select('*').eq('id', tripId).single(),
      supabase.from('trip_members').select('user_id').eq('trip_id', tripId),
    ]);

    if (tripRes.data) setTrip(tripRes.data);

    const memberIds = membersRes.data?.map(member => member.user_id) || [];
    const profileMap = await fetchProfilesMap(memberIds);

    setProfiles(profileMap);
    setMembers(
      memberIds.map(memberId => ({
        user_id: memberId,
        display_name: profileMap[memberId] || 'Unknown',
      })),
    );

    return { memberIds, profileMap };
  };

  const fetchExpensesAndSettlements = async (memberIds: string[]) => {
    if (!tripId) return;

    const [expensesRes, paymentsRes] = await Promise.all([
      supabase
        .from('expenses')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false }),
      supabase
        .from('settlement_payments')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false }),
    ]);

    const expensesData = expensesRes.data || [];
    const paymentsData = paymentsRes.data || [];

    setExpenses(expensesData);
    setSettlementPayments(paymentsData);

    if (expensesData.length === 0) {
      setExpenseSharesByExpense({});
      setMemberNetBalances(Object.fromEntries(memberIds.map(memberId => [memberId, 0])));
      setSettlements([]);
      return;
    }

    const { data: shares } = await supabase
      .from('expense_shares')
      .select('*')
      .in('expense_id', expensesData.map(expense => expense.id));

    const nextExpenseSharesByExpense: Record<string, ExpenseShareSummary[]> = {};
    (shares || []).forEach(share => {
      if (!nextExpenseSharesByExpense[share.expense_id]) nextExpenseSharesByExpense[share.expense_id] = [];
      nextExpenseSharesByExpense[share.expense_id].push({
        user_id: share.user_id,
        amount: Number(share.amount),
      });
    });
    setExpenseSharesByExpense(nextExpenseSharesByExpense);

    const netBalances: Record<string, number> = {};
    memberIds.forEach(memberId => {
      netBalances[memberId] = 0;
    });

    expensesData.forEach(expense => {
      netBalances[expense.paid_by] = (netBalances[expense.paid_by] || 0) + Number(expense.amount);
    });

    shares?.forEach(share => {
      netBalances[share.user_id] = (netBalances[share.user_id] || 0) - Number(share.amount);
    });

    paymentsData.forEach(payment => {
      netBalances[payment.from_user_id] = (netBalances[payment.from_user_id] || 0) + Number(payment.amount);
      netBalances[payment.to_user_id] = (netBalances[payment.to_user_id] || 0) - Number(payment.amount);
    });

    const roundedBalances = Object.fromEntries(
      Object.entries(netBalances).map(([memberId, balance]) => [memberId, Math.round(balance * 100) / 100]),
    );

    setMemberNetBalances(roundedBalances);
    setSettlements(simplifyDebts(roundedBalances));
  };

  const fetchImages = async () => {
    if (!tripId) return;

    const { data } = await supabase
      .from('trip_images')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });

    const imagesData = data || [];
    setImages(imagesData);

    if (imagesData.length === 0) {
      setImageCommentCounts({});
      setImageReactions({});
      return;
    }

    const imageIds = imagesData.map(image => image.id);
    const [commentsRes, reactionsRes] = await Promise.all([
      supabase.from('image_comments').select('id, image_id').in('image_id', imageIds),
      supabase.from('image_reactions').select('*').in('image_id', imageIds),
    ]);

    const nextCommentCounts: Record<string, number> = {};
    commentsRes.data?.forEach(comment => {
      nextCommentCounts[comment.image_id] = (nextCommentCounts[comment.image_id] || 0) + 1;
    });

    const nextImageReactions: Record<string, ImageReaction[]> = {};
    reactionsRes.data?.forEach(reaction => {
      if (!nextImageReactions[reaction.image_id]) nextImageReactions[reaction.image_id] = [];
      nextImageReactions[reaction.image_id].push(reaction as ImageReaction);
    });

    setImageCommentCounts(nextCommentCounts);
    setImageReactions(nextImageReactions);
  };

  const fetchPolls = async () => {
    if (!tripId) return;

    const { data: pollsData } = await supabase
      .from('polls')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });

    if (!pollsData || pollsData.length === 0) {
      setPolls([]);
      setPollOptions({});
      setPollVotes({});
      return;
    }

    setPolls(pollsData);

    const pollIds = pollsData.map(poll => poll.id);
    const [optionsRes, votesRes] = await Promise.all([
      supabase.from('poll_options').select('*').in('poll_id', pollIds),
      supabase.from('poll_votes').select('*').in('poll_id', pollIds),
    ]);

    const nextPollOptions: Record<string, PollOption[]> = {};
    optionsRes.data?.forEach(option => {
      if (!nextPollOptions[option.poll_id]) nextPollOptions[option.poll_id] = [];
      nextPollOptions[option.poll_id].push(option);
    });

    const nextPollVotes: Record<string, PollVote[]> = {};
    votesRes.data?.forEach(vote => {
      if (!nextPollVotes[vote.poll_id]) nextPollVotes[vote.poll_id] = [];
      nextPollVotes[vote.poll_id].push(vote);
    });

    setPollOptions(nextPollOptions);
    setPollVotes(nextPollVotes);
  };

  const fetchItems = async () => {
    if (!tripId) return;

    const { data } = await supabase
      .from('trip_items')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true });

    setItems(data || []);
  };

  const fetchForum = async () => {
    if (!tripId) return;

    const { data: postsData } = await supabase
      .from('forum_posts')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });

    if (!postsData || postsData.length === 0) {
      setForumPosts([]);
      setForumComments({});
      setForumReactions({});
      return;
    }

    setForumPosts(postsData);

    const postIds = postsData.map(post => post.id);
    const [commentsRes, reactionsRes] = await Promise.all([
      supabase
        .from('forum_comments')
        .select('*')
        .in('post_id', postIds)
        .order('created_at', { ascending: true }),
      supabase
        .from('forum_post_reactions')
        .select('*')
        .in('post_id', postIds)
        .order('created_at', { ascending: true }),
    ]);

    const commentsData = commentsRes.data || [];
    const reactionsData = reactionsRes.data || [];

    const forumProfileMap = await fetchProfilesMap([
      ...postsData.map(post => post.created_by),
      ...commentsData.map(comment => comment.user_id),
    ]);

    if (Object.keys(forumProfileMap).length > 0) {
      setProfiles(current => ({ ...current, ...forumProfileMap }));
    }

    const groupedComments: Record<string, ForumComment[]> = {};
    commentsData.forEach(comment => {
      if (!groupedComments[comment.post_id]) groupedComments[comment.post_id] = [];
      groupedComments[comment.post_id].push({
        ...comment,
        commenter_name: forumProfileMap[comment.user_id] || profiles[comment.user_id] || 'Unknown',
      });
    });

    const groupedReactions: Record<string, ForumReaction[]> = {};
    reactionsData.forEach(reaction => {
      if (!groupedReactions[reaction.post_id]) groupedReactions[reaction.post_id] = [];
      groupedReactions[reaction.post_id].push(reaction as ForumReaction);
    });

    setForumComments(groupedComments);
    setForumReactions(groupedReactions);
  };

  const refreshTripPage = async () => {
    if (!tripId) return;

    await fetchViewerProfile();
    const { memberIds } = await fetchTripBasics();
    await Promise.all([
      fetchExpensesAndSettlements(memberIds),
      fetchImages(),
      fetchPolls(),
      fetchItems(),
      fetchForum(),
    ]);
  };

  useEffect(() => { refreshTripPage(); }, [tripId]);

  // --- Action handlers ---
  const saveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tripId) return;
    const amount = parseFloat(expAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }
    const participantIds = expenseParticipantIds.length > 0 ? expenseParticipantIds : members.map(member => member.user_id);
    if (participantIds.length === 0) { toast.error('Select at least one member for this expense.'); return; }

    if (!expensePaidBy) { toast.error('Choose who paid for this expense.'); return; }

    const { shares, error: sharesError } = buildExpenseShares(amount, participantIds);
    if (sharesError || !shares) {
      toast.error(sharesError || 'Unable to calculate expense shares.');
      return;
    }

    let expenseId = editingExpenseId;

    if (editingExpenseId) {
      const updateExpense = await supabase
        .from('expenses')
        .update({ paid_by: expensePaidBy, description: expDesc, amount })
        .eq('id', editingExpenseId)
        .select()
        .single();
      if (updateExpense.error) { toast.error(updateExpense.error.message); return; }
      expenseId = updateExpense.data.id;

      const deleteShares = await supabase.from('expense_shares').delete().eq('expense_id', editingExpenseId);
      if (deleteShares.error) {
        toast.error(deleteShares.error.message);
        return;
      }
    } else {
      const createExpense = await supabase
        .from('expenses')
        .insert({ trip_id: tripId, paid_by: expensePaidBy, created_by: user.id, description: expDesc, amount })
        .select()
        .single();
      if (createExpense.error) { toast.error(createExpense.error.message); return; }
      expenseId = createExpense.data.id;
    }

    const shareRows = shares.map(share => ({
      expense_id: expenseId!,
      user_id: share.user_id,
      amount: share.amount,
    }));

    const sharesInsert = await supabase.from('expense_shares').insert(shareRows);
    if (sharesInsert.error) {
      toast.error(sharesInsert.error.message);
      return;
    }

    resetExpenseForm();
    setExpenseDialog(false);
    toast.success('Expense added! 💸');
    fetchExpensesAndSettlements(members.map(member => member.user_id));
  };
  const deleteExpense = async (id: string) => { await supabase.from('expenses').delete().eq('id', id); toast.success('Deleted'); fetchExpensesAndSettlements(members.map(member => member.user_id)); };

  const openPaymentDialog = (settlement: Balance) => {
    setSelectedSettlement(settlement);
    setPaymentAmount(settlement.amount.toFixed(2));
    setPaymentNotes('');
    setPaymentDialog(true);
  };

  const recordSettlementPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tripId || !selectedSettlement) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid payment amount');
      return;
    }

    if (amount - selectedSettlement.amount > 0.01) {
      toast.error('Payment cannot be more than the outstanding amount.');
      return;
    }

    const { error } = await supabase.from('settlement_payments').insert({
      trip_id: tripId,
      from_user_id: selectedSettlement.from,
      to_user_id: selectedSettlement.to,
      amount,
      notes: paymentNotes.trim() || null,
      recorded_by: user.id,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setPaymentDialog(false);
    setSelectedSettlement(null);
    setPaymentAmount('');
    setPaymentNotes('');
    toast.success('Payment recorded');
    fetchExpensesAndSettlements(members.map(member => member.user_id));
  };

  const uploadImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tripId || !imageFile) return;
    const filePath = `${user.id}/${tripId}/${Date.now()}.${imageFile.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('trip-images').upload(filePath, imageFile);
    if (error) { toast.error(error.message); return; }
    const { data: { publicUrl } } = supabase.storage.from('trip-images').getPublicUrl(filePath);
    await supabase.from('trip_images').insert({ trip_id: tripId, uploaded_by: user.id, image_url: publicUrl, caption: imageCaption || null });
    setImageFile(null); setImageCaption(''); setImageDialog(false); toast.success('Uploaded! 📸'); fetchImages();
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
    } else {
      setComments([]);
    }
  };
  const addComment = async () => {
    if (!user || !selectedImage || !newComment.trim()) return;
    await supabase.from('image_comments').insert({ image_id: selectedImage.id, user_id: user.id, comment: newComment.trim() });
    setNewComment('');
    await Promise.all([openImageComments(selectedImage), fetchImages()]);
  };
  const toggleImageReaction = async (imageId: string) => {
    if (!user) return;

    const existingReaction = (imageReactions[imageId] || []).find(reaction => reaction.user_id === user.id);
    if (existingReaction) {
      const { error } = await supabase.from('image_reactions').delete().eq('id', existingReaction.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from('image_reactions').insert({
        image_id: imageId,
        user_id: user.id,
        reaction_type: 'like',
      });
      if (error) { toast.error(error.message); return; }
    }

    fetchImages();
  };

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripId) return;
    const { data } = await supabase.from('profiles').select('user_id, display_name');
    const match = data?.find(p => p.display_name?.toLowerCase() === memberEmail.toLowerCase());
    if (!match) { toast.error('User not found. They need to sign up first.'); return; }
    const { error } = await supabase.from('trip_members').insert({ trip_id: tripId, user_id: match.user_id });
    if (error) { error.code === '23505' ? toast.error('Already a member') : toast.error(error.message); return; }
    setMemberEmail(''); setMemberDialog(false); toast.success('Member added! 🤝'); refreshTripPage();
  };

  const removeMember = async (memberId: string) => {
    if (!tripId) return;
    if (memberId === trip.created_by) {
      toast.error('Trip owner cannot be removed.');
      return;
    }

    const previousMembers = members;
    const previousProfiles = profiles;
    const previousExpenseParticipantIds = expenseParticipantIds;
    const previousExpenseCustomShares = expenseCustomShares;
    const previousMemberNetBalances = memberNetBalances;

    setMembers(current => current.filter(member => member.user_id !== memberId));
    setProfiles(current => {
      const next = { ...current };
      delete next[memberId];
      return next;
    });
    setExpenseParticipantIds(current => current.filter(id => id !== memberId));
    setExpenseCustomShares(current => {
      const next = { ...current };
      delete next[memberId];
      return next;
    });
    setMemberNetBalances(current => {
      const next = { ...current };
      delete next[memberId];
      return next;
    });

    const { data, error } = await supabase
      .from('trip_members')
      .delete()
      .select('id')
      .eq('trip_id', tripId)
      .eq('user_id', memberId);

    if (error || !data?.length) {
      setMembers(previousMembers);
      setProfiles(previousProfiles);
      setExpenseParticipantIds(previousExpenseParticipantIds);
      setExpenseCustomShares(previousExpenseCustomShares);
      setMemberNetBalances(previousMemberNetBalances);
      toast.error(error?.message ?? 'Member could not be removed. Please apply the latest Supabase migration.');
      return;
    }

    toast.success('Member removed from trip');
    await refreshTripPage();
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
    setPollQuestion(''); setPollIsAnonymous(false); setPollOptionTexts(['', '']); setPollDialog(false); toast.success('Poll created! 📊'); fetchPolls();
  };
  const votePoll = async (pollId: string, optionId: string, isAnonymous: boolean) => {
    if (!user) return;
    const { error } = await supabase.from('poll_votes').insert({ poll_id: pollId, option_id: optionId, user_id: isAnonymous ? null : user.id });
    if (error) { error.code === '23505' ? toast.error('Already voted') : toast.error(error.message); return; }
    toast.success('Voted! ✅'); fetchPolls();
  };
  const deletePoll = async (id: string) => { await supabase.from('polls').delete().eq('id', id); toast.success('Deleted'); fetchPolls(); };
  const hasUserVoted = (pollId: string) => (pollVotes[pollId] || []).some(v => v.user_id === user?.id);

  // Forum
  const createForumPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tripId || !forumTitle.trim()) return;
    const { error } = await supabase.from('forum_posts').insert({
      trip_id: tripId,
      created_by: user.id,
      title: forumTitle.trim(),
      body: forumBody.trim() || null,
      category: forumCategory,
    });
    if (error) { toast.error(error.message); return; }
    setForumTitle('');
    setForumBody('');
    setForumCategory('general');
    setForumDialog(false);
    toast.success('Forum post added!');
    fetchForum();
  };
  const addForumComment = async (postId: string) => {
    if (!user) return;
    const draft = forumCommentDrafts[postId]?.trim();
    if (!draft) return;
    const { error } = await supabase.from('forum_comments').insert({ post_id: postId, user_id: user.id, comment: draft });
    if (error) { toast.error(error.message); return; }
    setForumCommentDrafts(current => ({ ...current, [postId]: '' }));
    fetchForum();
  };
  const deleteForumPost = async (postId: string) => {
    const { error } = await supabase.from('forum_posts').delete().eq('id', postId);
    if (error) { toast.error(error.message); return; }
    toast.success('Forum post removed');
    fetchForum();
  };
  const toggleForumPostOpen = (postId: string) => {
    setExpandedForumPosts(current =>
      current.includes(postId) ? current.filter(id => id !== postId) : [...current, postId],
    );
  };
  const toggleForumReaction = async (postId: string) => {
    if (!user) return;

    const existingReaction = (forumReactions[postId] || []).find(reaction => reaction.user_id === user.id);
    if (existingReaction) {
      const { error } = await supabase.from('forum_post_reactions').delete().eq('id', existingReaction.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from('forum_post_reactions').insert({
        post_id: postId,
        user_id: user.id,
        reaction_type: 'upvote',
      });
      if (error) { toast.error(error.message); return; }
    }

    fetchForum();
  };

  // Items / Inventory
  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tripId) return;
    const qty = parseInt(itemQty);
    if (isNaN(qty) || qty < 1) { toast.error('Enter valid quantity'); return; }
    const { error } = await supabase.from('trip_items').insert({ trip_id: tripId, brought_by: user.id, item_name: itemName, quantity: qty, category: itemCategory, status: 'new' });
    if (error) { toast.error(error.message); return; }
    setItemName(''); setItemQty('1'); setItemCategory('general'); setItemDialog(false); toast.success('Item added! 📦'); fetchItems();
  };
  const updateItemStatus = async (item: TripItem, status: InventoryStatus) => {
    const { error } = await supabase.from('trip_items').update({ status }).eq('id', item.id);
    if (error) { toast.error(error.message); return; }
    fetchItems();
  };
  const startEditingItem = (item: TripItem) => {
    setEditingItemId(item.id);
    setEditingItemName(item.item_name);
    setEditingItemQty(String(item.quantity));
    setEditingItemCategory(item.category);
  };
  const cancelEditingItem = () => {
    setEditingItemId(null);
    setEditingItemName('');
    setEditingItemQty('1');
    setEditingItemCategory('general');
  };
  const saveItemDetails = async (itemId: string) => {
    const qty = parseInt(editingItemQty);
    if (!editingItemName.trim()) { toast.error('Item name is required'); return; }
    if (isNaN(qty) || qty < 1) { toast.error('Enter valid quantity'); return; }
    const { error } = await supabase.from('trip_items').update({
      item_name: editingItemName.trim(),
      quantity: qty,
      category: editingItemCategory,
    }).eq('id', itemId);
    if (error) { toast.error(error.message); return; }
    cancelEditingItem();
    toast.success('Item updated');
    fetchItems();
  };
  const deleteItem = async (id: string) => { await supabase.from('trip_items').delete().eq('id', id); toast.success('Removed'); fetchItems(); };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  if (!trip) return <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#eff8f7_0%,#fff7f1_30%,#fffdfb_100%)]"><p className="text-muted-foreground">Loading trip...</p></div>;

  // Group items by category
  const itemsByCategory = items.reduce<Record<string, TripItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});
  const statusCounts = items.reduce<Record<InventoryStatus, number>>((acc, item) => {
    acc[item.status] += 1;
    return acc;
  }, { new: 0, buying: 0, bought: 0, expired: 0, not_needed: 0 });
  const heroStats = [
    { label: 'Travelers', value: members.length, icon: Users },
    { label: 'Expenses', value: expenses.length, icon: CreditCard },
    { label: 'Inventory', value: items.length, icon: Package },
    { label: 'Your Role', value: viewerProfile.role === 'super_admin' ? 'SA' : 'AD', icon: Shield },
  ];
  const filteredForumPosts = forumFilter === 'all'
    ? forumPosts
    : forumPosts.filter(post => post.category === forumFilter);
  const tabSummary: Record<TripTab, { title: string; description: string }> = {
    expenses: { title: 'Expenses', description: 'Track shared trip spending and keep every payment visible.' },
    settle: { title: 'Settlements', description: 'See who owes whom and settle balances quickly.' },
    inventory: { title: 'Inventory', description: 'Manage trip essentials and update item status in one place.' },
    forum: { title: 'Community Forum', description: 'Share updates, requests, suggestions, and replies in a cleaner community feed.' },
    polls: { title: 'Polls', description: 'Run quick votes for the group when a decision is needed.' },
    gallery: { title: 'Gallery', description: 'Upload photos and keep trip memories together.' },
    members: { title: 'Members', description: 'See everyone in this trip workspace and add new travelers.' },
  };
  const totalRecordedPayments = settlementPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const selectedExpenseMembers = members.filter(member => expenseParticipantIds.includes(member.user_id));
  const currentExpenseAmount = Number(expAmount || 0);
  const expenseCustomSplitTotal = selectedExpenseMembers.reduce((sum, member) => sum + Number(expenseCustomShares[member.user_id] || 0), 0);
  const youOweTotal = settlements
    .filter(settlement => settlement.from === user?.id)
    .reduce((sum, settlement) => sum + settlement.amount, 0);
  const youAreOwedTotal = settlements
    .filter(settlement => settlement.to === user?.id)
    .reduce((sum, settlement) => sum + settlement.amount, 0);
  const yourNetBalance = Math.round((memberNetBalances[user?.id || ''] || 0) * 100) / 100;
  const travelerBalances = members
    .map(member => ({
      ...member,
      balance: Math.round((memberNetBalances[member.user_id] || 0) * 100) / 100,
    }))
    .sort((a, b) => b.balance - a.balance);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eff8f7_0%,#fff7f1_30%,#fffdfb_100%)]">
      <header className="sticky top-0 z-30 border-b border-[#eadfd4] bg-white/90 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/dashboard" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ff8a3d_0%,#f76707_100%)] shadow-[0_12px_30px_-18px_rgba(247,103,7,0.9)] sm:h-11 sm:w-11">
                <Home className="h-4 w-4 text-white sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xl font-bold text-[#f76707] sm:text-2xl">FunTrip</p>
                <p className="hidden text-xs uppercase tracking-[0.2em] text-[#8a796b] sm:block">Travel Hub</p>
              </div>
            </Link>
            <Badge className="hidden rounded-full border border-[#ffd8bf] bg-[#fff2e8] px-4 py-1 text-[#d9480f] hover:bg-[#fff2e8] sm:inline-flex">Trip Planning Workspace</Badge>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Badge variant="outline" className="rounded-full border-[#eadfd4] bg-white/90 px-3 py-1 text-[#5f534a]">
              {currentDateLabel}
            </Badge>
            <div className="hidden items-center gap-3 rounded-full border border-[#eadfd4] bg-white px-3 py-2 shadow-sm sm:flex">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-[linear-gradient(135deg,#ff8a3d_0%,#f76707_100%)] text-sm font-bold text-white">
                  {getInitials(viewerProfile.display_name || profiles[user?.id || ''] || '')}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold">{viewerProfile.display_name || profiles[user?.id || ''] || 'Traveler'}</p>
                <p className="text-xs text-muted-foreground">{viewerProfile.role === 'super_admin' ? 'Super Admin' : 'Admin'}</p>
              </div>
            </div>
            <Button variant="outline" className="rounded-full px-3 sm:px-4" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <header className="hidden border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex w-full flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/dashboard"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-extrabold truncate">{trip.name}</h1>
            {trip.description && <p className="text-sm text-muted-foreground truncate">{trip.description}</p>}
          </div>
          {/* Member avatars in header */}
          <div className="mr-1 hidden -space-x-2 sm:flex">
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

      <div className="lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="sticky top-[65px] z-20 border-b border-[#eadfd4] bg-white/85 px-4 py-3 backdrop-blur-sm lg:static lg:min-h-[calc(100vh-81px)] lg:border-b-0 lg:border-r lg:px-5 lg:py-5">
          <div className="hidden space-y-6 lg:block">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#8a796b]">Main</p>
              <div className="space-y-2">
                <Link to="/dashboard" className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-[#5f534a] transition hover:bg-[#faf3ee]">
                  <Home className="h-4 w-4" />
                  <span className="font-medium">Dashboard</span>
                </Link>
              </div>
            </div>
            {TRIP_NAV.map(sectionGroup => (
              <div key={sectionGroup.group}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#8a796b]">{sectionGroup.group}</p>
                <div className="space-y-2">
                  {sectionGroup.items.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setActiveTab(item.key)}
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
            <Link to="/dashboard" className="flex shrink-0 items-center gap-2 rounded-full border border-[#eadfd4] bg-white px-4 py-2 text-sm text-[#5f534a]">
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
            {TRIP_NAV.flatMap(sectionGroup => sectionGroup.items).map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
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
          <div className="space-y-6">
            <div className="rounded-[24px] border border-white/60 bg-white/85 p-4 shadow-sm md:hidden">
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a796b]">Current Trip</p>
                  <p className="mt-2 text-2xl font-extrabold text-foreground">{trip.name}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{trip.description || 'Keep your planning and trip work in one shared space.'}</p>
                  <p className="mt-2 text-sm font-medium text-[#5f534a]">{currentDateLabel}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full px-3 py-1">{members.length} members</Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1">{tabSummary[activeTab].title}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{tabSummary[activeTab].description}</p>
                <div className="flex flex-wrap gap-2">
                  <Dialog open={memberDialog} onOpenChange={setMemberDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm"><Users className="mr-2 h-4 w-4" /> Members</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Add Trip Member</DialogTitle></DialogHeader>
                      <form onSubmit={addMember} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Display Name</Label>
                          <Input value={memberEmail} onChange={e => setMemberEmail(e.target.value)} placeholder="Enter their display name" required />
                        </div>
                        <Button type="submit" className="w-full gradient-primary border-none text-primary-foreground">Add Member</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>

            <div className="hidden rounded-[28px] bg-[linear-gradient(135deg,#f76707_0%,#d9480f_45%,#617a43_100%)] px-6 py-6 text-white shadow-[0_30px_60px_-30px_rgba(217,72,15,0.8)] md:block sm:px-8">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <Badge className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-white hover:bg-white/10">Current Trip</Badge>
                  <p className="mt-4 text-3xl font-extrabold">{trip.name}</p>
                  <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">{trip.description || 'Keep your planning, updates, members, and trip work in one shared space.'}</p>
                  <p className="mt-3 text-sm text-white/80">{currentDateLabel}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex -space-x-2">
                    {members.slice(0, 4).map((member, index) => (
                      <Avatar key={member.user_id} className="h-10 w-10 border-2 border-white/40">
                        <AvatarFallback className={`${SHELL_COLORS[index % SHELL_COLORS.length]} text-xs font-bold text-primary-foreground`}>
                          {getInitials(member.display_name)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {members.length > 4 && (
                      <Avatar className="h-10 w-10 border-2 border-white/40">
                        <AvatarFallback className="bg-white/15 text-xs font-bold text-white">+{members.length - 4}</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                  <Dialog open={memberDialog} onOpenChange={setMemberDialog}>
                    <DialogTrigger asChild>
                      <Button className="border-none bg-white/15 text-white hover:bg-white/25"><Users className="mr-2 h-4 w-4" /> Add Member</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Add Trip Member</DialogTitle></DialogHeader>
                      <form onSubmit={addMember} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Display Name</Label>
                          <Input value={memberEmail} onChange={e => setMemberEmail(e.target.value)} placeholder="Enter their display name" required />
                        </div>
                        <Button type="submit" className="w-full gradient-primary border-none text-primary-foreground">Add Member</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>

            <div className="hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
              {heroStats.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Card key={item.label} className="border-white/60 shadow-sm">
                    <CardContent className="flex items-center gap-4 p-5">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${SHELL_COLORS[index % SHELL_COLORS.length]}`}>
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

            <Card className="hidden border-white/60 shadow-sm md:block">
              <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xl font-bold">{tabSummary[activeTab].title}</p>
                  <p className="text-sm text-muted-foreground">{tabSummary[activeTab].description}</p>
                </div>
                <Badge variant="outline" className="w-fit rounded-full px-3 py-1">{members.length} members in trip</Badge>
              </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TripTab)}>
              <TabsList className="hidden">
            <TabsTrigger value="expenses">💸 Expenses</TabsTrigger>
            <TabsTrigger value="settle">🤝 Settle</TabsTrigger>
            <TabsTrigger value="inventory">📦 Inventory</TabsTrigger>
            <TabsTrigger value="forum">💬 Forum</TabsTrigger>
            <TabsTrigger value="polls">📊 Polls</TabsTrigger>
            <TabsTrigger value="gallery">📸 Gallery</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
          </TabsList>

          {/* EXPENSES */}
          <TabsContent value="expenses">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-bold">Expenses</h3>
              <Dialog open={expenseDialog} onOpenChange={setExpenseDialog}>
                <DialogTrigger asChild><Button className="gradient-primary border-none text-primary-foreground" onClick={resetExpenseForm}><Plus className="mr-2 h-4 w-4" /> Add</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Expense 💰</DialogTitle></DialogHeader>
                  <form onSubmit={saveExpense} className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {editingExpenseId ? 'Update the expense details, split, payer, or participants.' : 'Create a new shared expense for this trip.'}
                    </p>
                    <div className="space-y-2"><Label>Description</Label><Input value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="Lunch at restaurant" required /></div>
                    <div className="space-y-2"><Label>Amount (₹)</Label><Input type="number" step="0.01" value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="500" required /></div>
                    <div className="space-y-2">
                      <Label>Paid By</Label>
                      <Select value={expensePaidBy} onValueChange={setExpensePaidBy}>
                        <SelectTrigger><SelectValue placeholder="Choose the payer" /></SelectTrigger>
                        <SelectContent>
                          {members.map(member => (
                            <SelectItem key={member.user_id} value={member.user_id}>{member.display_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Split Mode</Label>
                      <Select value={expenseSplitMode} onValueChange={value => setExpenseSplitMode(value as ExpenseSplitMode)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {EXPENSE_SPLIT_MODES.map(mode => (
                            <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        {EXPENSE_SPLIT_MODES.find(mode => mode.value === expenseSplitMode)?.helper}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Split Between Members</Label>
                      <div className="rounded-xl border p-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          {members.map(member => (
                            <label key={member.user_id} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={expenseParticipantIds.includes(member.user_id)}
                                onCheckedChange={checked => toggleExpenseParticipant(member.user_id, checked === true)}
                              />
                              <span>{member.display_name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {expenseParticipantIds.length} selected member{expenseParticipantIds.length === 1 ? '' : 's'} will be included in this expense.
                      </p>
                    </div>
                    {expenseSplitMode !== 'equal' && (
                      <div className="space-y-3 rounded-xl border border-dashed p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">
                              {expenseSplitMode === 'exact' ? 'Exact share entry' : 'Percentage entry'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {expenseSplitMode === 'exact'
                                ? `Entered total: ${formatCurrency(expenseCustomSplitTotal)} of ${formatCurrency(currentExpenseAmount)}`
                                : `Entered total: ${expenseCustomSplitTotal.toFixed(2)}% of 100%`}
                            </p>
                          </div>
                          <Badge variant="outline">
                            {expenseSplitMode === 'exact' ? formatCurrency(currentExpenseAmount) : '100% target'}
                          </Badge>
                        </div>
                        <div className="space-y-3">
                          {selectedExpenseMembers.map(member => (
                            <div key={member.user_id} className="grid gap-2 sm:grid-cols-[1fr_140px] sm:items-center">
                              <div className="text-sm font-medium">{member.display_name}</div>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={expenseCustomShares[member.user_id] || ''}
                                onChange={e => setExpenseCustomShare(member.user_id, e.target.value)}
                                placeholder={expenseSplitMode === 'exact' ? '0.00' : '0'}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <Button type="submit" className="w-full gradient-primary border-none text-primary-foreground">{editingExpenseId ? 'Save Changes' : 'Add Expense'}</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            {expenses.length === 0 ? (
              <Card className="border-dashed border-2"><CardContent className="py-10 text-center"><p className="text-4xl mb-2">💸</p><p className="text-muted-foreground">No expenses yet</p></CardContent></Card>
            ) : (
              <Card>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Description</TableHead><TableHead>Paid By</TableHead><TableHead>Split Details</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Date</TableHead><TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {expenses.map(exp => {
                      const sharedMembers = expenseSharesByExpense[exp.id] || [];
                      return (
                      <TableRow key={exp.id}>
                        <TableCell className="font-medium">{exp.description}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6"><AvatarFallback className="gradient-primary text-primary-foreground text-[9px]">{getInitials(profiles[exp.paid_by] || '')}</AvatarFallback></Avatar>
                            {profiles[exp.paid_by] || 'Unknown'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            {sharedMembers.length === 0 ? (
                              <span className="text-sm text-muted-foreground">No members</span>
                            ) : (
                              sharedMembers.map(share => (
                                <Badge key={`${exp.id}-${share.user_id}`} variant="outline" className="text-xs">
                                  {(profiles[share.user_id] || 'Unknown')} - {formatCurrency(Number(share.amount))}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">₹{Number(exp.amount).toFixed(2)}</TableCell>
                        <TableCell className="text-right text-muted-foreground text-sm">{new Date(exp.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          {(exp.created_by || exp.paid_by) === user?.id && (
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditExpenseDialog(exp)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteExpense(exp.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* SETTLE */}
          <TabsContent value="settle">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold">Settlement Summary</h3>
                <p className="text-sm text-muted-foreground">Splitwise-style simplified debts are shown here after netting all expenses and recorded payments.</p>
              </div>
              <Badge variant="outline" className="w-fit rounded-full px-3 py-1">Recorded: ₹{totalRecordedPayments.toFixed(2)}</Badge>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-white/60 shadow-sm">
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground">You owe</p>
                    <p className="mt-2 text-2xl font-bold">{formatCurrency(youOweTotal)}</p>
                  </CardContent>
                </Card>
                <Card className="border-white/60 shadow-sm">
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground">You get back</p>
                    <p className="mt-2 text-2xl font-bold">{formatCurrency(youAreOwedTotal)}</p>
                  </CardContent>
                </Card>
                <Card className="border-white/60 shadow-sm">
                  <CardContent className="p-5">
                    <p className="text-sm text-muted-foreground">Net balance</p>
                    <p className="mt-2 text-2xl font-bold">{formatCurrency(yourNetBalance)}</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-white/60 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Traveler Balances</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Traveler</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Net Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {travelerBalances.map(member => (
                          <TableRow key={`balance-${member.user_id}`}>
                            <TableCell className="font-medium">{member.display_name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {member.balance > 0.009 ? 'Gets back' : member.balance < -0.009 ? 'Owes' : 'Settled'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(member.balance)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
              {settlements.length === 0 ? (
                <Card className="border-dashed border-2">
                  <CardContent className="py-10 text-center">
                    <p className="mb-2 text-4xl">🎉</p>
                    <p className="text-muted-foreground">All settled up!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  <Card className="border-white/60 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Simplified Who Pays Whom</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="mb-4 text-sm text-muted-foreground">
                        These are the minimum settlement transfers needed right now.
                      </p>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Payer</TableHead>
                              <TableHead>Receiver</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {settlements.map((s, i) => (
                              <TableRow key={`settlement-row-${s.from}-${s.to}-${i}`}>
                                <TableCell className="font-medium">{profiles[s.from] || 'Unknown'}</TableCell>
                                <TableCell className="font-medium">{profiles[s.to] || 'Unknown'}</TableCell>
                                <TableCell className="text-right font-semibold">₹{s.amount.toFixed(2)}</TableCell>
                                <TableCell className="text-right">
                                  {user?.id === s.from ? (
                                    <Button variant="outline" size="sm" onClick={() => openPaymentDialog(s)}>
                                      Record Payment
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Pending</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>

                  {settlements.map((s, i) => (
                    <Card key={`${s.from}-${s.to}-${i}`} className="overflow-hidden border-white/60 shadow-sm">
                      <div className="h-1 gradient-warm" />
                      <CardContent className="flex flex-col gap-4 p-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2 rounded-full bg-muted/40 px-3 py-2">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="gradient-primary text-xs text-primary-foreground">
                                  {getInitials(profiles[s.from] || '')}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{profiles[s.from] || 'Unknown'}</span>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <div className="flex items-center gap-2 rounded-full bg-muted/40 px-3 py-2">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="gradient-teal text-xs text-primary-foreground">
                                  {getInitials(profiles[s.to] || '')}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{profiles[s.to] || 'Unknown'}</span>
                            </div>
                          </div>
                          <Badge variant="secondary" className="w-fit px-3 py-1 text-base font-bold">
                            ₹{s.amount.toFixed(2)}
                          </Badge>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{profiles[s.from] || 'Unknown'}</span>
                            {' '}needs to pay{' '}
                            <span className="font-medium text-foreground">{profiles[s.to] || 'Unknown'}</span>
                            {' '}₹{s.amount.toFixed(2)}.
                          </p>
                          {user?.id === s.from && (
                            <Button variant="outline" onClick={() => openPaymentDialog(s)}>
                              Record Payment
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              <Card className="border-white/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Recorded Payments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {settlementPayments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No payment records yet.</p>
                  ) : (
                    settlementPayments.map(payment => (
                      <div key={payment.id} className="rounded-xl border p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-sm">
                            <span className="font-medium">{profiles[payment.from_user_id] || 'Unknown'}</span>
                            <span className="text-muted-foreground"> paid </span>
                            <span className="font-medium">{profiles[payment.to_user_id] || 'Unknown'}</span>
                          </div>
                          <Badge variant="outline">₹{Number(payment.amount).toFixed(2)}</Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">Recorded on {new Date(payment.created_at).toLocaleString()}</p>
                        {payment.notes && <p className="mt-2 text-sm">{payment.notes}</p>}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
              <DialogContent>
                <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
                <form onSubmit={recordSettlementPayment} className="space-y-4">
                  <div className="rounded-xl border bg-muted/20 p-3 text-sm">
                    <p>
                      <span className="font-medium">{selectedSettlement ? (profiles[selectedSettlement.from] || 'Unknown') : 'Payer'}</span>
                      <span className="text-muted-foreground"> paying </span>
                      <span className="font-medium">{selectedSettlement ? (profiles[selectedSettlement.to] || 'Unknown') : 'Receiver'}</span>
                    </p>
                    {selectedSettlement && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Outstanding balance: {formatCurrency(selectedSettlement.amount)}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input type="number" step="0.01" min="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="UPI reference, partial payment note, or anything helpful..." rows={3} />
                  </div>
                  <Button type="submit" className="w-full gradient-warm border-none text-primary-foreground">Save Payment Record</Button>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* INVENTORY */}
          <TabsContent value="inventory">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">Inventory Status</span>
                      <span className="text-sm text-muted-foreground">{items.length} total item{items.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {STATUS_ORDER.map(status => (
                        <Badge key={status} variant="outline" className={STATUS_BADGE_CLASSES[status]}>
                          {formatInventoryStatus(status)}: {statusCounts[status]}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {Object.entries(itemsByCategory).map(([category, catItems]) => (
                  <div key={category}>
                    <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                      <span className="text-lg">{CATEGORY_EMOJIS[category] || '📦'}</span>
                      <span className="capitalize">{category}</span>
                      <Badge variant="outline" className="ml-1">{catItems.length}</Badge>
                    </h4>
                    <Card className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="hidden grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_170px_190px_48px] items-center gap-4 border-b bg-muted/30 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
                          <span>Item</span>
                          <span>Submitter</span>
                          <span>Status</span>
                          <span>Actions</span>
                          <span />
                        </div>
                        {catItems.map((item, idx) => (
                          <div
                            key={item.id}
                            className={`grid gap-4 border-b px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_170px_190px_48px] lg:items-start ${item.status === 'bought' || item.status === 'expired' || item.status === 'not_needed' ? 'opacity-80' : ''}`}
                          >
                            <div className="min-w-0 space-y-3">
                              <div className="flex items-start justify-between gap-3 lg:block">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium break-words">
                                    {item.item_name} {item.quantity > 1 && <span className="text-muted-foreground">×{item.quantity}</span>}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground capitalize">{category}</p>
                                </div>
                                <Badge variant="outline" className={`lg:hidden ${STATUS_BADGE_CLASSES[item.status]}`}>
                                  {formatInventoryStatus(item.status)}
                                </Badge>
                              </div>
                              {editingItemId === item.id && (
                                <div className="space-y-2">
                                  <Input value={editingItemName} onChange={e => setEditingItemName(e.target.value)} />
                                  <div className="grid grid-cols-2 gap-2">
                                    <Input type="number" min="1" value={editingItemQty} onChange={e => setEditingItemQty(e.target.value)} />
                                    <Select value={editingItemCategory} onValueChange={setEditingItemCategory}>
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
                              )}
                            </div>

                            <div className="flex items-center gap-2 lg:min-h-[40px]">
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className={`${AVATAR_COLORS[idx % AVATAR_COLORS.length]} text-primary-foreground text-[9px]`}>
                                  {getInitials(profiles[item.brought_by] || '')}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm text-muted-foreground">{profiles[item.brought_by] || 'Unknown'}</span>
                            </div>

                            <div className="space-y-2 lg:min-h-[40px]">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">Status</p>
                              {item.brought_by === user?.id ? (
                                <Select value={item.status} onValueChange={(value: InventoryStatus) => updateItemStatus(item, value)}>
                                  <SelectTrigger className="w-full lg:w-[150px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {INVENTORY_STATUSES.map(status => (
                                      <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div>
                                  <Badge variant="outline" className={STATUS_BADGE_CLASSES[item.status]}>
                                    {formatInventoryStatus(item.status)}
                                  </Badge>
                                  <p className="mt-2 text-xs text-muted-foreground">Submitter updates this</p>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 lg:min-h-[40px]">
                              {item.brought_by === user?.id ? (
                                editingItemId === item.id ? (
                                  <>
                                    <Button variant="outline" size="sm" onClick={() => saveItemDetails(item.id)}>Save</Button>
                                    <Button variant="ghost" size="sm" onClick={cancelEditingItem}>Cancel</Button>
                                  </>
                                ) : (
                                  <Button variant="ghost" size="sm" onClick={() => startEditingItem(item)}>Edit</Button>
                                )
                              ) : (
                                <span className="text-xs text-muted-foreground">View only</span>
                              )}
                            </div>

                            <div className="flex items-start justify-end lg:min-h-[40px]">
                              {item.brought_by === user?.id && (
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteItem(item.id)}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* FORUM */}
          <TabsContent value="forum">
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-2xl font-bold text-[#f76707]">
                    <span className="text-xl">💬</span>
                    Community Forum
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">Post updates, issues, suggestions, and appreciation for everyone in the trip.</p>
                </div>
                <Dialog open={forumDialog} onOpenChange={setForumDialog}>
                  <DialogTrigger asChild>
                    <Button className="rounded-2xl gradient-primary border-none px-5 text-primary-foreground"><Plus className="mr-2 h-4 w-4" /> New Post</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Create Community Post</DialogTitle></DialogHeader>
                    <form onSubmit={createForumPost} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={forumCategory} onValueChange={(value: ForumCategory) => setForumCategory(value)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {FORUM_CATEGORIES.map(category => (
                              <SelectItem key={category.value} value={category.value}>
                                {category.emoji} {category.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input value={forumTitle} onChange={e => setForumTitle(e.target.value)} placeholder="A-wing lift keeps stopping between floors in the evening" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Details</Label>
                        <Textarea value={forumBody} onChange={e => setForumBody(e.target.value)} placeholder="Add what happened, when it happened, what help you need, or anything the group should know..." rows={4} />
                      </div>
                      <Button type="submit" className="w-full gradient-primary border-none text-primary-foreground">Create Post</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant={forumFilter === 'all' ? 'default' : 'outline'}
                  className={`rounded-full px-5 ${forumFilter === 'all' ? 'gradient-primary border-none text-primary-foreground' : 'bg-white'}`}
                  onClick={() => setForumFilter('all')}
                >
                  All Posts
                </Button>
                {FORUM_CATEGORIES.map(category => (
                  <Button
                    key={category.value}
                    type="button"
                    variant="outline"
                    className={`rounded-full bg-white px-5 ${forumFilter === category.value ? 'border-[#ffcfb0] bg-[#fff0e7] text-[#d9480f]' : ''}`}
                    onClick={() => setForumFilter(category.value)}
                  >
                    <span className="mr-2">{category.emoji}</span>
                    {category.label}
                  </Button>
                ))}
              </div>

              {filteredForumPosts.length === 0 ? (
                <Card className="border-dashed border-2">
                  <CardContent className="py-10 text-center">
                    <p className="mb-2 text-4xl">💬</p>
                    <p className="text-muted-foreground">No community posts yet for this category.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredForumPosts.map((post, idx) => {
                    const categoryMeta = getForumCategoryMeta(post.category);
                    const commentCount = forumComments[post.id]?.length || 0;
                    const reactionCount = forumReactions[post.id]?.length || 0;
                    const hasLiked = !!forumReactions[post.id]?.some(reaction => reaction.user_id === user?.id);
                    const isExpanded = expandedForumPosts.includes(post.id);

                    return (
                      <Card key={post.id} className="overflow-hidden rounded-[26px] border-white/70 shadow-sm">
                        <CardContent className="p-0">
                          <div className="p-5 sm:p-6">
                            <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start">
                              <Avatar className="h-10 w-10 shrink-0">
                                <AvatarFallback className={`${AVATAR_COLORS[idx % AVATAR_COLORS.length]} text-sm font-bold text-primary-foreground`}>
                                  {getInitials(profiles[post.created_by] || '')}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                  <span className="font-semibold text-foreground">{profiles[post.created_by] || 'Unknown'}</span>
                                  <Badge variant="outline" className={`${categoryMeta.badgeClass} rounded-full`}>
                                    {categoryMeta.label.toLowerCase()}
                                  </Badge>
                                </div>
                                <div className="space-y-2">
                                  <p className="text-2xl font-bold tracking-tight">{post.title}</p>
                                  {post.body && <p className="max-w-4xl text-base leading-7 text-[#6f625a]">{post.body}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 self-start justify-self-start sm:justify-self-end">
                                <span className="whitespace-nowrap text-sm text-muted-foreground">{formatRelativeDate(post.created_at)}</span>
                                {post.created_by === user?.id && (
                                  <Button variant="ghost" size="icon" onClick={() => deleteForumPost(post.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 border-t bg-white/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className={`rounded-full px-4 ${hasLiked ? 'border-[#ffcfb0] bg-[#fff0e7] text-[#d9480f]' : 'bg-white'}`}
                                onClick={() => toggleForumReaction(post.id)}
                              >
                                <ThumbsUp className="mr-2 h-4 w-4" />
                                {reactionCount}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className={`rounded-full px-4 py-2 text-sm font-normal ${isExpanded ? 'border-[#ffcfb0] bg-[#fff0e7] text-[#d9480f]' : 'bg-white'}`}
                                onClick={() => toggleForumPostOpen(post.id)}
                              >
                                <MessageSquareText className="mr-2 h-4 w-4" />
                                {commentCount}
                              </Button>
                            </div>
                            {isExpanded && (
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-full px-5"
                                onClick={() => toggleForumPostOpen(post.id)}
                              >
                                Close
                              </Button>
                            )}
                          </div>

                          {isExpanded && (
                            <div className="space-y-4 border-t bg-[#fffaf5] px-5 py-5 sm:px-6">
                              {(forumComments[post.id] || []).length === 0 ? (
                                <p className="text-sm text-muted-foreground">No comments yet. Be the first to reply.</p>
                              ) : (
                                <div className="space-y-3">
                                  {(forumComments[post.id] || []).map((comment, commentIdx) => (
                                    <div key={comment.id} className="rounded-2xl border bg-white p-4">
                                      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                                        <Avatar className="h-6 w-6">
                                          <AvatarFallback className={`${AVATAR_COLORS[commentIdx % AVATAR_COLORS.length]} text-[9px] text-primary-foreground`}>
                                            {getInitials(comment.commenter_name || '')}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium text-foreground">{comment.commenter_name || 'Unknown'}</span>
                                        <span>•</span>
                                        <span>{formatRelativeDate(comment.created_at)}</span>
                                      </div>
                                      <p className="text-sm leading-6">{comment.comment}</p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="flex gap-2">
                                <Input
                                  value={forumCommentDrafts[post.id] || ''}
                                  onChange={e => setForumCommentDrafts(current => ({ ...current, [post.id]: e.target.value }))}
                                  placeholder="Add a comment..."
                                  onKeyDown={e => e.key === 'Enter' && addForumComment(post.id)}
                                />
                                <Button type="button" size="icon" className="gradient-primary border-none text-primary-foreground" onClick={() => addForumComment(post.id)}>
                                  <Send className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* POLLS */}
          <TabsContent value="polls">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                      <CardContent className="space-y-4">
                        {options.map(opt => {
                          const optionVotes = votes.filter(v => v.option_id === opt.id);
                          const optVotes = optionVotes.length;
                          const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
                          const optionVoterNames = !poll.is_anonymous
                            ? optionVotes
                                .map(vote => vote.user_id ? (profiles[vote.user_id] || 'Unknown') : null)
                                .filter((name): name is string => Boolean(name))
                            : [];
                          const selectedByViewer = !!optionVotes.find(vote => vote.user_id === user?.id);

                          return (
                            <div key={opt.id} className={`space-y-3 rounded-2xl border p-4 ${selectedByViewer ? 'border-primary/40 bg-primary/5' : 'bg-white/70'}`}>
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{opt.option_text}</span>
                                    {selectedByViewer && <Badge variant="secondary">Your vote</Badge>}
                                  </div>
                                  {!poll.is_anonymous && optionVoterNames.length > 0 && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {optionVoterNames.join(', ')}
                                    </p>
                                  )}
                                </div>
                                {!voted && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="shrink-0"
                                    onClick={() => votePoll(poll.id, opt.id, poll.is_anonymous)}
                                  >
                                    Vote
                                  </Button>
                                )}
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Current support</span>
                                  <span className="font-medium text-muted-foreground">{pct}% ({optVotes})</span>
                                </div>
                                <Progress value={pct} className="h-3" />
                              </div>
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
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                {images.map(img => {
                  const likeCount = imageReactions[img.id]?.length || 0;
                  const commentCount = imageCommentCounts[img.id] || 0;
                  const hasLiked = !!imageReactions[img.id]?.some(reaction => reaction.user_id === user?.id);

                  return (
                  <Card key={img.id} className="overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl group">
                    <div className="aspect-square overflow-hidden">
                      <img
                        src={img.image_url}
                        alt={img.caption || 'Trip photo'}
                        className="h-full w-full cursor-pointer object-cover transition-transform group-hover:scale-105"
                        onClick={() => openImageComments(img)}
                      />
                    </div>
                      <CardContent className="space-y-3 p-3">
                      {img.caption && <p className="text-sm font-medium">{img.caption}</p>}
                      <div className="flex items-center gap-1.5 mt-1">
                        <Avatar className="h-5 w-5"><AvatarFallback className="gradient-primary text-primary-foreground text-[8px]">{getInitials(profiles[img.uploaded_by] || '')}</AvatarFallback></Avatar>
                        <p className="text-xs text-muted-foreground">{profiles[img.uploaded_by] || 'Unknown'} • {new Date(img.created_at).toLocaleDateString()}</p>
                      </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={`rounded-full ${hasLiked ? 'border-[#ffcfb0] bg-[#fff0e7] text-[#d9480f]' : ''}`}
                            onClick={() => toggleImageReaction(img.id)}
                          >
                            <ThumbsUp className="mr-2 h-4 w-4" />
                            {likeCount}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            onClick={() => openImageComments(img)}
                          >
                            <MessageSquareText className="mr-2 h-4 w-4" />
                            {commentCount}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
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

          <TabsContent value="members">
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold">Trip Members</h3>
                  <p className="text-sm text-muted-foreground">Everyone who can view and collaborate inside this trip.</p>
                  {(viewerProfile.role === 'admin' || viewerProfile.role === 'super_admin') && (
                    <p className="mt-1 text-xs text-muted-foreground">Admins can remove non-owner members directly from this list.</p>
                  )}
                </div>
                <Dialog open={memberDialog} onOpenChange={setMemberDialog}>
                  <DialogTrigger asChild>
                    <Button className="gradient-primary border-none text-primary-foreground"><Users className="mr-2 h-4 w-4" /> Add Member</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Trip Member</DialogTitle></DialogHeader>
                    <form onSubmit={addMember} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Display Name</Label>
                        <Input value={memberEmail} onChange={e => setMemberEmail(e.target.value)} placeholder="Enter their display name" required />
                      </div>
                      <Button type="submit" className="w-full gradient-primary border-none text-primary-foreground">Add Member</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {members.map((member, index) => (
                  <Card key={member.user_id} className="border-white/60 shadow-sm">
                    <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className={`${SHELL_COLORS[index % SHELL_COLORS.length]} text-sm font-bold text-primary-foreground`}>
                            {getInitials(member.display_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold">{member.display_name}</p>
                          <p className="text-xs text-muted-foreground">{member.user_id}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {member.user_id === trip.created_by ? 'Trip Owner' : 'Member'}
                        </Badge>
                        {(viewerProfile.role === 'admin' || viewerProfile.role === 'super_admin') && member.user_id !== trip.created_by && member.user_id !== user?.id && (
                          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => removeMember(member.user_id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove
                          </Button>
                        )}
                      </div>
                    </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
};

export default TripDetail;
