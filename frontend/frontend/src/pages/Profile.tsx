import { Link } from 'react-router-dom';
import { Mail, Calendar, LogOut, LogIn, BookOpen, FileQuestion, ListChecks, Sigma, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FadeIn, Stagger, HoverLift } from '@/components/MotionPrimitives';
import { useAuth, userContact } from '@/lib/AuthContext';
import { courses } from '@/data/courses';
import { problems } from '@/data/problems';

const quickLinks = [
  { to: '/courses', icon: BookOpen, label: '课程总览', desc: `${courses.length} 门核心课程` },
  { to: '/problems', icon: FileQuestion, label: '例题广场', desc: `${problems.length} 道详解例题` },
  { to: '/formulas', icon: ListChecks, label: '公式速查表', desc: '按课程归类的常用公式' },
];

const Profile = () => {
  const { user, signOut } = useAuth();

  // 未登录：渲染登录引导（不做重定向，避免登出过渡动画期间的路由冲突）
  if (!user) {
    return (
      <div className="container flex min-h-[60vh] items-center justify-center py-14">
        <FadeIn className="text-center max-w-md">
          <span className="flex h-14 w-14 mx-auto items-center justify-center bg-info/10 text-info mb-6">
            <UserRound className="h-7 w-7" />
          </span>
          <h1 className="font-serif text-2xl font-semibold">还未登录</h1>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            登录后即可查看个人中心。当前为演示登录模式，任意邮箱即可体验。
          </p>
          <Button asChild className="mt-7 gap-2 bg-info text-info-foreground hover:bg-info/90">
            <Link to="/login">
              <LogIn className="h-4 w-4" />
              去登录
            </Link>
          </Button>
        </FadeIn>
      </div>
    );
  }

  const loginDate = new Date(user.loginAt).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="container py-14 lg:py-20 max-w-4xl">
      {/* 用户信息卡 */}
      <FadeIn>
        <div className="border border-border bg-card">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 border-b border-border px-6 py-6">
            <Avatar className="h-16 w-16 border border-border">
              <AvatarImage src={user.avatarUrl} alt={user.name} />
              <AvatarFallback className="bg-info/10 text-info text-lg font-semibold">
                {user.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="font-serif text-2xl font-semibold">{user.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  {userContact(user)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  登录于 {loginDate}
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={signOut}
              className="gap-2 text-muted-foreground hover:text-destructive hover:border-destructive/40"
            >
              <LogOut className="h-4 w-4" />
              退出登录
            </Button>
          </div>

          <div className="px-6 py-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              欢迎回来，<strong className="text-foreground">{user.name}</strong>
              ！这里是你的个人中心。演示模式下，学习进度与收藏功能将在接入云端账号体系后开放。
            </p>
          </div>
        </div>
      </FadeIn>

      {/* 学习入口 */}
      <FadeIn delay={0.1}>
        <h2 className="font-serif text-xl font-semibold mt-12 mb-5">继续学习</h2>
      </FadeIn>
      <Stagger className="grid gap-4 sm:grid-cols-3" stagger={0.08}>
        {quickLinks.map((link) => (
          <HoverLift key={link.to}>
            <Link
              to={link.to}
              className="group block h-full border border-border bg-card p-5 transition-colors duration-[var(--duration-normal)] hover:border-info/50"
            >
              <span className="flex h-10 w-10 items-center justify-center bg-info/10 text-info mb-4">
                <link.icon className="h-5 w-5" />
              </span>
              <h3 className="font-serif text-base font-semibold group-hover:text-info transition-colors duration-[var(--duration-fast)]">
                {link.label}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{link.desc}</p>
            </Link>
          </HoverLift>
        ))}
      </Stagger>

      {/* 品牌脚注 */}
      <FadeIn delay={0.2}>
        <div className="mt-12 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Sigma className="h-3.5 w-3.5" />
          Principia · 演示登录模式（本地会话）
        </div>
      </FadeIn>
    </div>
  );
};

export default Profile;
