import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '수익률 24시 | 투자·도박 사기 판별 게임',
  description: '스마트폰 연락을 대화와 확인을 통해 판별하는 교육용 시뮬레이션 게임',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
