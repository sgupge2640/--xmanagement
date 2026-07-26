import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ArrowLeft, User, Mail, Lock, Save } from 'lucide-react';
import { updateProfile, updatePassword } from '../lib/api';
import { getEmail, getName, setName } from '../lib/auth';
import { toast } from 'sonner';

interface ProfileEditPageProps {
  onBack: () => void;
}

export function ProfileEditPage({ onBack }: ProfileEditPageProps) {
  const [name, setNameState] = useState(getName() || '');
  const [email] = useState(getEmail() || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast.error('名前を入力してください');
      return;
    }

    setSaving(true);
    try {
      await updateProfile(name, email);
      setName(name);
      toast.success('プロフィールを更新しました');
    } catch (error: any) {
      console.error('プロフィール更新エラー:', error);
      toast.error(error.message || 'プロフィールの更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error('現在のパスワードを入力してください');
      return;
    }

    if (!newPassword) {
      toast.error('新しいパスワードを入力してください');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('パスワードは6文字以上で入力してください');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('新しいパスワードが一致しません');
      return;
    }

    setChangingPassword(true);
    try {
      await updatePassword(currentPassword, newPassword);
      toast.success('パスワードを変更しました');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('パスワード変更エラー:', error);
      toast.error(error.message || 'パスワードの変更に失敗しました');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-2 sm:p-4">
      <div className="max-w-2xl mx-auto py-4 sm:py-8">
        <div className="mb-4 sm:mb-6">
          <Button variant="ghost" onClick={onBack} className="mb-2 text-sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            マイページに戻る
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">プロフィール編集</h1>
        </div>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              基本情報
            </CardTitle>
            <CardDescription>名前を変更できます</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-sm font-medium mb-2 block">名前</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setNameState(e.target.value)}
                placeholder="山田太郎"
                className="w-full"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-sm font-medium mb-2 block">
                <Mail className="h-4 w-4 inline mr-1" />
                メールアドレス
              </Label>
              <Input id="email" type="email" value={email} disabled className="w-full bg-gray-100 cursor-not-allowed" />
              <p className="text-xs text-gray-500 mt-1">※ メールアドレスは変更できません</p>
            </div>

            <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {saving ? '保存中...' : 'プロフィールを保存'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              パスワード変更
            </CardTitle>
            <CardDescription>セキュリティのため、現在のパスワードを入力してください</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="current-password" className="text-sm font-medium mb-2 block">現在のパスワード</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="現在のパスワードを入力"
                className="w-full"
              />
            </div>

            <div>
              <Label htmlFor="new-password" className="text-sm font-medium mb-2 block">新しいパスワード</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="6文字以上"
                className="w-full"
              />
            </div>

            <div>
              <Label htmlFor="confirm-password" className="text-sm font-medium mb-2 block">新しいパスワード（確認）</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="もう一度入力"
                className="w-full"
              />
            </div>

            <Button onClick={handleChangePassword} disabled={changingPassword} className="w-full" variant="secondary">
              <Lock className="h-4 w-4 mr-2" />
              {changingPassword ? '変更中...' : 'パスワードを変更'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
