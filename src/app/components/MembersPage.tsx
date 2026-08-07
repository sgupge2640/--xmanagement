import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ArrowLeft, Trash2, Crown, User, Tag } from 'lucide-react';
import { getGroupMembers, deleteMember, getFilterTags, getMemberTags, saveMemberTags } from '../lib/api';
import { toast } from 'sonner';
import { Badge } from './ui/badge';
import { useLanguage } from '../lib/LanguageContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { FilterTag } from './FilterTagsManager';

interface Member {
  id: number;
  user_email: string;
  user_name: string;
  role: string;
  joined_at: string;
}

interface MembersPageProps {
  groupId: number;
  groupName: string;
  onBack: () => void;
}

export function MembersPage({ groupId, groupName, onBack }: MembersPageProps) {
  const { t } = useLanguage();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // フィルタータグ管理
  const [availableTags, setAvailableTags] = useState<FilterTag[]>([]);
  const [memberTags, setMemberTags] = useState<{ [email: string]: string[] }>({});
  const [tagEditTarget, setTagEditTarget] = useState<Member | null>(null);
  const [editingTagIds, setEditingTagIds] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const data = await getGroupMembers(groupId);
      setMembers(data.members || []);
    } catch (error: any) {
      toast.error(error.message || 'メンバー一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const tags = await getFilterTags(groupId);
      setAvailableTags(tags);
    } catch {}
  };

  const loadMemberTags = async (memberList: Member[]) => {
    const result: { [email: string]: string[] } = {};
    await Promise.all(
      memberList.map(async (m) => {
        result[m.user_email] = await getMemberTags(groupId, m.user_email);
      })
    );
    setMemberTags(result);
  };

  useEffect(() => {
    Promise.all([loadMembers(), loadTags()]).then(() => {});
  }, [groupId]);

  useEffect(() => {
    if (members.length > 0) loadMemberTags(members);
  }, [members]);

  const handleDeleteMember = async () => {
    if (!memberToDelete) return;
    setDeleting(true);
    try {
      await deleteMember(groupId, memberToDelete.user_email);
      toast.success(t.common.deleteSuccess);
      setShowDeleteDialog(false);
      setMemberToDelete(null);
      await loadMembers();
    } catch (error: any) {
      toast.error(error.message || t.common.deleteError);
    } finally {
      setDeleting(false);
    }
  };

  const openTagEdit = (member: Member) => {
    setTagEditTarget(member);
    setEditingTagIds(memberTags[member.user_email] || []);
  };

  const toggleTag = (tagId: string) => {
    setEditingTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const saveTagEdit = async () => {
    if (!tagEditTarget) return;
    setSavingTags(true);
    try {
      await saveMemberTags(groupId, tagEditTarget.user_email, editingTagIds);
      setMemberTags(prev => ({ ...prev, [tagEditTarget.user_email]: editingTagIds }));
      toast.success('タグを保存しました');
      setTagEditTarget(null);
    } catch {
      toast.error('タグの保存に失敗しました');
    } finally {
      setSavingTags(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTagById = (id: string) => availableTags.find(t => t.id === id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-2 sm:p-4">
      <div className="max-w-4xl mx-auto py-4 sm:py-8">
        <div className="mb-4 sm:mb-6">
          <Button variant="ghost" onClick={onBack} className="mb-4 text-sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t.common.back}
          </Button>
          <h1 className="text-2xl sm:text-3xl mb-2">メンバー管理</h1>
          <p className="text-sm sm:text-base text-gray-600">{groupName}</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm sm:text-base">{t.common.loading}</p>
          </div>
        ) : members.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <User className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 text-sm sm:text-base">メンバーがいません</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {members.map((member) => {
              const tags = (memberTags[member.user_email] || [])
                .map(id => getTagById(id))
                .filter(Boolean) as FilterTag[];
              return (
                <Card key={member.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <CardTitle className="text-base sm:text-lg break-all">{member.user_name}</CardTitle>
                          {member.role === 'admin' ? (
                            <Badge variant="default" className="text-xs">
                              <Crown className="h-3 w-3 mr-1 inline" />
                              管理者
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              <User className="h-3 w-3 mr-1 inline" />
                              メンバー
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 break-all mb-1">{member.user_email}</p>
                        <p className="text-xs text-gray-500 mb-2">参加日時: {formatDate(member.joined_at)}</p>
                        {/* タグ表示 */}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tags.length > 0 ? tags.map(tag => (
                            <span
                              key={tag.id}
                              className="px-2 py-0.5 rounded-full text-xs text-white font-medium"
                              style={{ backgroundColor: tag.color }}
                            >
                              {tag.name}
                            </span>
                          )) : (
                            <span className="text-xs text-gray-400">タグなし</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        {availableTags.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openTagEdit(member)}
                            className="w-full sm:w-auto text-sm"
                          >
                            <Tag className="h-4 w-4 mr-2" />
                            タグ管理
                          </Button>
                        )}
                        {member.role !== 'admin' && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setMemberToDelete(member);
                              setShowDeleteDialog(true);
                            }}
                            className="w-full sm:w-auto text-sm"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t.common.delete}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        )}

        {availableTags.length === 0 && !loading && (
          <p className="text-xs text-gray-400 mt-4 text-center">
            ※ タグはダッシュボードの「フィルター機能」から追加できます
          </p>
        )}
      </div>

      {/* タグ編集ダイアログ */}
      <Dialog open={!!tagEditTarget} onOpenChange={open => !open && setTagEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tagEditTarget?.user_name} のタグ管理</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-500 mb-3">該当するタグにチェックを入れてください</p>
            <div className="flex flex-wrap gap-2">
              {availableTags.map(tag => {
                const selected = editingTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                      selected ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-600'
                    }`}
                    style={selected ? { backgroundColor: tag.color, borderColor: tag.color } : {}}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagEditTarget(null)}>キャンセル</Button>
            <Button onClick={saveTagEdit} disabled={savingTags}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.common.deleteMember}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.common.deleteMemberConfirm}
              <br />
              <span className="font-semibold mt-2 block">{memberToDelete?.user_name}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMember} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? t.common.loading : t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
