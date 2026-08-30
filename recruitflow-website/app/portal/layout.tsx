import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardIcon, ProfileIcon, PipelineIcon, InterviewsIcon, JobsIcon, NotificationsIcon, SettingsIcon } from "@/components/dashboard/NavIcons";
import { RivaWidget } from "@/components/riva/RivaWidget";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell
      title="Candidate Dashboard"
      links={[
        { href: "/portal", label: "Dashboard", icon: <DashboardIcon /> },
        { href: "/portal/profile", label: "Profile", icon: <ProfileIcon /> },
        { href: "/portal/applications", label: "My Applications", icon: <PipelineIcon /> },
        { href: "/portal/interviews", label: "Interviews", icon: <InterviewsIcon /> },
        { href: "/portal/jobs", label: "Jobs", icon: <JobsIcon /> },
        { href: "/portal/notifications", label: "Notifications", icon: <NotificationsIcon /> },
        { href: "/portal/settings", label: "Settings", icon: <SettingsIcon /> },
      ]}
    >
      {children}
      <RivaWidget />
    </DashboardShell>
  );
}
