import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Eye, MessageCircle, Shield, Users } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { api } from '@/lib/api';
import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Empty } from '@/components/ui/Empty';
import { Skeleton } from '@/components/ui/Skeleton';
import { colors, radius } from '@/lib/theme';

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

const categoryIcons: Record<string, string> = {
  diabetes: '🩺',
  cancer: '🎗️',
  anxiety: '🧠',
  parents: '👨‍👩‍👧',
  students: '📚',
  heart: '❤️',
  autoimmune: '🛡️',
  rare: '🔬',
};

export default function Community() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Group | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [newPost, setNewPost] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    const loadGroups = async () => {
      setGroupsLoading(true);
      setGroupsError(null);
      try {
        const response = await api.get('/community/groups');
        setGroups(response.data ?? []);
      } catch (err: any) {
        setGroups([]);
        setGroupsError(err.response?.data?.error ?? 'Community groups are unavailable right now.');
      } finally {
        setGroupsLoading(false);
      }
    };

    void loadGroups();
  }, []);

  useEffect(() => {
    if (!selected) return;

    const loadPosts = async () => {
      setPostsLoading(true);
      setPostsError(null);
      try {
        const response = await api.get(`/community/posts?groupId=${selected.id}`);
        setPosts(response.data ?? []);
      } catch (err: any) {
        setPosts([]);
        setPostsError(err.response?.data?.error ?? 'This group could not be opened.');
      } finally {
        setPostsLoading(false);
      }
    };

    void loadPosts();
  }, [selected]);

  const submit = async () => {
    if (!selected || !newPost.trim()) return;
    setPosting(true);
    try {
      await api.post('/community/posts', {
        groupId: selected.id,
        content: newPost,
        isAnonymous: anonymous,
      });
      const refreshed = await api.get(`/community/posts?groupId=${selected.id}`);
      setPosts(refreshed.data ?? []);
      setNewPost('');
      toast.success('Post published');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Post failed');
    } finally {
      setPosting(false);
    }
  };

  if (selected) {
    return (
      <AppScreen
        tone="purple"
        eyebrow="Support group"
        title={selected.name}
        subtitle={`${selected.memberCount?.toLocaleString() ?? 0} members`}
        icon={<Text style={styles.heroEmoji}>{categoryIcons[selected.category] ?? '💬'}</Text>}
        action={
          <Pressable onPress={() => setSelected(null)} style={styles.backBtn}>
            <ArrowLeft size={16} color="#fff" />
          </Pressable>
        }
      >
        <Card style={styles.composerCard}>
          <Text style={styles.sectionTitle}>Share safely</Text>
          <TextInput
            value={newPost}
            onChangeText={setNewPost}
            multiline
            placeholder="Share your experience or ask for advice…"
            placeholderTextColor="#94A3B8"
            style={styles.composerInput}
          />
          <View style={styles.composerFooter}>
            <Pressable onPress={() => setAnonymous((value) => !value)} style={[styles.anonymousPill, anonymous && styles.anonymousPillActive]}>
              <Eye size={12} color={anonymous ? '#fff' : colors.mutedForeground} />
              <Text style={[styles.anonymousText, anonymous && styles.anonymousTextActive]}>
                {anonymous ? 'Anonymous' : 'Public'}
              </Text>
            </Pressable>
            <Button size="sm" onPress={submit} loading={posting} disabled={!newPost.trim()} style={styles.postButton}>
              Publish
            </Button>
          </View>
        </Card>

        {postsLoading ? (
          Array.from({ length: 2 }).map((_, index) => (
            <Card key={index} style={styles.postCard}>
              <Skeleton style={{ height: 16, width: 120 }} />
              <Skeleton style={{ height: 12, width: '100%' }} />
              <Skeleton style={{ height: 12, width: '85%' }} />
            </Card>
          ))
        ) : postsError ? (
          <Card style={styles.postCard}>
            <Empty icon={MessageCircle} title="Couldn’t load posts" description={postsError} />
          </Card>
        ) : posts.length ? (
          posts.map((post) => (
            <Card key={post.id} style={styles.postCard}>
              <View style={styles.postTop}>
                <View style={styles.postAvatar}>
                  <Text style={styles.postAvatarText}>
                    {post.isAnonymous ? '?' : (post.authorName?.[0]?.toUpperCase() ?? 'U')}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.postAuthor}>{post.isAnonymous ? 'Anonymous member' : post.authorName ?? 'Member'}</Text>
                  <Text style={styles.postDate}>{new Date(post.createdAt).toLocaleDateString()}</Text>
                </View>
              </View>
              <Text style={styles.postContent}>{post.content}</Text>
              <View style={styles.postMeta}>
                <Text style={styles.postMetaText}>{post.likes} likes</Text>
                <Text style={styles.postMetaText}>{post.commentsCount} comments</Text>
              </View>
            </Card>
          ))
        ) : (
          <Card style={styles.postCard}>
            <Empty icon={MessageCircle} title="No posts yet" description="Be the first person to share support in this group." />
          </Card>
        )}
      </AppScreen>
    );
  }

  return (
    <AppScreen
      tone="purple"
      eyebrow="Community"
      title="Find support that feels human."
      subtitle="Protected groups for experiences, questions, and peer help."
      icon={<Users size={24} color="#fff" />}
      headerContent={
        <View style={styles.safeBanner}>
          <Shield size={16} color="#fff" />
          <Text style={styles.safeBannerText}>Tap a group to read posts and share your own message — anonymous posting is available.</Text>
        </View>
      }
    >
      {groupsLoading ? (
        Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} style={styles.groupCard}>
            <Skeleton style={{ width: 52, height: 52, borderRadius: radius.lg }} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton style={{ height: 16, width: 140 }} />
              <Skeleton style={{ height: 12, width: '100%' }} />
            </View>
          </Card>
        ))
      ) : groupsError ? (
        <Card style={styles.groupCard}>
          <Empty icon={Users} title="Couldn’t load groups" description={groupsError} />
        </Card>
      ) : (
        groups.map((group) => (
          <Pressable key={group.id} onPress={() => setSelected(group)}>
            <Card style={styles.groupCard}>
              <View style={styles.groupIcon}>
                <Text style={styles.groupEmoji}>{categoryIcons[group.category] ?? '💬'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.groupName}>{group.name}</Text>
                <Text style={styles.groupDescription} numberOfLines={2}>
                  {group.description || 'A secure support space for shared experience.'}
                </Text>
                <Text style={styles.groupMembers}>{group.memberCount?.toLocaleString() ?? 0} members</Text>
              </View>
            </Card>
          </Pressable>
        ))
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heroEmoji: { fontSize: 24 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  safeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  safeBannerText: {
    color: '#fff',
    fontSize: 13,
    flex: 1,
  },
  groupCard: {
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  groupIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.purpleSoft,
  },
  groupEmoji: {
    fontSize: 22,
  },
  groupName: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '700',
  },
  groupDescription: {
    color: colors.mutedForeground,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  groupMembers: {
    color: colors.purple,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  composerCard: {
    padding: 18,
    gap: 12,
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: '800',
  },
  composerInput: {
    minHeight: 110,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    color: colors.foreground,
    fontSize: 14,
    lineHeight: 20,
  },
  composerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  anonymousPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.background,
  },
  anonymousPillActive: {
    backgroundColor: colors.purple,
  },
  anonymousText: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: '700',
  },
  anonymousTextActive: {
    color: '#fff',
  },
  postButton: {
    backgroundColor: colors.purple,
  },
  postCard: {
    padding: 16,
    gap: 12,
  },
  postTop: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  postAvatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.purpleSoft,
  },
  postAvatarText: {
    color: colors.purple,
    fontSize: 14,
    fontWeight: '800',
  },
  postAuthor: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '700',
  },
  postDate: {
    color: colors.mutedForeground,
    fontSize: 11,
    marginTop: 2,
  },
  postContent: {
    color: colors.foreground,
    fontSize: 14,
    lineHeight: 20,
  },
  postMeta: {
    flexDirection: 'row',
    gap: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  postMetaText: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: '600',
  },
});
