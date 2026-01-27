import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState, useRef } from 'react';
import {
  ArrowRight,
  Github,
  Globe,
  Lock,
  Upload,
  TrendingUp,
  RefreshCw,
  FileText,
  PieChart,
  MessageCircle,
  Server,
  Eye,
  Scale,
  Sparkles,
  Shield,
  Check,
  Users,
  ChevronDown,
} from 'lucide-react';
import { useLatestRelease, getDownloadUrl } from '@/hooks/use-latest-release';
import { motion, useInView } from 'motion/react';
import { cn } from '@/lib/utils';
import { Marquee } from '@/components/ui/marquee';
import { ShineBorder } from '@/components/ui/shine-border';
import { Highlighter } from '@/components/ui/highlighter';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

// Animation variants for reuse
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

// Smooth easing
const smoothEase = [0.25, 0.4, 0.25, 1];

export const Route = createFileRoute('/')({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: 'Moneywright - Private, AI-Powered Personal Finance' },
      {
        name: 'description',
        content:
          'Privacy-first personal finance manager. Upload any bank statement, track expenses and investments, get AI-powered insights. Self-hostable and open source.',
      },
    ],
  }),
});

type Platform = 'macos' | 'windows' | 'linux';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'macos';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('win')) return 'windows';
  return 'linux';
}

const platformInfo: Record<Platform, { label: string; icon: string }> = {
  macos: { label: 'macOS', icon: '/icons/apple.svg' },
  windows: { label: 'Windows', icon: '/icons/windows.svg' },
  linux: { label: 'Linux', icon: '/icons/linux.svg' },
};

// Bank and broker logos
const institutions = [
  { name: 'HDFC Bank', logo: '/institutions/hdfc.svg' },
  { name: 'ICICI Bank', logo: '/institutions/icici.svg' },
  { name: 'SBI', logo: '/institutions/sbi.svg' },
  { name: 'Axis Bank', logo: '/institutions/axis.svg' },
  { name: 'Kotak', logo: '/institutions/kotak.svg' },
  { name: 'HSBC', logo: '/institutions/hsbc.svg' },
  { name: 'Amex', logo: '/institutions/amex.svg' },
  { name: 'Zerodha', logo: '/institutions/zerodha.svg' },
  { name: 'Groww', logo: '/institutions/groww.svg' },
  { name: 'Vested', logo: '/institutions/vested.svg' },
];

