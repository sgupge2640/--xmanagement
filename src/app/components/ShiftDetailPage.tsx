import { useEffect, useMemo, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ArrowLeft, Calendar, Clock, MapPin, CheckCircle2, XCircle, AlertCircle, Megaphone, Plus, Trash2 } from 'lucide-react';
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
  saveShiftRoles,
  unpublishShiftResults,
  unapproveShiftApplication,
  directHireMember,
  cancelDirectHire,
  getPublishedDates,
  type ApprovedSlot,
  type ApprovedSlotsMap,
  type ShiftRole,
} from '../lib/api';
import { toast } from 'sonner';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { AppliedShiftCalendar } from './AppliedShiftCalendar';
import { ShiftApplicationCalendar } from './ShiftApplicationCalendar';
import { ShiftGridView } from './ShiftGridView';

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
    desired_shifts_per_week?: number;
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
  synthetic?: boolean;
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
  const [dailySchedules, setDailySchedules] = useState<DailyScheduleItem[]>([]);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [dateApplications, setDateApplications] = useState<Record<string, ApplicationForDate[]>>({});
  const [publishingResults, setPublishingResults] = useState(false);
  const [publishedDates, setPublishedDates] = useState<string[]>([]);
  const [desiredShiftsPerWeek, setDesiredShiftsPerWeek] = useState(3);
  const [groupMembers, setGroupMembers] = useState<Array<{ user_email: string; user_name: string }>>([]);
  const [approvedSlotsMap, setApprovedSlotsMap] = useState<ApprovedSlotsMap>({});
  const [roles, setRoles] = useState<ShiftRole[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#3b82f6');
  const [savingRoles, setSavingRoles] = useState(false);
  const [customBreakpoints, setCustomBreakpoints] = useState<CustomBreakpoint[]>([]);
  const [newBreakpointName, setNewBreakpointName] = useState('');
  const [newBreakpointStart, setNewBreakpointStart] = useState('');
  const [newBreakpointEnd, setNewBreakpointEnd] = useState('');

  const PRESET_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#3b82f6', '#a855f7', '#ec4899', '#78716c',
  ];

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

  const loadDetail = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const data = await getShiftDetail(shiftId);
      setDetail(data);

      const loadedPublishedDates = await getPublishedDates(shiftId).catch(() => []);
      setPublishedDates(loadedPublishedDates);

      const currentUserEmail = localStorage.getItem('user_email') || '';
      const currentUserApplication = data.applications.find((app) => app.user_email === currentUserEmail);
      const lockedDateSet = new Set(loadedPublishedDates);
      const userScheduleMap = new Map<string, DaySchedule>(
        (currentUserApplication?.daily_schedule || []).map((day: DaySchedule) => [day.date, day] as const),
      );

      const schedules = buildDateList(
        data.shift.start_date,
        data.shift.end_date,
        data.shift.start_time,
        data.shift.end_time,
      ).map((item) => {
        const userDay = userScheduleMap.get(item.date);
        if (lockedDateSet.has(item.date)) {
          if (!userDay) return item;
          return {
            ...item,
            start_time: userDay.start_time,
            end_time: userDay.end_time,
          };
        }

        // 勤務不可日入力方式: checked=true を「勤務不可」として扱う
        if (!currentUserApplication) {
          return item;
        }

        if (!userDay) {
          return {
            ...item,
            checked: true,
          };
        }

        return {
          ...item,
          checked: false,
          start_time: userDay.start_time,
          end_time: userDay.end_time,
        };
      });
      setDailySchedules(schedules);

      if (data.is_admin) {
        const grouped: Record<string, ApplicationForDate[]> = {};
        schedules.forEach((schedule) => {
          grouped[schedule.date] = [];
        });

        data.applications.forEach((application) => {
          if (application.daily_schedule && application.daily_schedule.length > 0) {
            application.daily_schedule.forEach((day: DaySchedule) => {
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
                synthetic: false,
                selected: false,
              });
            });
            return;
          }
        });

        const targetGroupId = groupId ?? data.shift.group_id;
        try {
          const [membersData, slotsMap, shiftRoles, breakpoints] = await Promise.all([
            getGroupMembers(targetGroupId),
            getApprovedSlotsMap(shiftId),
            getShiftRoles(shiftId),
            getShiftBreakpoints(shiftId),
          ]);

          const allMembers = (membersData.members || [])
            .filter((member: any) => member?.user_email)
            .map((member: any) => ({
              user_email: member.user_email,
              user_name: member.user_name || member.user_email,
              role: member.role,
            }));

          const adminMembers = allMembers.filter((member: any) => member.role === 'admin');
          const syntheticBaseId = -1000000000;

          schedules.forEach((schedule, scheduleIndex) => {
            if (!grouped[schedule.date]) grouped[schedule.date] = [];
            adminMembers.forEach((admin, adminIndex) => {
              const exists = grouped[schedule.date].some(
                (item) => item.user_email.toLowerCase() === admin.user_email.toLowerCase(),
              );
              if (exists) return;
              grouped[schedule.date].push({
                id: syntheticBaseId + scheduleIndex * 1000 + adminIndex,
                user_name: admin.user_name,
                user_email: admin.user_email,
                status: 'approved',
                day_status: 'approved',
                overall_status: 'approved',
                start_time: schedule.start_time,
                end_time: schedule.end_time,
                original_start_time: schedule.start_time,
                original_end_time: schedule.end_time,
                synthetic: true,
                selected: false,
              });
            });
          });

          setDateApplications(grouped);
          setGroupMembers(allMembers);
          setApprovedSlotsMap(slotsMap || {});
          setRoles(shiftRoles || []);
          const nextBreakpoints = ((breakpoints || []) as CustomBreakpoint[])
            .sort((a, b) => a.start.localeCompare(b.start));
          setCustomBreakpoints(nextBreakpoints);
        } catch {
          setDateApplications(grouped);
          setGroupMembers([]);
          setCustomBreakpoints([]);
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'シフト情報の取得に失敗しました');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
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
    const toMinutesSafe = (value: string) => {
      const text = value.slice(0, 5);
      const [h, m] = text.split(':').map(Number);
      return h * 60 + m;
    };

    const shiftStart = shift.start_time.slice(0, 5);
    const shiftEnd = shift.end_time.slice(0, 5);
    const shiftStartMin = toMinutesSafe(shiftStart);
    const shiftEndMin = toMinutesSafe(shiftEnd);

    const availableSchedules: Array<{ date: string; start_time: string; end_time: string }> = [];

    for (const item of dailySchedules) {
      if (publishedDates.includes(item.date)) continue;

      if (!item.checked) {
        availableSchedules.push({
          date: item.date,
          start_time: shiftStart,
          end_time: shiftEnd,
        });
        continue;
      }

      const unavailableStart = item.start_time.slice(0, 5);
      const unavailableEnd = item.end_time.slice(0, 5);
      const unavailableStartMin = toMinutesSafe(unavailableStart);
      const unavailableEndMin = toMinutesSafe(unavailableEnd);

      if (unavailableStartMin >= unavailableEndMin) {
        toast.error(`${formatDate(item.date)} の勤務不可時間が不正です`);
        return;
      }

      if (unavailableStartMin < shiftStartMin || unavailableEndMin > shiftEndMin) {
        toast.error(`${formatDate(item.date)} の勤務不可時間はシフト時間内で指定してください`);
        return;
      }

      if (unavailableStartMin === shiftStartMin && unavailableEndMin === shiftEndMin) {
        continue;
      }

      if (unavailableStartMin === shiftStartMin) {
        availableSchedules.push({
          date: item.date,
          start_time: unavailableEnd,
          end_time: shiftEnd,
        });
        continue;
      }

      if (unavailableEndMin === shiftEndMin) {
        availableSchedules.push({
          date: item.date,
          start_time: shiftStart,
          end_time: unavailableStart,
        });
        continue;
      }

      toast.error(`${formatDate(item.date)} は中抜けの勤務不可時間を設定できません（開始側か終了側に寄せてください）`);
      return;
    }

    if (availableSchedules.length === 0) {
      toast.error('勤務可能日がありません。勤務できない日の選択を見直してください');
      return;
    }

    setApplying(true);
    try {
      await applyToShift(shiftId, availableSchedules, desiredShiftsPerWeek);
      toast.success('シフトに応募しました');
      setShowApplicationForm(false);
      await loadDetail();
    } catch (error: any) {
      toast.error(error.message || '応募に失敗しました');
    } finally {
      setApplying(false);
    }
  };

  const handlePublishResults = async () => {
    setPublishingResults(true);
    try {
      await publishShiftResults(shiftId);
      toast.success('採用結果を公開しました');
      await loadDetail();
    } catch (error: any) {
      toast.error(error.message || '結果の公開に失敗しました');
    } finally {
      setPublishingResults(false);
    }
  };

  const handleUnpublishResults = async () => {
    setPublishingResults(true);
    try {
      await unpublishShiftResults(shiftId);
      toast.success('採用結果の公開を取り消しました');
      await loadDetail();
    } catch (error: any) {
      toast.error(error.message || '結果の公開取り消しに失敗しました');
    } finally {
      setPublishingResults(false);
    }
  };

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

  const updateApplicationDayStatus = (
    appId: number,
    date: string,
    isApproved: boolean,
    nextDayStatus?: 'approved' | 'pending' | 'direct_approved',
  ) => {
    const dayStatus = nextDayStatus ?? (isApproved ? 'approved' : 'pending');
    setDateApplications((current) => ({
      ...current,
      [date]: (current[date] || []).map((item) =>
        item.id === appId
          ? {
              ...item,
              day_status: dayStatus,
              status: isApproved ? 'approved' : 'pending',
            }
          : item,
      ),
    }));
  };

  const handleApproveSlot = async (
    appId: number,
    date: string,
    startTime: string,
    endTime: string,
    slots?: ApprovedSlot[],
  ) => {
    const app = (dateApplications[date] || []).find((item) => item.id === appId);
    if (!app) return;
    const isDirectApproved = app.day_status === 'direct_approved';

    const nextMap: ApprovedSlotsMap = { ...approvedSlotsMap };
    nextMap[app.user_email] = { ...(nextMap[app.user_email] || {}) };
    nextMap[app.user_email][date] = slots || [{ start: startTime, end: endTime }];

    if (!isDirectApproved) {
      await approveShiftApplication(appId, [{ date }]);
    }
    await saveApprovedSlotsMap(shiftId, nextMap);
    setApprovedSlotsMap(nextMap);
    updateApplicationDayStatus(appId, date, true, isDirectApproved ? 'direct_approved' : 'approved');
  };

  const handleUnapproveSlot = async (appId: number, date: string, slotStart?: string, slotEnd?: string) => {
    const app = (dateApplications[date] || []).find((item) => item.id === appId);
    if (!app) return;
    const isDirectApproved = app.day_status === 'direct_approved';

    const nextMap: ApprovedSlotsMap = { ...approvedSlotsMap };
    const userDateSlots = [...(nextMap[app.user_email]?.[date] || [])];
    let remainingSlots = userDateSlots;

    if (slotStart && slotEnd) {
      remainingSlots = userDateSlots.filter((slot) => !overlaps(slot.start, slot.end, slotStart, slotEnd));
    } else {
      remainingSlots = [];
    }

    if (remainingSlots.length > 0) {
      nextMap[app.user_email] = { ...(nextMap[app.user_email] || {}), [date]: remainingSlots };
      await saveApprovedSlotsMap(shiftId, nextMap);
      setApprovedSlotsMap(nextMap);
      if (!isDirectApproved) {
        await approveShiftApplication(appId, [{ date }]);
      }
      updateApplicationDayStatus(appId, date, true, isDirectApproved ? 'direct_approved' : 'approved');
      return;
    }

    if (nextMap[app.user_email]) {
      const { [date]: _removed, ...restDates } = nextMap[app.user_email];
      nextMap[app.user_email] = restDates;
      if (Object.keys(nextMap[app.user_email]).length === 0) {
        delete nextMap[app.user_email];
      }
    }

    await saveApprovedSlotsMap(shiftId, nextMap);
    setApprovedSlotsMap(nextMap);

    if (isDirectApproved) {
      await cancelDirectHire(appId, date);
      await loadDetail(false);
      return;
    }

    await unapproveShiftApplication(appId, [date]);
    updateApplicationDayStatus(appId, date, false);
  };

  const handleDirectApproveSlot = async ({
    userEmail,
    userName,
    date,
    startTime,
    endTime,
  }: {
    userEmail: string;
    userName: string;
    date: string;
    startTime: string;
    endTime: string;
  }) => {
    if (!userEmail?.trim()) {
      toast.error('対象ユーザーのメールアドレスを特定できませんでした');
      return;
    }
    const normalizedEmail = userEmail.trim();
    const nextMap: ApprovedSlotsMap = { ...approvedSlotsMap };
    const existingUserSlots = nextMap[normalizedEmail] || {};
    const existingDateSlots = [...(existingUserSlots[date] || [])];
    const newSlot: ApprovedSlot = {
      start: startTime,
      end: endTime,
      slotKey: `direct:${date}:${startTime}-${endTime}`,
    };
    const overlapIndex = existingDateSlots.findIndex((slot) => overlaps(slot.start, slot.end, startTime, endTime));
    const nextDateSlots = overlapIndex >= 0
      ? existingDateSlots.map((slot, index) => (index === overlapIndex ? { ...slot, ...newSlot } : slot))
      : [...existingDateSlots, newSlot].sort((left, right) => left.start.localeCompare(right.start));

    nextMap[normalizedEmail] = {
      ...existingUserSlots,
      [date]: nextDateSlots,
    };

    await directHireMember(shiftId, date, normalizedEmail, userName, startTime, endTime);
    await saveApprovedSlotsMap(shiftId, nextMap);
    setApprovedSlotsMap(nextMap);
    toast.success('未応募枠を採用しました');
    await loadDetail(false);
  };

  const handleAddBreakpoint = () => {
    const name = newBreakpointName.trim();
    const start = newBreakpointStart;
    const end = newBreakpointEnd;

    if (!name || !start || !end) {
      toast.error('名前・開始・終了をすべて入力してください');
      return;
    }

    const shiftStartMin = toMinutes(detail!.shift.start_time.slice(0, 5));
    const shiftEndMin = toMinutes(detail!.shift.end_time.slice(0, 5));
    const startMin = toMinutes(start);
    const endMin = toMinutes(end);

    if (startMin >= endMin) {
      toast.error('終了時刻は開始時刻より後にしてください');
      return;
    }

    if (startMin < shiftStartMin || endMin > shiftEndMin) {
      toast.error(`区切りはシフト時間内で設定してください（${detail!.shift.start_time.slice(0, 5)}〜${detail!.shift.end_time.slice(0, 5)}）`);
      return;
    }

    const hasOverlap = customBreakpoints.some((slot) => overlaps(start, end, slot.start, slot.end));
    if (hasOverlap) {
      toast.error('既存の区切り時間と重複しています');
      return;
    }

    const next = [...customBreakpoints, { name, start, end }].sort((a, b) => a.start.localeCompare(b.start));
    setCustomBreakpoints(next);
    setNewBreakpointName('');
    setNewBreakpointStart('');
    setNewBreakpointEnd('');
  };

  const handleSaveBreakpoints = async () => {
    try {
      await saveShiftBreakpoints(shiftId, customBreakpoints);
      toast.success('区切り時間を保存しました');
    } catch (error: any) {
      toast.error(error.message || '区切り時間の保存に失敗しました');
    }
  };

  const handleRemoveBreakpoint = (index: number) => {
    setCustomBreakpoints((current) => current.filter((_, i) => i !== index));
  };

  const handleAddRole = () => {
    const name = newRoleName.trim();
    if (!name) {
      toast.error('役割名を入力してください');
      return;
    }
    setRoles((current) => [...current, { id: crypto.randomUUID(), name, color: newRoleColor }]);
    setNewRoleName('');
  };

  const handleRemoveRole = (id: string) => {
    setRoles((current) => current.filter((role) => role.id !== id));
  };

  const handleSaveRoles = async () => {
    try {
      setSavingRoles(true);
      await saveShiftRoles(shiftId, roles);
      toast.success('採用内容を保存しました');
    } catch (error: any) {
      toast.error(error.message || '採用内容の保存に失敗しました');
    } finally {
      setSavingRoles(false);
    }
  };

  const handleClearBreakpoints = async () => {
    try {
      await saveShiftBreakpoints(shiftId, []);
      setCustomBreakpoints([]);
      setNewBreakpointName('');
      setNewBreakpointStart('');
      setNewBreakpointEnd('');
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
  const applicantWeeklySummaries = applications
    .map((application) => {
      const availableDays = application.daily_schedule?.length || 0;
      const approvedDays = (application.daily_schedule || []).filter(
        (day) => day.status === 'approved' || day.status === 'direct_approved',
      ).length;
      const weeksCount = dailySchedules.length > 0 ? Math.ceil(dailySchedules.length / 7) : 0;
      const desiredPerWeek = application.desired_shifts_per_week ?? null;
      const desiredTotal = desiredPerWeek ? desiredPerWeek * weeksCount : null;
      const achievementRate = desiredTotal && desiredTotal > 0
        ? Math.round((approvedDays / desiredTotal) * 100)
        : null;

      return {
        id: application.id,
        user_name: application.user_name,
        user_email: application.user_email,
        desiredPerWeek,
        desiredTotal,
        availableDays,
        approvedDays,
        achievementRate,
      };
    })
    .sort((left, right) => {
      if ((right.desiredPerWeek ?? 0) !== (left.desiredPerWeek ?? 0)) {
        return (right.desiredPerWeek ?? 0) - (left.desiredPerWeek ?? 0);
      }
      return right.availableDays - left.availableDays;
    });

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

            {!is_admin && !showApplicationForm && (
              <Button onClick={() => setShowApplicationForm(true)} disabled={isDeadlinePassed} className="w-full">
                {isDeadlinePassed ? '応募締切済み' : userApplication ? 'このシフトを再提出する' : 'このシフトに応募する'}
              </Button>
            )}

            {!is_admin && showApplicationForm && (
              <div className="border-t pt-4 space-y-3">
                <h3 className="font-medium">勤務できない日・時間帯を選択してください（未選択日は終日勤務可能として提出されます）</h3>
                <ShiftApplicationCalendar
                  dailySchedules={dailySchedules}
                  onCheckChange={handleCheckChange}
                  onTimeChange={handleTimeChange}
                  desiredShiftsPerWeek={desiredShiftsPerWeek}
                  onDesiredShiftsChange={setDesiredShiftsPerWeek}
                  disabledDates={publishedDates}
                  shiftStartTime={shift.start_time}
                  shiftEndTime={shift.end_time}
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
                      publishedDates={shift.results_published ? null : publishedDates}
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
                  <Button onClick={handlePublishResults} disabled={publishingResults} variant="outline">
                    <Megaphone className="h-4 w-4 mr-2" />
                    採用を公開
                  </Button>
                )}
                {shift.results_published && (
                  <Button onClick={handleUnpublishResults} disabled={publishingResults} variant="outline">
                    <Megaphone className="h-4 w-4 mr-2" />
                    公開を取り消す
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {shift.results_published && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Megaphone className="h-5 w-5 text-blue-600" />
                    <h3 className="font-medium text-blue-900">採用結果を公開しました</h3>
                  </div>
                  <p className="text-sm text-blue-700 mb-1">公開日時: {formatDateTime(shift.results_published_at || '')}</p>
                  <p className="text-sm text-blue-800 whitespace-pre-wrap">採用された内容だけが利用者のカレンダーに反映されます。</p>
                </div>
              )}

              <div className="border rounded-lg p-3 sm:p-4 bg-gray-50 space-y-3">
                <div>
                  <h4 className="text-sm font-medium text-gray-800">応募者の希望回数一覧</h4>
                  <p className="text-xs text-gray-600 mt-1">週の希望回数、提出済み勤務可能日数、採用済み日数を一覧で確認できます。</p>
                </div>

                {applicantWeeklySummaries.length === 0 ? (
                  <p className="text-sm text-gray-500">応募者がまだいません。</p>
                ) : (
                  <div className="space-y-2">
                    {applicantWeeklySummaries.map((summary) => {
                      const isBalanced = summary.achievementRate !== null && summary.achievementRate >= 80 && summary.achievementRate <= 120;
                      const isUnder = summary.achievementRate !== null && summary.achievementRate < 80;
                      const isOver = summary.achievementRate !== null && summary.achievementRate > 120;

                      return (
                        <div key={summary.id} className="rounded-lg border bg-white px-3 py-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="font-medium text-sm text-gray-900">{summary.user_name}</div>
                              <div className="text-xs text-gray-500">{summary.user_email}</div>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs">
                              <Badge variant="outline">
                                希望: {summary.desiredPerWeek ? `${summary.desiredPerWeek}回/週` : '未設定'}
                              </Badge>
                              <Badge variant="outline">勤務可能提出: {summary.availableDays}日</Badge>
                              <Badge variant="outline">採用済み: {summary.approvedDays}日</Badge>
                              {summary.desiredTotal ? (
                                <Badge
                                  variant={isBalanced ? 'default' : 'outline'}
                                  className={
                                    isBalanced
                                      ? 'bg-green-500'
                                      : isUnder
                                      ? 'text-red-600 border-red-300'
                                      : isOver
                                      ? 'text-orange-600 border-orange-300'
                                      : ''
                                  }
                                >
                                  達成率: {summary.achievementRate}%
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

                <div className="space-y-4">
                  <div className="border rounded-lg p-3 sm:p-4 bg-gray-50 space-y-3">
                    <div>
                      <h4 className="text-sm font-medium text-gray-800">採用内容の編集</h4>
                      <p className="text-xs text-gray-600 mt-1">募集後でも役割の追加・削除・色変更ができます。</p>
                    </div>

                    {roles.length > 0 && (
                      <div className="space-y-2">
                        {roles.map((role) => (
                          <div key={role.id} className="grid grid-cols-[auto_1fr_auto] gap-2 items-center bg-white border rounded px-2 py-2">
                            <input
                              value={role.name}
                              onChange={(e) => setRoles((current) => current.map((item) => item.id === role.id ? { ...item, name: e.target.value } : item))}
                              className="w-full border rounded px-2 py-1 text-sm"
                              placeholder="役割名"
                            />
                            <div className="flex gap-1 flex-wrap justify-start">
                              {PRESET_COLORS.map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  className={`w-5 h-5 rounded-full border-2 ${role.color === color ? 'border-gray-800' : 'border-transparent'}`}
                                  style={{ backgroundColor: color }}
                                  onClick={() => setRoles((current) => current.map((item) => item.id === role.id ? { ...item, color } : item))}
                                />
                              ))}
                            </div>
                            <Button type="button" size="sm" variant="outline" onClick={() => handleRemoveRole(role.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
                      <Input
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        placeholder="役割名（例：リーダー、レジ担当）"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddRole();
                          }
                        }}
                      />
                      <div className="flex gap-1 flex-wrap items-center">
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={`w-5 h-5 rounded-full border-2 ${newRoleColor === color ? 'border-gray-800' : 'border-transparent'}`}
                            style={{ backgroundColor: color }}
                            onClick={() => setNewRoleColor(color)}
                          />
                        ))}
                      </div>
                      <Button type="button" variant="outline" onClick={handleAddRole} disabled={!newRoleName.trim()}>
                        <Plus className="h-4 w-4 mr-1" />
                        追加
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button onClick={handleSaveRoles} disabled={savingRoles}>
                        {savingRoles ? '保存中...' : '採用内容を保存'}
                      </Button>
                    </div>
                  </div>

                  <div className="border rounded-lg p-3 sm:p-4 bg-gray-50 space-y-3">
                    <div>
                      <h4 className="text-sm font-medium text-gray-800">時間帯の区切り設定</h4>
                      <p className="text-xs text-gray-600 mt-1">区切りごとに名前と時間を登録します。例: A 10:00〜11:20</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <Input
                        value={newBreakpointName}
                        onChange={(e) => setNewBreakpointName(e.target.value)}
                        placeholder="名前 (例: A)"
                      />
                      <Input
                        type="time"
                        value={newBreakpointStart}
                        onChange={(e) => setNewBreakpointStart(e.target.value)}
                      />
                      <Input
                        type="time"
                        value={newBreakpointEnd}
                        onChange={(e) => setNewBreakpointEnd(e.target.value)}
                      />
                      <Button onClick={handleAddBreakpoint}>追加</Button>
                    </div>
                    <div className="space-y-2">
                      {customBreakpoints.length === 0 ? (
                        <p className="text-xs text-gray-600">現在は区切りなし（全体: {shift.start_time.slice(0, 5)}〜{shift.end_time.slice(0, 5)}）</p>
                      ) : (
                        <div className="space-y-1">
                          {customBreakpoints.map((slot, index) => (
                            <div key={`${slot.name}-${slot.start}-${slot.end}-${index}`} className="flex items-center justify-between gap-2 text-xs bg-white border rounded px-2 py-1.5">
                              <span>{slot.name} {slot.start}〜{slot.end}</span>
                              <Button type="button" size="sm" variant="outline" onClick={() => handleRemoveBreakpoint(index)}>削除</Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={handleSaveBreakpoints}>区切りを保存</Button>
                      <Button variant="outline" onClick={handleClearBreakpoints}>区切りをクリア</Button>
                    </div>
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
                    onDirectHireSlot={handleDirectApproveSlot}
                  />
                </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
