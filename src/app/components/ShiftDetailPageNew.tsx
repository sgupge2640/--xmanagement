import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ArrowLeft, Calendar, Clock, MapPin, Users, CheckCircle2, XCircle, AlertCircle, Megaphone, ChevronDown, ChevronUp } from 'lucide-react';
import { getShiftDetail, applyToShift, approveShiftApplication, publishShiftResults } from '../lib/api';
import { toast } from 'sonner';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { AppliedShiftCalendar } from './AppliedShiftCalendar.tsx';

interface ShiftDetail {
  shift: {
    id: number;
    title: string;
    description: string;
    start_date: string;
    end_date: string;
    start_time: string;
    end_time: string;
    location: string;
    application_deadline: string;
    group_name: string;
    results_published?: boolean;
    results_message?: string;
    results_published_at?: string;
  };
  applications: Array<{
    id: number;
    user_email: string;
    user_name: string;
    status: string;
    applied_at: string;
    daily_schedule?: Array<{
      date: string;
      start_time: string;
      end_time: string;
    }>;
  }>;
  is_admin: boolean;
}

interface DailyScheduleItem {
  date: string;
  checked: boolean;
  start_time: string;
  end_time: string;
}

interface ApplicationWithTime {
  id: number;
  user_name: string;
  user_email: string;
  status: string;
  start_time: string;
  end_time: string;
  selected: boolean;
}

interface TimeAdjustSectionProps {
  apps: ApplicationWithTime[];
  date: string;
  open: boolean;
  onToggle: () => void;
  onTimeChange: (date: string, appId: number, field: 'start_time' | 'end_time', value: string) => void;
}

