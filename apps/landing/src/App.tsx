import { Nav } from './components/Nav';
import { Hero } from './sections/Hero';
import { Features } from './sections/Features';
import { HowItWorks } from './sections/HowItWorks';
import { Stats } from './sections/Stats';
import { Audiences } from './sections/Audiences';
import { CTA } from './sections/CTA';
import { Footer } from './sections/Footer';

export const App = () => (
  <div className="relative min-h-screen">
    <Nav />
    <main>
      <Hero />
      <Features />
      <HowItWorks />
      <Stats />
      <Audiences />
      <CTA />
    </main>
    <Footer />
  </div>
);
