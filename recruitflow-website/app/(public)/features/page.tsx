import { FeaturesHero } from "@/components/site/FeaturesHero";
import { FeaturesOverview } from "@/components/site/FeaturesOverview";

export const metadata = {
  title: "Features · RecruitFlow AI",
  description:
    "From AI-powered resume screening to one-click applications, RecruitFlow AI brings recruiters and candidates together on a single, intelligent hiring platform.",
};

export default function FeaturesPage() {
  return (
    <div>
      <FeaturesHero />
      <FeaturesOverview />
    </div>
  );
}
