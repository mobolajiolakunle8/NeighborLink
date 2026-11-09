// NeighbourLink assistant: a deterministic, offline knowledge-base assistant that
// answers site FAQs and routes members to the right page. It calls no external AI
// service, so it works without any API key and never invents businesses or prices.
// Every question and reply is reported to the admin dashboard (see logAssistantTurn).

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDb } from "./firebase";

export interface AssistantLink { label: string; href: string }
export interface AssistantReply { intent: string; answer: string; links: AssistantLink[]; suggestions: string[] }

const CONTACT_LINK: AssistantLink = { label: "Contact the admin team", href: "/contact" };

interface Entry {
  intent: string;
  keywords: string[];
  answer: string;
  links?: AssistantLink[];
  suggestions?: string[];
}

const KB: Entry[] = [
  {
    intent: "emergency",
    keywords: [
      "emergency", "urgent", "ambulance", "police", "hospital", "fire", "accident", "robbery", "attack",
      "danger", "dying", "bleeding", "collapsed", "crisis", "sos", "medical", "injured", "injury",
      "unconscious", "stroke", "seizure", "poison", "drowning", "choking", "overdose", "labour pains",
    ],
    answer:
      "I'm a website guide and can't help in an emergency. Please stop using this chat and contact the Nigeria Police on 112, FRSC on 122, or go to your nearest hospital immediately.",
    links: [],
    suggestions: [],
  },
  {
    intent: "list-business",
    keywords: ["list", "listing", "register business", "add business", "submit business", "sell", "advertise", "owner", "my shop", "my business", "sign up business"],
    answer:
      "Listing a business is free. Create an account as a Business owner, then open My profile → My businesses → New listing. Fill in the name, description, category, area and cover photo, then submit. An administrator reviews every listing before it appears publicly.",
    links: [{ label: "Create an account", href: "/register" }, { label: "See the directory", href: "/directory" }, CONTACT_LINK],
    suggestions: ["How do I get verified?", "How do I add my shop location?"],
  },
  {
    intent: "verification",
    keywords: ["verify", "verified", "verification", "cac", "badge", "confirmed"],
    answer:
      "Open My profile → My businesses → Get verified, then enter your CAC registration number (for example RC 1234567 or BN 1234567). An administrator checks it and your listing shows a Verified business badge once confirmed. Owners cannot verify their own listing.",
    links: [{ label: "My profile", href: "/profile" }, CONTACT_LINK],
    suggestions: ["How do I list a business?", "What does the cover photo need?"],
  },
  {
    intent: "find-business",
    keywords: ["find", "search", "directory", "look for", "where can i find", "need a", "looking for", "recommend", "nearby", "near me", "shop", "business", "barber", "tailor", "plumber", "electrician", "restaurant", "pharmacy"],
    answer:
      "Use the Directory to search by name or service, filter by category and neighbourhood, and switch between list and map views. The homepage map shows approved businesses with a saved location.",
    links: [{ label: "Open the directory", href: "/directory" }, { label: "Business map", href: "/directory" }, { label: "Neighbourhoods", href: "/neighbourhoods" }],
    suggestions: ["How do I save a business?", "Which areas do you cover?"],
  },
  {
    intent: "save-business",
    keywords: ["save", "saved", "bookmark", "favourite", "favorite", "shortlist"],
    answer:
      "Tap the bookmark icon on any business card or profile to save it. Your saved businesses are private and appear under Saved on any device you sign in from.",
    links: [{ label: "Saved businesses", href: "/saved" }, { label: "Directory", href: "/directory" }],
    suggestions: ["How do reviews work?", "How do I contact a business?"],
  },
  {
    intent: "contact-admin",
    keywords: ["contact", "message admin", "talk to", "support", "help me", "complain", "complaint", "report problem", "speak to", "phone", "call"],
    answer:
      "You can reach the admin team on +2349030192034, or send a message from the Contact page. If you are signed in, replies appear in the Messages box on your profile and in Updates.",
    links: [{ label: "Contact page", href: "/contact" }, { label: "Message the admin team", href: "/profile#messages" }],
    suggestions: ["How do I report a listing?", "How do reviews work?"],
  },
  {
    intent: "message-admin",
    keywords: ["inbox", "reply", "my message", "message box", "unread"],
    answer:
      "Sign in and open the Messages box on your profile to see conversations with the admin team. Unread replies also appear in Updates and as a badge in the header.",
    links: [{ label: "Your messages", href: "/profile#messages" }, { label: "Inbox", href: "/inbox" }, { label: "Updates", href: "/notifications" }],
    suggestions: ["How do I contact the admin team?"],
  },
  {
    intent: "reviews",
    keywords: ["review", "reviews", "rating", "star", "stars", "rate"],
    answer:
      "Open a business profile and use Write a review. Choose 1–5 stars and add a short comment. You can leave one review per business, you cannot review your own listing, and reviews are only allowed on approved listings. You can delete your review from the same page.",
    links: [{ label: "Browse businesses", href: "/directory" }],
    suggestions: ["How do I report a listing?", "How do I get verified?"],
  },
  {
    intent: "report",
    keywords: ["report", "scam", "fake", "spam", "abuse", "wrong information", "flag", "closed down"],
    answer:
      "Use the Report button on a business, review, help post or conversation. Choose a reason and add details. Reports go only to the moderation team, not to the person you are reporting.",
    links: [{ label: "Directory", href: "/directory" }, CONTACT_LINK],
    suggestions: ["How do reviews work?", "How do I contact the admin team?"],
  },
  {
    intent: "help-board",
    keywords: ["help board", "help post", "offer help", "request help", "errand", "volunteer", "neighbour help"],
    answer:
      "The Community help board is where neighbours post requests and offers — errands, tutoring, repairs, childcare and more. Sign in, tap Post to board, choose Request or Offer, and add a title and details. You can mark your post fulfilled at any time.",
    links: [{ label: "Open the help board", href: "/help" }],
    suggestions: ["How do I contact the admin team?", "Which areas do you cover?"],
  },
  {
    intent: "account-delete",
    keywords: ["delete account", "delete my account", "close account", "remove account", "cancel account", "gdpr", "my data"],
    answer:
      "Go to My profile → Delete account and confirm with your password. This permanently removes your profile, listings, help posts, reviews, saved businesses, photos and conversation history. It cannot be undone.",
    links: [{ label: "My profile", href: "/profile" }, CONTACT_LINK],
    suggestions: ["How do I contact the admin team?"],
  },
  {
    intent: "map-location",
    keywords: ["map", "location", "pin", "address", "directions", "coordinates", "gps", "where is the shop"],
    answer:
      "In the listing form, use Business location: click the map, drag the pin, enter latitude and longitude, or use Use my location while you are at the business. Cover photos and coordinates are published only after your listing is approved.",
    links: [{ label: "My businesses", href: "/profile#my-listings" }, { label: "Business map", href: "/directory" }],
    suggestions: ["What does the cover photo need?", "How do I list a business?"],
  },
  {
    intent: "cover-photo",
    keywords: ["cover photo", "cover image", "photo", "picture", "image", "upload", "compress", "size", "dimension", "logo", "pixel"],
    answer:
      "Business covers look best at 1600 × 900 px (16:9). Uploads are automatically rotated, cropped, resized and compressed to WebP (1.5 MB maximum) before storage, so you can pick a photo up to 25 MB and it will be optimised. Profile photos and logos use a square crop up to 1024 × 1024 px.",
    links: [{ label: "My businesses", href: "/profile#my-listings" }],
    suggestions: ["How do I add my shop location?", "How do I list a business?"],
  },
  {
    intent: "pricing",
    keywords: ["price", "pricing", "cost", "fee", "free", "charge", "pay", "payment", "subscription", "money"],
    answer:
      "NeighbourLink is completely free to join and free to list a business. The site does not process payments or hold deposits for transactions between members — always agree terms directly with the business or neighbour.",
    links: [{ label: "Create a free account", href: "/register" }, { label: "Directory", href: "/directory" }],
    suggestions: ["How do I list a business?", "Which areas do you cover?"],
  },
  {
    intent: "areas",
    keywords: ["area", "areas", "neighbourhood", "neighbourhoods", "cover", "ibadan", "bodija", "challenge", "dugbe", "ring road", "apata", "sango", "moniya", "akobo", "mokola"],
    answer:
      "NeighbourLink covers neighbourhoods across Ibadan, Oyo State — including Bodija, Challenge, Dugbe, Ring Road, Apata, Sango, Akobo, Moniya, Mokola and many more. Pick an area to see its businesses, open help posts and news.",
    links: [{ label: "All neighbourhoods", href: "/neighbourhoods" }, { label: "Directory", href: "/directory" }],
    suggestions: ["How do I list a business?", "How do I save a business?"],
  },
  {
    intent: "categories",
    keywords: ["category", "categories", "type of business", "services", "what is available", "kinds"],
    answer:
      "The directory covers Food & Drinks, Health & Wellness, Education, Home Services, Fashion & Beauty, Transport & Logistics, Tech & Repairs, Markets & Shopping, Agriculture & Food, Professional Services, Entertainment and General Services.",
    links: [{ label: "Browse the directory", href: "/directory" }],
    suggestions: ["Which areas do you cover?", "How do I list a business?"],
  },
  {
    intent: "account-type",
    keywords: ["account type", "role", "resident", "business owner", "switch", "change account"],
    answer:
      "Residents browse, review and use the help board. Business owners can also list businesses. You can change your account type under My profile → Account type. Administrator access is granted only by an existing administrator.",
    links: [{ label: "My profile", href: "/profile" }],
    suggestions: ["How do I list a business?", "How do reviews work?"],
  },
  {
    intent: "password",
    keywords: ["password", "reset", "forgot", "login", "log in", "sign in", "cannot log in", "locked out"],
    answer:
      "On the login page choose Forgot password and enter your email — a reset link is sent to you. If you still cannot sign in, contact the admin team on +2349030192034.",
    links: [{ label: "Log in", href: "/login" }, CONTACT_LINK],
    suggestions: ["How do I delete my account?"],
  },
  {
    intent: "safety",
    keywords: ["safe", "safety", "scammed", "trust", "careful", "meet"],
    answer:
      "Keep messages on NeighbourLink, meet in public places during the day, never share OTPs, PINs or bank details, and agree prices before work starts. Listings are reviewed before publishing, but that is not a quality guarantee — confirm details before you pay.",
    links: [{ label: "Report a problem", href: "/contact" }, { label: "Directory", href: "/directory" }],
    suggestions: ["How do I report a listing?", "How do reviews work?"],
  },
  {
    intent: "greeting",
    keywords: ["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "please", "thanks", "thank you"],
    answer:
      "Hello! I can point you to the right page — try asking about listing a business, finding a service, reviews, verification, saving businesses or your account.",
    links: [{ label: "Directory", href: "/directory" }, { label: "Community help", href: "/help" }, CONTACT_LINK],
    suggestions: ["How do I list a business?", "How do I find a business?", "How do reviews work?"],
  },
];

const STOP_WORDS = new Set(["the", "a", "an", "is", "are", "do", "does", "i", "my", "me", "to", "for", "of", "on", "how", "what", "can", "you", "your", "and", "in", "it", "with", "please", "there", "this", "that", "we"]);

function scoreEntry(entry: Entry, tokens: string[]): number {
  let score = 0;
  for (const keyword of entry.keywords) {
    if (keyword.includes(" ")) {
      if (tokens.join(" ").includes(keyword)) score += 4;
      continue;
    }
    for (const token of tokens) {
      if (token === keyword) score += 3;
      else if (keyword.length > 4 && (token.startsWith(keyword) || keyword.startsWith(token))) score += 1;
    }
  }
  return score;
}

const FALLBACK: AssistantReply = {
  intent: "fallback",
  answer:
    "I'm not sure about that one. I can help with listing a business, finding services, reviews, verification, the map, saving businesses or your account. For anything else, please send the admin team a message.",
  links: [{ label: "Contact the admin team", href: "/contact" }, { label: "Community help", href: "/help" }, { label: "Directory", href: "/directory" }],
  suggestions: ["How do I list a business?", "How do I find a business?", "How do I contact the admin team?"],
};

export function answerQuestion(rawQuestion: string): AssistantReply {
  const question = rawQuestion.trim().toLowerCase();
  if (!question) return { ...FALLBACK, intent: "empty" };
  const tokens = question.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(t => t.length > 1 && !STOP_WORDS.has(t));
  let best: Entry | null = null;
  let bestScore = 0;
  for (const entry of KB) {
    const score = scoreEntry(entry, tokens);
    if (score > bestScore) { bestScore = score; best = entry; }
  }
  if (!best || bestScore < 3) return { ...FALLBACK, intent: "fallback" };
  return { intent: best.intent, answer: best.answer, links: best.links ?? [], suggestions: best.suggestions ?? [] };
}

export const ASSISTANT_GREETING: AssistantReply = {
  intent: "greeting",
  answer: "Hello! I'm the NeighbourLink guide. Ask me how to list a business, find a service, leave a review, get verified or manage your account.",
  links: [{ label: "Directory", href: "/directory" }, { label: "Community help", href: "/help" }, CONTACT_LINK],
  suggestions: ["How do I list a business?", "How do I find a business?", "How do reviews work?", "Is NeighbourLink free?"],
};

export const ASSISTANT_SUGGESTIONS = [
  "How do I list a business?",
  "How do I find a business?",
  "How do I get verified?",
  "How do reviews work?",
  "How do I save a business?",
  "Which areas do you cover?",
];

/** Reports every question and reply to the admin dashboard. Failures never break the chat. */
export async function logAssistantTurn(input: {
  question: string; answer: string; intent: string; links: AssistantLink[]; pagePath: string; uid: string | null;
}): Promise<void> {
  try {
    await addDoc(collection(getDb(), "assistantLogs"), {
      question: input.question.slice(0, 500),
      answer: input.answer.slice(0, 2000),
      intent: input.intent.slice(0, 60),
      links: input.links.slice(0, 8),
      pagePath: input.pagePath.slice(0, 200),
      uid: input.uid,
      reviewed: false,
      createdAt: serverTimestamp(),
    });
  } catch { /* reporting must never block the conversation */ }
}
