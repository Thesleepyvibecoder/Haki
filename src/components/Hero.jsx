import { motion } from "framer-motion";
import "./Hero.css";
import { FaWhatsapp, FaInstagram, FaPhoneAlt } from "react-icons/fa";


import { fadeIn, textVariant } from "../utils/motion";

const Hero = () => {
  return (
    <section className="hero-section">
      <div className="hero-copy-wrap">
        <div className="hero-accent" aria-hidden="true">
          <div className="hero-accent-dot" />
          <div className="hero-accent-line" />
        </div>

        <div className="hero-copy">
          <h1 className="hero-title">
            Welcome to{" "}
            <motion.span
              variants={textVariant(0.5)}
              initial="hidden"
              whileInView="show"
              viewport={{ once: false, amount: 0.25 }}
              className="hero-name"
            >
              Haki NFC
            </motion.span>
          </h1>

          <motion.p
            variants={fadeIn("", "", 0.1, 1)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: false, amount: 0.25 }}
            className="hero-subtitle"
          >
            Smart NFC solutions for businesses, brands
            <br className="hero-line-break" />
            <span className="hero-and">and</span> modern digital experiences.
          </motion.p>

          <motion.div
            variants={fadeIn("", "", 0.5, 1)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: false, amount: 0.25 }}
            className="hero-socials"
          >
            <a
              href="#contact"
              className="hero-social-link"
              aria-label="WhatsApp"
            >
              <FaWhatsapp />
            </a>

            <a
              href="#contact"
              className="hero-social-link"
              aria-label="Instagram"
            >
              <FaInstagram />
            </a>

            <a
              href="#contact"
              className="hero-social-link"
              aria-label="Phone"
            >
              <FaPhoneAlt />
            </a>
          </motion.div>
        </div>
      </div>
            <div className="hero-device" aria-hidden="true">
        <img src="/nfc-device.png" alt="" />
      </div>

      <div className="hero-scroll-indicator">
        <a href="#about">
          <div className="hero-scroll-shell">
            <motion.div
              animate={{
                y: [0, 24, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                repeatType: "loop",
              }}
              className="hero-scroll-dot"
            />
          </div>
        </a>
      </div>
    </section>
  );
};

export default Hero;
