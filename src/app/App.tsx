import { useEffect, useState } from 'react';
import { LoginPage } from './components/LoginPage';
import { SignupPage } from './components/SignupPage';
import { MyPage } from './components/MyPage';
import { CreateGroupPage } from './components/CreateGroupPage';
import { JoinGroupPage } from './components/JoinGroupPage';
import { ManageRequestsPage } from './components/ManageRequestsPage';
import { GroupDashboard } from './components/GroupDashboard';
import { CreateShiftPage } from './components/CreateShiftPage';
import { ShiftDetailPage } from './components/ShiftDetailPage';
import { MembersPage } from './components/MembersPage';
import { ShiftSwapRequests } from './components/ShiftSwapRequests';
import { SalaryView } from './components/SalaryView';
import { LanguageProvider } from './lib/LanguageContext';
import { Toaster } from 'sonner';
import * as auth from './lib/auth';
import { getSupabaseClient } from './lib/supabase';
import { getMyGroups } from './lib/api';
import './lib/debug';
import { ProfileEditPage } from './components/ProfileEditPage';
import { Button } from './components/ui/button';

type GroupSummary = {
  id: number;
  name: string;
  isAdmin: boolean;
};

type AppRoute =
  | { kind: 'root' }
  | { kind: 'login' }
  | { kind: 'signup' }
  | { kind: 'mypage' }
  | { kind: 'profile-edit' }
  | { kind: 'create-group' }
  | { kind: 'join-group' }
  | { kind: 'group-dashboard'; groupId: number }
  | { kind: 'manage-requests'; groupId: number }
  | { kind: 'members'; groupId: number }
  | { kind: 'create-shift'; groupId: number }
  | { kind: 'shift-detail'; groupId: number; shiftId: number }
  | { kind: 'swap-requests'; groupId: number }
  | { kind: 'salary'; groupId: number }
  | { kind: 'not-found' };

type NavigateOptions = {
  replace?: boolean;
};

const PENDING_PATH_KEY = 'post_login_path';

function usePathname() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to: string, options: NavigateOptions = {}) => {
    if (options.replace) {
      window.history.replaceState({}, '', to);
    } else {
      window.history.pushState({}, '', to);
    }
    setPathname(to);
  };

  return { pathname, navigate };
}

function parseRoute(pathname: string): AppRoute {
  const segments = pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);

  if (segments.length === 0) return { kind: 'root' };
  if (segments.length === 1) {
    if (segments[0] === 'login') return { kind: 'login' };
    if (segments[0] === 'signup') return { kind: 'signup' };
    if (segments[0] === 'mypage') return { kind: 'mypage' };
    if (segments[0] === 'profile-edit') return { kind: 'profile-edit' };
    if (segments[0] === 'create-group') return { kind: 'create-group' };
    if (segments[0] === 'join-group') return { kind: 'join-group' };
  }

  if (segments[0] === 'groups' && segments.length >= 3 && /^\d+$/.test(segments[1])) {
    const groupId = Number(segments[1]);

    if (segments[2] === 'dashboard') return { kind: 'group-dashboard', groupId };
    if (segments[2] === 'manage-requests') return { kind: 'manage-requests', groupId };
    if (segments[2] === 'members') return { kind: 'members', groupId };
    if (segments[2] === 'create-shift') return { kind: 'create-shift', groupId };
    if (segments[2] === 'swap-requests') return { kind: 'swap-requests', groupId };
    if (segments[2] === 'salary') return { kind: 'salary', groupId };
    if (segments[2] === 'shifts' && segments.length >= 4 && /^\d+$/.test(segments[3])) {
      return { kind: 'shift-detail', groupId, shiftId: Number(segments[3]) };
    }
  }

  return { kind: 'not-found' };
}

