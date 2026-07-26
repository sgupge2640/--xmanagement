import { useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  CheckCircle2,
  Clock,
  XCircle,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  UserPlus,
  EyeOff,
  Eye,
  Megaphone,
} from 'lucide-react';

function SelectedTimeAdjust({ apps, onTimeChange }: {
  apps: { id: number; user_name: string; start_time: string; end_time: string; original_start_time: string; original_end_time: string }[];
  onTimeChange: (appId: number, field: 'start_time' | 'end_time', value: string) => void;
}) {
  return (
    <div className="mt-2 border border-gray-200 rounded-lg p-3 space-y-3 bg-gray-50">
      <div className="text-xs text-gray-500">選択中 {apps.length} 人の時間を調整する</div>
      {apps.map(app => (
        <div key={app.id}>
          <div className="text-xs font-medium text-gray-700 mb-1">{app.user_name}</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-gray-500">開始</Label>
              <Input type="time" step="600" value={app.start_time}
                onChange={e => onTimeChange(app.id, 'start_time', e.target.value)}
                className="mt-0.5 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">終了</Label>
              <Input type="time" step="600" value={app.end_time}
                onChange={e => onTimeChange(app.id, 'end_time', e.target.value)}
                className="mt-0.5 h-8 text-sm" />
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            希望: {app.original_start_time.slice(0, 5)} 〜 {app.original_end_time.slice(0, 5)}
          </div>
        </div>
      ))}
    </div>
  );
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

interface TimeSlotCoverage {
  slot: string;
  count: number;
  isSufficient: boolean;
  apps: ApplicationWithTime[];
}

interface ShiftDateDetailProps {
  date: string;
  displayDate: string;
  applications: ApplicationWithTime[];
  isResultsPublished: boolean;
  timeSlotCoverage: TimeSlotCoverage[];
  customBreakpoints: { start: string; end: string; name: string }[];
  onApplicationSelect: (appId: number, checked: boolean) => void;
  onTimeChange: (appId: number, field: 'start_time' | 'end_time', value: string) => void;
  onUnapprove: (appId: number, date: string) => void;
  onShowPreview: () => void;
  unapproving: { appId: number; date: string } | null;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  groupMembers?: Array<{ user_email: string; user_name: string }>;
  onDirectHire?: (userEmail: string, userName: string, startTime: string, endTime: string) => void;
  onCancelDirectHire?: (appId: number) => void;
  defaultStartTime?: string;
  defaultEndTime?: string;
  hiddenDayApps?: { appId: number; date: string }[];
  onToggleHidden?: (appId: number, date: string) => void;
  isDatePublished?: boolean;
  onToggleDatePublish?: () => void;
}

export function ShiftDateDetail({
  date,
  displayDate,
  applications,
  isResultsPublished,
  timeSlotCoverage,
  customBreakpoints,
  onApplicationSelect,
  onTimeChange,
  onUnapprove,
  onShowPreview,
  unapproving,
  onSelectAll,
  onDeselectAll,
  groupMembers = [],
  onDirectHire,
  onCancelDirectHire,
  defaultStartTime = '09:00',
  defaultEndTime = '18:00',
  hiddenDayApps = [],
  onToggleHidden,
  isDatePublished = false,
  onToggleDatePublish,
}: ShiftDateDetailProps) {
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [directHireOpen, setDirectHireOpen] = useState(false);
  const [directHireTimes, setDirectHireTimes] = useState<{ [email: string]: { start: string; end: string } }>({});

  const pendingApps = applications.filter(app => app.day_status === 'pending');
  const approvedApps = applications.filter(app => app.day_status === 'approved');
  const directApprovedApps = applications.filter(app => app.day_status === 'direct_approved');
  const hasSelectedApps = applications.some(app => app.selected || app.day_status === 'approved' || app.day_status === 'direct_approved');
  // 通常の応募者（direct_approved 以外）のメールアドレス
  const regularAppliedEmails = new Set(applications.filter(a => a.day_status !== 'direct_approved').map(a => a.user_email));
  const directApprovedEmails = new Set(directApprovedApps.map(a => a.user_email));
  const nonApplicants = groupMembers.filter(m => !regularAppliedEmails.has(m.user_email) && !directApprovedEmails.has(m.user_email));
  const allPendingSelected = pendingApps.length > 0 && pendingApps.every(app => app.selected);
  const somePendingSelected = pendingApps.some(app => app.selected);

  if (applications.length === 0 && nonApplicants.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>この日の応募者はいません</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-lg flex items-center gap-2">
          {displayDate} の応募者
          {isDatePublished && (
            <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">発表済み</Badge>
          )}
        </h3>
        {onToggleDatePublish && (
          <Button
            size="sm"
            variant={isDatePublished ? 'outline' : 'default'}
            className={isDatePublished
              ? 'border-green-400 text-green-700 hover:bg-green-50'
              : 'bg-green-600 hover:bg-green-700 text-white'
            }
            onClick={onToggleDatePublish}
          >
            <Megaphone className="h-3.5 w-3.5 mr-1" />
            {isDatePublished ? '発表を取り消す' : 'この日を発表'}
          </Button>
        )}
      </div>

      {/* 時間帯ごとの人数配置（折りたたみ） */}
      {hasSelectedApps && timeSlotCoverage.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-purple-50/50 transition-colors"
            onClick={() => setCoverageOpen(v => !v)}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              <h4 className="font-medium text-purple-900">時間帯別の配置人数</h4>
              <Badge variant="outline" className="text-xs text-purple-700 border-purple-300">
                {customBreakpoints.length === 0 ? '区切りなし' : `${customBreakpoints.length}箇所で区切り`}
              </Badge>
            </div>
            {coverageOpen ? <ChevronUp className="h-4 w-4 text-purple-600 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-purple-600 flex-shrink-0" />}
          </button>

          {coverageOpen && (
            <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-purple-200">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-3">
            {timeSlotCoverage.map((coverage, idx) => {
              // "名前: HH:MM-HH:MM" または "HH:MM-HH:MM" を分解
              const slotStr = coverage.slot || '';
              const colonIdx = slotStr.indexOf(': ');
              const slotName = colonIdx !== -1 ? slotStr.slice(0, colonIdx) : '';
              const slotTime = colonIdx !== -1 ? slotStr.slice(colonIdx + 2) : slotStr;
              const [slotStart, slotEnd] = slotTime.split('-');

              return (
                <div
                  key={idx}
                  className={`p-3 sm:p-4 rounded-lg transition-all hover:shadow-md ${
                    coverage.count === 0
                      ? 'bg-red-100 border-2 border-red-300'
                      : coverage.isSufficient
                      ? 'bg-green-100 border-2 border-green-300'
                      : 'bg-yellow-100 border-2 border-yellow-300'
                  }`}
                >
                  {/* 時間帯ラベル */}
                  <div className="bg-white/80 rounded px-1.5 sm:px-2 py-1 mb-2 sm:mb-3 text-center">
                    {slotName && (
                      <div className="text-sm sm:text-lg font-bold text-gray-900">{slotName}</div>
                    )}
                    <div className="text-xs text-gray-600 whitespace-nowrap">
                      {slotStart}〜{slotEnd}
                    </div>
                  </div>
                  
                  {/* 人数表示 */}
                  <div className="flex flex-col items-center gap-1">
                    {coverage.count === 0 ? (
                      <Minus className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                    ) : coverage.isSufficient ? (
                      <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600" />
                    )}
                    <div className="flex items-baseline gap-1">
                      <span className={`text-xl sm:text-2xl font-bold ${
                        coverage.count === 0
                          ? 'text-red-700'
                          : coverage.isSufficient
                          ? 'text-green-700'
                          : 'text-yellow-700'
                      }`}>
                        {coverage.count}
                      </span>
                      <span className="text-xs sm:text-sm text-gray-600">人</span>
                    </div>
                  </div>

                  {/* 名前一覧 */}
                  {coverage.apps.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {coverage.apps.map(app => (
                        <div key={app.id} className="text-xs text-center text-gray-700 bg-white/60 rounded px-1 py-0.5 truncate">
                          {app.user_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
            </div>
          )}
        </div>
      )}

      {/* 承認待ち */}
      {pendingApps.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              承認待ち ({pendingApps.length}件)
            </h4>
            
            {/* 一括選択ボタン */}
            {!isResultsPublished && (onSelectAll || onDeselectAll) && (
              <div className="flex items-center gap-2">
                {!allPendingSelected && onSelectAll && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSelectAll}
                    className="text-blue-600 border-blue-300 hover:bg-blue-50"
                  >
                    <CheckSquare className="h-4 w-4 mr-1" />
                    全選択
                  </Button>
                )}
                {somePendingSelected && onDeselectAll && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onDeselectAll}
                    className="text-gray-600 border-gray-300 hover:bg-gray-50"
                  >
                    <Square className="h-4 w-4 mr-1" />
                    全解除
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="space-y-2">
            {pendingApps.map((app) => {
              const isHidden = hiddenDayApps.some(h => h.appId === app.id && h.date === date);
              return (
                <div
                  key={app.id}
                  className={`border rounded-lg p-4 ${
                    isHidden ? 'bg-gray-100 border-gray-200 opacity-60' :
                    app.selected ? 'bg-blue-50 border-blue-300' : 'bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {!isResultsPublished && !isHidden && (
                      <Checkbox
                        id={`app-${app.id}`}
                        checked={app.selected}
                        onCheckedChange={(checked) => onApplicationSelect(app.id, checked as boolean)}
                        className="mt-1"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className={`font-medium ${isHidden ? 'text-gray-400' : ''}`}>{app.user_name}</div>
                          <div className={`text-sm ${isHidden ? 'text-gray-400' : 'text-gray-600'}`}>{app.user_email}</div>
                          {app.desired_shifts_per_week && !isHidden && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              希望: {app.desired_shifts_per_week}回/週
                            </Badge>
                          )}
                          {isHidden && (
                            <Badge variant="outline" className="mt-1 text-xs text-gray-400 border-gray-300">
                              非表示
                            </Badge>
                          )}
                        </div>
                        {onToggleHidden && !isResultsPublished && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className={`h-7 px-2 text-xs ${isHidden ? 'text-blue-600 hover:text-blue-700' : 'text-gray-400 hover:text-gray-600'}`}
                            onClick={() => onToggleHidden(app.id, date)}
                            title={isHidden ? '表示に戻す' : '非表示にする'}
                          >
                            {isHidden ? <Eye className="h-3.5 w-3.5 mr-1" /> : <EyeOff className="h-3.5 w-3.5 mr-1" />}
                            {isHidden ? '表示' : '非表示'}
                          </Button>
                        )}
                      </div>

                      {!isHidden && !app.selected && (
                        <div className="text-xs text-gray-400 mt-1">
                          {app.original_start_time.slice(0, 5)} - {app.original_end_time.slice(0, 5)}
                        </div>
                      )}

                      {isHidden && (
                        <div className="text-xs text-gray-400 mt-1">
                          {app.original_start_time.slice(0, 5)} - {app.original_end_time.slice(0, 5)}
                        </div>
                      )}

                      {!isHidden && app.selected && (app.start_time !== app.original_start_time || app.end_time !== app.original_end_time) && (
                        <div className="text-xs text-blue-600 mt-2">
                          元の応募時間: {app.original_start_time.slice(0, 5)} - {app.original_end_time.slice(0, 5)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 選択済みの時間調整（折りたたみ） */}
          {(() => {
            const selected = pendingApps.filter(a => a.selected);
            if (selected.length === 0 || isResultsPublished) return null;
            return <SelectedTimeAdjust apps={selected} onTimeChange={onTimeChange} />;
          })()}
        </div>
      )}

      {/* 承認済み */}
      {approvedApps.length > 0 && (
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            承認済み ({approvedApps.length}件)
          </h4>
          <div className="space-y-2">
            {approvedApps.map((app) => (
              <div
                key={app.id}
                className="border rounded-lg p-4 bg-green-50 border-green-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="font-medium">{app.user_name}</span>
                      {app.desired_shifts_per_week && (
                        <Badge variant="outline" className="text-xs">
                          希望: {app.desired_shifts_per_week}回/週
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mb-2">{app.user_email}</div>
                    <div className="flex items-center gap-1 text-sm">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span>
                        {app.start_time.slice(0, 5)} - {app.end_time.slice(0, 5)}
                      </span>
                    </div>
                    {(app.start_time !== app.original_start_time || app.end_time !== app.original_end_time) && (
                      <div className="text-xs text-blue-600 mt-1">
                        元の時間: {app.original_start_time.slice(0, 5)} - {app.original_end_time.slice(0, 5)}
                      </div>
                    )}
                  </div>
                  {!isResultsPublished && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onUnapprove(app.id, date)}
                      disabled={unapproving?.appId === app.id && unapproving?.date === date}
                      className="text-red-600 border-red-300 hover:bg-red-50 ml-3"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      {unapproving?.appId === app.id && unapproving?.date === date ? '取消中...' : '取消'}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 応募者以外から採用 */}
      {!isResultsPublished && onDirectHire && (directApprovedApps.length > 0 || nonApplicants.length > 0) && (
        <div className="border border-orange-200 rounded-lg overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 transition-colors"
            onClick={() => setDirectHireOpen(v => !v)}
          >
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              応募者以外から採用
              {directApprovedApps.length > 0 && (
                <span className="text-xs bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded-full">{directApprovedApps.length}人採用済み</span>
              )}
            </div>
            {directHireOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {directHireOpen && (
            <div className="divide-y divide-orange-100">
              {/* 採用済みの人 */}
              {directApprovedApps.map(app => (
                <div key={app.id} className="p-3 bg-orange-50 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-orange-900">{app.user_name}</div>
                    <div className="text-xs text-orange-600 truncate">{app.user_email}</div>
                    <div className="text-xs text-orange-700 mt-0.5">{app.start_time.slice(0,5)} 〜 {app.end_time.slice(0,5)}</div>
                  </div>
                  {onCancelDirectHire && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-orange-700 border-orange-300 hover:bg-orange-100 whitespace-nowrap"
                      onClick={() => onCancelDirectHire(app.id)}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      取り消し
                    </Button>
                  )}
                </div>
              ))}
              {/* 未採用のメンバー */}
              {nonApplicants.map(member => {
                const times = directHireTimes[member.user_email] || { start: defaultStartTime, end: defaultEndTime };
                return (
                  <div key={member.user_email} className="p-3 bg-white flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{member.user_name}</div>
                      <div className="text-xs text-gray-500 truncate">{member.user_email}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Input
                        type="time" step="600"
                        value={times.start}
                        onChange={e => setDirectHireTimes(prev => ({ ...prev, [member.user_email]: { ...times, start: e.target.value } }))}
                        className="h-8 w-28 text-sm"
                      />
                      <span className="text-gray-400 text-xs">〜</span>
                      <Input
                        type="time" step="600"
                        value={times.end}
                        onChange={e => setDirectHireTimes(prev => ({ ...prev, [member.user_email]: { ...times, end: e.target.value } }))}
                        className="h-8 w-28 text-sm"
                      />
                      <Button
                        size="sm"
                        className="h-8 bg-orange-500 hover:bg-orange-600 text-white whitespace-nowrap"
                        onClick={() => onDirectHire(member.user_email, member.user_name, times.start, times.end)}
                      >
                        採用
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* この日付の承認プレビューボタン */}
      {!isResultsPublished && pendingApps.length > 0 && (
        <div className="mt-4 flex justify-end">
          <Button
            onClick={onShowPreview}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            この日の選択を承認
          </Button>
        </div>
      )}
    </div>
  );
}