export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  INFO = 'info'
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: Date;
}

export interface ScriptFeature {
  title: string;
  description: string;
}

export interface ScriptData {
  id: string;
  name: string;
  shortDesc: string;
  fullDesc: string;
  features: ScriptFeature[];
  steps: string[];
  faqs: { question: string; answer: string }[];
  videoUrl?: string;
  price: string;
  originalPrice?: string;
  color: string;
  downloadUrl?: string;
  trialDownloadUrl?: string;
  /** קישור לקובץ מדריך (למשל גוגל דרייב) */
  guideUrl?: string;
  isDownloadable?: boolean;
  isTrialDownloadable?: boolean;
  isPublished?: boolean;
}

export interface PromotionBundleData extends ScriptData {
  /** רשימת קישורי סקריפטים הכלולים בחבילה */
  bundleScriptLinks?: string[];
}

export interface VideoItem {
  id: string;
  title: string;
  /** תיאור קצר להצגה בעמוד הסרטונים */
  shortDesc?: string;
  /** קטגוריה לחיפוש וסינון (למשל "מדריכים", "הדגמות", "טיפים") */
  category?: string;
  /** קישור YouTube (watch/shorts/embed) */
  url: string;
  /** האם מוצג באתר */
  isPublished?: boolean;
  /** סדר תצוגה (נמוך קודם) */
  sortOrder?: number;
  createdAt?: string;
}

export interface SiteSettings {
  promotionsPageVisible?: boolean;
  scriptsPageVisible?: boolean;
  productsPageVisible?: boolean;
  coversPageVisible?: boolean;
  videosPageVisible?: boolean;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  scriptName: string;
  timestamp: string;
}

export type OrderStatus = 'pending' | 'paid';

export interface PurchaseOrder {
  id: string;
  orderCode: string;
  customerName: string;
  customerEmail: string;
  productId: string;
  productName: string;
  amountNis: number;
  priceLabel: string;
  status: OrderStatus;
  createdAt: string;
  paidAt: string | null;
}