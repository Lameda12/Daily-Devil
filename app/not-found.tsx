import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
      <h1 className="font-pixel text-3xl text-blood">404</h1>
      <p className="text-mute">That level doesn’t exist (yet). The devil doesn’t do spoilers.</p>
      <Link href="/" className="font-pixel text-sm underline underline-offset-4">Play today’s level</Link>
    </main>
  )
}
