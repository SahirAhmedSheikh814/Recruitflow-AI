import { AboutSection } from "@/components/site/AboutSection";
import { ABOUT_SECTIONS } from "@/components/site/aboutData";

export const metadata = {
  title: "About · RecruitFlow AI",
};

export default function AboutPage() {
  return (
    <div>
      {ABOUT_SECTIONS.map((section, i) => (
        <AboutSection
          key={section.id}
          data={section}
          showTopGlow={i === 0}
        />
      ))}
    </div>
  );
}
