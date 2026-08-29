import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://whatfraud-demo.hoyhoy1227.chatgpt.site'),
  title: '수익률 24시 | 투자·도박 사기 판별 게임',
  description: '스마트폰 연락을 대화와 확인을 통해 판별하는 교육용 시뮬레이션 게임',
  openGraph: {
    title: '수익률 24시 | 투자·도박 사기 판별 게임',
    description: '스마트폰 연락을 확인하고 정상·주의·사기를 직접 판별하는 교육용 시뮬레이션 게임',
    type: 'website',
    locale: 'ko_KR',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: '수익률 24시 게임 미리보기' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '수익률 24시 | 투자·도박 사기 판별 게임',
    description: '스마트폰 연락을 확인하고 정상·주의·사기를 직접 판별하는 교육용 시뮬레이션 게임',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
