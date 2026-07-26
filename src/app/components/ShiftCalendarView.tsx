import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { CheckCircle2, Clock, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';

interface ApplicationWithTime {
  id: number;
  user_name: string;
  user_email: string;
  overall_status: string;
  start_time: string;
  end_time: string;
  selected: boolean;
  day_status: string;
  desired_shifts_per_week?: number;
}

interface DailyScheduleItem {
  date: string;
  start_time: string;
  end_time: string;
}

interface ShiftCalendarViewProps {
  dailySchedules: DailyScheduleItem[];
  dateApplications: { [date: string]: ApplicationWithTime[] };
  onDateClick: (date: string) => void;
  selectedDate: string;
}

export function ShiftCalendarView({
  dailySchedules,
  dateApplications,
  onDateClick,
  selectedDate,
}: ShiftCalendarViewProps) {
  // 日付を曜日でグループ化（週ごとに表示）
  const weeks: DailyScheduleItem[][] = [];
  let currentWeek: DailyScheduleItem[] = [];
  
  dailySchedules.forEach((schedule, index) => {
    const date = new Date(schedule.date);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    
    // 日曜日または最初の日付の場合、新しい週を開始
    if ((dayOfWeek === 0 && currentWeek.length > 0) || (index === 0 && dayOfWeek !== 0)) {
      if (currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      
      // 最初の週の空白を埋める
      if (index === 0 && dayOfWeek !== 0) {
        for (let i = 0; i < dayOfWeek; i++) {
          currentWeek.push(null as any);
        }
      }
    }
    
    currentWeek.push(schedule);
    
    // 最後の日付の場合、週を追加
    if (index === dailySchedules.length - 1) {
      // 最後の週の空白を埋める
      while (currentWeek.length < 7) {
        currentWeek.push(null as any);
      }
      weeks.push(currentWeek);
    }
  });

  // 日付のフォーマット（月/日）
  const formatShortDate = (date: string): string => {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  // 曜日の配列
  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

  // 日付の統計情報を取得
  const getDateStats = (date: string) => {
    const apps = dateApplications[date] || [];
    const approvedCount = apps.filter(app => app.day_status === 'approved').length;
    const pendingCount = apps.filter(app => app.day_status === 'pending').length;
    const selectedCount = apps.filter(app => app.selected && app.day_status === 'pending').length;
    
    return {
      approvedCount,
      pendingCount,
      selectedCount,
      totalApps: apps.length,
    };
  };

  // 日付セルの背景色を決定
  const getDateCellClass = (schedule: DailyScheduleItem | null, isSelected: boolean): string => {
    if (!schedule) return 'bg-gray-50';
    
    const stats = getDateStats(schedule.date);
    const baseClass = 'cursor-pointer transition-all hover:shadow-md';
    
    if (isSelected) {
      return `${baseClass} bg-blue-100 border-2 border-blue-500`;
    }
    
    if (stats.approvedCount > 0) {
      return `${baseClass} bg-green-50 border border-green-200 hover:bg-green-100`;
    }
    
    if (stats.selectedCount > 0) {
      return `${baseClass} bg-yellow-50 border border-yellow-200 hover:bg-yellow-100`;
    }
    
    if (stats.pendingCount > 0) {
      return `${baseClass} bg-gray-50 border border-gray-200 hover:bg-gray-100`;
    }
    
    return `${baseClass} bg-white border border-gray-200 hover:bg-gray-50`;
  };

  return (
    <div className="space-y-4">
      {/* カレンダーヘッダー */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {weekDays.map((day, index) => (
          <div
            key={day}
            className={`text-center py-1 sm:py-2 text-xs sm:text-sm font-medium ${
              index === 0 ? 'text-red-600' : index === 6 ? 'text-blue-600' : 'text-gray-700'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* カレンダー本体 */}
      {weeks.map((week, weekIndex) => (
        <div key={weekIndex} className="grid grid-cols-7 gap-1 sm:gap-2">
          {week.map((schedule, dayIndex) => {
            if (!schedule) {
              return <div key={`empty-${weekIndex}-${dayIndex}`} className="bg-gray-50 rounded-lg h-20 sm:h-24"></div>;
            }
            
            const stats = getDateStats(schedule.date);
            const isSelected = schedule.date === selectedDate;
            const date = new Date(schedule.date);
            const dayOfWeek = date.getDay();
            
            return (
              <Card
                key={schedule.date}
                className={getDateCellClass(schedule, isSelected)}
                onClick={() => onDateClick(schedule.date)}
              >
                <CardContent className="p-2 sm:p-3 h-20 sm:h-24 flex flex-col">
                  {/* 日付 */}
                  <div className={`text-xs sm:text-sm mb-0.5 sm:mb-1 ${
                    dayOfWeek === 0 ? 'text-red-600 font-medium' : 
                    dayOfWeek === 6 ? 'text-blue-600 font-medium' : 
                    'text-gray-700'
                  }`}>
                    {formatShortDate(schedule.date)}
                  </div>
                  
                  {/* 統計情報 */}
                  <div className="flex-1 flex flex-col gap-0.5 sm:gap-1 text-[10px] sm:text-xs">
                    {stats.approvedCount > 0 && (
                      <div className="flex items-center gap-0.5 sm:gap-1 text-green-700">
                        <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                        <span className="truncate">{stats.approvedCount}人</span>
                      </div>
                    )}
                    {stats.selectedCount > 0 && (
                      <div className="flex items-center gap-0.5 sm:gap-1 text-yellow-700">
                        <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                        <span className="truncate">{stats.selectedCount}人</span>
                      </div>
                    )}
                    {stats.pendingCount > 0 && stats.selectedCount === 0 && (
                      <div className="flex items-center gap-0.5 sm:gap-1 text-gray-600">
                        <AlertCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                        <span className="truncate">{stats.pendingCount}人</span>
                      </div>
                    )}
                    {stats.totalApps === 0 && (
                      <div className="text-gray-400 text-center mt-1 sm:mt-2 text-[9px] sm:text-xs">
                        応募なし
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ))}

      {/* 凡例 */}
      <div className="flex flex-wrap gap-2 sm:gap-4 text-[10px] sm:text-xs text-gray-600 p-2 sm:p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-50 border border-green-200 rounded"></div>
          <span>承認済み</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-3 h-3 sm:w-4 sm:h-4 bg-yellow-50 border border-yellow-200 rounded"></div>
          <span>選択中</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gray-50 border border-gray-200 rounded"></div>
          <span>承認待ち</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-3 h-3 sm:w-4 sm:h-4 bg-blue-100 border-2 border-blue-500 rounded"></div>
          <span>選択中の日付</span>
        </div>
      </div>
    </div>
  );
}

// 週間希望達成度表示コンポーネント
interface DesiredShiftsTrackerProps {
  applications: Array<ApplicationWithTime & { 
    id: number;
    user_email: string;
    overall_status: string;
    daily_schedule?: Array<{ date: string; status: string }>;
  }>;
  dateApplications: { [date: string]: ApplicationWithTime[] };
  dailySchedules: DailyScheduleItem[];
}

export function DesiredShiftsTracker({ applications, dateApplications, dailySchedules }: DesiredShiftsTrackerProps) {
  // 各応募者の週間実績を計算
  const calculateWeeklyStats = (app: any) => {
    if (!app.desired_shifts_per_week) {
      return null;
    }

    // 承認済みまたは選択中の日数をカウント
    let approvedDays = 0;
    let selectedDays = 0;

    dailySchedules.forEach(schedule => {
      const appsForDate = dateApplications[schedule.date] || [];
      const userApp = appsForDate.find(a => a.user_email === app.user_email);
      
      if (userApp) {
        if (userApp.day_status === 'approved') {
          approvedDays++;
        } else if (userApp.selected && userApp.day_status === 'pending') {
          selectedDays++;
        }
      }
    });

    const totalDays = approvedDays + selectedDays;
    const desiredPerWeek = app.desired_shifts_per_week;
    const weeksCount = Math.ceil(dailySchedules.length / 7);
    const targetTotal = desiredPerWeek * weeksCount;
    const achievementRate = targetTotal > 0 ? Math.round((totalDays / targetTotal) * 100) : 0;

    return {
      approvedDays,
      selectedDays,
      totalDays,
      desiredPerWeek,
      weeksCount,
      targetTotal,
      achievementRate,
    };
  };

  // 希望を設定している応募者のみフィルタ
  const appsWithDesiredShifts = applications.filter(app => app.desired_shifts_per_week);

  if (appsWithDesiredShifts.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardContent className="p-4">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          週間希望達成度
        </h4>
        <div className="space-y-3">
          {appsWithDesiredShifts.map(app => {
            const stats = calculateWeeklyStats(app);
            if (!stats) return null;

            const isUnderAchieving = stats.achievementRate < 80;
            const isOverAchieving = stats.achievementRate > 120;

            return (
              <div key={app.id} className="border rounded-lg p-3 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-medium text-sm">{app.user_name}</div>
                    <div className="text-xs text-gray-600">
                      希望: {stats.desiredPerWeek}回/週 (全期間で{stats.targetTotal}日)
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={
                        stats.achievementRate >= 80 && stats.achievementRate <= 120
                          ? 'default'
                          : 'outline'
                      }
                      className={
                        stats.achievementRate >= 80 && stats.achievementRate <= 120
                          ? 'bg-green-500'
                          : isUnderAchieving
                          ? 'text-red-600 border-red-300'
                          : 'text-orange-600 border-orange-300'
                      }
                    >
                      {stats.achievementRate}%
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-600">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    <span>承認: {stats.approvedDays}日</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-yellow-600" />
                    <span>選択中: {stats.selectedDays}日</span>
                  </div>
                  <div className="ml-auto flex items-center gap-1">
                    {isUnderAchieving && (
                      <>
                        <TrendingDown className="h-3 w-3 text-red-600" />
                        <span className="text-red-600">希望に満たない</span>
                      </>
                    )}
                    {isOverAchieving && (
                      <>
                        <TrendingUp className="h-3 w-3 text-orange-600" />
                        <span className="text-orange-600">希望を超過</span>
                      </>
                    )}
                    {!isUnderAchieving && !isOverAchieving && (
                      <span className="text-green-600">適切</span>
                    )}
                  </div>
                </div>
                {/* プログレスバー */}
                <div className="mt-2 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      stats.achievementRate >= 80 && stats.achievementRate <= 120
                        ? 'bg-green-500'
                        : isUnderAchieving
                        ? 'bg-red-500'
                        : 'bg-orange-500'
                    }`}
                    style={{ width: `${Math.min(stats.achievementRate, 100)}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}