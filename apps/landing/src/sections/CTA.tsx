import { motion } from 'framer-motion';
import { ArrowRight, Smartphone } from 'lucide-react';
import { Button } from '../components/Button';
import { StoreBadges } from '../components/StoreBadges';

export const CTA = () => (
  <section className="relative py-24 md:py-32">
    <div className="mx-auto max-w-5xl px-6 md:px-10">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-health-teal-soft via-card to-health-mint p-10 md:p-16 text-center ring-soft"
      >
        <span
          aria-hidden
          className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-primary/20 blur-3xl"
        />
        <span
          aria-hidden
          className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-emerald-300/30 blur-3xl"
        />
        <div className="relative">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-balance">
            Run an emergency network like one product.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            Open the operator portal or sideload the mobile shell. Demo accounts are seeded —
            try a dispatch, watch the ledger update, hit verify.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Button href="http://localhost:5173" size="lg">
              Open command portal <ArrowRight size={16} />
            </Button>
            <Button href="http://localhost:5174" variant="outline" size="lg">
              <Smartphone size={16} /> Open web mobile
            </Button>
          </div>

          <div className="mt-10 flex flex-col items-center gap-3">
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Or grab the app
            </div>
            <StoreBadges />
          </div>

          <div className="mt-8 text-xs text-muted-foreground font-mono">
            dispatcher@vitalis.dev / demo1234 · seed via <span className="text-foreground">npm run seed</span>
          </div>
        </div>
      </motion.div>
    </div>
  </section>
);
