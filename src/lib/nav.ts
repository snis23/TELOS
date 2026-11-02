import {
  BookOpen,
  ChartColumn,
  ClipboardList,
  Ellipsis,
  GraduationCap,
  Map as MapIcon,
  Settings,
  Sun,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** 4.1 메뉴 구조. 사이드바와 Alt+1~6 이 이 순서를 쓴다. */
export const MAIN_NAV: readonly NavItem[] = [
  { href: "/", label: "오늘", icon: Sun },
  { href: "/plan/", label: "계획", icon: MapIcon },
  { href: "/exam/", label: "시험", icon: ClipboardList },
  { href: "/learn/", label: "학습", icon: BookOpen },
  { href: "/record/", label: "기록", icon: ChartColumn },
  { href: "/grade/", label: "성적", icon: GraduationCap },
];

export const SETTINGS_NAV: NavItem = { href: "/settings/", label: "설정", icon: Settings };

/** 하단 탭: 오늘, 계획, 시험, 학습 + 더보기 */
export const TAB_NAV: readonly NavItem[] = MAIN_NAV.slice(0, 4);

/** 더보기 시트: 기록, 성적, 설정 */
export const MORE_NAV: readonly NavItem[] = [MAIN_NAV[4], MAIN_NAV[5], SETTINGS_NAV];

export const MORE_ICON = Ellipsis;

function normalize(path: string): string {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

/** 현재 주소가 메뉴에 속하는지. 오늘(/)은 정확히 같을 때만. */
export function isNavActive(pathname: string, href: string): boolean {
  const current = normalize(pathname || "/");
  const target = normalize(href);
  if (target === "/") return current === "/";
  return current === target || current.startsWith(`${target}/`);
}

export function isMoreActive(pathname: string): boolean {
  return MORE_NAV.some((item) => isNavActive(pathname, item.href));
}
