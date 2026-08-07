import { useEffect, useMemo, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ArrowLeft, Calendar, Clock, MapPin, Users, CheckCircle2, XCircle, AlertCircle, Megaphone } from 'lucide-react';
import {
  getShiftDetail,
  applyToShift,
  approveShiftApplication,
  publishShiftResults,
  getGroupMembers,
  getShiftBreakpoints,
  getApprovedSlotsMap,
  saveApprovedSlotsMap,
  saveShiftBreakpoints,
  getShiftRoles,
  unapproveShiftApplication,
  type ApprovedSlot,
  type ApprovedSlotsMap,
  type ShiftRole,
} from '../lib/api';
import { toast } from 'sonner';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { AppliedShiftCalendar } from './AppliedShiftCalendar';
import { ShiftApplicationCalendar } from './ShiftApplicationCalendar';
import { ShiftCalendarView, DesiredShiftsTracker } from './ShiftCalendarView';
import { ShiftGridView } from './ShiftGridView';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface DaySchedule {
  date: string;
  start_time: string;
  end_time: string;
  status?: string;
}

interface ShiftDetailData {
  shift: {
    id: number;
    group_id: number;
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
    daily_schedule?: DaySchedule[];
  }>;
  is_admin: boolean;
}

interface CustomBreakpoint {
  start: string;
  end: string;
  name: string;
}

interface DailyScheduleItem {
  date: string;
  checked: boolean;
  start_time: string;
  end_time: string;
}

interface ApplicationForDate {
  id: number;
  user_name: string;
  user_email: string;
  status: string;
  day_status: string;
  overall_status: string;
  start_time: string;
  end_time: string;
  original_start_time: string;
  original_end_time: string;
  desired_shifts_per_week?: number;
  selected: boolean;
}

interface ShiftDetailPageProps {
  shiftId: number;
  groupId?: number;
  onBack: () => void;
}

