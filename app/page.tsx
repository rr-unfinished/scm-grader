import Grader from "@/components/Grader";
import { SiteFooter, SiteHeader } from "@/components/Chrome";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="wrap">
        <Grader />
      </main>
      <SiteFooter />
    </>
  );
}
