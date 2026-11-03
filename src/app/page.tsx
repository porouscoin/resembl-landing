'use client';

import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import FuturisticHomeBackground from '@/components/FuturisticHomeBackground';

/* ═══════════════════════════════════════════════════════
   Feature data
═══════════════════════════════════════════════════════ */
const features = [
  {
    icon: '🔍',
    title: 'Find Similar Papers',
    description:
      'Search by keywords, upload PDFs, or paste ArXiv IDs to discover semantically related research using AI-powered embeddings.',
    link: '/search',
    color: '#0891b2',
    gradient: 'linear-gradient(135deg, #0891b2, #06b6d4)',
  },
  {
    icon: '📝',
    title: 'AI Paper Summaries',
    description:
      'Generate comprehensive section-by-section summaries of any research paper, streamed in real-time.',
    link: '/library',
    color: '#0d9488',
    gradient: 'linear-gradient(135deg, #0d9488, #10b981)',
  },
  {
    icon: '💬',
    title: 'Smart Paper Q&A',
    description:
      'Ask questions about any paper and get answers with source citations and inline PDF highlighting.',
    link: '/library',
    color: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  },
  {
    icon: '📈',
    title: 'Research Trends',
    description:
      'Visualize publication trends, track topic momentum, and forecast future research directions.',
    link: '/trends',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b, #f97316)',
  },
  {
    icon: '🕸️',
    title: 'Network Visualization',
    description:
      'Explore interactive force-directed graphs revealing how papers cluster by topic and similarity.',
    link: '/search',
    color: '#ec4899',
    gradient: 'linear-gradient(135deg, #ec4899, #f43f5e)',
  },
  {
    icon: '🏛️',
    title: 'Venue Analysis',
    description:
      'Discover top venues, topic specialization heatmaps, and detailed venue-level research patterns.',
    link: '/trends',
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
  },
];

/* ═══════════════════════════════════════════════════════
   Animation variants
═══════════════════════════════════════════════════════ */
const fadeInUp = {
  hidden: { opacity: 0, y: 50 },
  visible: { opacity: 1, y: 0 },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8, y: 30 },
  visible: { opacity: 1, scale: 1, y: 0 },
};

