import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardIcon, UsersIcon, JobsIcon, CandidatesIcon, FileTextIcon, LogOutIcon } from "@/components/dashboard/NavIcons";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell
      title="Admin Dashboard"
      links={[
        { href: "/admin", label: "Overview", icon: <DashboardIcon /> },
        { href: "/admin/recruiters", label: "Recruiters", icon: <UsersIcon /> },
        { href: "/admin/jobs", label: "Jobs", icon: <JobsIcon /> },
        { href: "/admin/candidates", label: "Candidates", icon: <CandidatesIcon /> },
        { href: "/admin/agent-log", label: "Agent log", icon: <FileTextIcon /> },
        { href: "", label: "Sign out", icon: <LogOutIcon />, action: "logout" },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
