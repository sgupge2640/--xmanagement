import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Sparkles, Plus, Trash2, AlertTriangle, Copy, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { getFilterTags, getAllMemberTags } from '../lib/api';
import { FilterTag } from './FilterTagsManager';

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  requiredCount: number;
  allowSplit: boolean;
}

interface DayConfig {
  date: string;
  displayDate: string;
  timeSlots: TimeSlot[];
}

interface ApplicationWithTime {
  id: number;
  user_name: string;
  user_email: string;
  overall_status: string;
  start_time: string;
  end_time: string;
  selected: boolean;
  day_status: string;
  original_start_time: string;
  original_end_time: string;
  desired_shifts_per_week?: number;
}

interface AIShiftAssignmentBulkProps {
  dates: { date: string; displayDate: string }[];
  dateApplications: { [date: string]: ApplicationWithTime[] };
  shiftStartTime: string;
  shiftEndTime: string;
  groupId: number;
  onApply: (selections: { [date: string]: Array<{ appId: number; startTime?: string; endTime?: string }> }) => void;
}

export function AIShiftAssignmentBulk({
  dates,
  dateApplications,
  shiftStartTime,
  shiftEndTime,
  groupId,
  onApply,
}: AIShiftAssignmentBulkProps) {
  const [open, setOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedTab, setSelectedTab] = useState(dates[0]?.date || '');
  const [expandedSlots, setExpandedSlots] = useState<{ [date: string]: boolean }>({});

  // フィルタータグ
  const [availableTags, setAvailableTags] = useState<FilterTag[]>([]);
  const [allMemberTags, setAllMemberTags] = useState<{ [email: string]: string[] }>({});
  const [activeFilterTagIds, setActiveFilterTagIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      getFilterTags(groupId).then(setAvailableTags).catch(() => {});
      getAllMemberTags(groupId).then(setAllMemberTags).catch(() => {});
    }
  }, [open, groupId]);

  const toggleFilterTag = (tagId: string) => {
    setActiveFilterTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  // フィルター適用後の応募者を返す
  const getFilteredApplications = (date: string): ApplicationWithTime[] => {
    const apps = dateApplications[date] || [];
    if (activeFilterTagIds.length === 0) return apps;
    return apps.filter(app => {
      const userTagIds = allMemberTags[app.user_email] || [];
      return activeFilterTagIds.every(id => userTagIds.includes(id));
    });
  };
  
  // 各日付の時間帯設定
  const [dayConfigs, setDayConfigs] = useState<DayConfig[]>(
    dates.map(d => ({
      date: d.date,
      displayDate: d.displayDate,
      timeSlots: [
        {
          id: '1',
          startTime: shiftStartTime,
          endTime: shiftEndTime,
          requiredCount: 1,
          allowSplit: false,
        },
      ],
    }))
  );

  // 時間をミリ秒に変換
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // 分を時刻文字列に変換
  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // 応募者が時間帯をカバーしているかチェック
  const canCoverTimeSlot = (app: ApplicationWithTime, slot: TimeSlot): boolean => {
    const appStart = timeToMinutes(app.start_time);
    const appEnd = timeToMinutes(app.end_time);
    const slotStart = timeToMinutes(slot.startTime);
    const slotEnd = timeToMinutes(slot.endTime);

    // 応募時間が時間帯全体をカバーしている場合のみtrue
    return appStart <= slotStart && appEnd >= slotEnd;
  };

  // AI自動配分アルゴリズム（特定の日付）
  const performAutoAssignmentForDate = (date: string, timeSlots: TimeSlot[]): number[] => {
    const applications = getFilteredApplications(date);
    const selectedAppIds: Set<number> = new Set();

    // 各応募者の勤務可能時間帯数をカウント（公平性のため）
    const appWorkCount: { [appId: number]: number } = {};
    applications.forEach(app => {
      if (app.day_status === 'pending') {
        appWorkCount[app.id] = 0;
      }
    });

    // 時間帯ごとに処理
    timeSlots.forEach(slot => {
      // この時間帯をカバーできる承認待ち応募者を取得
      const eligibleApps = applications.filter(
        app => app.day_status === 'pending' && canCoverTimeSlot(app, slot)
      );

      // 勤務回数が少ない順にソート（公平性のため）
      const sortedApps = eligibleApps.sort((a, b) => {
        const countDiff = appWorkCount[a.id] - appWorkCount[b.id];
        if (countDiff !== 0) return countDiff;
        
        // 同じ回数なら、勤務時間が長い人を優先
        const aHours = timeToMinutes(a.end_time) - timeToMinutes(a.start_time);
        const bHours = timeToMinutes(b.end_time) - timeToMinutes(b.start_time);
        return bHours - aHours;
      });

      // 必要人数まで選択
      let assignedCount = 0;
      for (const app of sortedApps) {
        if (assignedCount >= slot.requiredCount) break;
        
        selectedAppIds.add(app.id);
        appWorkCount[app.id]++;
        assignedCount++;
      }
    });

    return Array.from(selectedAppIds);
  };

  // 全日付に対して配分実行（週間希望数を考慮）
  const handleApplyAssignment = () => {
    setProcessing(true);
    
    try {
      const selections: { [date: string]: Array<{ appId: number; startTime?: string; endTime?: string }> } = {};
      
      // 全応募者の週間実績を追跡
      const userWeeklyCount: { [email: string]: number } = {};
      const weeksCount = Math.ceil(dayConfigs.length / 7);
      
      // 全応募者を取得してカウントを初期化
      const allUsers = new Set<string>();
      Object.values(dateApplications).forEach(apps => {
        apps.forEach(app => {
          if (app.day_status === 'pending') {
            allUsers.add(app.user_email);
          }
        });
      });
      allUsers.forEach(email => {
        userWeeklyCount[email] = 0;
      });
      
      // 各日付ごとに配分
      dayConfigs.forEach(dayConfig => {
        const applications = getFilteredApplications(dayConfig.date);
        const selectedApps: Array<{ appId: number; startTime?: string; endTime?: string }> = [];

        // 時間帯ごとに処理
        dayConfig.timeSlots.forEach(slot => {
          // この時間帯をカバーできる承認待ち応募者を取得
          const eligibleApps = applications.filter(
            app => app.day_status === 'pending' && canCoverTimeSlot(app, slot) &&
            !selectedApps.find(s => s.appId === app.id) // 既に選択されていない
          );

          // 週間希望数を考慮してソート
          const sortedApps = eligibleApps.sort((a, b) => {
            // 週間希望数がある場合、達成度を計算
            const aDesired = a.desired_shifts_per_week || 0;
            const bDesired = b.desired_shifts_per_week || 0;
            
            if (aDesired > 0 || bDesired > 0) {
              const aTarget = aDesired * weeksCount;
              const bTarget = bDesired * weeksCount;
              const aAchievement = aTarget > 0 ? userWeeklyCount[a.user_email] / aTarget : 1;
              const bAchievement = bTarget > 0 ? userWeeklyCount[b.user_email] / bTarget : 1;
              
              // 達成度が低い人を優先
              const achievementDiff = aAchievement - bAchievement;
              if (Math.abs(achievementDiff) > 0.05) return achievementDiff;
            }
            
            // 達成度が同じなら、現在の勤務回数が少ない人を優先
            const countDiff = userWeeklyCount[a.user_email] - userWeeklyCount[b.user_email];
            if (countDiff !== 0) return countDiff;
            
            // 同じ回数なら、勤務時間が長い人を優先
            const aHours = timeToMinutes(a.end_time) - timeToMinutes(a.start_time);
            const bHours = timeToMinutes(b.end_time) - timeToMinutes(b.start_time);
            return bHours - aHours;
          });

          // 時間分割が有効で、応募者数が必要人数より多い場合
          if (slot.allowSplit && sortedApps.length > slot.requiredCount) {
            // 分割する人数を決定（応募者数または必要人数+追加可能人数）
            const splitCount = Math.min(sortedApps.length, slot.requiredCount + Math.floor(sortedApps.length / 2));
            const selectedForSplit = sortedApps.slice(0, splitCount);
            
            // 時間帯を均等分割
            const slotStartMinutes = timeToMinutes(slot.startTime);
            const slotEndMinutes = timeToMinutes(slot.endTime);
            const totalMinutes = slotEndMinutes - slotStartMinutes;
            const minutesPerPerson = Math.floor(totalMinutes / splitCount);
            
            // 各応募者に分割時間を割り当て
            selectedForSplit.forEach((app, index) => {
              const assignedStart = slotStartMinutes + (minutesPerPerson * index);
              const assignedEnd = index === splitCount - 1 
                ? slotEndMinutes // 最後の人は終了時刻まで
                : slotStartMinutes + (minutesPerPerson * (index + 1));
              
              selectedApps.push({
                appId: app.id,
                startTime: minutesToTime(assignedStart),
                endTime: minutesToTime(assignedEnd),
              });
              userWeeklyCount[app.user_email]++;
            });
          } else {
            // 通常の配分（必要人数まで選択）- この時間帯の範囲で採用
            let assignedCount = 0;
            for (const app of sortedApps) {
              if (assignedCount >= slot.requiredCount) break;
              
              // 応募者の時間と時間帯の重なりを計算して、採用時間を設定
              const appStartMinutes = timeToMinutes(app.start_time);
              const appEndMinutes = timeToMinutes(app.end_time);
              const slotStartMinutes = timeToMinutes(slot.startTime);
              const slotEndMinutes = timeToMinutes(slot.endTime);
              
              // 採用時間 = 応募時間と時間帯の重なり部分
              const hireStartMinutes = Math.max(appStartMinutes, slotStartMinutes);
              const hireEndMinutes = Math.min(appEndMinutes, slotEndMinutes);
              
              selectedApps.push({
                appId: app.id,
                startTime: minutesToTime(hireStartMinutes),
                endTime: minutesToTime(hireEndMinutes),
              });
              userWeeklyCount[app.user_email]++;
              assignedCount++;
            }
          }
        });

        selections[dayConfig.date] = selectedApps;
      });
      
      onApply(selections);
      setOpen(false);
    } catch (error) {
      console.error('AI配分エラー:', error);
    } finally {
      setProcessing(false);
    }
  };

  // 時間帯追加
  const addTimeSlot = (date: string) => {
    setDayConfigs(dayConfigs.map(config => {
      if (config.date === date) {
        const newId = (Math.max(...config.timeSlots.map(s => parseInt(s.id)), 0) + 1).toString();
        return {
          ...config,
          timeSlots: [
            ...config.timeSlots,
            {
              id: newId,
              startTime: shiftStartTime,
              endTime: shiftEndTime,
              requiredCount: 1,
              allowSplit: false,
            },
          ],
        };
      }
      return config;
    }));
  };

  // 時間帯削除
  const removeTimeSlot = (date: string, slotId: string) => {
    setDayConfigs(dayConfigs.map(config => {
      if (config.date === date && config.timeSlots.length > 1) {
        return {
          ...config,
          timeSlots: config.timeSlots.filter(s => s.id !== slotId),
        };
      }
      return config;
    }));
  };

  // 時間帯更新
  const updateTimeSlot = (date: string, slotId: string, field: keyof TimeSlot, value: string | number) => {
    setDayConfigs(dayConfigs.map(config => {
      if (config.date === date) {
        return {
          ...config,
          timeSlots: config.timeSlots.map(slot =>
            slot.id === slotId ? { ...slot, [field]: value } : slot
          ),
        };
      }
      return config;
    }));
  };

  // 前の日の設定をコピー
  const copyFromPreviousDay = (currentDate: string) => {
    const currentIndex = dayConfigs.findIndex(c => c.date === currentDate);
    if (currentIndex > 0) {
      const previousConfig = dayConfigs[currentIndex - 1];
      setDayConfigs(dayConfigs.map(config => {
        if (config.date === currentDate) {
          return {
            ...config,
            timeSlots: previousConfig.timeSlots.map(slot => ({
              ...slot,
              id: Math.random().toString(), // 新しいIDを生成
            })),
          };
        }
        return config;
      }));
    }
  };

  // プレビュー情報を計算
  const getPreviewInfo = () => {
    let totalSelected = 0;
    const allWarnings: { date: string; warnings: string[] }[] = [];

    dayConfigs.forEach(dayConfig => {
      const applications = getFilteredApplications(dayConfig.date);
      const selectedIds = performAutoAssignmentForDate(dayConfig.date, dayConfig.timeSlots);
      totalSelected += selectedIds.length;

      const warnings: string[] = [];
      dayConfig.timeSlots.forEach(slot => {
        const eligibleCount = applications.filter(
          app => app.day_status === 'pending' && canCoverTimeSlot(app, slot)
        ).length;

        if (eligibleCount < slot.requiredCount) {
          warnings.push(
            `${slot.startTime}-${slot.endTime}: 必要${slot.requiredCount}人 / 可能${eligibleCount}人`
          );
        }
      });

      if (warnings.length > 0) {
        allWarnings.push({
          date: dayConfig.displayDate,
          warnings,
        });
      }
    });

    return {
      totalSelected,
      allWarnings,
    };
  };

  const previewInfo = getPreviewInfo();

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={processing}
        className="bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100"
      >
        <Sparkles className="h-4 w-4 mr-2" />
        一括自動配分
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              一括シフト配分（全日対応）
            </DialogTitle>
            <DialogDescription>
              各日付の時間帯と必要人数を設定してください。全日付まとめて最適な配分を行います。
            </DialogDescription>
            <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  <strong>注意：</strong>設定した時間帯で必要人数が揃っている日のみ自動配分が可能です。人数が不足している時間帯がある場合、その日は配分されません。
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* フィルターパネル */}
            {availableTags.length > 0 && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Filter className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">応募者フィルター</span>
                  {activeFilterTagIds.length > 0 && (
                    <button
                      onClick={() => setActiveFilterTagIds([])}
                      className="ml-auto text-xs text-blue-600 hover:underline"
                    >
                      クリア
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map(tag => {
                    const active = activeFilterTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => toggleFilterTag(tag.id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border-2 transition-all ${
                          active ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-600'
                        }`}
                        style={active ? { backgroundColor: tag.color, borderColor: tag.color } : {}}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
                {activeFilterTagIds.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    選択中のタグを<strong>すべて</strong>持つ応募者のみ対象にします
                  </p>
                )}
              </div>
            )}

            {/* 全体サマリー */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-900">
                <strong>対象期間：</strong> {dates[0]?.displayDate} 〜 {dates[dates.length - 1]?.displayDate} （{dates.length}日間）
              </div>
              <div className="text-sm text-blue-900 mt-1">
                <strong>承認待ち応募総数：</strong> {
                  dates.reduce(
                    (sum, d) => sum + getFilteredApplications(d.date).filter(a => a.day_status === 'pending').length,
                    0
                  )
                }人
                {activeFilterTagIds.length > 0 && (
                  <span className="ml-2 text-xs text-blue-600">（フィルター適用中）</span>
                )}
              </div>
            </div>

            {/* 日付ごとの設定タブ */}
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="w-full flex-wrap h-auto">
                {dayConfigs.map((config) => {
                  const pendingCount = getFilteredApplications(config.date).filter(
                    a => a.day_status === 'pending'
                  ).length;
                  
                  return (
                    <TabsTrigger key={config.date} value={config.date} className="flex-1 min-w-[100px]">
                      <div className="text-center">
                        <div className="text-xs">{config.displayDate.split(' ')[0]}</div>
                        <Badge variant="secondary" className="text-xs mt-1">
                          {pendingCount}人
                        </Badge>
                      </div>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {dayConfigs.map((dayConfig, dayIndex) => (
                <TabsContent key={dayConfig.date} value={dayConfig.date} className="mt-4">
                  <div className="space-y-3">
                    {/* ヘッダー */}
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{dayConfig.displayDate}</h3>
                      {dayIndex > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => copyFromPreviousDay(dayConfig.date)}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          前日と同じ
                        </Button>
                      )}
                    </div>

                    {/* 時間帯設定（折りたたみ） */}
                    <div className="border rounded-lg overflow-hidden">
                      <div className="flex items-center">
                        <button
                          type="button"
                          className="flex-1 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50 px-3 py-2 transition-colors"
                          onClick={() => setExpandedSlots(prev => ({ ...prev, [dayConfig.date]: !prev[dayConfig.date] }))}
                        >
                          <span className="font-medium">時間帯別の配置人数設定 ({dayConfig.timeSlots.length}件)</span>
                          {expandedSlots[dayConfig.date] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        {expandedSlots[dayConfig.date] && (
                          <button
                            type="button"
                            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded mr-2"
                            onClick={() => addTimeSlot(dayConfig.date)}
                          >
                            <Plus className="h-3 w-3" />追加
                          </button>
                        )}
                      </div>
                      {expandedSlots[dayConfig.date] && <div className="border-t divide-y">
                      {dayConfig.timeSlots.map((slot, index) => (
                      <div key={slot.id} className="p-4 space-y-3 bg-white">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm text-gray-700">
                            時間帯 {index + 1}
                          </span>
                          {dayConfig.timeSlots.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeTimeSlot(dayConfig.date, slot.id)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label htmlFor={`start-${dayConfig.date}-${slot.id}`} className="text-xs text-gray-600">
                              開始時刻
                            </Label>
                            <Input
                              id={`start-${dayConfig.date}-${slot.id}`}
                              type="time" step="600"
                              value={slot.startTime}
                              onChange={(e) => updateTimeSlot(dayConfig.date, slot.id, 'startTime', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`end-${dayConfig.date}-${slot.id}`} className="text-xs text-gray-600">
                              終了時刻
                            </Label>
                            <Input
                              id={`end-${dayConfig.date}-${slot.id}`}
                              type="time" step="600"
                              value={slot.endTime}
                              onChange={(e) => updateTimeSlot(dayConfig.date, slot.id, 'endTime', e.target.value)}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`count-${dayConfig.date}-${slot.id}`} className="text-xs text-gray-600">
                              必要人数
                            </Label>
                            <Input
                              id={`count-${dayConfig.date}-${slot.id}`}
                              type="number"
                              min="1"
                              value={slot.requiredCount}
                              onChange={(e) => updateTimeSlot(dayConfig.date, slot.id, 'requiredCount', parseInt(e.target.value) || 1)}
                              className="mt-1"
                            />
                          </div>
                        </div>

                        {/* 時間分割オプション */}
                        <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded">
                          <input
                            type="checkbox"
                            id={`split-${dayConfig.date}-${slot.id}`}
                            checked={slot.allowSplit}
                            onChange={(e) => updateTimeSlot(dayConfig.date, slot.id, 'allowSplit', e.target.checked)}
                            className="rounded"
                          />
                          <Label htmlFor={`split-${dayConfig.date}-${slot.id}`} className="text-xs text-green-900 cursor-pointer">
                            🔀 応募者が多い場合、時間を分割して複数人に配分する
                          </Label>
                        </div>

                        {/* この時間帯の応募可能人数 */}
                        <div className="text-xs text-gray-600">
                          この時間帯を完全にカバーできる応募者：
                          {getFilteredApplications(dayConfig.date).filter(
                            a => a.day_status === 'pending' && canCoverTimeSlot(a, slot)
                          ).length}人
                        </div>
                      </div>
                    ))}</div>}
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            {/* 警告表示 */}
            {previewInfo.allWarnings.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-sm text-red-900 mb-2">
                      ⚠️ 必要人数に満たない時間帯があります
                    </div>
                    <div className="space-y-3">
                      {previewInfo.allWarnings.map((item, index) => (
                        <div key={index}>
                          <div className="font-medium text-xs text-red-900 mb-1">
                            【{item.date}】
                          </div>
                          <div className="space-y-1 ml-2">
                            {item.warnings.map((warning, wIndex) => (
                              <div key={wIndex} className="text-xs text-red-800">
                                • {warning}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* プレビュー */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="text-sm text-gray-700">
                <strong>配分予定：</strong> 全{dates.length}日で合計 {previewInfo.totalSelected}人を自動選択します
              </div>
              <div className="text-xs text-gray-600 mt-1">
                ※ 既存の選択はリセットされ、最適配分が適用されます（承認は行いません）
              </div>
              <div className="text-xs text-gray-600 mt-1">
                ※ 配分後、各日付の承認画面で確認・調整してから承認してください
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={processing}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              onClick={handleApplyAssignment}
              disabled={processing}
              className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {processing ? '配分中...' : '配分を実行（全日）'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}