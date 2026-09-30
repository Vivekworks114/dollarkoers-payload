export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '4rem', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>DollarKoers</h1>
      <p>This is the DollarKoers admin server.</p>
      <ul>
        <li><a href="/admin">Admin UI</a></li>
        <li><a href="/api">REST API</a></li>
        <li><a href="/api/graphql-playground">GraphQL playground</a></li>
      </ul>
    </main>
  )
}
