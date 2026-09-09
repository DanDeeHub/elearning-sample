import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-white px-6 text-center">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-zinc-900">
        Welcome to your lesson
      </h1>
      <p className="max-w-md text-lg text-zinc-600">
        Ready when you are. Click below to begin.
      </p>
      <Link
        href="/lesson"
        className="font-display rounded-full bg-zinc-900 px-8 py-3 text-lg font-medium text-white transition-colors hover:bg-zinc-700"
      >
        Start lesson
      </Link>
    </main>
  );
}
