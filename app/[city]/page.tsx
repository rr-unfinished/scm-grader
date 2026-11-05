import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/Chrome";
import Grader from "@/components/Grader";
import { AREAS, CITY_BY_SLUG, areaOf, citySlug, nearbyCities } from "@/lib/cities";
import { cityStats, type CityStats } from "@/lib/city-stats";
import { SOUTH_BAY_CITIES, type SouthBayCity } from "@/lib/practice-types";

// Refresh the Google numbers once a day.
export const revalidate = 86400;
export const dynamicParams = false;

const SITE = (process.env.SITE_URL || "https://grader.southcoastmarketing.com").replace(/\/$/, "");
const MAIN_SITE = "https://www.southcoastmarketing.com";

export function generateStaticParams() {
  return SOUTH_BAY_CITIES.map((c) => ({ city: citySlug(c) }));
}

type Props = { params: Promise<{ city: string }> };

function copyFor(city: SouthBayCity) {
  return {
    title: `Dental & Medical Marketing Audit in ${city}, CA`,
    description: `Free marketing audit for ${city} dentists and medical practices. See your Google map rank, reviews, website and AI search score.`,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = CITY_BY_SLUG[(await params).city];
  if (!city) return {};
  const { title, description } = copyFor(city);
  const path = `/${citySlug(city)}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path },
    twitter: { title, description },
  };
}

const fmt = (n: number) => n.toLocaleString("en-US");

export default async function CityPage({ params }: Props) {
  const city = CITY_BY_SLUG[(await params).city];
  if (!city) notFound();

  const stats = await cityStats(city);
  const nearby = nearbyCities(city);
  const area = areaOf(city);
  const { description } = copyFor(city);
  const path = `${SITE}/${citySlug(city)}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${path}#webpage`,
        url: path,
        name: copyFor(city).title,
        description,
        isPartOf: { "@id": `${SITE}/#website` },
        about: { "@id": `${path}#service` },
        breadcrumb: { "@id": `${path}#breadcrumb` },
      },
      {
        "@type": "Service",
        "@id": `${path}#service`,
        name: `Free dental and medical marketing audit in ${city}, CA`,
        serviceType: "Digital marketing audit",
        provider: { "@id": `${MAIN_SITE}/#organization` },
        areaServed: { "@type": "City", name: `${city}, CA` },
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        audience: { "@type": "BusinessAudience", audienceType: "Dental and medical practices" },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${path}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Practice Grader", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: city, item: path },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <SiteHeader />
      <main className="wrap">
        <Grader
          initialCity={city}
          intro={{
            eyebrow: `Free for ${city} dental & medical practices`,
            heading: `See how ${city} patients find you online.`,
            lede: `Enter your practice name and get your online health score in under a minute. We check how you rank when ${city} patients search Google, plus your website, reviews and AI search.`,
          }}
          below={<CityDetails city={city} area={area} stats={stats} nearby={nearby} />}
        />
      </main>
      <SiteFooter />
    </>
  );
}

function CityDetails({
  city,
  area,
  stats,
  nearby,
}: {
  city: SouthBayCity;
  area: string;
  stats: CityStats | null;
  nearby: { city: SouthBayCity; miles: number }[];
}) {
  const updated = stats
    ? new Date(stats.fetchedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" })
    : null;

  return (
    <section className="areas" aria-labelledby="city-h">
      <div className="areas-intro">
        <h2 id="city-h">How {city} practices stack up on Google</h2>
        {stats ? (
          <p>
            When patients search &quot;dentist near me&quot; from {city}, these are the practices Google Maps shows first. The top{" "}
            {stats.sample} average <b>{stats.avgRating.toFixed(1)} stars</b> with a typical <b>{fmt(stats.medianReviews)} reviews</b>.{" "}
            {stats.with100Reviews} of {stats.sample} have more than 100 reviews, and {stats.rated48} are rated 4.8 or higher. That&apos;s
            the bar your practice is measured against.
          </p>
        ) : (
          <p>
            When patients search &quot;dentist near me&quot; from {city}, Google Maps shows a handful of practices first, and most
            patients choose from those. The grader shows you where you rank, who&apos;s above you, and what it would take to pass them.
          </p>
        )}
      </div>

      {stats && (
        <div className="city-stats">
          <div className="stat-tiles">
            <div className="stat">
              <b>{stats.avgRating.toFixed(1)}★</b>
              <span>Average rating of the top {stats.sample}</span>
            </div>
            <div className="stat">
              <b>{fmt(stats.medianReviews)}</b>
              <span>Typical number of Google reviews</span>
            </div>
            <div className="stat">
              <b>
                {stats.with100Reviews}/{stats.sample}
              </b>
              <span>Have 100+ reviews</span>
            </div>
          </div>
          <div className="tablewrap">
            <table>
              <caption className="sr-only">Top dentists on Google Maps near {city}</caption>
              <thead>
                <tr>
                  <th>Map rank</th>
                  <th>Practice</th>
                  <th>Rating</th>
                  <th>Reviews</th>
                </tr>
              </thead>
              <tbody>
                {stats.top.map((p, i) => (
                  <tr key={`${i}-${p.name}`}>
                    <td className="n">#{i + 1}</td>
                    <td>
                      {p.mapsUri ? (
                        <a href={p.mapsUri} target="_blank" rel="noopener noreferrer">
                          {p.name}
                        </a>
                      ) : (
                        p.name
                      )}
                    </td>
                    <td className="n">{typeof p.rating === "number" ? `${p.rating.toFixed(1)} ★` : "None"}</td>
                    <td className="n">{fmt(p.reviews ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">
            Data from Google Maps for &quot;dentist&quot; searched from the center of {city}, updated {updated}. Rank shifts with where a
            patient searches. Run the grader above to see your own position.
          </p>
        </div>
      )}

      <div className="areas-grid city-links">
        <div className="area">
          <h3>Near {city}</h3>
          <ul className="cities">
            {nearby.map((n) => (
              <li key={n.city}>
                <a href={`/${citySlug(n.city)}`}>{n.city}</a> <span className="mi">{n.miles} mi</span>
              </li>
            ))}
          </ul>
        </div>
        {AREAS.map((a) => (
          <div key={a.name} className={`area${a.name === area ? " here" : ""}`}>
            <h3>{a.name}</h3>
            <ul className="cities">
              {a.cities.map((c) => (
                <li key={c}>{c === city ? <b aria-current="page">{c}</b> : <a href={`/${citySlug(c)}`}>{c}</a>}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
