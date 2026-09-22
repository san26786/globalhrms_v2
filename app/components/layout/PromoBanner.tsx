import Image from 'next/image';

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

/**
 * Ported from the banner_visible carousel block. Source picked the org
 * logo via three branches (survey page / brand admin / super admin
 * fallback) — call site decides which logoUrl to pass in rather than
 * this component re-deriving the branch, since that logic depends on
 * whether this is a survey feedback page (a routing concern, not a
 * layout concern).
 */
export function PromoBanner({ logoUrl, logoAlt }: { logoUrl: string; logoAlt: string }) {
  return (
    <div className="slider-div container-fluid">
      <div className="row banner justify-content-around align-items-center">
        <div className="text-center col-md-2 col-xs-12">
          <a href="/dashboard">
            <Image
              src="/img/global-hr-logo-header-2.png"
              alt="Global HR"
              width={200}
              height={60}
              className="img-fluid"
            />
          </a>
        </div>
        <div className="text-center col-md-8 col-xs-12">
          {/* TODO: source used a Bootstrap carousel with a 2.5s interval
              and no controls; swap in a lightweight carousel lib or a
              small client component if fade/interval behavior matters. */}
          <div className="carousel-static-first-slide">
            <Image
              src={`/img/banner/${BANNER_IMAGES[0]}`}
              alt=""
              width={900}
              height={220}
              className="d-block img-fluid"
            />
          </div>
        </div>
        <div className="text-center col-md-2 col-xs-12 companyLogo">
          <Image src={logoUrl} alt={logoAlt} width={150} height={100} className="img-fluid" />
        </div>
      </div>
    </div>
  );
}
