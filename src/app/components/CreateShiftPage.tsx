import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { createShift, saveShiftRoles, ShiftRole } from '../lib/api';
import { toast } from 'sonner';
import { useLanguage } from '../lib/LanguageContext';

interface CreateShiftPageProps {
  groupId: number;
  groupName: string;
  onBack: () => void;
  onSuccess: () => void;
}

export function CreateShiftPage({ groupId, groupName, onBack, onSuccess }: CreateShiftPageProps) {
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [applicationDeadline, setApplicationDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<ShiftRole[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#3b82f6');

  const PRESET_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#3b82f6', '#a855f7', '#ec4899', '#78716c',
  ];

  const addRole = () => {
    const name = newRoleName.trim();
    if (!name) return;
    setRoles(prev => [...prev, { id: crypto.randomUUID(), name, color: newRoleColor }]);
    setNewRoleName('');
  };

  const removeRole = (id: string) => setRoles(prev => prev.filter(r => r.id !== id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { shift } = await createShift(groupId, {
        title,
        description,
        start_date: startDate,
        end_date: endDate,
        start_time: startTime,
        end_time: endTime,
        location,
        application_deadline: applicationDeadline,
      });
      if (roles.length > 0 && shift?.id) {
        await saveShiftRoles(shift.id, roles);
      }
      toast.success(t.common.success);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto py-8">
        <Button variant="ghost" onClick={onBack} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t.createShift.back}
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t.createShift.title}</CardTitle>
            <CardDescription>
              {groupName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t.createShift.title_field} *</Label>
                <Input
                  id="title"
                  type="text"
                  placeholder={t.createShift.titlePlaceholder}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t.createShift.description}</Label>
                <Textarea
                  id="description"
                  placeholder={t.createShift.descriptionPlaceholder}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">{t.createShift.startDate} *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">{t.createShift.endDate} *</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">{t.createShift.startTime} *</Label>
                  <Input
                    id="start_time"
                    type="time" step="600"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_time">{t.createShift.endTime} *</Label>
                  <Input
                    id="end_time"
                    type="time" step="600"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="application_deadline">{t.createShift.deadline} *</Label>
                <Input
                  id="application_deadline"
                  type="datetime-local"
                  value={applicationDeadline}
                  onChange={(e) => setApplicationDeadline(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">{t.createShift.location}</Label>
                <Input
                  id="location"
                  type="text"
                  placeholder={t.createShift.locationPlaceholder}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              {/* 採用内容設定 */}
              <div className="space-y-2">
                <Label>採用内容（特別な役割・仕事）</Label>
                <p className="text-xs text-gray-500">採用時に選択できる特別な役割を追加できます。通常業務は選択不要です。</p>
                {roles.length > 0 && (
                  <div className="space-y-1.5">
                    {roles.map(role => (
                      <div key={role.id} className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1.5">
                        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: role.color }} />
                        <span className="text-sm flex-1">{role.name}</span>
                        <button type="button" onClick={() => removeRole(role.id)} className="text-gray-400 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 items-center">
                  <Input
                    type="text"
                    placeholder="役割名（例：リーダー、レジ担当）"
                    value={newRoleName}
                    onChange={e => setNewRoleName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRole(); } }}
                    className="flex-1 text-sm"
                  />
                  <div className="flex gap-1">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        className={`w-5 h-5 rounded-full border-2 ${newRoleColor === c ? 'border-gray-800' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setNewRoleColor(c)}
                      />
                    ))}
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={addRole} disabled={!newRoleName.trim()}>
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div className="pt-4">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t.createShift.creating : t.createShift.create}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}