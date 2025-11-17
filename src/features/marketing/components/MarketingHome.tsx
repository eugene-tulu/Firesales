import { Link } from '@tanstack/react-router';
import { ArrowRight, Monitor, Shield, ShoppingCart, Timer, TrendingUp, Zap } from 'lucide-react';
import type { ComponentProps } from 'react';
import React from 'react';
import type { IconType } from 'react-icons';
import { SiGithub } from 'react-icons/si';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

type GenericIconProps = ComponentProps<'img'> & ComponentProps<'svg'>;

const TanStackIcon: React.FC<GenericIconProps> = ({ className }) => (
  <img src="/android-chrome-192x192.png" alt="TanStack" className={className} />
);

const ConvexIcon: React.FC<GenericIconProps> = ({ className }) => (
  <img src="/convex.png" alt="Convex" className={className} />
);

const BetterAuthIcon: React.FC<GenericIconProps> = ({ className }) => (
  <img src="/better-auth.png" alt="BetterAuth" className={className} />
);

type MarketingIcon = IconType | React.FC<{ className?: string; color?: string }>;

type TechItem = {
  name: string;
  description: string;
  Icon: MarketingIcon;
  iconColor?: string;
  iconClassName?: string;
  url: string;
};

// Create lazy-loaded icon components to avoid bundling issues
const createLazyIcon = (iconName: string) => {
  const LazyIcon = React.lazy(() =>
    import('react-icons/si').then((module) => ({
      default: module[iconName as keyof typeof module] as React.ComponentType<
        React.SVGProps<SVGSVGElement>
      >,
    })),
  );
  return LazyIcon;
};

const coreTechnologies: TechItem[] = [
  {
    name: 'TanStack Start',
    description: 'File-based routing, SSR, and progressive enhancement.',
    Icon: TanStackIcon,
    iconColor: '#f97316',
    url: 'https://tanstack.com/start',
  },
  {
    name: 'Convex',
    description: 'Realtime database operations with zero client boilerplate.',
    Icon: ConvexIcon,
    iconColor: '#0f172a',
    url: 'https://www.convex.dev/',
  },
  {
    name: 'Netlify',
    description: 'Serverless hosting and edge delivery tuned for TanStack Start.',
    Icon: createLazyIcon('SiNetlify'),
    iconClassName: 'text-emerald-500',
    url: 'https://www.netlify.com/',
  },
  {
    name: 'BetterAuth',
    description: 'Email-first authentication with session management baked in.',
    Icon: BetterAuthIcon,
    iconColor: '#be123c',
    url: 'https://www.better-auth.com/',
  },
  {
    name: 'Resend',
    description: 'Transactional emails for auth flows and lifecycle messaging.',
    Icon: createLazyIcon('SiResend'),
    iconClassName: 'text-slate-900',
    url: 'https://resend.com/',
  },
  {
    name: 'Biome',
    description: 'Fast linting and formatting to keep the codebase consistent.',
    Icon: createLazyIcon('SiBiome'),
    iconClassName: 'text-blue-600',
    url: 'https://biomejs.dev/',
  },
  {
    name: 'React 19',
    description: 'Modern UI library powering server and client rendering.',
    Icon: createLazyIcon('SiReact'),
    iconClassName: 'text-sky-400',
    url: 'https://react.dev/',
  },
  {
    name: 'Shadcn/UI',
    description: 'Accessible component primitives ready for rapid iteration.',
    Icon: createLazyIcon('SiShadcnui'),
    iconClassName: 'text-slate-900',
    url: 'https://ui.shadcn.com/',
  },
  {
    name: 'Tailwind',
    description: 'Utility-first styling with design tokens configured for the template.',
    Icon: createLazyIcon('SiTailwindcss'),
    iconClassName: 'text-sky-500',
    url: 'https://tailwindcss.com/',
  },
  {
    name: 'TypeScript',
    description: 'Type-safe foundations from server to client with strict typing.',
    Icon: createLazyIcon('SiTypescript'),
    iconClassName: 'text-blue-600',
    url: 'https://www.typescriptlang.org/',
  },
  {
    name: 'Vite',
    description: 'Lightning-fast dev server and build pipeline optimized for React.',
    Icon: createLazyIcon('SiVite'),
    iconClassName: 'text-purple-600',
    url: 'https://vitejs.dev/',
  },
  {
    name: 'Zod',
    description: 'Type-safe validation for data schemas.',
    Icon: createLazyIcon('SiZod'),
    iconClassName: 'text-blue-500',
    url: 'https://zod.dev/',
  },
];

