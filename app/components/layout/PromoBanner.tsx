'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const BANNER_IMAGES = [
  'applicant-management.jpg',
  'benefits-of-clients.jpg',
  'employee-login.jpg',
  'employee-sellf-service.jpg',
  'job-opening-management.jpg',
  'job-performance-reviews.jpg',
  'manage-employees.jpg',
  'performance-management.jpg',
  'project-info-tracking.jpg',
  'track-vacation-leaves-and-attendance.jpg',
  'train-skill-and-awards.jpg',
];

/** CI: <div class="carousel fade" data-ride="carousel" data-interval="2500">, no controls. */
const INTERVAL_MS = 2500;

/**
 * Port of header_v.php's banner_visible block (brand setting SSAABV): Global HR logo linking to
 * the dashboard, the product carousel, and the company logo chosen by the header service
 * (brand logo / CI default / Geecon for the super admin).
 */
export function PromoBanner({ logoUrl, logoAlt }: { logoUrl: string; logoAlt: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % BANNER_IMAGES.length), INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-white border-b border-slate-100 px-4 py-3">
      <div className="flex flex-col md:flex-row items-center justify-around gap-4">
        <Link href="/dashboard" className="shrink-0 md:w-1/6 flex justify-center">
          <Image src="/img/global-hr-logo-header-2.png" alt="Global HR" width={200} height={60} className="h-auto max-h-16 w-auto" />
        </Link>

        <div className="relative w-full md:w-2/3 aspect-[900/220] overflow-hidden rounded-xl" aria-hidden="true">
          {BANNER_IMAGES.map((file, i) => (
            <Image
              key={file}
              src={`/img/banner/${file}`}
              alt=""
              fill
              sizes="(min-width: 768px) 66vw, 100vw"
              priority={i === 0}
              className={`object-contain transition-opacity duration-700 ${i === index ? 'opacity-100' : 'opacity-0'}`}
            />
          ))}
        </div>

        <div className="shrink-0 md:w-1/6 flex justify-center">
          {/* unoptimized: the brand logo is served by an authenticated route, not a static file */}
          <Image src={logoUrl} alt={logoAlt} width={150} height={100} unoptimized className="h-auto max-h-20 w-auto object-contain" />
        </div>
      </div>
    </div>
  );
}
