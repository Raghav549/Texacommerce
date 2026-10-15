export function Icon({ name, size = 21, ...props }) {
  const paths = {
    home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
    compass: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm4-16-2 8-8 4 4-8z',
    reels: 'M4 3h16v18H4zM4 8h16M8 3l4 5m3-5 4 5m-9 4 5 3-5 3z',
    bag: 'M4 7h16l1 14H3L4 7Zm4 0V5a4 4 0 0 1 8 0v2',
    chat: 'M21 11a9 9 0 0 1-9 9H4l-3 2 2-7a9 9 0 1 1 18-4ZM7 10h10M7 14h6',
    heart: 'M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1C-2 11 12 21 12 21S26 11 20 5Z',
    bookmark: 'M5 3h14v19l-7-5-7 5z',
    user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-3a8 8 0 0 1 16 0v3',
    settings: 'm9 3 6 0 1 3 3 1 2 5-2 3-3 1-1 3H9l-1-3-3-1-2-5 2-3 3-1zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    search: 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6',
    bell: 'M18 8a6 6 0 0 0-12 0v6l-3 4h18l-3-4zM10 21h4',
    plus: 'M12 4v16M4 12h16',
    arrow: 'M4 12h16m-6-6 6 6-6 6',
    send: 'm3 3 19 9-19 9 4-9-4-9Zm4 9h15',
    check: 'm5 12 4 4L19 6',
    image: 'M3 3h18v18H3zM3 17l6-6 5 5 3-3 4 4M16 7h.01',
    globe: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM2 12h20M12 2a22 22 0 0 0 0 20 22 22 0 0 0 0-20',
    spark: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    close: 'm6 6 12 12M6 18 18 6',
    logout: 'M9 3H3v18h6m5-15 6 6-6 6M7 12h13',
    volume: 'm3 9 5 0 5-5v16l-5-5H3zM17 8q6 4 0 8',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.spark} /></svg>;
}