export function MarketingHome() {
  return (
    <div className="flex flex-col gap-16 py-16">
      <section className="text-center space-y-6">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          Transform Your Sales Strategy
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          Launch High-Impact Flash Sales in Minutes
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          Firesales is the all-in-one platform for creating, managing, and optimizing flash sales.
          Scrape product details, set inventory, and launch sales that drive urgency and boost
          revenue.
        </p>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
          Perfect for e-commerce businesses, marketplaces, and retailers looking to create
          time-sensitive promotions that generate buzz and increase conversion rates.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <Link to="/register" preload="intent" className="inline-flex items-center gap-2">
              Start Your First Flash Sale
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a
              href="https://github.com/eugene-tulu/Firesales"
              className="inline-flex items-center gap-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              <SiGithub className="h-4 w-4" />
              View on GitHub
            </a>
          </Button>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-muted/40 p-10 shadow-sm">
        <div className="text-center space-y-3">
          <span className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Powerful Flash Sale Features
          </span>
          <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
            Everything you need to run successful flash sales
          </h2>
          <p className="text-base text-muted-foreground">
            From product scraping to inventory management, our platform streamlines the entire flash
            sale process.
          </p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-background px-4 py-4 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <ShoppingCart className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">Product Scraping</p>
              <p className="text-sm text-muted-foreground">
                Automatically extract product details from any URL
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-background px-4 py-4 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Timer className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">Time-Sensitive Sales</p>
              <p className="text-sm text-muted-foreground">
                Create urgency with limited-time offers
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-background px-4 py-4 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">Real-Time Analytics</p>
              <p className="text-sm text-muted-foreground">
                Track sales performance as they happen
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-background px-4 py-4 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Monitor className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">Inventory Management</p>
              <p className="text-sm text-muted-foreground">
                Control stock levels and prevent overselling
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-background px-4 py-4 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">Secure Payments</p>
              <p className="text-sm text-muted-foreground">
                Process transactions safely with integrated payment systems
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-background px-4 py-4 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">Instant Activation</p>
              <p className="text-sm text-muted-foreground">
                Go live with your flash sale in seconds
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-linear-to-br from-primary/5 to-secondary/5 p-10 shadow-sm">
        <div className="text-center space-y-3 mb-10">
          <span className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Why Choose Firesales?
          </span>
          <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
            The complete solution for modern flash sales
          </h2>
          <p className="text-base text-muted-foreground">
            Built with modern web technologies to deliver exceptional performance and user
            experience.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">Lightning Fast Setup</h3>
            <p className="text-muted-foreground">
              Create and launch a flash sale in under 60 seconds. Just provide a product URL, set
              your inventory, and go live. No complex setup required.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Monitor className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">Real-Time Updates</h3>
            <p className="text-muted-foreground">
              Watch inventory levels update instantly as customers purchase. Get real-time analytics
              on sales performance and customer engagement.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">Enterprise-Grade Security</h3>
            <p className="text-muted-foreground">
              All transactions and data are protected with industry-standard security measures. Your
              customer information is always safe and secure.
            </p>
          </div>
        </div>
      </section>

      <section className="text-center space-y-6">
        <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
          Ready to boost your sales?
        </h2>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          Join thousands of businesses using Firesales to create high-converting flash sales that
          drive revenue and customer engagement.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <Link to="/register" preload="intent" className="inline-flex items-center gap-2">
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/login" preload="intent">
              Sign In to Dashboard
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
