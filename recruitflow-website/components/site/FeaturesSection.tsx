"use client";

import { motion } from "framer-motion";
import FeaturesGallery from "./FeaturesGallery";

/**
 * "Our Features" section wrapper (PRD §4). Poppins display heading with
 * "Features" in the brand primary color, Inter subheading, both fading/sliding
 * up on scroll-into-view. Wide container that breaks out of the narrow centered
 * width on desktop to give the gallery room, with small side gutters.
 */
const FeaturesSection = () => {
  return (
    <section id="features" className="pt-16 pb-4 md:pt-20 md:pb-6 lg:py-16">
      <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-10 xl:px-14 2xl:px-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-12 max-w-[640px] text-center lg:mb-16 lg:max-w-none"
        >
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-4 font-poppins text-3xl font-bold !leading-tight tracking-tight text-zinc-900 sm:text-4xl md:text-[45px]"
          >
            Our <span className="text-primary">Features</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-base !leading-relaxed text-zinc-600 md:text-xl lg:whitespace-nowrap lg:text-2xl"
          >
            Everything recruiters and job seekers need, all in one platform.
          </motion.p>
        </motion.div>

        <FeaturesGallery />
      </div>
    </section>
  );
};

export default FeaturesSection;
