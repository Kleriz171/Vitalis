import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Eye, MessageCircle, Users } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { api } from '@/lib/api';
import { AppScreen } from '@/components/AppScreen';
import { Button } from '@/components/ui/Button';
import { Group, Row } from '@/components/ui/List';
import { Empty } from '@/components/ui/Empty';
import { Skeleton } from '@/components/ui/Skeleton';
import { colors, radius } from '@/lib/theme';
import { apiError, locale, t, tn } from '@/lib/i18n';

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
        setGroupsError(apiError(err, 'Community groups are unavailable right now.'));
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
        setPostsError(apiError(err, 'This group could not be opened.'));
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
      toast.success(t('Post published'));
    } catch (err: any) {
      toast.error(apiError(err, 'Post failed'));
    } finally {
      setPosting(false);
    }
  };

  if (selected) {
    return (
      <AppScreen
        tone="purple"
        title={selected.name}
        subtitle={tn(selected.memberCount ?? 0, '1 member', '{n} members')}
        icon={<Text style={styles.heroEmoji}>{categoryIcons[selected.category] ?? '💬'}</Text>}
        compact
        action={
          <Pressable onPress={() => setSelected(null)} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('Back')}>
            <ArrowLeft size={16} color="#fff" />
          </Pressable>
        }
      >
        <Group title={t('Share safely')}>
          <View style={styles.composer}>
            <TextInput
              value={newPost}
              onChangeText={setNewPost}
              multiline
              placeholder={t('Share your experience or ask for advice…')}
              placeholderTextColor={colors.mutedForeground}
              style={styles.composerInput}
            />
            <View style={styles.composerBar}>
              <Pressable
                onPress={() => setAnonymous((value) => !value)}
                style={[styles.anonymousPill, anonymous && styles.anonymousPillActive]}
                accessibilityRole="switch"
                accessibilityState={{ checked: anonymous }}
              >
                <Eye size={14} color={anonymous ? '#fff' : colors.mutedForeground} />
                <Text style={[styles.anonymousText, anonymous && styles.anonymousTextActive]}>
                  {anonymous ? t('Anonymous') : t('Public')}
                </Text>
              </Pressable>
              <Button onPress={() => void submit()} loading={posting} disabled={!newPost.trim()} style={styles.postButton}>
                {t('Send')}
              </Button>
            </View>
          </View>
        </Group>

        {postsLoading ? (
          <Group>
            {Array.from({ length: 2 }).map((_, index) => (
              <View key={index} style={styles.post}>
                <Skeleton style={{ height: 14, width: 120 }} />
                <Skeleton style={{ height: 12, width: '100%' }} />
                <Skeleton style={{ height: 12, width: '85%' }} />
              </View>
            ))}
          </Group>
        ) : postsError ? (
          <Group>
            <Empty icon={MessageCircle} title={t('Couldn’t load posts')} description={postsError} />
          </Group>
        ) : posts.length ? (
          <Group title={tn(posts.length, '1 post', '{n} posts')}>
            {posts.map((post, index) => (
              <View key={post.id} style={[styles.post, index > 0 && styles.divider]}>
                <View style={styles.postTop}>
                  <View style={styles.postAvatar}>
                    <Text style={styles.postAvatarText}>{post.isAnonymous ? '?' : (post.authorName?.[0]?.toUpperCase() ?? 'U')}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.postAuthor}>{post.isAnonymous ? t('Anonymous member') : post.authorName ?? t('Member')}</Text>
                    <Text style={styles.postMeta}>
                      {new Date(post.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' })} · {tn(post.likes, '1 like', '{n} likes')} · {tn(post.commentsCount, '1 comment', '{n} comments')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.postContent}>{post.content}</Text>
              </View>
            ))}
          </Group>
        ) : (
          <Group>
            <Empty icon={MessageCircle} title={t('No posts yet')} description={t('Be the first person to share support in this group.')} />
          </Group>
        )}
      </AppScreen>
    );
  }

  return (
    <AppScreen
      tone="purple"
      title={t('Community')}
      subtitle={t('Anonymous posting is available.')}
      icon={<Users size={20} color="#fff" />}
      compact
    >
      {groupsLoading ? (
        <Group>
          {Array.from({ length: 4 }).map((_, index) => (
            <View key={index} style={styles.skeletonRow}>
              <Skeleton style={{ width: 36, height: 36, borderRadius: radius.md }} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton style={{ height: 14, width: 140 }} />
                <Skeleton style={{ height: 12, width: '80%' }} />
              </View>
            </View>
          ))}
        </Group>
      ) : groupsError ? (
        <Group>
          <Empty icon={Users} title={t('Couldn’t load groups')} description={groupsError} />
        </Group>
      ) : (
        <Group title={t('Support groups')}>
          {groups.map((group, index) => (
            <Row
              key={group.id}
              first={index === 0}
              icon={<Text style={styles.groupEmoji}>{categoryIcons[group.category] ?? '💬'}</Text>}
              tint={colors.purpleSoft}
              title={group.name}
              summary={`${tn(group.memberCount ?? 0, '1 member', '{n} members')} · ${group.description || t('A secure support space for shared experience.')}`}
              onPress={() => setSelected(group)}
            />
          ))}
        </Group>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heroEmoji: { fontSize: 20 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  groupEmoji: { fontSize: 18 },
  composer: { gap: 10, paddingBottom: 14 },
  composerInput: {
    minHeight: 84,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    color: colors.foreground,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  composerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  anonymousPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
  },
  anonymousPillActive: { backgroundColor: colors.purple },
  anonymousText: { color: colors.mutedForeground, fontSize: 13, fontWeight: '700' },
  anonymousTextActive: { color: '#fff' },
  postButton: { backgroundColor: colors.purple, paddingHorizontal: 22 },
  post: { gap: 10, paddingVertical: 14 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  postTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  postAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.purpleSoft,
  },
  postAvatarText: { color: colors.purple, fontSize: 14, fontWeight: '800' },
  postAuthor: { color: colors.foreground, fontSize: 14, fontWeight: '700' },
  postMeta: { color: colors.mutedForeground, fontSize: 12, marginTop: 1 },
  postContent: { color: colors.foreground, fontSize: 14, lineHeight: 21 },
});