/* ═══════════════════════════════════════════════════════
   Animated stat counter
═══════════════════════════════════════════════════════ */
function AnimatedStat({ value, label, suffix = '' }: { value: number; label: string; suffix?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = Math.max(1, Math.floor(value / 40));
    const timer = setInterval(() => {
      start += step;
      if (start >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 30);
    return () => clearInterval(timer);
  }, [inView, value]);

  return (
    <motion.div
      ref={ref}
      className="stat-item"
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
    >
      <span className="stat-value">
        {count.toLocaleString()}{suffix}
      </span>
      <span className="stat-label">{label}</span>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   Feature card — dark glassmorphism
═══════════════════════════════════════════════════════ */
function FeatureCard({ feature, index }: { feature: (typeof features)[0]; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      ref={ref}
      className="landing-feature-card"
      variants={fadeInUp}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      transition={{ duration: 0.55, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -10, transition: { duration: 0.3, ease: 'easeOut' } }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        '--card-color': feature.color,
      } as React.CSSProperties}
    >
      <motion.div
        className="feature-card-glow"
        style={{ background: feature.gradient }}
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      />
      
      <div className="feature-icon-wrapper" style={{ background: feature.gradient }}>
        <span className="feature-icon">{feature.icon}</span>
      </div>
      <h3 className="feature-title">{feature.title}</h3>
      <p className="feature-description">{feature.description}</p>
      <Link href={feature.link} className="feature-cta">
        Get Started
        <motion.svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          animate={{ x: hovered ? 4 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <path d="M7 4l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
      </Link>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   Step card — connected timeline
═══════════════════════════════════════════════════════ */
function StepCard({
  number,
  title,
  description,
  icon,
  index,
  isLast,
}: {
  number: number;
  title: string;
  description: string;
  icon: string;
  index: number;
  isLast: boolean;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <motion.div
      ref={ref}
      className="landing-step-card"
      variants={scaleIn}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      transition={{ duration: 0.55, delay: index * 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="step-number-ring">
        <motion.div
          className="step-number"
          animate={inView ? { rotate: [0, 10, -10, 0] } : {}}
          transition={{ duration: 0.6, delay: index * 0.18 + 0.4 }}
        >
          {number}
        </motion.div>
      </div>
      {!isLast && <div className="step-connector" />}
      <div className="step-icon">{icon}</div>
      <h3 className="step-title">{title}</h3>
      <p className="step-description">{description}</p>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════
   Scrolling text marquee
═══════════════════════════════════════════════════════ */
function Marquee() {
  const words = ['Discover', 'Analyze', 'Summarize', 'Explore', 'Visualize', 'Research', 'Connect', 'Understand'];
  return (
    <div className="marquee-wrapper">
      <motion.div
        className="marquee-track"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
      >
        {[...words, ...words].map((w, i) => (
          <span key={i} className="marquee-word">
            {w} <span className="marquee-dot" />
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Landing Page
═══════════════════════════════════════════════════════ */
export default function LandingPage() {
  const heroRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.92]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 80]);

  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div className="landing">
      {/* ─── Full-page starfield background (fixed, persists while scrolling) ─── */}
      <div className="landing-starfield-bg">
        <FuturisticHomeBackground />
      </div>

      {/* ─── Navigation ─── */}
      <nav className={`landing-nav ${scrolled ? 'landing-nav-scrolled' : ''}`}>
        <div className="landing-nav-brand">
          <div className="navbar-logo">
            <Image src="/resembl.png" alt="resembl logo" width={48} height={48} className="navbar-logo-img" />
          </div>
          <span className="navbar-title">resembl</span>
        </div>
        <div className={`landing-nav-links ${mobileMenuOpen ? 'landing-nav-open' : ''}`}>
          <a href="#features" className="landing-nav-link" onClick={() => setMobileMenuOpen(false)}>Features</a>
          <a href="#how-it-works" className="landing-nav-link" onClick={() => setMobileMenuOpen(false)}>How it works</a>
          <Link href="/search?nav=open" className="btn-nav-futuristic" onClick={() => setMobileMenuOpen(false)}>
            Get Started
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7"/><path d="M7 7h10v10"/>
            </svg>
          </Link>
        </div>
        <button
          className="landing-hamburger"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`} />
          <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`} />
          <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`} />
        </button>
      </nav>

      {/* ─── Hero ─── */}
      <motion.section
        ref={heroRef}
        className="landing-hero"
        style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
      >
        {/* Hero content — centered */}
        <div className="landing-hero-content">
          <motion.h1
            className="hero-heading"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            Discover, Analyze &<br />
            <span className="hero-heading-accent">Understand Research</span>
          </motion.h1>

          <motion.p
            className="hero-subheading"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            Find similar papers, generate summaries, ask questions about any paper, and explore
            research trends — all in one intelligent platform.
          </motion.p>

          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <Link href="/search?nav=open" className="btn-hero-primary">
              <span>Get Started</span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M7 4l8 6-8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <a href="#features" className="btn-hero-secondary">
              Explore Features
            </a>
          </motion.div>

          {/* Stats strip */}
          <motion.div
            className="hero-stats"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <AnimatedStat value={50000} label="Papers Indexed" suffix="+" />
            <div className="stat-divider" />
            <AnimatedStat value={200} label="Research Topics" suffix="+" />
            <div className="stat-divider" />
            <AnimatedStat value={6} label="Analysis Tools" />
          </motion.div>
        </div>
      </motion.section>

      {/* ─── Marquee divider ─── */}
      <Marquee />

      {/* ─── Features ─── */}
      <section id="features" className="landing-features">
        <div className="landing-section-header">
          <motion.span
            className="section-tag"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            Features
          </motion.span>
          <motion.h2
            className="section-heading"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.05 }}
          >
            Everything you need to
            <br />
            <span className="hero-heading-accent">navigate research</span>
          </motion.h2>
          <motion.p
            className="section-subheading"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            From discovery to deep understanding — powerful tools designed for researchers.
          </motion.p>
        </div>

        <div className="features-grid">
          {features.map((f, i) => (
            <FeatureCard key={f.title} feature={f} index={i} />
          ))}
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="landing-how-it-works">
        <div className="landing-section-header">
          <motion.span
            className="section-tag"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            How it works
          </motion.span>
          <motion.h2
            className="section-heading"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.05 }}
          >
            Three steps to <span className="hero-heading-accent">insight</span>
          </motion.h2>
        </div>

        <div className="steps-grid">
          {[
            { n: 1, icon: '📄', title: 'Upload or Search', desc: 'Search by keywords, paste an ArXiv link, or drag-and-drop a PDF to begin your research journey.' },
            { n: 2, icon: '🤖', title: 'AI Analysis', desc: 'Our engine processes your paper, generates embeddings, and maps connections across the research landscape.' },
            { n: 3, icon: '🔭', title: 'Explore & Discover', desc: 'View similar papers, read AI summaries, ask questions, and visualize clusters and trends.' },
          ].map((s, i) => (
            <StepCard key={s.n} number={s.n} icon={s.icon} title={s.title} description={s.desc} index={i} isLast={i === 2} />
          ))}
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="landing-cta">
        <motion.div
          className="cta-content"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <div className="cta-glow" />
          <h2 className="cta-heading">Ready to explore the research landscape?</h2>
          <p className="cta-subheading">
            Start analyzing papers, discovering connections, and gaining insights in minutes.
          </p>
          <Link href="/search?nav=open" className="btn-hero-primary">
            <span>Start Analyzing Papers</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M7 4l8 6-8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </motion.div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="navbar-logo">
              <Image src="/resembl.png" alt="resembl logo" width={48} height={48} className="navbar-logo-img" />
            </div>
            <span className="navbar-title">resembl</span>
          </div>
          <p className="footer-copy">&copy; 2026 resembl. Research paper analysis platform.</p>
        </div>
      </footer>
    </div>
  );
}
