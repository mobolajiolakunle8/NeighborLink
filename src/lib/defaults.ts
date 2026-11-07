// Built-in starting content. The site uses these values until an administrator
// initialises (or edits) the matching documents in Firestore. Nothing here is a
// fabricated business, testimonial or contact channel.
import type { Category, LegalPage, Neighbourhood, SiteSettings } from "./types";
import { slugify } from "./utils";

export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: "NeighbourLink",
  tagline: "Your Community. Your Connections.",
  logoUrl: "",
  heroTitle: "Your Community. Your Connections.",
  heroSubtitle:
    "Discover trusted local businesses, neighbours who care, and announcements that matter — across Ibadan.",
  heroImageUrl:
    "https://images.pexels.com/photos/37090480/pexels-photo-37090480.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  heroCtaLabel: "Browse directory",
  ctaTitle: "Own a business in Ibadan?",
  ctaText:
    "Join NeighbourLink free. Create your listing, get discovered by neighbours searching for exactly what you offer, and build trust with reviews.",
  bannerText: "",
  primaryColor: "#172D2A",
  sageColor: "#E8F0E9",
  goldColor: "#D5A85C",
  bgColor: "#F8F8F5",
  contactPhone: "+2349030192034",
  contactEmail: "",
  address: "Ibadan, Oyo State, Nigeria",
  seoTitle: "NeighbourLink — Your Community. Your Connections. | Ibadan",
  seoDescription:
    "NeighbourLink connects residents in Ibadan with local businesses, community assistance, services and neighbourhood announcements.",
  footerText: "Connecting Ibadan, one neighbourhood at a time.",
  emergencyDisclaimer:
    "NeighbourLink is a community platform and is not an emergency service. In an emergency, contact the Nigeria Police (112), FRSC (122), or your nearest hospital immediately.",
  socialLinks: {},
  navLinks: [
    { label: "Home", href: "/", enabled: true },
    { label: "Directory", href: "/directory", enabled: true },
    { label: "Community help", href: "/help", enabled: true },
    { label: "Announcements", href: "/announcements", enabled: true },
    { label: "Contact", href: "/contact", enabled: true },
  ],
};

const CATEGORY_SEED: Array<[string, string, string]> = [
  ["Food & Drinks", "Restaurants, bakeries, provisions and eateries", "utensils"],
  ["Health & Wellness", "Pharmacies, clinics, fitness and wellness", "heart-pulse"],
  ["Education", "Schools, lessons, tutorials and training", "graduation-cap"],
  ["Home Services", "Plumbing, electrical, cleaning and repairs", "wrench"],
  ["Fashion & Beauty", "Tailors, salons, barbers and boutiques", "scissors"],
  ["Transport & Logistics", "Okada, keke, taxis, haulage and delivery", "car"],
  ["Tech & Repairs", "Phones, laptops, gadgets and repairs", "smartphone"],
  ["Markets & Shopping", "Markets, supermarkets and general shopping", "shopping-bag"],
  ["Agriculture & Food", "Farm produce, poultry and fisheries", "wheat"],
  ["Professional Services", "Legal, accounting, printing and design", "briefcase"],
  ["Entertainment", "Events, music, viewing centres and recreation", "party-popper"],
  ["General Services", "Other trusted local services", "store"],
];

export const DEFAULT_CATEGORIES: Category[] = CATEGORY_SEED.map(([name, description, icon], i) => ({
  id: slugify(name),
  name,
  slug: slugify(name),
  description,
  icon,
  sortOrder: i,
  isActive: true,
}));

const NEIGHBOURHOOD_SEED = [
  "Bodija", "Challenge", "Dugbe", "Ring Road", "Apata", "Oke-Ado", "Iyaganku", "Sango",
  "University of Ibadan Area", "Felele", "Oluyole", "Akobo", "Moniya", "Oke-Are", "Agodi",
  "Jericho", "Oke-Odo", "Mokola", "Bashorun", "Ologuneru", "Oke-Bola", "Idi-Arere", "Odo-Ona",
  "Oke-Afa", "Agbamu", "Iwo Road", "Dakada", "Oke-Ira", "Oke-Igbo", "Oke-Aje",
];

export const DEFAULT_NEIGHBOURHOODS: Neighbourhood[] = NEIGHBOURHOOD_SEED.map((name, i) => ({
  id: slugify(name),
  name,
  slug: slugify(name),
  description: "",
  sortOrder: i,
  isActive: true,
}));

export const DEFAULT_LEGAL: LegalPage[] = [
  {
    id: "privacy",
    title: "Privacy Policy",
    content: `NeighbourLink respects your privacy. This policy explains what we collect, why, and what you can do about it.

1. What we collect
• Account details: name, email address, and optional phone number, neighbourhood, bio and profile photo.
• Content you create: business listings, help requests and offers, reviews, reports and contact messages.
• Technical data: basic usage analytics and push-notification tokens, only if you choose to enable notifications.

2. How we use it
We use your information to operate the directory, the help board and announcements; to keep the community safe; and to respond to your messages. We do not sell personal data.

3. Who processes data
NeighbourLink is built on Google Firebase (Authentication, Cloud Firestore, Cloud Storage, Cloud Messaging and Analytics). Data is stored in Google Cloud infrastructure under Firebase's security rules.

4. Visibility
Your private profile (email, phone) is visible only to you and to administrators. Business listings and reviews are public once approved. Help-board posts show your display name; contact details are shown only if you choose to include them.

5. Your choices
• View and edit your profile at any time.
• Delete your account permanently from your profile page. This removes your profile, listings, posts and reviews.
• Turn push notifications on or off in your browser settings.

6. Security
Access is controlled by server-enforced security rules. Administrator accounts cannot be created from the public sign-up form.

7. Contact
For privacy requests, call +2349030192034. We aim to comply with the Nigeria Data Protection Act, 2023.`,
  },
  {
    id: "terms",
    title: "Terms of Service",
    content: `By using NeighbourLink you agree to these terms.

1. Accounts
You must provide accurate information and keep your password secure. One person should not operate multiple accounts to mislead others.

2. Business listings
Listings must describe real businesses operating in Ibadan. Every listing is reviewed by an administrator before it appears publicly. Editing an approved listing sends it back for review.

3. Community help
Help requests and offers must be genuine. Never post requests for money transfers, personal financial details or anything illegal.

4. Reviews and reports
Reviews must be honest and based on real experience. We may remove content that is misleading, abusive, discriminatory or unsafe.

5. Emergencies
NeighbourLink is NOT an emergency service. In an emergency, call 112 (Nigeria Police) or 122 (FRSC), or go to the nearest hospital immediately.

6. Third-party transactions
NeighbourLink connects neighbours and businesses but does not provide, guarantee or take responsibility for goods, services or payments arranged between users. Use caution and verify before you pay.

7. Suspension and removal
We may suspend accounts or remove content that breaks these terms, without notice where necessary to protect the community.

8. Changes
We may update these terms. The date of the latest change is shown on this page.

9. Contact
Questions about these terms: +2349030192034.`,
  },
];
