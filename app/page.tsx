import CTA from "./components/landing/CTA";
import Footer from "./components/landing/Footer";
import ForWho from "./components/landing/ForWho";
import Hero from "./components/landing/Hero";
import HowItWorks from "./components/landing/HowItWorks";
// import Navbar from "./components/landing/Navbar";

export default function Home() {
  return (
    <>
      {/* <Navbar /> */}
      <Hero />
      <ForWho />
      <HowItWorks />
      <CTA />
      <Footer />
    </>
  );
}