function LandingPage() {
  const [platform, setPlatform] = useState<Platform>('macos');
  const [showMacDropdown, setShowMacDropdown] = useState(false);
  const macDropdownRef = useRef<HTMLDivElement>(null);
  const { data: downloads } = useLatestRelease();

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (macDropdownRef.current && !macDropdownRef.current.contains(event.target as Node)) {
        setShowMacDropdown(false);
      }
    }
    if (showMacDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMacDropdown]);

  // Get platform-specific download URL
  const downloadUrl = downloads ? getDownloadUrl(downloads, platform) : 'https://github.com/moneywright/moneywright/releases';
  const releasesUrl = downloads?.releasesUrl || 'https://github.com/moneywright/moneywright/releases';

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#f5f5f7] overflow-x-hidden landing-noise">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-8 py-5 flex justify-between items-center bg-gradient-to-b from-[#0a0a0c] to-transparent backdrop-blur-xl">
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img src="/logo.png" alt="Moneywright" className="w-9 h-9 rounded-lg" />
          <span className="font-display font-semibold text-lg">Moneywright</span>
        </Link>
        <div className="flex gap-8 items-center">
          <Link
            to="/docs/$"
            params={{ _splat: '' }}
            className="hidden sm:block text-[#a1a1aa] hover:text-[#f5f5f7] text-sm font-medium transition-colors"
          >
            Docs
          </Link>
          <a
            href="https://github.com/moneywright/moneywright"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:block text-[#a1a1aa] hover:text-[#f5f5f7] text-sm font-medium transition-colors"
          >
            GitHub
          </a>
          <a
            href={releasesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#f5f5f7] text-[#0a0a0c] px-5 py-2.5 rounded-lg font-semibold text-sm hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(255,255,255,0.2)] transition-all"
          >
            Download
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col justify-center items-center text-center px-5 sm:px-8 pt-20 sm:pt-24 pb-12 overflow-hidden">
        {/* Animated gradient orbs - 4 colors (smaller/dimmer on mobile) */}
        <div className="absolute w-[300px] sm:w-[700px] h-[300px] sm:h-[700px] rounded-full blur-[60px] sm:blur-[100px] opacity-40 sm:opacity-50 animate-float bg-[radial-gradient(circle,#10b981_0%,transparent_70%)] -top-[150px] sm:-top-[250px] -left-[150px] sm:-left-[250px]" />
        <div className="absolute w-[250px] sm:w-[550px] h-[250px] sm:h-[550px] rounded-full blur-[50px] sm:blur-[90px] opacity-40 sm:opacity-50 animate-float-delayed bg-[radial-gradient(circle,#f97316_0%,transparent_70%)] -bottom-[100px] sm:-bottom-[200px] -right-[100px] sm:-right-[200px]" />
        <div className="absolute hidden sm:block w-[350px] h-[350px] rounded-full blur-[80px] animate-float-delayed-2 bg-[radial-gradient(circle,#a855f7_0%,transparent_70%)] top-[20%] right-[5%]" />
        <div className="absolute hidden sm:block w-[400px] h-[400px] rounded-full blur-[80px] animate-float-delayed-3 bg-[radial-gradient(circle,#3b82f6_0%,transparent_70%)] bottom-[15%] left-[2%]" />

        <div className="relative z-10 max-w-[900px] w-full">
          {/* Badges */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-6 sm:mb-8 animate-fade-in-up flex-wrap">
            <span className="inline-flex items-center gap-1.5 bg-[#a855f7]/10 border border-[#a855f7]/20 px-3 py-1.5 rounded-full text-xs text-[#a855f7] font-medium">
              <Sparkles className="w-3 h-3" />
              AI-powered
            </span>
            <span className="relative group inline-flex items-center gap-1.5 bg-[#f97316]/10 border border-[#f97316]/20 px-3 py-1.5 rounded-full text-xs text-[#f97316] font-medium cursor-help">
              <Lock className="w-3 h-3" />
              BYOK
              {/* Tooltip */}
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#18181c] border border-white/10 rounded-lg text-xs text-[#f5f5f7] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                Bring Your Own API Keys
                <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#18181c]" />
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-[#3b82f6]/10 border border-[#3b82f6]/20 px-3 py-1.5 rounded-full text-xs text-[#3b82f6] font-medium">
              <Github className="w-3 h-3" />
              Open source
            </span>
          </div>

          {/* Title */}
          <h1 className="text-[clamp(2.5rem,9vw,4.5rem)] font-semibold leading-[1.1] tracking-tighter mb-4 sm:mb-6 px-2 animate-fade-in-up-1">
            Stop wondering where
            <br />
            your money <Highlighter action="highlight" color="#10b981" strokeWidth={3} isView delay={1000}>goes</Highlighter>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-lg text-[#a1a1aa] max-w-[580px] mx-auto mb-8 sm:mb-10 font-normal px-2 animate-fade-in-up-2 leading-relaxed">
            Drop all your bank and card statements. See exactly where your money went,
            find subscriptions you forgot about, and chat with AI about your finances. Free forever.
          </p>

          {/* CTA Buttons */}
          <div className="flex gap-2.5 sm:gap-3 justify-center flex-wrap px-2 animate-fade-in-up-3">
            {platform === 'macos' ? (
              <div className="relative" ref={macDropdownRef}>
                <button
                  onClick={() => setShowMacDropdown(!showMacDropdown)}
                  className="relative inline-flex items-center gap-2 bg-gradient-to-br from-[#10b981] to-[#059669] text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(16,185,129,0.3)] transition-all shadow-[0_4px_20px_rgba(16,185,129,0.15)] overflow-hidden"
                >
                  <ShineBorder shineColor={['#10b981', '#14b8a6', '#06b6d4']} borderWidth={2} />
                  <img src={platformInfo[platform].icon} alt="" className="w-4 h-4 invert" />
                  Download for {platformInfo[platform].label}
                  <ChevronDown className={cn('w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform', showMacDropdown && 'rotate-180')} />
                </button>
                {showMacDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#18181c] border border-white/10 rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.4)] z-50">
                    <a
                      href={downloads?.macos || releasesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5"
                      onClick={() => setShowMacDropdown(false)}
                    >
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium text-[#f5f5f7]">Apple Silicon</div>
                        <div className="text-xs text-[#71717a]">M1, M2, M3, M4 Macs</div>
                      </div>
                    </a>
                    <a
                      href={downloads?.macosIntel || releasesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                      onClick={() => setShowMacDropdown(false)}
                    >
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium text-[#f5f5f7]">Intel</div>
                        <div className="text-xs text-[#71717a]">Older Macs (pre-2020)</div>
                      </div>
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="relative inline-flex items-center gap-2 bg-gradient-to-br from-[#10b981] to-[#059669] text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(16,185,129,0.3)] transition-all shadow-[0_4px_20px_rgba(16,185,129,0.15)] overflow-hidden"
              >
                <ShineBorder shineColor={['#10b981', '#14b8a6', '#06b6d4']} borderWidth={2} />
                <img src={platformInfo[platform].icon} alt="" className="w-4 h-4 invert" />
                Download for {platformInfo[platform].label}
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </a>
            )}
            <a
              href="https://github.com/moneywright/moneywright"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#18181c] border border-white/10 text-[#f5f5f7] px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm hover:bg-[#111115] hover:border-white/20 transition-all"
            >
              <Github className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Star on GitHub
            </a>
          </div>

          {/* Other platforms */}
          <div className="mt-4 flex items-center justify-center gap-4 text-[10px] sm:text-xs text-[#71717a] animate-fade-in-up-4">
            <span>Also available for</span>
            {(['macos', 'windows', 'linux'] as Platform[])
              .filter((p) => p !== platform)
              .map((p) => (
                <a
                  key={p}
                  href={downloads ? getDownloadUrl(downloads, p) : releasesUrl}
                  className="inline-flex items-center gap-1.5 text-[#a1a1aa] hover:text-[#f5f5f7] transition-colors"
                >
                  <img src={platformInfo[p].icon} alt="" className="w-3.5 h-3.5 opacity-70 invert" />
                  {platformInfo[p].label}
                </a>
              ))}
          </div>
        </div>
      </section>

      {/* Stats Marquee */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
        variants={fadeIn}
        transition={{ duration: 0.6, ease: smoothEase }}
        className="py-8 border-y border-white/5 bg-[#0a0a0c]/50 relative overflow-hidden"
      >
        <Marquee pauseOnHover className="[--duration:40s]">
          <StatCard stat="₹4,299/mo" label="hidden subscriptions found on average" />
          <StatCard stat="0" label="accounts or signups needed" />
          <StatCard stat="500+" label="banks supported worldwide" />
          <StatCard stat="$0" label="cost forever — fully open source" />
          <StatCard stat="30 sec" label="to import your first statement" />
        </Marquee>
      </motion.section>

      {/* Supported Institutions */}
      <section className="py-12 px-4 sm:px-8 bg-[#0a0a0c]">
        <div className="max-w-5xl mx-auto text-center">
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            transition={{ duration: 0.5, ease: smoothEase }}
            className="text-[#71717a] text-sm mb-8"
          >
            Works with banks and brokers you already use
          </motion.p>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="flex flex-wrap justify-center items-center gap-8 sm:gap-12"
          >
            {institutions.map((inst, index) => (
              <motion.img
                key={inst.name}
                variants={fadeInUp}
                transition={{ duration: 0.4, ease: smoothEase, delay: index * 0.05 }}
                src={inst.logo}
                alt={inst.name}
                className="h-8 sm:h-10 opacity-50 hover:opacity-80 transition-opacity grayscale hover:grayscale-0"
              />
            ))}
          </motion.div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-24 px-4 sm:px-8 bg-gradient-to-b from-[#0a0a0c] to-[#111115] relative">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <motion.span
              variants={fadeInUp}
              transition={{ duration: 0.5, ease: smoothEase }}
              className="inline-block text-xs font-semibold uppercase tracking-wider text-[#f97316] mb-4"
            >
              The Problem
            </motion.span>
            <motion.h2
              variants={fadeInUp}
              transition={{ duration: 0.5, ease: smoothEase, delay: 0.1 }}
              className="text-[clamp(1.75rem,4vw,2.75rem)] font-semibold tracking-tighter mb-6"
            >
              Your financial data is <Highlighter action="highlight" color="#ef4444" strokeWidth={3} isView delay={700}>everywhere</Highlighter>
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              transition={{ duration: 0.5, ease: smoothEase, delay: 0.2 }}
              className="text-[#a1a1aa] text-base sm:text-lg max-w-2xl mx-auto leading-relaxed"
            >
              Juggling multiple bank apps, maintaining outdated spreadsheets, trusting finance tools
              that profit from your data. There's a better way.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="grid md:grid-cols-3 gap-4"
          >
            <motion.div variants={scaleIn} transition={{ duration: 0.5, ease: smoothEase }} className="h-full">
              <BentoCard
                icon={<Globe className="w-6 h-6 text-[#ef4444]" />}
                iconBg="bg-[rgba(239,68,68,0.15)]"
                title="Scattered across apps"
                description="Different bank apps, credit cards, investments — no single view of your finances."
              />
            </motion.div>
            <motion.div variants={scaleIn} transition={{ duration: 0.5, ease: smoothEase }} className="h-full">
              <BentoCard
                icon={<FileText className="w-6 h-6 text-[#f97316]" />}
                iconBg="bg-[rgba(249,115,22,0.15)]"
                title="Manual spreadsheets"
                description="Tedious data entry that's always out of date. Who has time for that?"
              />
            </motion.div>
            <motion.div variants={scaleIn} transition={{ duration: 0.5, ease: smoothEase }} className="h-full">
              <BentoCard
                icon={<Eye className="w-6 h-6 text-[#a855f7]" />}
                iconBg="bg-[rgba(168,85,247,0.15)]"
                title="Privacy concerns"
                description="Most finance apps monetize your data. You're the product, not the customer."
              />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Solution / Features Section */}
      <section className="py-24 px-4 sm:px-8 bg-[#111115] relative">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <motion.span
              variants={fadeInUp}
              transition={{ duration: 0.5, ease: smoothEase }}
              className="inline-block text-xs font-semibold uppercase tracking-wider text-[#10b981] mb-4"
            >
              The Solution
            </motion.span>
            <motion.h2
              variants={fadeInUp}
              transition={{ duration: 0.5, ease: smoothEase, delay: 0.1 }}
              className="text-[clamp(1.75rem,4vw,2.75rem)] font-semibold tracking-tighter"
            >
              One app. Complete <Highlighter action="highlight" color="#06b6d4" strokeWidth={3} isView delay={700}>clarity</Highlighter>
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {/* Large card - Statement Parsing */}
            <motion.div
              variants={scaleIn}
              transition={{ duration: 0.6, ease: smoothEase }}
              className="lg:col-span-2 group relative flex flex-col overflow-hidden rounded-2xl bg-[#18181c] border border-white/5 p-6 sm:p-8 hover:border-white/10 transition-all"
            >
              <div className="absolute top-0 right-0 w-[250px] h-[250px] rounded-full blur-[80px] bg-[radial-gradient(circle,#10b981_0%,transparent_70%)] opacity-20" />
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-[rgba(16,185,129,0.15)] flex items-center justify-center mb-5">
                  <Upload className="w-6 h-6 text-[#10b981]" />
                </div>
                <h3 className="text-xl sm:text-2xl font-semibold mb-3">
                  Upload <span className="text-[#10b981]">any</span> statement
                </h3>
                <p className="text-[#a1a1aa] text-sm sm:text-base leading-relaxed mb-6">
                  PDF, CSV, Excel — from any bank in the world. Our AI extracts every transaction,
                  categorizes it automatically, and builds your complete financial picture.
                </p>
                <div className="flex flex-wrap gap-2">
                  {institutions.slice(0, 6).map((inst) => (
                    <img key={inst.name} src={inst.logo} alt={inst.name} className="h-6 opacity-60" />
                  ))}
                  <span className="px-2 py-1 text-xs text-[#71717a]">+500 more</span>
                </div>
              </div>
            </motion.div>

            {/* Subscription Detection */}
            <motion.div variants={scaleIn} transition={{ duration: 0.5, ease: smoothEase }} className="h-full">
              <BentoCard
                icon={<RefreshCw className="w-6 h-6 text-[#f97316]" />}
                iconBg="bg-[rgba(249,115,22,0.15)]"
                title="Find hidden subscriptions"
                description="Discover recurring charges you forgot about. The average user finds ₹4,299/month in subscriptions they don't use."
              />
            </motion.div>

            {/* AI Assistant */}
            <motion.div variants={scaleIn} transition={{ duration: 0.5, ease: smoothEase }} className="h-full">
              <BentoCard
                icon={<MessageCircle className="w-6 h-6 text-[#a855f7]" />}
                iconBg="bg-[rgba(168,85,247,0.15)]"
                title="Chat with your finances"
                description="'How much did I spend on food?' Ask Penny anything in plain English."
              />
            </motion.div>

            {/* Investment Tracking - Large card */}
            <motion.div
              variants={scaleIn}
              transition={{ duration: 0.6, ease: smoothEase }}
              className="lg:col-span-2 group relative flex flex-col overflow-hidden rounded-2xl bg-[#18181c] border border-white/5 p-6 sm:p-8 hover:border-white/10 transition-all h-full"
            >
              <div className="absolute top-0 right-0 w-[250px] h-[250px] rounded-full blur-[80px] bg-[radial-gradient(circle,#3b82f6_0%,transparent_70%)] opacity-20" />
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-[rgba(59,130,246,0.15)] flex items-center justify-center mb-5">
                  <TrendingUp className="w-6 h-6 text-[#3b82f6]" />
                </div>
                <h3 className="text-xl sm:text-2xl font-semibold mb-3">
                  Track <span className="text-[#3b82f6]">all</span> your investments
                </h3>
                <p className="text-[#a1a1aa] text-sm sm:text-base leading-relaxed mb-6">
                  Stocks, mutual funds, PPF, EPF — see your complete portfolio in one place. Import from any broker and track your real net worth.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <img src="/institutions/zerodha.svg" alt="Zerodha" className="h-6 opacity-60" />
                  <img src="/institutions/groww.svg" alt="Groww" className="h-6 opacity-60" />
                  <img src="/institutions/vested.svg" alt="Vested" className="h-6 opacity-60" />
                  <img src="/institutions/epf.png" alt="EPF" className="h-6 opacity-60" />
                  <img src="/institutions/mfcentral.svg" alt="MFCentral" className="h-6 opacity-60" />
                  <span className="px-2 py-1 text-xs text-[#71717a]">+more</span>
                </div>
              </div>
            </motion.div>

            {/* Insurance Analysis */}
            <motion.div variants={scaleIn} transition={{ duration: 0.5, ease: smoothEase }} className="h-full">
              <BentoCard
                icon={<FileText className="w-6 h-6 text-[#ef4444]" />}
                iconBg="bg-[rgba(239,68,68,0.15)]"
                title="Understand your policies"
                description="Upload insurance documents, get plain-English explanations. No more hidden clauses."
              />
            </motion.div>

            {/* Visual Insights */}
            <motion.div variants={scaleIn} transition={{ duration: 0.5, ease: smoothEase }} className="h-full">
              <BentoCard
                icon={<PieChart className="w-6 h-6 text-[#06b6d4]" />}
                iconBg="bg-[rgba(6,182,212,0.15)]"
                title="Beautiful insights"
                description="See where your money goes with charts that actually make sense."
              />
            </motion.div>

            {/* Multiple Profiles */}
            <motion.div variants={scaleIn} transition={{ duration: 0.5, ease: smoothEase }} className="h-full">
              <BentoCard
                icon={<Users className="w-6 h-6 text-[#10b981]" />}
                iconBg="bg-[rgba(16,185,129,0.15)]"
                title="Family finances"
                description="Create profiles for each family member. See individual or combined views instantly."
              />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Product Showcase Section */}
      <section className="py-24 bg-gradient-to-b from-[#111115] to-[#0a0a0c] overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-12"
          >
            <motion.span
              variants={fadeInUp}
              transition={{ duration: 0.5, ease: smoothEase }}
              className="inline-block text-xs font-semibold uppercase tracking-wider text-[#10b981] mb-4"
            >
              See It In Action
            </motion.span>
            <motion.h2
              variants={fadeInUp}
              transition={{ duration: 0.5, ease: smoothEase, delay: 0.1 }}
              className="text-[clamp(1.75rem,4vw,2.75rem)] font-semibold tracking-tighter"
            >
              Beautiful, powerful, <Highlighter action="highlight" color="#3b82f6" strokeWidth={3} isView delay={700}>yours</Highlighter>
            </motion.h2>
          </motion.div>
        </div>

        {/* Screenshot Carousel */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.7, ease: smoothEase, delay: 0.2 }}
        >
          <ScreenshotCarousel />
        </motion.div>
      </section>

      {/* Control Section */}
      <section className="py-24 px-4 sm:px-8 bg-gradient-to-b from-[#111115] to-[#0a0a0c] relative overflow-hidden">
        {/* Subtle background orb */}
        <div className="absolute top-1/2 right-0 w-[400px] h-[400px] rounded-full blur-[100px] bg-[radial-gradient(circle,#10b981_0%,transparent_70%)] opacity-10 -translate-y-1/2 translate-x-1/2" />

        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <motion.span
              variants={fadeInUp}
              transition={{ duration: 0.5, ease: smoothEase }}
              className="inline-block text-xs font-semibold uppercase tracking-wider text-[#10b981] mb-4"
            >
              Built Different
            </motion.span>
            <motion.h2
              variants={fadeInUp}
              transition={{ duration: 0.5, ease: smoothEase, delay: 0.1 }}
              className="text-[clamp(1.75rem,4vw,2.75rem)] font-semibold tracking-tighter mb-6"
            >
              You control <Highlighter action="highlight" color="#a855f7" strokeWidth={3} isView delay={700}>everything</Highlighter>
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              transition={{ duration: 0.5, ease: smoothEase, delay: 0.2 }}
              className="text-[#a1a1aa] text-base sm:text-lg leading-relaxed max-w-2xl mx-auto"
            >
              No Moneywright servers. No accounts. No data harvesting.
              Choose your AI provider — or go fully local with Ollama.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <motion.div variants={scaleIn} transition={{ duration: 0.5, ease: smoothEase }} className="h-full">
              <BentoCard
                icon={<Server className="w-6 h-6 text-[#10b981]" />}
                iconBg="bg-[rgba(16,185,129,0.15)]"
                title="Self-hostable"
                description="Deploy on your own servers, NAS, or cloud. You own the infrastructure."
              />
            </motion.div>
            <motion.div variants={scaleIn} transition={{ duration: 0.5, ease: smoothEase }} className="h-full">
              <BentoCard
                icon={<Sparkles className="w-6 h-6 text-[#a855f7]" />}
                iconBg="bg-[rgba(168,85,247,0.15)]"
                title="Your AI, your choice"
                description="OpenAI, Anthropic, Google, Grok — or run locally with Ollama."
              />
            </motion.div>
            <motion.div variants={scaleIn} transition={{ duration: 0.5, ease: smoothEase }} className="h-full">
              <BentoCard
                icon={<Lock className="w-6 h-6 text-[#f97316]" />}
                iconBg="bg-[rgba(249,115,22,0.15)]"
                title="No middlemen"
                description="Your data goes directly to your chosen AI. We never see it."
              />
            </motion.div>
            <motion.div variants={scaleIn} transition={{ duration: 0.5, ease: smoothEase }} className="h-full">
              <BentoCard
                icon={<Github className="w-6 h-6 text-[#3b82f6]" />}
                iconBg="bg-[rgba(59,130,246,0.15)]"
                title="Fully open source"
                description="Audit every line. Fork it. Modify it. It's yours."
              />
            </motion.div>
          </motion.div>

        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-4 sm:px-8 bg-[#0a0a0c] relative overflow-hidden">
        {/* Connection line decorations */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent hidden md:block" />

        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <motion.span
              variants={fadeInUp}
              transition={{ duration: 0.5, ease: smoothEase }}
              className="inline-block text-xs font-semibold uppercase tracking-wider text-[#10b981] mb-4"
            >
              Get Started
            </motion.span>
            <motion.h2
              variants={fadeInUp}
              transition={{ duration: 0.5, ease: smoothEase, delay: 0.1 }}
              className="text-[clamp(1.75rem,4vw,2.75rem)] font-semibold tracking-tighter"
            >
              Three steps to <Highlighter action="highlight" color="#f97316" strokeWidth={3} isView delay={700}>clarity</Highlighter>
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="grid md:grid-cols-3 gap-6 md:gap-8"
          >
            {/* Step 1 */}
            <motion.div
              variants={fadeInUp}
              transition={{ duration: 0.5, ease: smoothEase }}
              className="relative group"
            >
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-[#10b981]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex flex-col items-center text-center p-6 rounded-2xl bg-[#18181c] border border-white/5 hover:border-white/10 transition-all">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#10b981] text-xs font-bold text-[#022c22]">
                  Step 1
                </div>
                <div className="w-16 h-16 rounded-2xl bg-[rgba(16,185,129,0.15)] flex items-center justify-center mt-4 mb-5">
                  <ArrowRight className="w-8 h-8 text-[#10b981] rotate-[-90deg]" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Download & Install</h3>
                <p className="text-[#a1a1aa] text-sm leading-relaxed">
                  One-click install for macOS, Windows, or Linux. No account needed.
                </p>
              </div>
            </motion.div>

            {/* Step 2 */}
            <motion.div
              variants={fadeInUp}
              transition={{ duration: 0.5, ease: smoothEase }}
              className="relative group"
            >
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-[#a855f7]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex flex-col items-center text-center p-6 rounded-2xl bg-[#18181c] border border-white/5 hover:border-white/10 transition-all">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#a855f7] text-xs font-bold text-white">
                  Step 2
                </div>
                <div className="w-16 h-16 rounded-2xl bg-[rgba(168,85,247,0.15)] flex items-center justify-center mt-4 mb-5">
                  <Upload className="w-8 h-8 text-[#a855f7]" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Upload Statements</h3>
                <p className="text-[#a1a1aa] text-sm leading-relaxed">
                  Drag and drop your bank statements. PDF, CSV, and Excel supported.
                </p>
              </div>
            </motion.div>

            {/* Step 3 */}
            <motion.div
              variants={fadeInUp}
              transition={{ duration: 0.5, ease: smoothEase }}
              className="relative group"
            >
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-[#06b6d4]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex flex-col items-center text-center p-6 rounded-2xl bg-[#18181c] border border-white/5 hover:border-white/10 transition-all">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#06b6d4] text-xs font-bold text-[#022c22]">
                  Step 3
                </div>
                <div className="w-16 h-16 rounded-2xl bg-[rgba(6,182,212,0.15)] flex items-center justify-center mt-4 mb-5">
                  <PieChart className="w-8 h-8 text-[#06b6d4]" />
                </div>
                <h3 className="text-lg font-semibold mb-2">See Everything</h3>
                <p className="text-[#a1a1aa] text-sm leading-relaxed">
                  Instantly see spending patterns, subscriptions, and get AI insights.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 px-5 sm:px-8 bg-gradient-to-b from-[#0a0a0c] via-[#111115] to-[#0a0a0c] text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[700px] h-[500px] sm:h-[700px] bg-[radial-gradient(circle,#10b981_0%,transparent_70%)] opacity-10 blur-[80px] sm:blur-[100px]" />
        <div className="absolute top-[20%] left-[10%] w-[250px] h-[250px] bg-[radial-gradient(circle,#a855f7_0%,transparent_70%)] opacity-10 blur-[60px]" />
        <div className="absolute bottom-[20%] right-[10%] w-[250px] h-[250px] bg-[radial-gradient(circle,#f97316_0%,transparent_70%)] opacity-10 blur-[60px]" />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="relative z-10 max-w-[600px] mx-auto"
        >
          <motion.img
            variants={scaleIn}
            transition={{ duration: 0.5, ease: smoothEase }}
            src="/logo.png"
            alt="Moneywright"
            className="w-16 h-16 rounded-2xl mx-auto mb-6"
          />
          <motion.h2
            variants={fadeInUp}
            transition={{ duration: 0.5, ease: smoothEase, delay: 0.1 }}
            className="text-[clamp(1.5rem,5vw,2.5rem)] font-semibold tracking-tighter mb-4"
          >
            Ready to take <Highlighter action="highlight" color="#10b981" strokeWidth={3} isView delay={700}>control</Highlighter>?
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            transition={{ duration: 0.5, ease: smoothEase, delay: 0.2 }}
            className="text-[#a1a1aa] text-sm sm:text-base mb-8"
          >
            Join thousands who finally know where every rupee goes.
          </motion.p>

          <motion.a
            variants={fadeInUp}
            transition={{ duration: 0.5, ease: smoothEase, delay: 0.3 }}
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative inline-flex items-center gap-2 bg-gradient-to-br from-[#10b981] to-[#059669] text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-sm sm:text-base hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(16,185,129,0.3)] transition-all shadow-[0_4px_20px_rgba(16,185,129,0.15)] overflow-hidden"
          >
            <ShineBorder shineColor={['#10b981', '#14b8a6', '#06b6d4']} borderWidth={2} />
            Download Moneywright — Free
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </motion.a>

          <motion.div
            variants={fadeIn}
            transition={{ duration: 0.5, ease: smoothEase, delay: 0.4 }}
            className="flex justify-center gap-6 mt-6 text-xs sm:text-sm text-[#71717a]"
          >
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-[#10b981]" />
              Free forever
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-[#10b981]" />
              No account
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-[#10b981]" />
              Works offline
            </span>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-5 sm:px-8 bg-[#0a0a0c] border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <img src="/logo.png" alt="Moneywright" className="w-8 h-8 rounded-lg" />
                <span className="font-display font-semibold">Moneywright</span>
              </div>
              <p className="text-[#71717a] text-sm leading-relaxed">
                Know where your money goes.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-4 text-[#a1a1aa]">Docs</h4>
              <ul className="space-y-2">
                <li><Link to="/docs/$" params={{ _splat: '' }} className="text-[#71717a] hover:text-[#f5f5f7] text-sm transition-colors">Getting Started</Link></li>
                <li><Link to="/docs/$" params={{ _splat: '' }} className="text-[#71717a] hover:text-[#f5f5f7] text-sm transition-colors">Installation</Link></li>
                <li><Link to="/docs/$" params={{ _splat: '' }} className="text-[#71717a] hover:text-[#f5f5f7] text-sm transition-colors">Self-hosting</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-4 text-[#a1a1aa]">Download</h4>
              <ul className="space-y-2">
                <li><a href={downloads ? getDownloadUrl(downloads, 'macos') : releasesUrl} className="text-[#71717a] hover:text-[#f5f5f7] text-sm transition-colors inline-flex items-center gap-2"><img src="/icons/apple.svg" className="w-3.5 h-3.5 opacity-60 invert" /> macOS</a></li>
                <li><a href={downloads ? getDownloadUrl(downloads, 'windows') : releasesUrl} className="text-[#71717a] hover:text-[#f5f5f7] text-sm transition-colors inline-flex items-center gap-2"><img src="/icons/windows.svg" className="w-3.5 h-3.5 opacity-60 invert" /> Windows</a></li>
                <li><a href={downloads ? getDownloadUrl(downloads, 'linux') : releasesUrl} className="text-[#71717a] hover:text-[#f5f5f7] text-sm transition-colors inline-flex items-center gap-2"><img src="/icons/linux.svg" className="w-3.5 h-3.5 opacity-60 invert" /> Linux</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-4 text-[#a1a1aa]">Community</h4>
              <ul className="space-y-2">
                <li><a href="https://github.com/moneywright/moneywright" target="_blank" rel="noopener noreferrer" className="text-[#71717a] hover:text-[#f5f5f7] text-sm transition-colors">GitHub</a></li>
                <li><a href="https://github.com/moneywright/moneywright/issues" target="_blank" rel="noopener noreferrer" className="text-[#71717a] hover:text-[#f5f5f7] text-sm transition-colors">Issues</a></li>
                <li><a href={releasesUrl} target="_blank" rel="noopener noreferrer" className="text-[#71717a] hover:text-[#f5f5f7] text-sm transition-colors">Releases</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-[#71717a] text-sm">
              <Globe className="w-3.5 h-3.5" />
              <span>Open source</span>
              <span className="text-white/20">•</span>
              <Scale className="w-3.5 h-3.5" />
              <span>AGPL-3.0</span>
            </div>
            <div className="text-[#71717a] text-sm">
              Built by <a href="https://priyanshrastogi.com" target="_blank" rel="noopener noreferrer" className="text-[#a1a1aa] hover:text-[#f5f5f7] transition-colors">@priyanshrastogi</a> & <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="text-[#a1a1aa] hover:text-[#f5f5f7] transition-colors">@claude</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Screenshot data
const screenshots = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Get a complete overview of your finances at a glance',
    image: '/screenshots/dashboard.png',
    icon: PieChart,
    color: '#10b981',
  },
  {
    id: 'penny',
    title: 'Ask Penny',
    description: 'Chat with AI about your spending, savings, and goals',
    image: '/screenshots/penny.png',
    icon: MessageCircle,
    color: '#a855f7',
  },
  {
    id: 'transactions',
    title: 'Transactions',
    description: 'Every transaction categorized and searchable instantly',
    image: '/screenshots/transactions.png',
    icon: TrendingUp,
    color: '#3b82f6',
  },
  {
    id: 'subscriptions',
    title: 'Subscriptions',
    description: 'Find and track every recurring charge automatically',
    image: '/screenshots/subscriptions.png',
    icon: RefreshCw,
    color: '#f97316',
  },
];

// Screenshot Showcase Component - Cinematic 3D Carousel
function ScreenshotCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeScreenshot = screenshots[activeIndex];

  return (
    <div className="relative">
      {/* Ambient glow behind active screenshot */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-[120px] opacity-30 transition-colors duration-700"
        style={{ backgroundColor: activeScreenshot.color }}
      />

      {/* Main showcase area */}
      <div className="relative max-w-5xl mx-auto px-4 sm:px-8" style={{ perspective: '2000px' }}>
        {/* 3D Carousel Container */}
        <div className="relative h-[280px] sm:h-[450px] lg:h-[550px]">
          {screenshots.map((screenshot, index) => {
            const isActive = index === activeIndex;
            const offset = index - activeIndex;

            // Calculate position for 3D effect
            const translateX = offset * 85; // percentage offset
            const translateZ = isActive ? 0 : -200;
            const rotateY = offset * -25; // rotation towards center
            const scale = isActive ? 1 : 0.65;
            const opacity = Math.abs(offset) > 1 ? 0 : isActive ? 1 : 0.4;
            const zIndex = isActive ? 30 : 20 - Math.abs(offset);

            return (
              <div
                key={screenshot.id}
                className={cn(
                  "absolute top-0 left-1/2 w-[85%] sm:w-[75%] max-w-[900px] transition-all duration-700 ease-out cursor-pointer",
                  !isActive && "hover:opacity-60"
                )}
                style={{
                  transform: `translateX(calc(-50% + ${translateX}%)) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                  opacity,
                  zIndex,
                  transformStyle: 'preserve-3d',
                }}
                onClick={() => setActiveIndex(index)}
              >
                {/* Screenshot card */}
                <div
                  className={cn(
                    "relative rounded-2xl overflow-hidden transition-shadow duration-700",
                    isActive
                      ? "shadow-[0_25px_100px_-20px_rgba(0,0,0,0.8),0_0_60px_-15px_var(--glow-color)]"
                      : "shadow-[0_15px_40px_-15px_rgba(0,0,0,0.6)]"
                  )}
                  style={{ '--glow-color': `${screenshot.color}40` } as React.CSSProperties}
                >
                  {/* Border glow for active */}
                  <div
                    className={cn(
                      "absolute inset-0 rounded-2xl transition-opacity duration-700",
                      isActive ? "opacity-100" : "opacity-0"
                    )}
                    style={{
                      background: `linear-gradient(135deg, ${screenshot.color}30 0%, transparent 50%, ${screenshot.color}20 100%)`,
                      padding: '1px',
                    }}
                  />

                  {/* Image container */}
                  <div className="relative bg-[#0d0d0f] rounded-2xl overflow-hidden border border-white/[0.08]">
                    <img
                      src={screenshot.image}
                      alt={screenshot.title}
                      className="w-full h-auto"
                      draggable={false}
                    />

                    {/* Subtle vignette overlay */}
                    <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(0,0,0,0.3)_100%)]" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="relative z-40 max-w-3xl mx-auto mt-4 sm:mt-8 px-4">
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center gap-1 p-1.5 rounded-full bg-[#18181c]/80 backdrop-blur-sm border border-white/[0.06]">
            {screenshots.map((screenshot, index) => {
              const isActive = index === activeIndex;
              const Icon = screenshot.icon;

              return (
                <button
                  key={screenshot.id}
                  onClick={() => setActiveIndex(index)}
                  className={cn(
                    "relative flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-300",
                    isActive
                      ? "text-white"
                      : "text-[#71717a] hover:text-[#a1a1aa]"
                  )}
                >
                  {/* Active background pill */}
                  {isActive && (
                    <div
                      className="absolute inset-0 rounded-full transition-colors duration-300"
                      style={{ backgroundColor: `${screenshot.color}20` }}
                    />
                  )}
                  <Icon
                    className={cn(
                      "relative w-4 h-4 transition-colors duration-300",
                    )}
                    style={{ color: isActive ? screenshot.color : undefined }}
                  />
                  <span className="relative hidden sm:inline">{screenshot.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Description below tabs */}
        <div className="text-center mt-3 sm:mt-6">
          <p className="text-[#a1a1aa] text-sm sm:text-base transition-opacity duration-300">
            {activeScreenshot.description}
          </p>
        </div>
      </div>
    </div>
  );
}

// Consistent Bento Card component
function BentoCard({
  icon,
  iconBg = 'bg-[#18181c]',
  title,
  description,
  compact = false,
}: {
  icon: React.ReactNode;
  iconBg?: string;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div className={cn(
      "group relative flex flex-col overflow-hidden rounded-2xl bg-[#18181c] border border-white/5 hover:border-white/10 transition-all h-full",
      compact ? "p-4" : "p-6"
    )}>
      <div className={cn(
        "rounded-xl flex items-center justify-center mb-4",
        compact ? "w-10 h-10" : "w-12 h-12",
        iconBg
      )}>
        {icon}
      </div>
      <h3 className={cn("font-semibold mb-1", compact ? "text-sm" : "text-lg")}>{title}</h3>
      <p className={cn("text-[#a1a1aa] leading-relaxed", compact ? "text-xs" : "text-sm")}>{description}</p>
    </div>
  );
}

function StatCard({ stat, label }: { stat: string; label: string }) {
  return (
    <div className="flex items-center gap-4 px-6 py-2">
      <span className="text-3xl sm:text-4xl font-semibold text-[#f5f5f7] whitespace-nowrap">{stat}</span>
      <span className="text-[#71717a] text-sm max-w-[140px]">{label}</span>
    </div>
  );
}