function buildDateList(startDate: string, endDate: string, startTime: string, endTime: string) {
  const items: DailyScheduleItem[] = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  while (cursor <= end) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, '0');
    const day = String(cursor.getDate()).padStart(2, '0');

    items.push({
      date: `${year}-${month}-${day}`,
      checked: false,
      start_time: startTime,
      end_time: endTime,
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return items;
}

export function ShiftDetailPage({ shiftId, groupId, onBack }: ShiftDetailPageProps) {
  const [detail, setDetail] = useState<ShiftDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [processingDate, setProcessingDate] = useState<string | null>(null);
  const [dailySchedules, setDailySchedules] = useState<DailyScheduleItem[]>([]);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [dateApplications, setDateApplications] = useState<Record<string, ApplicationForDate[]>>({});
  const [publishingResults, setPublishingResults] = useState(false);
  const [resultsMessage, setResultsMessage] = useState('');
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [desiredShiftsPerWeek, setDesiredShiftsPerWeek] = useState(3);
  const [adminTab, setAdminTab] = useState('daily');
  const [groupMembers, setGroupMembers] = useState<Array<{ user_email: string; user_name: string }>>([]);
  const [approvedSlotsMap, setApprovedSlotsMap] = useState<ApprovedSlotsMap>({});
  const [roles, setRoles] = useState<ShiftRole[]>([]);
  const [customBreakpoints, setCustomBreakpoints] = useState<CustomBreakpoint[]>([]);
  const [breakpointInput, setBreakpointInput] = useState('');

  const overlaps = (startA: string, endA: string, startB: string, endB: string) => {
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    return toMinutes(startA) < toMinutes(endB) && toMinutes(endA) > toMinutes(startB);
  };

  const toMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const toTimeString = (minutes: number) => {
    const h = String(Math.floor(minutes / 60)).padStart(2, '0');
    const m = String(minutes % 60).padStart(2, '0');
    return `${h}:${m}`;
  };

  const parseBreakpointSlots = (raw: string, shiftStart: string, shiftEnd: string) => {
    const text = raw.trim();
    if (!text) return { slots: [] as CustomBreakpoint[] };

    const tokens = text
      .split(/[\s,、]+/)
      .map((v) => v.trim())
      .filter(Boolean);

    const valid = /^([01]\d|2[0-3]):([0-5]\d)$/;
    const boundaryMinutes: number[] = [];
    for (const token of tokens) {
      if (!valid.test(token)) {
        return { slots: [] as CustomBreakpoint[], error: `時刻の形式が不正です: ${token}` };
      }
      boundaryMinutes.push(toMinutes(token));
    }

    const shiftStartMin = toMinutes(shiftStart.slice(0, 5));
    const shiftEndMin = toMinutes(shiftEnd.slice(0, 5));
    const uniqueSorted = Array.from(new Set(boundaryMinutes)).sort((a, b) => a - b);

    if (uniqueSorted.some((m) => m <= shiftStartMin || m >= shiftEndMin)) {
      return {
        slots: [] as CustomBreakpoint[],
        error: `区切り時刻はシフト時間内で指定してください（${shiftStart.slice(0, 5)}〜${shiftEnd.slice(0, 5)}）`,
      };
    }

    const edges = [shiftStartMin, ...uniqueSorted, shiftEndMin];
    const slots: CustomBreakpoint[] = [];
    for (let i = 0; i < edges.length - 1; i += 1) {
      const start = toTimeString(edges[i]);
      const end = toTimeString(edges[i + 1]);
      slots.push({
        start,
        end,
        name: `${start}-${end}`,
      });
    }
    return { slots };
  };

  const loadDetail = async () => {
    try {
      setLoading(true);
      const data = await getShiftDetail(shiftId);
      setDetail(data);

      const schedules = buildDateList(
        data.shift.start_date,
        data.shift.end_date,
        data.shift.start_time,
        data.shift.end_time,
      );
      setDailySchedules(schedules);
      setSelectedDate((current) => current || schedules[0]?.date || '');

      if (data.is_admin) {
        const grouped: Record<string, ApplicationForDate[]> = {};
        schedules.forEach((schedule) => {
          grouped[schedule.date] = [];
        });

        data.applications.forEach((application) => {
          if (application.daily_schedule && application.daily_schedule.length > 0) {
            application.daily_schedule.forEach((day) => {
              if (!grouped[day.date]) grouped[day.date] = [];
              grouped[day.date].push({
                id: application.id,
                user_name: application.user_name,
                user_email: application.user_email,
                status: day.status || application.status,
                day_status: day.status || application.status,
                overall_status: application.status,
                start_time: day.start_time,
                end_time: day.end_time,
                original_start_time: day.start_time,
                original_end_time: day.end_time,
                desired_shifts_per_week: application.desired_shifts_per_week,
                selected: false,
              });
            });
            return;
          }

          schedules.forEach((schedule) => {
            grouped[schedule.date].push({
              id: application.id,
              user_name: application.user_name,
              user_email: application.user_email,
              status: application.status,
              day_status: application.status,
              overall_status: application.status,
              start_time: data.shift.start_time,
              end_time: data.shift.end_time,
              original_start_time: data.shift.start_time,
              original_end_time: data.shift.end_time,
              desired_shifts_per_week: application.desired_shifts_per_week,
              selected: false,
            });
          });
        });

        setDateApplications(grouped);

        const targetGroupId = groupId ?? data.shift.group_id;
        try {
          const [membersData, slotsMap, shiftRoles, breakpoints] = await Promise.all([
            getGroupMembers(targetGroupId),
            getApprovedSlotsMap(shiftId),
            getShiftRoles(shiftId),
            getShiftBreakpoints(shiftId),
          ]);
          setGroupMembers(membersData.members || []);
          setApprovedSlotsMap(slotsMap || {});
          setRoles(shiftRoles || []);
          const nextBreakpoints = (breakpoints || []) as CustomBreakpoint[];
          setCustomBreakpoints(nextBreakpoints);
          const separators = nextBreakpoints.slice(0, -1).map((slot) => slot.end).join(', ');
          setBreakpointInput(separators);
        } catch {
          setGroupMembers([]);
          setCustomBreakpoints([]);
          setBreakpointInput('');
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'シフト情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [shiftId]);

  const formatDate = (dateString: string) => {
    const date = new Date(`${dateString}T00:00:00`);
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

  const handleCheckChange = (index: number, checked: boolean) => {
    setDailySchedules((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, checked } : item));
  };

  const handleTimeChange = (index: number, field: 'start_time' | 'end_time', value: string) => {
    setDailySchedules((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  };

  const handleApply = async () => {
    const selectedSchedules = dailySchedules
      .filter((item) => item.checked)
      .map((item) => ({
        date: item.date,
        start_time: item.start_time,
        end_time: item.end_time,
      }));

    if (selectedSchedules.length === 0) {
      toast.error('少なくとも1日以上選択してください');
      return;
    }

    setApplying(true);
    try {
      await applyToShift(shiftId, selectedSchedules, desiredShiftsPerWeek);
      toast.success('シフトに応募しました');
      setShowApplicationForm(false);
      await loadDetail();
    } catch (error: any) {
      toast.error(error.message || '応募に失敗しました');
    } finally {
      setApplying(false);
    }
  };

  const handleSelectApplication = (date: string, appId: number, selected: boolean) => {
    setDateApplications((current) => ({
      ...current,
      [date]: (current[date] || []).map((item) => item.id === appId ? { ...item, selected } : item),
    }));
  };

  const handleChangeApplicationTime = (date: string, appId: number, field: 'start_time' | 'end_time', value: string) => {
    setDateApplications((current) => ({
      ...current,
      [date]: (current[date] || []).map((item) => item.id === appId ? { ...item, [field]: value } : item),
    }));
  };

  const handleApproveSelectedForDate = async (date: string) => {
    const selectedApps = (dateApplications[date] || []).filter((item) => item.selected && item.status === 'pending');
    if (selectedApps.length === 0) {
      toast.error('承認する応募を選択してください');
      return;
    }

    setProcessingDate(date);
    try {
      for (const app of selectedApps) {
        await approveShiftApplication(app.id, [{
          date,
          start_time: app.start_time,
          end_time: app.end_time,
        }]);
      }
      toast.success(`${selectedApps.length}件の応募を承認しました`);
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
      toast.success('結果を公開しました');
      setShowPublishDialog(false);
      await loadDetail();
    } catch (error: any) {
      toast.error(error.message || '結果の公開に失敗しました');
    } finally {
      setPublishingResults(false);
    }
  };

  const selectedDayApplications = useMemo(() => dateApplications[selectedDate] || [], [dateApplications, selectedDate]);
  const gridDailySchedules = useMemo(
    () => dailySchedules.map((item) => ({ date: item.date, displayDate: formatDate(item.date) })),
    [dailySchedules],
  );

  const wishTimesMap = useMemo(() => {
    const map: { [email: string]: { [date: string]: { start: string; end: string } } } = {};
    Object.entries(dateApplications).forEach(([date, apps]) => {
      apps.forEach((app) => {
        if (!map[app.user_email]) map[app.user_email] = {};
        map[app.user_email][date] = {
          start: app.original_start_time,
          end: app.original_end_time,
        };
      });
    });
    return map;
  }, [dateApplications]);

  const handleApproveSlot = async (
    appId: number,
    date: string,
    startTime: string,
    endTime: string,
    slots?: ApprovedSlot[],
  ) => {
    await approveShiftApplication(appId, [{ date, start_time: startTime, end_time: endTime }]);

    const app = (dateApplications[date] || []).find((item) => item.id === appId);
    if (app) {
      const nextMap: ApprovedSlotsMap = { ...approvedSlotsMap };
      nextMap[app.user_email] = { ...(nextMap[app.user_email] || {}) };
      nextMap[app.user_email][date] = slots || [{ start: startTime, end: endTime }];
      await saveApprovedSlotsMap(shiftId, nextMap);
      setApprovedSlotsMap(nextMap);
    }

    await loadDetail();
  };

  const handleUnapproveSlot = async (appId: number, date: string, slotStart?: string, slotEnd?: string) => {
    await unapproveShiftApplication(appId, [date]);

    const app = (dateApplications[date] || []).find((item) => item.id === appId);
    if (app) {
      const nextMap: ApprovedSlotsMap = { ...approvedSlotsMap };
      const userDateSlots = [...(nextMap[app.user_email]?.[date] || [])];
      if (slotStart && slotEnd) {
        const filtered = userDateSlots.filter((slot) => !overlaps(slot.start, slot.end, slotStart, slotEnd));
        if (filtered.length > 0) {
          nextMap[app.user_email] = { ...(nextMap[app.user_email] || {}), [date]: filtered };
        } else if (nextMap[app.user_email]) {
          const { [date]: _removed, ...restDates } = nextMap[app.user_email];
          nextMap[app.user_email] = restDates;
        }
      } else if (nextMap[app.user_email]) {
        const { [date]: _removed, ...restDates } = nextMap[app.user_email];
        nextMap[app.user_email] = restDates;
      }
      await saveApprovedSlotsMap(shiftId, nextMap);
      setApprovedSlotsMap(nextMap);
    }

    await loadDetail();
  };

  const handleApplyBreakpoints = async () => {
    if (!detail?.is_admin) return;
    const parsed = parseBreakpointSlots(breakpointInput, detail.shift.start_time, detail.shift.end_time);
    if (parsed.error) {
      toast.error(parsed.error);
      return;
    }

    try {
      await saveShiftBreakpoints(shiftId, parsed.slots);
      setCustomBreakpoints(parsed.slots);
      toast.success('区切り時間を更新しました');
    } catch (error: any) {
      toast.error(error.message || '区切り時間の保存に失敗しました');
    }
  };

  const handleClearBreakpoints = async () => {
    try {
      await saveShiftBreakpoints(shiftId, []);
      setCustomBreakpoints([]);
      setBreakpointInput('');
      toast.success('区切り時間をクリアしました');
    } catch (error: any) {
      toast.error(error.message || '区切り時間のクリアに失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-5xl mx-auto py-8 text-center text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-5xl mx-auto py-8">
          <Button variant="ghost" onClick={onBack} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <Card>
            <CardContent className="py-12 text-center text-gray-500">シフト情報が見つかりません</CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { shift, applications, is_admin } = detail;
  const approvedCount = applications.filter((app) => app.status === 'approved' || app.status === 'partially_approved').length;
  const pendingCount = applications.filter((app) => app.status === 'pending').length;
  const currentUserEmail = localStorage.getItem('user_email') || '';
  const userApplication = applications.find((app) => app.user_email === currentUserEmail);
  const isDeadlinePassed = new Date(shift.application_deadline) < new Date();
  const parsedPreview = parseBreakpointSlots(breakpointInput, shift.start_time, shift.end_time);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto py-8">
        <Button variant="ghost" onClick={onBack} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          戻る
        </Button>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <CardTitle className="text-2xl">{shift.title}</CardTitle>
                  {isDeadlinePassed && <Badge variant="outline" className="text-red-600 border-red-600">締切終了</Badge>}
                  {shift.results_published && <Badge variant="outline" className="text-blue-600 border-blue-600">結果発表済み</Badge>}
                </div>
                <CardDescription>{shift.group_name}</CardDescription>
              </div>
              {groupId ? <Badge variant="secondary">グループID: {groupId}</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {shift.description && <p className="text-gray-700 whitespace-pre-wrap">{shift.description}</p>}

            <div className="grid gap-3 text-gray-700">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-gray-500" />
                <span>{shift.start_date === shift.end_date ? formatDate(shift.start_date) : `${formatDate(shift.start_date)} 〜 ${formatDate(shift.end_date)}`}</span>
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

            <div className="pt-3 border-t border-gray-200 text-sm">
              <span className="font-medium text-gray-700">応募締切: </span>
              <span className={isDeadlinePassed ? 'text-red-600 font-medium' : 'text-gray-700'}>{formatDateTime(shift.application_deadline)}</span>
            </div>

            {!is_admin && !userApplication && !showApplicationForm && (
              <Button onClick={() => setShowApplicationForm(true)} disabled={isDeadlinePassed} className="w-full">
                {isDeadlinePassed ? '応募締切済み' : 'このシフトに応募する'}
              </Button>
            )}

            {!is_admin && showApplicationForm && (
              <div className="border-t pt-4 space-y-3">
                <h3 className="font-medium">カレンダーで就業可能日と時間を選択してください</h3>
                <ShiftApplicationCalendar
                  dailySchedules={dailySchedules}
                  onCheckChange={handleCheckChange}
                  onTimeChange={handleTimeChange}
                  desiredShiftsPerWeek={desiredShiftsPerWeek}
                  onDesiredShiftsChange={setDesiredShiftsPerWeek}
                />
                <div className="flex gap-2">
                  <Button onClick={handleApply} disabled={applying} className="flex-1">{applying ? '応募中...' : '応募する'}</Button>
                  <Button variant="outline" onClick={() => setShowApplicationForm(false)} disabled={applying}>キャンセル</Button>
                </div>
              </div>
            )}

            {!is_admin && userApplication && (
              <div className="pt-4 space-y-3">
                {userApplication.status === 'pending' && <Badge variant="secondary" className="w-full justify-center py-2"><AlertCircle className="h-4 w-4 mr-2" />承認待ち</Badge>}
                {(userApplication.status === 'approved' || userApplication.status === 'partially_approved') && <Badge variant="default" className="w-full justify-center py-2"><CheckCircle2 className="h-4 w-4 mr-2" />承認済み</Badge>}
                {userApplication.status === 'rejected' && <Badge variant="destructive" className="w-full justify-center py-2"><XCircle className="h-4 w-4 mr-2" />拒否されました</Badge>}

                {userApplication.daily_schedule && userApplication.daily_schedule.length > 0 && (
                  <div className="border-t pt-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">あなたの応募内容</h4>
                    <AppliedShiftCalendar
                      appliedDays={userApplication.daily_schedule}
                      startDate={shift.start_date}
                      endDate={shift.end_date}
                      publishedDates={shift.results_published ? null : []}
                      shiftId={shift.id}
                      userEmail={currentUserEmail}
                    />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {is_admin && (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1">
                  <CardTitle>日付別応募者管理</CardTitle>
                  <CardDescription>{applications.length}件の応募（承認済み: {approvedCount}件、承認待ち: {pendingCount}件）</CardDescription>
                </div>
                {!shift.results_published && applications.length > 0 && (
                  <Button onClick={() => setShowPublishDialog(true)} disabled={publishingResults} variant="outline">
                    <Megaphone className="h-4 w-4 mr-2" />
                    結果を発表
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={adminTab} onValueChange={setAdminTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="daily">日付別管理</TabsTrigger>
                  <TabsTrigger value="wish">希望一覧</TabsTrigger>
                  <TabsTrigger value="result">採用結果一覧</TabsTrigger>
                </TabsList>

                <TabsContent value="daily" className="space-y-4 mt-4">
              {shift.results_published && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Megaphone className="h-5 w-5 text-blue-600" />
                    <h3 className="font-medium text-blue-900">採用結果を発表しました</h3>
                  </div>
                  <p className="text-sm text-blue-700 mb-1">発表日時: {formatDateTime(shift.results_published_at || '')}</p>
                  {shift.results_message && <p className="text-sm text-blue-800 whitespace-pre-wrap">{shift.results_message}</p>}
                </div>
              )}

              {dailySchedules.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {dailySchedules.map((schedule) => {
                    const count = (dateApplications[schedule.date] || []).length;
                    return (
                      <Button
                        key={schedule.date}
                        size="sm"
                        variant={selectedDate === schedule.date ? 'default' : 'outline'}
                        onClick={() => setSelectedDate(schedule.date)}
                      >
                        {formatDate(schedule.date)}
                        {count > 0 ? ` (${count})` : ''}
                      </Button>
                    );
                  })}
                </div>
              )}

              {selectedDate && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="font-medium">{formatDate(selectedDate)} の応募者</h3>
                    {!shift.results_published && (
                      <Button
                        size="sm"
                        onClick={() => handleApproveSelectedForDate(selectedDate)}
                        disabled={processingDate === selectedDate || selectedDayApplications.filter((item) => item.selected && item.status === 'pending').length === 0}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {processingDate === selectedDate ? '承認中...' : '選択を承認'}
                      </Button>
                    )}
                  </div>

                  {selectedDayApplications.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>この日の応募者はいません</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedDayApplications.map((app) => (
                        <div key={`${app.id}-${selectedDate}`} className={`border rounded-lg p-4 ${app.status === 'approved' ? 'bg-green-50 border-green-200' : app.selected ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1">
                              {!shift.results_published && app.status === 'pending' && (
                                <Checkbox checked={app.selected} onCheckedChange={(checked) => handleSelectApplication(selectedDate, app.id, checked as boolean)} className="mt-1" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="font-medium">{app.user_name}</div>
                                <div className="text-xs text-gray-500 truncate">{app.user_email}</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 md:w-[280px]">
                              <Input type="time" value={app.start_time} disabled={shift.results_published || app.status !== 'pending'} onChange={(e) => handleChangeApplicationTime(selectedDate, app.id, 'start_time', e.target.value)} />
                              <Input type="time" value={app.end_time} disabled={shift.results_published || app.status !== 'pending'} onChange={(e) => handleChangeApplicationTime(selectedDate, app.id, 'end_time', e.target.value)} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
                </TabsContent>

                <TabsContent value="wish" className="space-y-4 mt-4">
                  <ShiftCalendarView
                    dailySchedules={dailySchedules}
                    dateApplications={dateApplications}
                    onDateClick={setSelectedDate}
                    selectedDate={selectedDate}
                  />
                  <ShiftGridView
                    mode="wish"
                    dailySchedules={gridDailySchedules}
                    dateApplications={dateApplications}
                    groupMembers={groupMembers}
                    customBreakpoints={customBreakpoints}
                    shiftStartTime={shift.start_time}
                    shiftEndTime={shift.end_time}
                    roles={roles}
                    approvedSlotsMap={approvedSlotsMap}
                    wishTimesMap={wishTimesMap}
                    isAdmin={false}
                  />
                  <DesiredShiftsTracker
                    applications={applications as any}
                    dateApplications={dateApplications as any}
                    dailySchedules={dailySchedules as any}
                  />
                </TabsContent>

                <TabsContent value="result" className="space-y-4 mt-4">
                  <div className="border rounded-lg p-3 sm:p-4 bg-gray-50 space-y-3">
                    <div>
                      <h4 className="text-sm font-medium text-gray-800">時間帯の区切り設定</h4>
                      <p className="text-xs text-gray-600 mt-1">シフト全体の中で区切りたい時刻を入力すると、採用結果一覧がその時間帯単位で採用できる表になります。</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        value={breakpointInput}
                        onChange={(e) => setBreakpointInput(e.target.value)}
                        placeholder="例: 12:00, 15:00"
                      />
                      <Button onClick={handleApplyBreakpoints} className="sm:w-auto">区切りを適用</Button>
                      <Button variant="outline" onClick={handleClearBreakpoints} className="sm:w-auto">区切りをクリア</Button>
                    </div>
                    {parsedPreview.error ? (
                      <p className="text-xs text-red-600">{parsedPreview.error}</p>
                    ) : (
                      <p className="text-xs text-gray-600">
                        プレビュー: {parsedPreview.slots.length > 0
                          ? parsedPreview.slots.map((slot) => `${slot.start}〜${slot.end}`).join(' / ')
                          : `${shift.start_time.slice(0, 5)}〜${shift.end_time.slice(0, 5)}（区切りなし）`}
                      </p>
                    )}
                  </div>
                  <ShiftGridView
                    mode="result"
                    dailySchedules={gridDailySchedules}
                    dateApplications={dateApplications}
                    groupMembers={groupMembers}
                    customBreakpoints={customBreakpoints}
                    shiftStartTime={shift.start_time}
                    shiftEndTime={shift.end_time}
                    roles={roles}
                    approvedSlotsMap={approvedSlotsMap}
                    wishTimesMap={wishTimesMap}
                    isAdmin={true}
                    onApproveSlot={handleApproveSlot}
                    onUnapproveSlot={handleUnapproveSlot}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>採用結果を発表しますか？</DialogTitle>
              <DialogDescription>結果を発表すると、承認待ちの応募は自動的に不採用となります。</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="results-message" className="text-sm font-medium">メッセージ（任意）</Label>
              <Textarea
                id="results-message"
                value={resultsMessage}
                onChange={(e) => setResultsMessage(e.target.value)}
                placeholder="採用者・不採用者に表示するメッセージを入力してください。"
                className="mt-2"
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPublishDialog(false)} disabled={publishingResults}>キャンセル</Button>
              <Button onClick={handlePublishResults} disabled={publishingResults}>{publishingResults ? '公開中...' : '結果を発表'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
