import { Logo } from './components/Logo';
import { StoreBadges } from './components/StoreBadges';

const STEPS = [
  {
    title: 'Press SOS',
    body: 'Three seconds to cancel, then your location goes out. If someone is not breathing, tick one box and your phone starts pacing CPR for you.',
  },
  {
    title: 'The nearest trained person is called',
    body: 'Doctors, nurses and neighbours who passed the CPR course get the alert, not the whole city. The first to accept is sent straight to you.',
  },
  {
    title: 'A second runner brings the defibrillator',
    body: 'On a cardiac arrest, another responder fetches the closest public AED on the way, while the ambulance is still in traffic.',
  },
];

export const App = () => (
  <>
    <header className="bg-teal-deep text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-6">
        <Logo light />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-8 items-end pt-14 lg:pt-20">
        <div className="pb-16 lg:pb-28">
          <h1 className="rise text-[clamp(2.4rem,6vw,4.5rem)] font-extrabold leading-[1.02] tracking-[-0.03em] max-w-[14ch]">
            Help that lives on your street.
          </h1>
          <p className="rise rise-2 mt-6 text-lg sm:text-xl text-white/90 max-w-[38ch]">
            When someone collapses, Vitalis calls the nearest certified responder and sends another one for a defibrillator. Often minutes before an ambulance can.
          </p>
          <div className="rise rise-3 mt-10" id="download">
            <StoreBadges dark />
            <p className="mt-4 text-sm text-white/80">Free to download. Available in Tirana first.</p>
          </div>
        </div>

        <div className="rise-phone relative z-10 mx-auto w-[min(300px,78vw)] lg:mr-6 -mb-24 lg:-mb-32">
          <div className="rounded-[2.6rem] bg-ink p-2.5 shadow-[0_30px_60px_-28px_rgba(0,0,0,0.45)]">
            <img
              src="/screen-sos.png"
              width={780}
              height={1688}
              alt="Vitalis during a cardiac SOS: a responder has been alerted, a call-the-ambulance button, and a CPR pacing circle counting compressions."
              className="rounded-[2rem] w-full h-auto block"
            />
          </div>
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-40 lg:pt-48 pb-24">
      <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.02em] max-w-[20ch]">What happens when you press SOS</h2>
      <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <span className="text-5xl font-extrabold text-teal tabular-nums" aria-hidden>{i + 1}</span>
            <h3 className="mt-3 text-xl font-bold">{s.title}</h3>
            <p className="mt-2 text-muted leading-relaxed">{s.body}</p>
          </li>
        ))}
      </ol>

      <section className="mt-28 grid lg:grid-cols-[0.8fr_1.2fr] gap-12 items-center">
        <div className="order-2 lg:order-1 mx-auto w-[min(280px,72vw)] rounded-[2.4rem] bg-ink p-2.5">
          <img
            src="/screen-responder.png"
            width={780}
            height={1688}
            loading="lazy"
            alt="The responder inbox: on duty, an accepted cardiac arrest call with directions and patient buttons."
            className="rounded-[1.9rem] w-full h-auto block"
          />
        </div>
        <div className="order-1 lg:order-2">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.02em] max-w-[18ch]">Twenty minutes of training makes you a responder</h2>
          <p className="mt-5 text-lg text-muted max-w-[46ch]">
            Take the free CPR or AED course in the app. Pass the quiz and you can switch on duty whenever you're free. Vitalis will only call you to emergencies close by.
          </p>
          <div className="mt-8"><StoreBadges /></div>
        </div>
      </section>
    </main>

    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 flex flex-col sm:flex-row gap-6 sm:items-center justify-between text-sm text-muted">
        <Logo />
        <p className="max-w-[52ch]">
          Vitalis does not replace emergency services. In an emergency, also call <a className="font-semibold text-ink underline underline-offset-2" href="tel:127">127</a> or <a className="font-semibold text-ink underline underline-offset-2" href="tel:112">112</a>.
        </p>
      </div>
    </footer>
  </>
);
