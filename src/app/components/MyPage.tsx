import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Users, UserPlus, LogOut, UserCheck, Crown, User, Calendar as CalendarIcon, Trash2, Settings } from 'lucide-react';
import { getEmail, getName } from '../lib/auth';
import { getMyGroups, getMyShifts, getGroupCalendar, deleteGroup } from '../lib/api';
import { toast } from 'sonner';
import { Badge } from './ui/badge';
import { Calendar } from './Calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useLanguage } from '../lib/LanguageContext';
import { replacePlaceholders } from '../lib/i18n';
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

interface Group {
  id: number;
  name: string;
  description: string;
  code: string;
  role: string;
  is_admin: boolean;
}

interface MyPageProps {
  onCreateGroup: () => void;
  onJoinGroup: () => void;
  onManageRequests: (groupId: number, groupName: string) => void;
  onSelectGroup: (groupId: number, groupName: string, isAdmin: boolean) => void;
  onLogout: () => void;
  onEditProfile?: () => void;
}

export function MyPage({ onCreateGroup, onJoinGroup, onManageRequests, onSelectGroup, onLogout, onEditProfile }: MyPageProps) {
  const { t } = useLanguage();
  const userName = getName() || 'ユーザー';
  const userEmail = getEmail() || '';
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [myShifts, setMyShifts] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedAdminGroupId, setSelectedAdminGroupId] = useState<number | null>(null);
  const [adminCalendarData, setAdminCalendarData] = useState<any[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const data = await getMyGroups();
      const groupsList = data.groups || [];
      
      const groupsWithRole = groupsList.map((g: any) => ({
        ...g,
        is_admin: g.role === 'admin'
      }));
      
      setGroups(groupsWithRole);
      
      if (groupsWithRole.length > 0) {
        const adminGroup = groupsWithRole.find((g: any) => g.is_admin);
        if (adminGroup) {
          setSelectedGroup(adminGroup);
        } else {
          setSelectedGroup(groupsWithRole[0]);
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'グループの取得に失敗しました');
      setGroups([]); // エラー時は空配列を設定
    } finally {
      setLoading(false);
    }
  };

  const loadMyShifts = async () => {
    try {
      setCalendarLoading(true);
      const data = await getMyShifts();
      setMyShifts(data.applications || []);
    } catch (error: any) {
      console.error('シフト取得エラー:', error.message);
      // エラー時も UI が壊れないよう空配列に戻す
      setMyShifts([]);
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        toast.error('セッションが切れました。再度ログインしてください。');
      }
    } finally {
      setCalendarLoading(false);
    }
  };

  const loadAdminCalendar = async (groupId: number) => {
    try {
      setCalendarLoading(true);
      const data = await getGroupCalendar(groupId);
      
      // シフトデータを変換
      const events: any[] = [];
      if (data.shifts && data.shifts.length > 0) {
        data.shifts.forEach((shift: any) => {
          if (shift.shift_applications && shift.shift_applications.length > 0) {
            shift.shift_applications.forEach((app: any) => {
              if (app.daily_schedules && app.daily_schedules.length > 0) {
                app.daily_schedules
                  .filter((schedule: any) => schedule.status === 'approved')
                  .forEach((schedule: any) => {
                    events.push({
                      date: schedule.date,
                      start_time: schedule.start_time,
                      end_time: schedule.end_time,
                      shift_title: shift.title,
                      user_name: app.user_name,
                    });
                  });
              }
            });
          }
        });
      }
      
      setAdminCalendarData(events);
    } catch (error: any) {
      console.error('カレンダー取得エラー:', error.message);
      // エラーの場合は空配列をセット
      setAdminCalendarData([]);
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        toast.error('セッションが切れました。再度ログインしてください。');
      }
    } finally {
      setCalendarLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
    loadMyShifts();
  }, []);

  useEffect(() => {
    if (selectedAdminGroupId) {
      loadAdminCalendar(selectedAdminGroupId);
    }
  }, [selectedAdminGroupId]);

  // メンバー用カレンダーイベント
  const memberCalendarEvents = myShifts.flatMap((application: any) => {
    // applicationsから取得したデータ構造に合わせる
    const shift = application.shifts;
    const dailySchedules = application.daily_schedules;
    
    if (!shift) return [];
    
    // group_id からグループ名を取得
    const group = groups.find(g => g.id === shift.group_id);
    const groupName = group?.name || 'グループ';
    
    if (dailySchedules && dailySchedules.length > 0) {
      // 日付ごとのスケジュールがある場合、承認済みの日付のみ表示
      return dailySchedules
        .filter((day: any) => day.status === 'approved')
        .map((day: any) => ({
          date: day.date,
          start_time: day.start_time,
          end_time: day.end_time,
          title: shift.title,
          group_name: groupName,
          status: 'approved',
          shift_id: shift.id,
          group_id: shift.group_id,
        }));
    } else {
      // 従来の形式では全体ステータスで判定
      if (application.status !== 'approved' && application.status !== 'partially_approved') {
        return [];
      }
      
      const events = [];
      const start = new Date(shift.start_date);
      const end = new Date(shift.end_date);
      
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        events.push({
          date: date.toISOString().split('T')[0],
          start_time: shift.start_time,
          end_time: shift.end_time,
          title: shift.title,
          group_name: groupName,
          status: application.status,
          shift_id: shift.id,
          group_id: shift.group_id,
        });
      }
      
      return events;
    }
  });

  const adminGroups = groups.filter(g => g.is_admin);

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;
    
    setDeleting(true);
    try {
      await deleteGroup(groupToDelete.id);
      toast.success(t.common.deleteSuccess);
      setShowDeleteDialog(false);
      setGroupToDelete(null);
      // グループリストを再読み込み
      loadGroups();
      loadMyShifts();
    } catch (error: any) {
      toast.error(error.message || t.common.deleteError);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-2 sm:p-4">
      <div className="max-w-6xl mx-auto py-4 sm:py-8">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-3xl mb-2">{t.myPage.title}</h1>
              <p className="text-sm sm:text-base text-gray-600">{replacePlaceholders(t.myPage.welcome, { name: userName })}</p>
              <p className="text-xs sm:text-sm text-gray-500 break-all">{userEmail}</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              {onEditProfile && (
                <Button variant="outline" onClick={onEditProfile} className="flex-1 sm:flex-none text-sm">
                  <Settings className="h-4 w-4 mr-2" />
                  プロフィール編雁E                </Button>
              )}
              <Button variant="outline" onClick={onLogout} className="flex-1 sm:flex-none text-sm">
                <LogOut className="h-4 w-4 mr-2" />
                {t.myPage.logout}
              </Button>
            </div>
          </div>
        </div>

        {/* 参加中のグルーチE*/}
        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm sm:text-base">{t.myPage.loading}</p>
          </div>
        ) : groups.length > 0 ? (
          <>
            {/* カレンダー */}
            <div className="mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl mb-3 sm:mb-4 px-2 sm:px-0">{t.myPage.calendar}</h2>
              <Tabs defaultValue="member">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="member" className="text-sm">{t.myPage.member}</TabsTrigger>
                  <TabsTrigger value="admin" disabled={adminGroups.length === 0} className="text-sm">{t.myPage.admin}</TabsTrigger>
                </TabsList>
                <TabsContent value="member">
                  <Calendar
                    events={memberCalendarEvents}
                    loading={calendarLoading}
                    isAdmin={false}
                  />
                </TabsContent>
                <TabsContent value="admin">
                  {adminGroups.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <CalendarIcon className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 text-gray-300" />
                        <p className="text-gray-500 text-sm sm:text-base">{t.myPage.noAdminGroups}</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <div className="mb-4">
                        <Select 
                          value={selectedAdminGroupId?.toString() || ''} 
                          onValueChange={(value) => setSelectedAdminGroupId(parseInt(value))}
                        >
                          <SelectTrigger className="w-full sm:w-64 text-sm">
                            <SelectValue placeholder={t.myPage.selectGroup} />
                          </SelectTrigger>
                          <SelectContent>
                            {adminGroups.map((group) => (
                              <SelectItem key={group.id} value={group.id.toString()} className="text-sm">
                                {group.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Calendar
                        events={adminCalendarData.map(event => ({
                          date: event.date,
                          start_time: event.start_time,
                          end_time: event.end_time,
                          title: event.shift_title,
                          user_name: event.user_name,
                        }))}
                        loading={calendarLoading}
                        isAdmin={true}
                      />
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            <h2 className="text-lg sm:text-xl mb-3 sm:mb-4 px-2 sm:px-0">{t.myPage.joinedGroups}</h2>
            <div className="grid gap-3 sm:gap-4 mb-4 sm:mb-6">
              {groups.map((group) => (
                <Card key={group.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <CardTitle className="text-base sm:text-lg break-all">{group.name}</CardTitle>
                          {group.is_admin ? (
                            <Badge variant="default" className="text-xs">
                              <Crown className="h-3 w-3 mr-1 inline" />
                              {t.myPage.adminBadge}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              <User className="h-3 w-3 mr-1 inline" />
                              {t.myPage.memberBadge}
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-xs sm:text-sm break-words">
                          {group.description || t.myPage.noDescription}
                        </CardDescription>
                        <p className="text-xs text-gray-500 mt-1">{t.myPage.groupCode}: {group.code}</p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Button
                          onClick={() => onSelectGroup(group.id, group.name, group.is_admin)}
                          className="w-full sm:w-auto text-sm"
                        >
                          <Users className="h-4 w-4 mr-2" />
                          {t.myPage.open}
                        </Button>
                        {group.is_admin && (
                          <Button
                            variant="destructive"
                            onClick={() => {
                              setGroupToDelete(group);
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
              ))}
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 mb-4 text-sm sm:text-base">{t.myPage.noGroups}</p>
            </CardContent>
          </Card>
        )}

        {/* アクション */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Button onClick={onCreateGroup} size="lg" className="w-full text-sm sm:text-base">
            <Users className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            {t.myPage.createGroup}
          </Button>
          <Button onClick={onJoinGroup} variant="outline" size="lg" className="w-full text-sm sm:text-base">
            <UserPlus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            {t.myPage.joinGroup}
          </Button>
        </div>
      </div>

      {/* 削除確認ダイアログ */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.common.deleteGroup}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.common.deleteGroupConfirm}
              <br />
              <span className="font-semibold mt-2 block">{groupToDelete?.name}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGroup} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? t.common.loading : t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}