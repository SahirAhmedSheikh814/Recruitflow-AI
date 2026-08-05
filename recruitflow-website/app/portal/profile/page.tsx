"use client";

import { useEffect, useRef, useState } from "react";

import {
  getCurrentUser,
  uploadProfilePicture,
  updateProfileGender,
  ApiError,
  type CurrentUser,
} from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";

export default function ProfilePage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [savingGender, setSavingGender] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load profile."))
      .finally(() => setLoading(false));
  }, []);

  async function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const updated = await uploadProfilePicture(file);
      setUser(updated);
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleGender(gender: "male" | "female") {
    // Toggle off if the same option is clicked again.
    const next = user?.gender === gender ? "" : gender;
    setSavingGender(true);
    try {
      const updated = await updateProfileGender(next);
      setUser(updated);
    } catch {
      /* non-critical — leave the current value in place */
    } finally {
      setSavingGender(false);
    }
  }

  return (
    <div>
      <h1 className="font-poppins text-2xl font-bold text-zinc-900">My Profile</h1>
      <p className="mt-1 text-sm text-zinc-500">Your RecruitFlow AI account details.</p>

      <div className="mt-8 max-w-lg">
        {loading ? (
          <div className="py-16 text-center text-zinc-400">Loading…</div>
        ) : error ? (
          <div className="rounded-lg border border-rejected/30 bg-rejected/5 px-4 py-3 text-sm text-rejected">
            {error}
          </div>
        ) : user ? (
          <div className="flex flex-col gap-6">
            {/* Profile picture */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h2 className="font-poppins text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Profile picture
              </h2>
              <div className="mt-4 flex items-center gap-5">
                <Avatar
                  src={user.picture_url}
                  name={user.full_name}
                  gender={user.gender}
                  size={80}
                  className="ring-2 ring-primary/10"
                />
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handlePickFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium font-poppins text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
                  >
                    {uploading ? "Uploading…" : user.picture_url ? "Change picture" : "Upload picture"}
                  </button>
                  <p className="text-xs text-zinc-400">JPG, PNG, WEBP or GIF, up to 5&nbsp;MB.</p>
                </div>
              </div>
              {uploadError && (
                <p className="mt-3 text-sm text-rejected">{uploadError}</p>
              )}
            </div>

            {/* Default avatar / gender — only relevant when no photo is set */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h2 className="font-poppins text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Default avatar
              </h2>
              <p className="mt-1 text-xs text-zinc-400">
                Used when you haven&apos;t set a picture. Choose the silhouette you prefer.
              </p>
              <div className="mt-4 flex gap-3">
                {(["male", "female"] as const).map((g) => {
                  const selected = user.gender === g;
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => handleGender(g)}
                      disabled={savingGender}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium capitalize transition-colors disabled:opacity-60 ${
                        selected
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                      }`}
                    >
                      <Avatar name={user.full_name} gender={g} size={32} />
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Account details */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <dl className="flex flex-col divide-y divide-zinc-100">
                <div className="flex items-center justify-between py-3">
                  <dt className="text-sm text-zinc-500">Full name</dt>
                  <dd className="text-sm font-medium text-zinc-900">{user.full_name}</dd>
                </div>
                <div className="flex items-center justify-between py-3">
                  <dt className="text-sm text-zinc-500">Email</dt>
                  <dd className="text-sm font-medium text-zinc-900">{user.email}</dd>
                </div>
                <div className="flex items-center justify-between py-3">
                  <dt className="text-sm text-zinc-500">Account type</dt>
                  <dd>
                    <Badge tone="primary">{user.role}</Badge>
                  </dd>
                </div>
              </dl>
              <p className="mt-6 text-xs text-zinc-400">
                Profile editing (resume, contact details) will be available soon. For now, your most
                recent application submission keeps your details up to date.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
