"use client";

import { LockKeyhole } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    setIsSubmitting(false);
    if (!response.ok) {
      setError("That username or password did not work.");
      return;
    }

    const result = await response.json();
    router.replace(searchParams.get("from") || (result.role === "admin" ? "/admin" : "/"));
  }

  return (
    <LoginShell
      onSubmit={handleSubmit}
      username={username}
      setUsername={setUsername}
      password={password}
      setPassword={setPassword}
      error={error}
      isSubmitting={isSubmitting}
    />
  );
}

function LoginShell({
  onSubmit,
  username = "",
  setUsername,
  password = "",
  setPassword,
  error = "",
  isSubmitting = false
}: {
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  username?: string;
  setUsername?: (value: string) => void;
  password?: string;
  setPassword?: (value: string) => void;
  error?: string;
  isSubmitting?: boolean;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg border border-black/10 bg-white p-7 shadow-soft"
      >
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-md bg-ink text-white">
          <LockKeyhole size={21} />
        </div>
        <h1 className="text-2xl font-semibold text-ink">Investor access</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Sign in to view vehicle investment performance.
        </p>
        <label className="mt-6 block text-sm font-medium text-slate-700" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          value={username}
          onChange={(event) => setUsername?.(event.target.value)}
          className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-marina focus:ring-2 focus:ring-marina/15"
          autoComplete="username"
        />
        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword?.(event.target.value)}
          className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-marina focus:ring-2 focus:ring-marina/15"
          autoComplete="current-password"
        />
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={isSubmitting || !onSubmit}
          className="mt-6 h-11 w-full rounded-md bg-ink px-4 font-medium text-white transition hover:bg-marina disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Checking..." : "Open dashboard"}
        </button>
      </form>
    </main>
  );
}
