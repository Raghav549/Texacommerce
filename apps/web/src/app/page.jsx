import TexaApp from '@/components/TexaApp';
const views = new Set(['feed', 'explore', 'reels', 'shop', 'messages', 'saved', 'cart', 'profile', 'settings']);
export default async function HomePage({ searchParams }) {
  const params = await searchParams;
  return <TexaApp initialView={views.has(params.view) ? params.view : 'feed'} />;
}
