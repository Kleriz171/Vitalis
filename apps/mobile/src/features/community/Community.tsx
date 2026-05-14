import { useEffect, useState } from 'react';
import {
  Users, MessageCircle, Heart, Send, Eye, Shield, ChevronRight, ArrowLeft,
  Stethoscope, Ribbon, Brain, Baby, GraduationCap, FlaskConical, MessagesSquare,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../../api/client';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Skeleton } from '../../components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Group {
  id: string;
  name: string;
  description?: string;
  category: string;
  memberCount?: number;
}

interface Post {
  id: string;
  groupId: string;
  content: string;
  isAnonymous: boolean;
  authorName?: string | null;
  likes: number;
  commentsCount: number;
  createdAt: string;
}

const categoryIcons: Record<string, LucideIcon> = {
  diabetes: Stethoscope,
  cancer: Ribbon,
  anxiety: Brain,
  parents: Baby,
  students: GraduationCap,
  heart: Heart,
  autoimmune: Shield,
  rare: FlaskConical,
};

const CategoryIcon = ({ category, className }: { category: string; className?: string }) => {
  const Icon = categoryIcons[category] ?? MessagesSquare;
  return <Icon className={className} aria-hidden />;
};

const categoryColors: Record<string, string> = {
  diabetes: 'bg-blue-50 text-blue-600',
  cancer: 'bg-purple-50 text-purple-600',
  anxiety: 'bg-emerald-50 text-emerald-600',
  parents: 'bg-yellow-50 text-yellow-600',
  students: 'bg-pink-50 text-pink-600',
  heart: 'bg-destructive/10 text-destructive',
  autoimmune: 'bg-orange-50 text-orange-600',
  rare: 'bg-indigo-50 text-indigo-600',
};

export const Community = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    api.get('/community/groups').then(r => setGroups(r.data)).catch(() => {}).finally(() => setLoadingGroups(false));
  }, []);

  useEffect(() => {
    if (!selectedGroup) { setPosts([]); return; }
    api.get(`/community/posts?groupId=${selectedGroup.id}`).then(r => setPosts(r.data)).catch(() => {});
  }, [selectedGroup]);

  const submitPost = async () => {
    if (!selectedGroup || !newPost.trim()) return;
    setPosting(true);
    try {
      await api.post('/community/posts', { groupId: selectedGroup.id, content: newPost, isAnonymous });
      toast.success('Posted');
      setNewPost('');
      const r = await api.get(`/community/posts?groupId=${selectedGroup.id}`);
      setPosts(r.data);
    } catch {
      toast.error('Post failed');
    } finally { setPosting(false); }
  };

  if (selectedGroup) {
    return (
      <div className="min-h-full bg-background">
        <header className="bg-gradient-to-br from-purple-500 to-purple-600 text-white px-5 pt-6 pb-6 rounded-2xl mx-4 mt-3">
          <button onClick={() => setSelectedGroup(null)} className="text-white/80 text-sm mb-3 flex items-center gap-1">
            <ArrowLeft size={14} /> Back
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl grid place-items-center backdrop-blur">
              <CategoryIcon category={selectedGroup.category} className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{selectedGroup.name}</h1>
              <p className="text-white/80 text-xs">{selectedGroup.memberCount?.toLocaleString() ?? 0} members</p>
            </div>
          </div>
        </header>

        <div className="px-4 pb-6 space-y-4 mt-4">
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-xl grid place-items-center flex-shrink-0">
                <MessageCircle size={18} className="text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <Textarea
                  value={newPost}
                  onChange={e => setNewPost(e.target.value)}
                  placeholder="Share your experience or ask for advice…"
                  className="resize-none min-h-[80px]"
                />
                <div className="flex items-center justify-between mt-2">
                  <button
                    onClick={() => setIsAnonymous(!isAnonymous)}
                    className={cn(
                      'flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors',
                      isAnonymous ? 'bg-purple-500 text-white' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <Eye size={12} /> {isAnonymous ? 'Anonymous' : 'Public'}
                  </button>
                  <Button
                    size="sm"
                    onClick={submitPost}
                    disabled={!newPost.trim() || posting}
                    className="bg-purple-500 hover:bg-purple-600 text-white"
                  >
                    <Send size={14} /> Post
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {posts.map(p => (
            <Card key={p.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'w-8 h-8 rounded-full grid place-items-center text-xs font-bold',
                    p.isAnonymous ? 'bg-muted text-muted-foreground' : 'bg-purple-100 text-purple-600'
                  )}>
                    {p.isAnonymous ? '?' : p.authorName?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{p.isAnonymous ? 'Anonymous' : p.authorName ?? 'User'}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                {p.isAnonymous && (
                  <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Shield size={10} /> Anonymous
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed">{p.content}</p>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                <button className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <Heart size={14} /> {p.likes}
                </button>
                <button className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <MessageCircle size={14} /> {p.commentsCount}
                </button>
              </div>
            </Card>
          ))}

          {!posts.length && (
            <Card className="p-10 text-center text-muted-foreground">
              <MessageCircle size={48} className="mx-auto mb-3 opacity-40" />
              <p>No posts yet</p>
              <p className="text-xs mt-1">Be the first to share.</p>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <header className="hero-header bg-gradient-to-br from-purple-500 to-purple-600">
        <h1 className="text-2xl font-bold tracking-tight">Community</h1>
        <p className="text-white/80 text-sm mt-1">Support, advice, hope</p>
      </header>

      <div className="px-4 mt-4 pb-6 space-y-3">
        <Card className="p-4 bg-gradient-to-br from-purple-50 to-card">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-2xl grid place-items-center">
              <Shield size={22} className="text-purple-600" />
            </div>
            <div>
              <h3 className="font-bold">Safe space</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Post anonymously if you prefer. Your privacy is the priority.</p>
            </div>
          </div>
        </Card>

        {groups.map(g => (
          <button key={g.id} onClick={() => setSelectedGroup(g)} className="block w-full text-left">
            <Card className="p-4 hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-4">
                <div className={cn('w-14 h-14 rounded-2xl grid place-items-center', categoryColors[g.category] || 'bg-muted text-muted-foreground')}>
                  <CategoryIcon category={g.category} className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{g.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{g.description}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Users size={10} /> {g.memberCount?.toLocaleString() ?? 0} members
                    </span>
                  </div>
                </div>
                <ChevronRight size={20} className="text-muted-foreground flex-shrink-0" />
              </div>
            </Card>
          </button>
        ))}

        {loadingGroups && Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="w-14 h-14 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
          </Card>
        ))}
        {!loadingGroups && !groups.length && (
          <Card className="p-10 text-center text-muted-foreground">
            <Users size={48} className="mx-auto mb-3 opacity-40" />
            <p>No groups yet.</p>
          </Card>
        )}
      </div>
    </div>
  );
};
