import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Plus, Trash2, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import { getFilterTags, saveFilterTags } from '../lib/api';
import { toast } from 'sonner';

export interface FilterTag {
  id: string;
  name: string;
  color: string;
}

const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
];

interface FilterTagsManagerProps {
  groupId: number;
  onTagsChange?: (tags: FilterTag[]) => void;
}

export function FilterTagsManager({ groupId, onTagsChange }: FilterTagsManagerProps) {
  const [tags, setTags] = useState<FilterTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadTags();
  }, [groupId]);

  const loadTags = async () => {
    try {
      setLoading(true);
      const data = await getFilterTags(groupId);
      setTags(data);
      onTagsChange?.(data);
    } catch (e: any) {
      toast.error('フィルタータグの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const addTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    if (tags.some(t => t.name === name)) {
      toast.error('同じ名前のタグが既にあります');
      return;
    }
    const newTag: FilterTag = {
      id: `${Date.now()}`,
      name,
      color: newTagColor,
    };
    const updated = [...tags, newTag];
    try {
      setSaving(true);
      await saveFilterTags(groupId, updated);
      setTags(updated);
      onTagsChange?.(updated);
      setNewTagName('');
      toast.success(`タグ「${name}」を追加しました`);
    } catch {
      toast.error('タグの保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const removeTag = async (tagId: string) => {
    const updated = tags.filter(t => t.id !== tagId);
    try {
      setSaving(true);
      await saveFilterTags(groupId, updated);
      setTags(updated);
      onTagsChange?.(updated);
      toast.success('タグを削除しました');
    } catch {
      toast.error('タグの削除に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader
        className="p-4 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4 text-blue-600" />
            フィルター機能
            <Badge variant="secondary" className="text-xs">{tags.length}件</Badge>
          </CardTitle>
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
        </div>
        {!expanded && tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.map(tag => (
              <span
                key={tag.id}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </CardHeader>
      {expanded && (
        <CardContent className="p-4 pt-0 space-y-4">
          <p className="text-xs text-gray-500">
            シフト採用時に応募者を絞り込むためのタグを管理します。メンバー管理画面でメンバーにタグを割り当てられます。
          </p>

          {/* 既存タグ一覧 */}
          {loading ? (
            <p className="text-sm text-gray-400">読み込み中...</p>
          ) : tags.length === 0 ? (
            <p className="text-sm text-gray-400">タグがまだありません</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <div
                  key={tag.id}
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-sm text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  <span>{tag.name}</span>
                  <button
                    onClick={() => removeTag(tag.id)}
                    className="ml-1 hover:bg-black/20 rounded-full p-0.5 transition-colors"
                    disabled={saving}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 新規タグ追加 */}
          <div className="border-t pt-4 space-y-3">
            <Label className="text-sm font-medium">タグを追加</Label>
            <div className="flex gap-2">
              <Input
                placeholder="タグ名を入力"
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag()}
                className="flex-1"
              />
              <Button onClick={addTag} disabled={!newTagName.trim() || saving} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                追加
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">色:</span>
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${newTagColor === color ? 'border-gray-700 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setNewTagColor(color)}
                />
              ))}
            </div>
            {newTagName && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                プレビュー:
                <span
                  className="px-2 py-0.5 rounded-full text-white text-xs"
                  style={{ backgroundColor: newTagColor }}
                >
                  {newTagName}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
