import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PipelineIcon, JobsIcon, InterviewsIcon, SettingsIcon, LogOutIcon } from "@/components/dashboard/NavIcons";

export default function RecruiterLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell
      title="Recruiter Dashboard"
      links={[
        { href: "/recruiter", label: "Pipeline", icon: <PipelineIcon /> },
        { href: "/recruiter/jobs", label: "Jobs", icon: <JobsIcon /> },
        { href: "/recruiter/interviews", label: "Interviews", icon: <InterviewsIcon /> },
        { href: "/recruiter/settings", label: "Settings", icon: <SettingsIcon /> },
        { href: "", label: "Logout", icon: <LogOutIcon />, action: "logout" },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
