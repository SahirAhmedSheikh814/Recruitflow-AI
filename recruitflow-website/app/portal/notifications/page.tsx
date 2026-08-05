export default function NotificationsPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="font-poppins text-xl font-bold text-zinc-900">Notifications</h2>
        <p className="mt-1 text-sm text-zinc-500">Stay updated on your application status.</p>
      </div>

      <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
        <p className="text-zinc-500">No notifications yet.</p>
        <p className="mt-2 text-xs text-zinc-400">
          You&apos;ll receive updates here when recruiters take action on your applications.
        </p>
      </div>
    </div>
  );
}
