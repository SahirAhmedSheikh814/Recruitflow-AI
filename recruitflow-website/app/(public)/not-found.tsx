import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-32 text-center">
      <p className="font-poppins text-5xl font-bold text-primary">404</p>
      <h1 className="mt-4 font-poppins text-xl font-semibold text-zinc-900">
        This role isn&apos;t available
      </h1>
      <p className="mt-2 text-zinc-500">
        The position you&apos;re looking for may have closed or been filled.
      </p>
      <Link
        href="/jobs"
        className="mt-8 inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-medium font-poppins text-white hover:bg-primary/90"
      >
        View open roles
      </Link>
    </div>
  );
}
