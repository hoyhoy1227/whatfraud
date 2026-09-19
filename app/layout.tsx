import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://whatfraud-demo.hoyhoy1227.chatgpt.site'),
  icons: { icon: '/committee-icon.svg' },
  title: '사기방지위원회 | 인터랙티브 스마트폰 스릴러',
  description: '익숙한 연락으로 시작된 하루. 지인 사칭, 가짜 투자방, 회수 사칭을 선택과 기록으로 경험하는 가상 스마트폰 게임.',
  openGraph: {
    title: '사기방지위원회 | 인터랙티브 스마트폰 스릴러',
    description: '하나의 휴대폰, 세 번의 선택. 나의 행동이 남긴 하루를 되감아 보는 가상 스마트폰 체험.',
    type: 'website',
    locale: 'ko_KR',
    images: [{ url: '/committee-og.png', width: 1200, height: 630, alt: '사기방지위원회 — 당신의 선택을 기록합니다' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '사기방지위원회 | 인터랙티브 스마트폰 스릴러',
    description: '하나의 휴대폰, 세 번의 선택. 나의 행동이 남긴 하루를 되감아 보는 가상 스마트폰 체험.',
    images: ['/committee-og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