function useResolvedGroup(groupId: number | null) {
  const [group, setGroup] = useState<GroupSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (groupId === null) {
      setGroup(null);
      setLoading(false);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    const loadGroup = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await getMyGroups();
        const matchedGroup = (data.groups || []).find((item: any) => Number(item.id) === groupId);

        if (cancelled) return;

        if (!matchedGroup) {
          setGroup(null);
          setError('このグループへのアクセス権がありません');
          return;
        }

        setGroup({
          id: Number(matchedGroup.id),
          name: matchedGroup.name,
          isAdmin: matchedGroup.role === 'admin',
        });
      } catch (loadError: any) {
        if (cancelled) return;
        setGroup(null);
        setError(loadError?.message || 'グループ情報の取得に失敗しました');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadGroup();

    return () => {
      cancelled = true;
    };
  }, [groupId]);

  return { group, loading, error };
}

function CenterMessage({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-xl w-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-center space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-600 whitespace-pre-wrap">{message}</p>
        {actionLabel && onAction && <Button onClick={onAction}>{actionLabel}</Button>}
      </div>
    </div>
  );
}

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const { pathname, navigate } = usePathname();
  const route = parseRoute(pathname);
  const isLoggedIn = auth.isAuthenticated();
  const needsGroupResolution =
    isLoggedIn &&
    (route.kind === 'group-dashboard' ||
      route.kind === 'manage-requests' ||
      route.kind === 'members' ||
      route.kind === 'create-shift' ||
      route.kind === 'swap-requests' ||
      route.kind === 'salary');
  const resolvedGroupId = needsGroupResolution ? route.groupId : null;
  const { group, loading: groupLoading, error: groupError } = useResolvedGroup(resolvedGroupId);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const supabase = getSupabaseClient();
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          auth.logout();
        } else if (session) {
          auth.setToken(session.access_token);
          auth.setEmail(session.user.email || '');

          if (session.user.user_metadata?.name) {
            auth.setName(session.user.user_metadata.name);
          }
        } else {
          auth.logout();
        }
      } catch {
        auth.logout();
      } finally {
        setIsInitializing(false);
      }
    };

    initAuth();
  }, []);

  useEffect(() => {
    if (isInitializing) return;

    const loggedIn = auth.isAuthenticated();
    const isPublicRoute = route.kind === 'login' || route.kind === 'signup';

    if (!loggedIn && (route.kind === 'root' || !isPublicRoute)) {
      if (route.kind !== 'root') {
        window.sessionStorage.setItem(PENDING_PATH_KEY, pathname);
      }
      navigate('/login', { replace: true });
      return;
    }

    if (loggedIn && (route.kind === 'root' || isPublicRoute)) {
      navigate('/mypage', { replace: true });
    }
  }, [isInitializing, navigate, pathname, route.kind]);

  const handleLogout = () => {
    auth.logout();
    window.sessionStorage.removeItem(PENDING_PATH_KEY);
    navigate('/login', { replace: true });
  };

  const handleAuthSuccess = () => {
    const pendingPath = window.sessionStorage.getItem(PENDING_PATH_KEY);
    if (pendingPath) {
      window.sessionStorage.removeItem(PENDING_PATH_KEY);
      navigate(pendingPath, { replace: true });
      return;
    }
    navigate('/mypage', { replace: true });
  };

  const handleGroupActionSuccess = () => {
    navigate('/mypage', { replace: true });
  };

  if (isInitializing) {
    return (
      <LanguageProvider>
        <CenterMessage title="初期化中" message="ログイン状態を確認しています。" />
        <Toaster />
      </LanguageProvider>
    );
  }

  let content: React.ReactNode = null;

  switch (route.kind) {
    case 'signup':
      content = (
        <SignupPage onSignupSuccess={handleAuthSuccess} onSwitchToLogin={() => navigate('/login')} />
      );
      break;
    case 'login':
      content = (
        <LoginPage onLoginSuccess={handleAuthSuccess} onSwitchToSignup={() => navigate('/signup')} />
      );
      break;
    case 'mypage':
      content = (
        <MyPage
          onCreateGroup={() => navigate('/create-group')}
          onJoinGroup={() => navigate('/join-group')}
          onManageRequests={(groupId) => navigate(`/groups/${groupId}/manage-requests`)}
          onSelectGroup={(groupId) => navigate(`/groups/${groupId}/dashboard`)}
          onLogout={handleLogout}
          onEditProfile={() => navigate('/profile-edit')}
        />
      );
      break;
    case 'profile-edit':
      content = <ProfileEditPage onBack={() => navigate('/mypage')} />;
      break;
    case 'create-group':
      content = <CreateGroupPage onBack={() => navigate('/mypage')} onSuccess={handleGroupActionSuccess} />;
      break;
    case 'join-group':
      content = <JoinGroupPage onBack={() => navigate('/mypage')} onSuccess={handleGroupActionSuccess} />;
      break;
    case 'shift-detail':
      content = (
        <ShiftDetailPage
          shiftId={route.shiftId}
          groupId={route.groupId}
          onBack={() => navigate(`/groups/${route.groupId}/dashboard`)}
        />
      );
      break;
    case 'manage-requests':
    case 'group-dashboard':
    case 'members':
    case 'create-shift':
    case 'swap-requests':
    case 'salary':
      if (!isLoggedIn) {
        content = null;
        break;
      }

      if (groupLoading) {
        content = <CenterMessage title="読み込み中" message="グループ情報を確認しています。" />;
        break;
      }

      if (groupError || !group) {
        content = (
          <CenterMessage
            title="グループを表示できません"
            message={groupError || 'グループ情報が見つかりませんでした。'}
            actionLabel="マイページへ戻る"
            onAction={() => navigate('/mypage', { replace: true })}
          />
        );
        break;
      }

      if (route.kind === 'manage-requests') {
        content = (
          <ManageRequestsPage
            groupId={group.id}
            groupName={group.name}
            onBack={() => navigate(`/groups/${group.id}/dashboard`)}
          />
        );
        break;
      }

      if (route.kind === 'group-dashboard') {
        content = (
          <GroupDashboard
            groupId={group.id}
            groupName={group.name}
            isAdmin={group.isAdmin}
            onBack={() => navigate('/mypage')}
            onCreateShift={() => navigate(`/groups/${group.id}/create-shift`)}
            onViewShift={(shiftId) => navigate(`/groups/${group.id}/shifts/${shiftId}`)}
            onManageRequests={() => navigate(`/groups/${group.id}/manage-requests`)}
            onSwapRequests={() => navigate(`/groups/${group.id}/swap-requests`)}
            onViewSalary={() => navigate(`/groups/${group.id}/salary`)}
            onManageMembers={() => navigate(`/groups/${group.id}/members`)}
          />
        );
        break;
      }

      if (route.kind === 'members') {
        content = (
          <MembersPage
            groupId={group.id}
            groupName={group.name}
            onBack={() => navigate(`/groups/${group.id}/dashboard`)}
          />
        );
        break;
      }

      if (route.kind === 'create-shift') {
        content = (
          <CreateShiftPage
            groupId={group.id}
            groupName={group.name}
            onBack={() => navigate(`/groups/${group.id}/dashboard`)}
            onSuccess={() => navigate(`/groups/${group.id}/dashboard`)}
          />
        );
        break;
      }

      if (route.kind === 'swap-requests') {
        content = (
          <ShiftSwapRequests
            groupId={group.id}
            groupName={group.name}
            isAdmin={group.isAdmin}
            onBack={() => navigate(`/groups/${group.id}/dashboard`)}
          />
        );
        break;
      }

      content = (
        <SalaryView
          groupId={group.id}
          groupName={group.name}
          isAdmin={group.isAdmin}
          onBack={() => navigate(`/groups/${group.id}/dashboard`)}
        />
      );
      break;
    case 'root':
      content = <CenterMessage title="読み込み中" message="表示先を確認しています。" />;
      break;
    case 'not-found':
      content = (
        <CenterMessage
          title="ページが見つかりません"
          message="指定されたURLは存在しません。"
          actionLabel="マイページへ戻る"
          onAction={() => navigate('/mypage', { replace: true })}
        />
      );
      break;
  }

  return (
    <LanguageProvider>
      {content}
      <Toaster />
    </LanguageProvider>
  );
}
