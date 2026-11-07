// Shared data models for the Cloud Firestore collections used by NeighbourLink.
// Timestamps are typed as `unknown` because Firestore returns Timestamp objects on
// read and null while a serverTimestamp() is still pending; use toDate() to format.

export type Role = "resident" | "business" | "admin";
export type BusinessStatus = "pending" | "approved" | "rejected";
export type HelpType = "request" | "offer";
export type HelpStatus = "open" | "fulfilled" | "closed";
export type ReportStatus = "open" | "resolved" | "dismissed";
export type ReportTargetType = "business" | "help" | "review" | "user";
export type MessageStatus = "new" | "read" | "replied";

/** users/{uid} — private to the owner and administrators. */
export interface UserProfile {
  id: string;
  uid: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  neighbourhood: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isSuspended: boolean;
  fcmTokens?: string[];
  createdAt?: unknown;
}

export interface NavLink {
  label: string;
  href: string;
  enabled: boolean;
}

/** siteSettings/main — every value here is editable from the admin dashboard. */
export interface SiteSettings {
  siteName: string;
  tagline: string;
  logoUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  heroCtaLabel: string;
  ctaTitle: string;
  ctaText: string;
  bannerText: string;
  primaryColor: string;
  sageColor: string;
  goldColor: string;
  bgColor: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  seoTitle: string;
  seoDescription: string;
  footerText: string;
  emergencyDisclaimer: string;
  socialLinks: Record<string, string>;
  navLinks: NavLink[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Neighbourhood {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}

/** businesses/{id} */
export interface Business {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  description: string;
  categoryId: string | null;
  neighbourhoodId: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  openingHours: string | null;
  imageUrl: string | null;
  status: BusinessStatus;
  isFeatured: boolean;
  views: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Review {
  id: string;
  businessId: string;
  userId: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt?: unknown;
}

export interface HelpPost {
  id: string;
  userId: string;
  authorName: string;
  type: HelpType;
  title: string;
  description: string;
  category: string;
  neighbourhoodId: string | null;
  status: HelpStatus;
  contactPhone: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  isPublished: boolean;
  isPinned: boolean;
  publishedAt?: unknown;
}

export interface Report {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  createdAt?: unknown;
}

export interface ActivityLog {
  id: string;
  userId: string | null;
  action: string;
  details: string;
  createdAt?: unknown;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: MessageStatus;
  createdAt?: unknown;
}

/** legalPages/{"privacy" | "terms"} */
export interface LegalPage {
  id: string;
  title: string;
  content: string;
  updatedAt?: unknown;
}