function TimeAdjustSection({ apps, date, open, onToggle, onTimeChange }: TimeAdjustSectionProps) {
  return (
    <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <span>選択中 {apps.length} 人の時間を調整する</span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="p-3 space-y-3 bg-gray-50 border-t border-gray-200">
          {apps.map(app => (
            <div key={app.id}>
              <div className="text-xs font-medium text-gray-700 mb-1">{app.user_name}</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-gray-500">開姁E/Label>
                  <Input type="time" step="600" value={app.start_time}
                    onChange={e => onTimeChange(date, app.id, 'start_time', e.target.value)}
                    className="mt-0.5 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">終亁E/Label>
                  <Input type="time" step="600" value={app.end_time}
                    onChange={e => onTimeChange(date, app.id, 'end_time', e.target.value)}
                    className="mt-0.5 h-8 text-sm" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ShiftDetailPageProps {
  shiftId: number;
  onBack: () => void;
}

export function ShiftDetailPage({ shiftId, onBack }: ShiftDetailPageProps) {
  const [detail, setDetail] = useState<ShiftDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [processingDate, setProcessingDate] = useState<string | null>(null);
  const [dailySchedules, setDailySchedules] = useState<DailyScheduleItem[]>([]);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [publishingResults, setPublishingResults] = useState(false);
  const [resultsMessage, setResultsMessage] = useState('');
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  // 日付ごとの応募老E��編雁E��能な時間
  const [dateApplications, setDateApplications] = useState<{ [date: string]: ApplicationWithTime[] }>({});
  // 日付ごとの時間調整セクションの開閉
  const [timeAdjustOpen, setTimeAdjustOpen] = useState<{ [date: string]: boolean }>({});

  // 日付リストを生�E
  const generateDateList = (startDate: string, endDate: string, defaultStartTime: string, defaultEndTime: string): DailyScheduleItem[] => {
    const dates: DailyScheduleItem[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      dates.push({
        date: date.toISOString().split('T')[0],
        checked: true,
        start_time: defaultStartTime,
        end_time: defaultEndTime,
      });
    }
    
    return dates;
  };

  const loadDetail = async () => {
    try {
      setLoading(true);
      const data = await getShiftDetail(shiftId);
      setDetail(data);
      
      // 日ごとのスケジュールを�E期化
      const dates = generateDateList(
        data.shift.start_date,
        data.shift.end_date,
        data.shift.start_time,
        data.shift.end_time
      );
      setDailySchedules(dates);
      
      // 最初�E日付を選抁E      if (dates.length > 0) {
        setSelectedDate(dates[0].date);
      }
      
      // 日付ごとの応募老E��整琁E��管琁E��E���E�E      if (data.is_admin) {
        const dateApps: { [date: string]: ApplicationWithTime[] } = {};
        
        dates.forEach(({ date }) => {
          dateApps[date] = [];
        });
        
        data.applications.forEach(app => {
          if (app.daily_schedule && app.daily_schedule.length > 0) {
            // 日ごとのスケジュールがある場吁E            app.daily_schedule.forEach(day => {
              if (!dateApps[day.date]) {
                dateApps[day.date] = [];
              }
              dateApps[day.date].push({
                id: app.id,
                user_name: app.user_name,
                user_email: app.user_email,
                status: app.status,
                start_time: day.start_time,
                end_time: day.end_time,
                selected: false,
              });
            });
          } else {
            // 全期間に応募してぁE��場吁E            dates.forEach(({ date }) => {
              dateApps[date].push({
                id: app.id,
                user_name: app.user_name,
                user_email: app.user_email,
                status: app.status,
                start_time: data.shift.start_time,
                end_time: data.shift.end_time,
                selected: false,
              });
            });
          }
        });
        
        setDateApplications(dateApps);
      }
    } catch (error: any) {
      toast.error(error.message || 'シフト惁E��の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [shiftId]);

  const handleShowApplicationForm = () => {
    setShowApplicationForm(true);
  };

  const handleApply = async () => {
    // チェチE��された日付�Eみを送信
    const selectedSchedules = dailySchedules
      .filter(item => item.checked)
      .map(item => ({
        date: item.date,
        start_time: item.start_time,
        end_time: item.end_time,
      }));

    if (selectedSchedules.length === 0) {
      toast.error('少なくとめE日以上選択してください');
      return;
    }

    setApplying(true);
    try {
      await applyToShift(shiftId, selectedSchedules);
      toast.success('シフトに応募しました�E�E);
      setShowApplicationForm(false);
      await loadDetail();
    } catch (error: any) {
      toast.error(error.message || '応募に失敗しました');
    } finally {
      setApplying(false);
    }
  };

  const handleCheckChange = (index: number, checked: boolean) => {
    const newSchedules = [...dailySchedules];
    newSchedules[index].checked = checked;
    setDailySchedules(newSchedules);
  };

  const handleTimeChange = (index: number, field: 'start_time' | 'end_time', value: string) => {
    const newSchedules = [...dailySchedules];
    newSchedules[index][field] = value;
    setDailySchedules(newSchedules);
  };

  // 管琁E��E���E�日付ごとの応募老E�E選択状態を変更
  const handleApplicationSelect = (date: string, appId: number, checked: boolean) => {
    setDateApplications(prev => {
      const newState = { ...prev };
      const apps = newState[date].map(app => 
        app.id === appId ? { ...app, selected: checked } : app
      );
      newState[date] = apps;
      return newState;
    });
  };

  // 管琁E��E���E�応募老E�E時間を変更
  const handleApplicationTimeChange = (date: string, appId: number, field: 'start_time' | 'end_time', value: string) => {
    setDateApplications(prev => {
      const newState = { ...prev };
      const apps = newState[date].map(app => 
        app.id === appId ? { ...app, [field]: value } : app
      );
      newState[date] = apps;
      return newState;
    });
  };

  // 管琁E��E���E�選択した応募を承誁E  const handleApproveSelectedForDate = async (date: string) => {
    const apps = dateApplications[date] || [];
    const selected = apps.filter(app => app.selected && app.status === 'pending');
    
    if (selected.length === 0) {
      toast.error('承認する応募を選択してください');
      return;
    }

    setProcessingDate(date);
    try {
      // 吁E��募を個別に承認（管琁E��E��設定した時間で�E�E      for (const app of selected) {
        const approvedSchedule = [{
          date: date,
          start_time: app.start_time,
          end_time: app.end_time,
        }];
        await approveShiftApplication(app.id, approvedSchedule);
      }
      toast.success(`${selected.length}件の応募を承認しました`);
      await loadDetail();
    } catch (error: any) {
      toast.error(error.message || '承認に失敗しました');
    } finally {
      setProcessingDate(null);
    }
  };

  const handlePublishResults = async () => {
    setPublishingResults(true);
    try {
      await publishShiftResults(shiftId, resultsMessage);
      toast.success('結果を�E開しました');
      await loadDetail();
    } catch (error: any) {
      toast.error(error.message || '結果の公開に失敗しました');
    } finally {
      setPublishingResults(false);
      setShowPublishDialog(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto py-8">
          <div className="text-center py-12">
            <p className="text-gray-500">読み込み中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto py-8">
          <Button variant="ghost" onClick={onBack} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻めE          </Button>
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">シフト惁E��が見つかりません</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { shift, applications, is_admin } = detail;
  const approvedCount = applications.filter(app => app.status === 'approved').length;
  const pendingCount = applications.filter(app => app.status === 'pending').length;
  const userApplication = applications.find(app => app.user_email === localStorage.getItem('user_email'));
  const isDeadlinePassed = new Date(shift.application_deadline) < new Date();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto py-8">
        <Button variant="ghost" onClick={onBack} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          戻めE        </Button>

        {/* シフト詳細 */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <CardTitle className="text-2xl">{shift.title}</CardTitle>
                  {isDeadlinePassed && (
                    <Badge variant="outline" className="text-red-600 border-red-600">
                      締刁E��亁E                    </Badge>
                  )}
                </div>
                <CardDescription>{shift.group_name}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {shift.description && (
              <p className="text-gray-700">{shift.description}</p>
            )}
            
            <div className="grid gap-3 text-gray-700">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-gray-500" />
                <span>
                  {shift.start_date === shift.end_date 
                    ? formatDate(shift.start_date)
                    : `${formatDate(shift.start_date)} 、E${formatDate(shift.end_date)}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-500" />
                <span>{shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}</span>
              </div>
              {shift.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-gray-500" />
                  <span>{shift.location}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-200">
              <div className="text-sm">
                <span className="font-medium text-gray-700">応募締刁E</span>{' '}
                <span className={isDeadlinePassed ? 'text-red-600 font-medium' : 'text-gray-700'}>
                  {formatDateTime(shift.application_deadline)}
                </span>
              </div>
            </div>

            {!is_admin && !userApplication && !showApplicationForm && (
              <div className="pt-4">
                <Button 
                  onClick={handleShowApplicationForm} 
                  disabled={isDeadlinePassed} 
                  className="w-full"
                >
                  {isDeadlinePassed ? '応募締刁E��み' : 'こ�Eシフトに応募する'}
                </Button>
              </div>
            )}

            {!is_admin && !userApplication && showApplicationForm && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="font-medium mb-4">日ごとの就業時間を設定してください</h3>
                <div className="space-y-3 mb-4">
                  {dailySchedules.map((schedule, index) => (
                    <div key={schedule.date} className="border rounded-lg p-4 bg-white">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={`day-${index}`}
                          checked={schedule.checked}
                          onCheckedChange={(checked) => handleCheckChange(index, checked as boolean)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <Label htmlFor={`day-${index}`} className="text-base cursor-pointer">
                            {formatDate(schedule.date)}
                          </Label>
                          {schedule.checked && (
                            <div className="grid grid-cols-2 gap-3 mt-3">
                              <div>
                                <Label htmlFor={`start-${index}`} className="text-sm text-gray-600">
                                  開始時刻
                                </Label>
                                <Input
                                  id={`start-${index}`}
                                  type="time" step="600"
                                  value={schedule.start_time}
                                  onChange={(e) => handleTimeChange(index, 'start_time', e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label htmlFor={`end-${index}`} className="text-sm text-gray-600">
                                  終亁E��刻
                                </Label>
                                <Input
                                  id={`end-${index}`}
                                  type="time" step="600"
                                  value={schedule.end_time}
                                  onChange={(e) => handleTimeChange(index, 'end_time', e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleApply} 
                    disabled={applying} 
                    className="flex-1"
                  >
                    {applying ? '応募中...' : '応募する'}
                  </Button>
                  <Button 
                    onClick={() => setShowApplicationForm(false)} 
                    variant="outline"
                    disabled={applying}
                  >
                    キャンセル
                  </Button>
                </div>
              </div>
            )}

            {!is_admin && userApplication && (
              <div className="pt-4 space-y-3">
                {userApplication.status === 'pending' && (
                  <Badge variant="secondary" className="w-full justify-center py-2">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    承認征E��
                  </Badge>
                )}
                {userApplication.status === 'approved' && (
                  <Badge variant="default" className="w-full justify-center py-2">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    承認済み
                  </Badge>
                )}
                {userApplication.status === 'rejected' && (
                  <Badge variant="destructive" className="w-full justify-center py-2">
                    <XCircle className="h-4 w-4 mr-2" />
                    拒否されました
                  </Badge>
                )}
                
                {userApplication.daily_schedule && userApplication.daily_schedule.length > 0 && (
                  <div className="border-t pt-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">あなた�E応募冁E��</h4>
                    <AppliedShiftCalendar
                      appliedDays={userApplication.daily_schedule}
                      startDate={shift.start_date}
                      endDate={shift.end_date}
                      shiftStartTime={shift.start_time}
                      shiftEndTime={shift.end_time}
                    />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 日付別応募老E��覧�E�管琁E��E�Eみ�E�E*/}
        {is_admin && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle>日付別応募老E��琁E/CardTitle>
                  <CardDescription>
                    {applications.length}件の応募�E�承認済み: {approvedCount}件、承認征E��: {pendingCount}件�E�E                  </CardDescription>
                </div>
                {!shift.results_published && applications.length > 0 && (
                  <Button
                    onClick={() => setShowPublishDialog(true)}
                    disabled={publishingResults}
                    variant="outline"
                  >
                    <Megaphone className="h-4 w-4 mr-2" />
                    結果を発表
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {shift.results_published && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Megaphone className="h-5 w-5 text-blue-600" />
                    <h3 className="font-medium text-blue-900">採用結果を発表しました</h3>
                  </div>
                  <p className="text-sm text-blue-700 mb-1">
                    発表日晁E {formatDateTime(shift.results_published_at || '')}
                  </p>
                  {shift.results_message && (
                    <p className="text-sm text-blue-800 mt-2 whitespace-pre-wrap">
                      {shift.results_message}
                    </p>
                  )}
                </div>
              )}
              
              {applications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>まだ応募老E��ぁE��せん</p>
                </div>
              ) : (
                <Tabs value={selectedDate} onValueChange={setSelectedDate}>
                  <TabsList className="w-full flex-wrap h-auto">
                    {dailySchedules.map((schedule) => {
                      const appsForDate = dateApplications[schedule.date] || [];
                      const pendingForDate = appsForDate.filter(app => app.status === 'pending').length;
                      
                      return (
                        <TabsTrigger key={schedule.date} value={schedule.date} className="flex-1 min-w-[120px]">
                          <div className="text-center">
                            <div>{formatDate(schedule.date).split(' ')[0]}</div>
                            {pendingForDate > 0 && (
                              <Badge variant="secondary" className="mt-1 text-xs">
                                {pendingForDate}件
                              </Badge>
                            )}
                          </div>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                  
                  {dailySchedules.map((schedule) => {
                    const appsForDate = dateApplications[schedule.date] || [];
                    const pendingApps = appsForDate.filter(app => app.status === 'pending');
                    const approvedApps = appsForDate.filter(app => app.status === 'approved');
                    
                    return (
                      <TabsContent key={schedule.date} value={schedule.date} className="mt-4">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium">
                              {formatDate(schedule.date)} の応募老E                            </h3>
                            {pendingApps.length > 0 && !shift.results_published && (
                              <Button
                                onClick={() => handleApproveSelectedForDate(schedule.date)}
                                disabled={processingDate === schedule.date || pendingApps.filter(a => a.selected).length === 0}
                                size="sm"
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                選択を承誁E({pendingApps.filter(a => a.selected).length})
                              </Button>
                            )}
                          </div>

                          {appsForDate.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <p>こ�E日の応募老E�EぁE��せん</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {/* 承認征E�� */}
                              {pendingApps.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4" />
                                    承認征E�� ({pendingApps.length})
                                  </h4>
                                  <div className="space-y-2">
                                    {pendingApps.map((app) => (
                                      <div
                                        key={`${app.id}-${schedule.date}`}
                                        className={`border rounded-lg p-3 bg-white flex items-center gap-3 ${app.selected ? 'border-blue-300 bg-blue-50' : ''}`}
                                      >
                                        {!shift.results_published && (
                                          <Checkbox
                                            checked={app.selected}
                                            onCheckedChange={(checked) =>
                                              handleApplicationSelect(schedule.date, app.id, checked as boolean)
                                            }
                                          />
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium">{app.user_name}</div>
                                          <div className="text-xs text-gray-500 truncate">{app.user_email}</div>
                                        </div>
                                        <div className="text-xs text-gray-400 whitespace-nowrap">
                                          {app.start_time.slice(0, 5)} - {app.end_time.slice(0, 5)}
                                        </div>
                                      </div>
                                    ))}
                                    {/* 選択済みの時間調整�E�折りたたみ�E�E*/}
                                    {(() => {
                                      const selectedPending = pendingApps.filter(a => a.selected);
                                      if (selectedPending.length === 0 || shift.results_published) return null;
                                      return <TimeAdjustSection apps={selectedPending} date={schedule.date} open={!!timeAdjustOpen[schedule.date]} onToggle={() => setTimeAdjustOpen(prev => ({ ...prev, [schedule.date]: !prev[schedule.date] }))} onTimeChange={handleApplicationTimeChange} />;
                                    })()}
                                  </div>
                                </div>
                              )}

                              {/* 承認済み */}
                              {approvedApps.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    承認済み ({approvedApps.length})
                                  </h4>
                                  <div className="space-y-2">
                                    {approvedApps.map((app) => (
                                      <div key={`${app.id}-${schedule.date}`} className="border rounded-lg p-4 bg-green-50 border-green-200">
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <div className="font-medium">{app.user_name}</div>
                                            <div className="text-sm text-gray-600">{app.user_email}</div>
                                          </div>
                                          <div className="text-right">
                                            <div className="flex items-center gap-2 text-sm text-gray-700">
                                              <Clock className="h-4 w-4" />
                                              <span>{app.start_time.slice(0, 5)} - {app.end_time.slice(0, 5)}</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              )}
            </CardContent>
          </Card>
        )}

        {/* 結果発表ダイアログ */}
        <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>採用結果を発表しますか�E�E/DialogTitle>
              <DialogDescription>
                結果を発表すると、承認征E��の応募は自動的に不採用となります。この操作�E取り消せません、E              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="results-message" className="text-sm font-medium">
                メチE��ージ�E�任意！E              </Label>
              <Textarea
                id="results-message"
                value={resultsMessage}
                onChange={(e) => setResultsMessage(e.target.value)}
                placeholder="採用老E��のメチE��ージを�E力してください�E�例：お疲れ様でした�E�採用された方はご確認ください。！E
                className="mt-2"
                rows={4}
              />
            </div>
            <DialogFooter className="flex gap-2">
              <Button
                onClick={() => setShowPublishDialog(false)}
                variant="outline"
                disabled={publishingResults}
                className="flex-1"
              >
                キャンセル
              </Button>
              <Button
                onClick={handlePublishResults}
                disabled={publishingResults}
                className="flex-1"
              >
                {publishingResults ? '発表中...' : '結果を発表'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
