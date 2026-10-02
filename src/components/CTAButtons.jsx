import React, { useState, useEffect } from "react";
import './CTAButtons.css';
import { motion, AnimatePresence } from "framer-motion";
import { FaDownload, FaRocket } from "react-icons/fa";

const CTAButtons = () => {
    const [isVisible, setIsVisible] = useState(true);
    useEffect(() => {
        const handleScroll = () => setIsVisible(window.scrollY <= 400);
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);
    const handleViewWork = () => {
        const projectsSection = document.getElementById("projects");
        if (projectsSection) projectsSection.scrollIntoView({ behavior: "smooth" });
    };
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div className="cta-wrapper" initial={{ opacity: 0, y: -20, x: 20 }} animate={{ opacity: 1, y: 0, x: 0 }} exit={{ opacity: 0, y: -20, x: 20 }} transition={{ duration: 0.4, ease: "easeOut" }}>
                    <motion.button onClick={handleViewWork} className="cta-primary" whileHover={{ y: -2, scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2 }} aria-label="Explore Haki">
                        <div className="cta-primary-bg" aria-hidden="true" />
                        <div className="cta-primary-content"><FaRocket className="cta-icon-rocket" aria-hidden="true" /><span>Explore Haki</span></div>
                        <div className="cta-primary-ring" aria-hidden="true" />
                    </motion.button>
                    <motion.a href="/haki-project-brief.pdf" download className="cta-secondary" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2 }} aria-label="Download Project Brief">
                        <FaDownload className="cta-icon-download" aria-hidden="true" />
                        <span>Download Project Brief</span>
                    </motion.a>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
export default CTAButtons;
