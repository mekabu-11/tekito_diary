/**
 * ルートページ（app/page.tsx）
 *
 * アプリケーションのルート（/）にアクセスした場合、
 * 日記入力ページ（/diary）にリダイレクトする。
 *
 * ※ middleware.ts でもリダイレクト処理を行っているが、
 *   Server Component としてのフォールバックとしてここにも設置
 */
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/diary');
}
