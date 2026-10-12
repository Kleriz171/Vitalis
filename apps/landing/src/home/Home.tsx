import { Nav } from './Nav';
import { CityStory } from './CityStory';
import { AppSection } from './AppSection';
import { WatchSection } from './WatchSection';
import { ResponderSection } from './ResponderSection';
import { OrganisationsSection } from './OrganisationsSection';
import { TrustSection } from './TrustSection';
import { Closing } from './Closing';

export const Home = () => (
  <>
    <Nav />
    <main>
      <div id="story"><CityStory /></div>
      <AppSection />
      <WatchSection />
      <ResponderSection />
      <OrganisationsSection />
      <TrustSection />
      <div id="get"><Closing /></div>
    </main>
  </>
);
