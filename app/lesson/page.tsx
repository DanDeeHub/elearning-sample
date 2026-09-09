import Link from "next/link";

export default function Lesson() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-white px-6 text-center">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-zinc-900">
        Lesson 1
      </h1>
      <p className="max-w-md text-lg text-zinc-600">Lesson content goes here.</p>
      <Link href="/" className="cursor-pointer text-sm font-medium text-zinc-500 hover:text-zinc-900">
        &larr; Back
      </Link>
    </main>
  );
}
