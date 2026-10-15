'use client';
export default function ErrorPage({ reset }) {
  return <main style={{ padding: '12vh 25px', textAlign: 'center' }}><h1>A small pause in the connection.</h1><p style={{ margin: 20 }}>Something went wrong. Please try again.</p><button className="primary" onClick={reset}>Try again</button></main>;
}
