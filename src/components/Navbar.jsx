import React, { useEffect, useState } from "react";
import "./Navbar.css";
import { Link } from "react-router-dom";
import {
  FaUser,
  FaBriefcase,
  FaFolderOpen,
  FaEnvelope,
  FaLightbulb,
} from "react-icons/fa";
import { motion } from "framer-motion";

import { navLinks } from "../constants";
import { logo, menu, close } from "../assets";
import { fadeIn } from "../utils/motion";

const Navbar = () => {
  const [active, setActive] = useState("");
  const [toggle, setToggle] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;

      if (scrollTop > 100) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }

      const firstLink = navLinks[0];

      if (firstLink) {
        const element = document.getElementById(firstLink.id);

        if (element && element.parentElement) {
          const sectionTop = element.parentElement.offsetTop;

          if (scrollTop < sectionTop - 100) {
            setActive("");
            return;
          }
        }
      }

      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 50
      ) {
        const lastLink = navLinks[navLinks.length - 1];

        if (lastLink) {
          setActive(lastLink.title);
        }

        return;
      }

      for (const nav of navLinks) {
        const element = document.getElementById(nav.id);

        if (element) {
          const section = element.parentElement;

          if (section) {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;

            if (
              scrollTop >= sectionTop - 100 &&
              scrollTop < sectionTop + sectionHeight - 100
            ) {
              setActive(nav.title);
              break;
            }
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const getNavIcon = (title) => {
    switch (title) {
      case "About":
        return FaUser;

      case "How It Works":
        return FaBriefcase;

      case "Solutions":
        return FaLightbulb;

      case "Products":
        return FaFolderOpen;

      case "Contact":
        return FaEnvelope;

      default:
        return FaUser;
    }
  };

  return (
    <motion.nav
      variants={fadeIn("down", "spring", 0.2, 1)}
      initial="hidden"
      animate="show"
      className={`site-navbar ${
        scrolled ? "site-navbar--scrolled" : ""
      }`}
    >
      <div className="navbar-inner">
        <Link
          to="/"
          className="navbar-brand"
          onClick={() => {
            setActive("");
            window.scrollTo(0, 0);
          }}
        >
          <img src={logo} alt="Haki logo" className="navbar-logo" />

          <p className="navbar-name">
            Haki
          </p>
        </Link>

        <ul className="desktop-nav">
          {navLinks.map((nav) => {
            const IconComponent = getNavIcon(nav.title);

            return (
              <li
                key={nav.id}
                className={`desktop-nav-item ${
                  active === nav.title ? "is-active" : ""
                }`}
                onClick={() => setActive(nav.title)}
              >
                <a href={`#${nav.id}`} className="desktop-nav-link">
                  <IconComponent className="nav-link-icon" />
                  {nav.title}
                </a>
              </li>
            );
          })}
        </ul>

        <div className="mobile-nav">
          <button
            type="button"
            className="mobile-menu-button"
            aria-label={
              toggle ? "Close navigation menu" : "Open navigation menu"
            }
            aria-expanded={toggle}
            onClick={() => setToggle(!toggle)}
          >
            <img
              src={toggle ? close : menu}
              alt=""
              className="mobile-menu-icon"
            />
          </button>

          <div
            className={`mobile-menu-panel ${
              toggle ? "is-open" : ""
            }`}
          >
            <ul className="mobile-nav-list">
              {navLinks.map((nav) => {
                const IconComponent = getNavIcon(nav.title);

                return (
                  <li
                    key={nav.id}
                    className={`mobile-nav-item ${
                      active === nav.title ? "is-active" : ""
                    }`}
                    onClick={() => {
                      setToggle(false);
                      setActive(nav.title);
                    }}
                  >
                    <a
                      href={`#${nav.id}`}
                      className="mobile-nav-link"
                    >
                      <IconComponent className="nav-link-icon" />
                      {nav.title}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
