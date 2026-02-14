"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function tokenKey(roomName: string) {
  return `lk_token_${roomName}`;
}
function creatorKey(roomName: string) {
  return `lk_creator_${roomName}`;
}

export default function Home() {
  const router = useRouter();
  const [createName, setCreateName] = useState("");
  const [joinRoomName, setJoinRoomName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [joinError, setJoinError] = useState("");

  async function handleCreate() {
    const name = createName.trim();
    if (!name) {
      setCreateError("Enter your name");
      return;
    }
    setCreateError("");
    setCreateLoading(true);
    try {
      const res = await fetch("/api/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? "Failed to create room");
        return;
      }
      sessionStorage.setItem(tokenKey(data.roomName), data.token);
      if (data.creatorIdentity != null) {
        sessionStorage.setItem(creatorKey(data.roomName), JSON.stringify({
          identity: data.creatorIdentity,
          name: data.creatorName ?? data.creatorIdentity,
        }));
      }
      router.push(`/room/${data.roomName}`);
    } catch {
      setCreateError("Something went wrong");
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleJoin() {
    const roomName = joinRoomName.trim();
    const name = joinName.trim();
    if (!roomName || !name) {
      setJoinError("Enter room name and your name");
      return;
    }
    setJoinError("");
    setJoinLoading(true);
    try {
      const res = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error ?? "Failed to join");
        return;
      }
      sessionStorage.setItem(tokenKey(roomName), data.token);
      router.push(`/room/${roomName}`);
    } catch {
      setJoinError("Something went wrong");
    } finally {
      setJoinLoading(false);
    }
  }

  return (
<<<<<<< HEAD
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 font-sans dark:bg-zinc-950">
      <main className="w-full max-w-md space-y-10">
        <h1 className="text-center text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Audio room
        </h1>

        <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200">
            Create room
          </h2>
          <input
            type="text"
            placeholder="Your name"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
          />
          {createError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {createError}
            </p>
          )}
          <button
            type="button"
            onClick={handleCreate}
            disabled={createLoading}
            className="w-full rounded-lg bg-zinc-900 py-2.5 font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
=======
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            To get started, edit the page.tsx file.
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Looking for a starting point or more instructions? Head over to{" "}
            <a
              href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Templates
            </a>{" "}
            or the{" "}
            <a
              href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Learning
            </a>{" "}
            center.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="/test-translation"
          >
            Test translation pipeline
          </a>
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
>>>>>>> 42da645 (stt-llm-tss pipeline setup)
          >
            {createLoading ? "Creating…" : "Create room"}
          </button>
        </section>

        <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-medium text-zinc-800 dark:text-zinc-200">
            Join a room
          </h2>
          <input
            type="text"
            placeholder="Room name"
            value={joinRoomName}
            onChange={(e) => setJoinRoomName(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
          />
          <input
            type="text"
            placeholder="Your name"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
          />
          {joinError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {joinError}
            </p>
          )}
          <button
            type="button"
            onClick={handleJoin}
            disabled={joinLoading}
            className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            {joinLoading ? "Joining…" : "Join"}
          </button>
        </section>
      </main>
    </div>
  );
}
