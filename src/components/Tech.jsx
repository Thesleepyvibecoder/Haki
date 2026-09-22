import React from "react";
import './Tech.css';
import { motion } from "framer-motion";

import { FaLaptopCode } from "react-icons/fa";

import { SectionWrapper } from "../hoc";
import { technologies } from "../constants";
import { styles } from "../styles";
import { fadeIn, textVariant } from "../utils/motion";



const Tech = () => {
  return (
    <>
      <motion.div variants={textVariant()} className='tech-heading'>
        <p className={styles.sectionSubText}>What Haki NFC brings to your business</p>
<h2 className={styles.sectionHeadText}>Smart Business Solutions. <FaLaptopCode className="tech-heading-icon" /></h2>
      </motion.div>

      <div className='tech-intro'>
        <motion.p
          variants={fadeIn("", "", 0.1, 1)}
          className='tech-description'
        >
          We combine NFC technology with smart digital tools to help businesses connect with customers, share information instantly, and build stronger digital presence.
        </motion.p>

        
      </div>

      <div className='tech-grid'>
        {technologies.map((technology, index) => (
          <motion.div
            className='tech-card'
            key={technology.name}
            variants={fadeIn("up", "spring", 0.08 * index, 0.75)}
          >
            <div className='tech-icon-wrap'>
              <img
                src={technology.icon}
                alt={`${technology.name} logo`}
                className='tech-icon'
                loading='lazy'
              />
            </div>
            <h3 className='tech-name'>{technology.name}</h3>
            
          </motion.div>
        ))}
      </div>
    </>
  );
};

export default SectionWrapper(Tech, "skills");
