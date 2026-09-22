import React from "react";
import "./About.css";
import { motion } from "framer-motion";

import { styles } from "../styles";
import { SectionWrapper } from "../hoc";
import { fadeIn, textVariant } from "../utils/motion";

const About = () => {
  return (
    <>
      <motion.div variants={textVariant()}>
        <p
          className={`${styles.sectionSubText} font-["Playfair_Display"] italic tracking-wider text-secondary text-[18px]`}
        >
          About Haki NFC
        </p>

        <h2
          className={`${styles.sectionHeadText} font-["Oswald"] font-bold uppercase tracking-wider`}
        >
          Smart Connections.
        </h2>
      </motion.div>

      <div className="mt-10 flex flex-col gap-10">
        <motion.div
          variants={fadeIn("", "", 0.1, 1)}
          className="max-w-4xl"
        >
          <p className='text-secondary text-[18px] leading-[32px] font-["Inter"] font-normal'>
            Haki NFC creates smart, tap-to-connect solutions designed for
            modern businesses. We bring NFC technology into everyday
            interactions, making it easier for businesses to connect with
            their customers in a simple, seamless, and memorable way.
          </p>
        </motion.div>

        <div className="about-products">

  {/* Product 01 */}
  <motion.div
    variants={fadeIn("right", "spring", 0.2, 0.75)}
    className="about-product"
  >
    <div className="about-product-number">01</div>

    <div className="about-product-content">
      <span className="about-product-label">
        GOOGLE REVIEW
      </span>

      <h3>
        NFC Review Stand
      </h3>

      <p>
        Turn a simple tap into a Google review. Our NFC-enabled
        review stand gives customers an effortless way to connect
        with your business and share their experience.
      </p>

      <div className="about-product-flow">
        <span>Tap</span>
        <span>→</span>
        <span>Review</span>
        <span>→</span>
        <span>Grow</span>
      </div>
    </div>
  </motion.div>

  {/* Product 02 */}
  <motion.div
    variants={fadeIn("left", "spring", 0.4, 0.75)}
    className="about-product"
  >
    <div className="about-product-number">02</div>

    <div className="about-product-content">
      <span className="about-product-label">
        DIGITAL IDENTITY
      </span>

      <h3>
        NFC Business Card
      </h3>

      <p>
        A premium business card with NFC technology that instantly
        shares contact details, websites, social profiles, or
        whatever your business needs to put in front of a customer.
      </p>

      <div className="about-product-flow">
        <span>Tap</span>
        <span>→</span>
        <span>Connect</span>
        <span>→</span>
        <span>Share</span>
      </div>
    </div>
  </motion.div>

</div>
      </div>
    </>
  );
};

export default SectionWrapper(About, "about");
