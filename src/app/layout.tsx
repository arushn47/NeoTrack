import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#6366f1",
};

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://neopat-tracker.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "NeoTrack — Campus Placement Command Center",
    template: "%s — NeoTrack",
  },
  description:
    "Track campus placement drives, automated NeoPAT email sync, shortlist PDF/Excel attachment matching, OA test dates, and interview rounds in one unified dashboard.",
  keywords: [
    "NeoTrack",
    "Campus Placement Tracker",
    "NeoPAT Tracker",
    "VIT Placement Tracker",
    "VIT Bhopal Placements",
    "College Placement Management",
    "Placement Drive Schedule",
    "Shortlist Attachment Parser",
    "Online Assessment Tracker",
    "Interview Schedule Manager",
    "Campus Recruitment Command Center",
    "Job Application Tracking System",
  ],
  authors: [{ name: "NeoTrack Team", url: siteUrl }],
  creator: "NeoTrack",
  publisher: "NeoTrack",
  applicationName: "NeoTrack",
  category: "Productivity",
  manifest: "/manifest.json",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "NeoTrack",
    title: "NeoTrack — Campus Placement Command Center",
    description:
      "Never miss a shortlist, test, or interview. Real-time campus placement tracking and automated email parsing.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "NeoTrack — Campus Placement Command Center",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NeoTrack — Campus Placement Command Center",
    description:
      "Never miss a shortlist, test, or interview. Real-time campus placement tracking and automated email parsing.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NeoTrack",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": `${siteUrl}/#webapp`,
      name: "NeoTrack",
      url: siteUrl,
      applicationCategory: "EducationalApplication, BusinessApplication",
      operatingSystem: "All modern web browsers, Android, iOS",
      description:
        "Real-time campus placement tracking, automated NeoPAT email sync, shortlist spreadsheet parsing, and interview schedule command center.",
      browserRequirements: "Requires JavaScript. Requires HTML5.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      featureList: [
        "Automated Gmail & NeoPAT Sync",
        "Excel & PDF Shortlist Candidate Matching",
        "Placement Drive Calendar & Timeline",
        "Conversion Funnel Analytics",
        "Browser & Mobile Web Push Notifications",
      ],
    },
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "NeoTrack",
      url: siteUrl,
      logo: `${siteUrl}/icon.svg`,
      description: "Smart Campus Placement and Drive Intelligence Platform.",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
