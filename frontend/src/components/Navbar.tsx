import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Search, LogIn, LogOut, User, BookOpen, Sun, Moon } from 'lucide-react';
import BrandMark from '@/components/BrandMark';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth, userContact } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useSubject } from '@/lib/SubjectContext';
import { SUBJECT_META, type Subject } from '@/types';

const navLinks = [
  { to: '/', label: '首页' },
  { to: '/courses', label: '课程' },
  { to: '/knowledge', label: '知识库' },
  { to: '/tutor', label: 'AI 答疑' },
  { to: '/problems', label: '例题广场' },
  { to: '/formulas', label: '公式速查' },
  { to: '/mistakes', label: '错题本' },
  { to: '/forum', label: '论坛' },
  { to: '/about', label: '关于' },
];

interface NavbarProps {
  onOpenSearch: () => void;
}

const Navbar = ({ onOpenSearch }: NavbarProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme, toggle: toggleTheme, themeLabel } = useTheme();
  const { subject, setSubject } = useSubject();

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  const handleSignOut = () => {
    signOut();
    setMobileOpen(false);
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-16 items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Principia 首页">
          <BrandMark className="h-9 w-9 drop-shadow-sm" />
          <span className="font-serif text-xl font-semibold tracking-tight">
            Principia
          </span>
        </Link>

        {/* 桌面导航 */}
        <nav className="hidden md:flex items-center gap-1" aria-label="主导航">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-3 py-2 text-sm font-medium transition-colors duration-[var(--duration-fast)] hover:text-foreground ${
                isActive(link.to) ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {link.label}
              {isActive(link.to) && (
                <span className="block h-0.5 w-full bg-info mt-0.5" />
              )}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/* 搜索触发按钮 */}
          <Button
            variant="outline"
            onClick={onOpenSearch}
            className="hidden sm:flex items-center gap-2 text-muted-foreground font-normal w-44 lg:w-56 justify-between"
            aria-label="搜索知识点与例题"
          >
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              <span className="text-sm">搜索知识 / 例题</span>
            </span>
            <kbd className="pointer-events-none hidden lg:inline-flex h-5 select-none items-center gap-0.5 border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenSearch}
            className="sm:hidden"
            aria-label="搜索"
          >
            <Search className="h-5 w-5" />
          </Button>

          {/* 数学 / 物理 学科切换 */}
          <div className="hidden sm:flex items-center gap-0.5 rounded-md border border-border p-0.5">
            {(['math', 'physics'] as Subject[]).map((s) => (
              <button
                key={s}
                onClick={() => setSubject(s)}
                aria-label={`切换到${SUBJECT_META[s].name}`}
                aria-pressed={subject === s}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors duration-[var(--duration-fast)] ${
                  subject === s
                    ? 'bg-info text-info-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {SUBJECT_META[s].short}
              </button>
            ))}
          </div>

          {/* 日光 / 月光模式切换 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={`切换到${theme === 'dark' ? '日光模式' : '月光模式'}`}
            title={themeLabel}
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          {/* 登录状态区 */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  aria-label={`用户菜单：${user.name}`}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                    <AvatarFallback className="bg-info/10 text-info text-xs font-semibold">
                      {user.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground font-normal truncate">
                    {userContact(user)}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer gap-2">
                    <User className="h-4 w-4" />
                    个人中心
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/study" className="cursor-pointer gap-2">
                    <BookOpen className="h-4 w-4" />
                    学习档案
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm" className="gap-1.5 bg-info text-info-foreground hover:bg-info/90">
              <Link to="/login">
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">登录</span>
              </Link>
            </Button>
          )}

          {/* 移动端菜单按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? '关闭菜单' : '打开菜单'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* 移动端抽屉菜单 */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-border bg-background" aria-label="移动端导航">
          <div className="container py-3 flex flex-col">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`py-3 text-sm font-medium border-b border-border last:border-0 ${
                  isActive(link.to) ? 'text-info' : 'text-muted-foreground'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link
                  to="/study"
                  onClick={() => setMobileOpen(false)}
                  className="py-3 text-sm font-medium border-b border-border text-muted-foreground"
                >
                  学习档案
                </Link>
                <Link
                  to="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="py-3 text-sm font-medium border-b border-border text-muted-foreground"
                >
                  个人中心
                </Link>
                <button
                  onClick={handleSignOut}
                  className="py-3 text-sm font-medium text-left text-destructive"
                >
                  退出登录
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="py-3 text-sm font-medium text-info"
              >
                登录
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
};

export default Navbar;
