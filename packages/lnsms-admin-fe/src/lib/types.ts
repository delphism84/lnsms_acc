export interface StoreManager {
  name?: string;
  phone?: string;
  email?: string;
}

export interface StoreContact {
  phoneMain?: string;
  phoneAlt?: string;
  fax?: string;
  emailMain?: string;
  emailAlt?: string;
  website?: string;
  kakaoChannel?: string;
  instagram?: string;
  facebook?: string;
  naverPlace?: string;
  naverBlog?: string;
  youtube?: string;
}

export interface StoreLocation {
  address1?: string;
  address2?: string;
  postalCode?: string;
  city?: string;
  region?: string;
  country?: string;
  floor?: string;
  unit?: string;
  directions?: string;
  parkingInfo?: string;
  mapUrl?: string;
  imageUrl?: string;
  lat?: number | null;
  lng?: number | null;
}

export interface StoreBusiness {
  legalName?: string;
  brandName?: string;
  ceoName?: string;
  bizNo?: string;
  bizType?: string;
  bizItem?: string;
  openingDate?: string;
}

export interface StoreOperations {
  timezone?: string;
  hoursText?: string;
  breakTimeText?: string;
  lastOrderText?: string;
  holidayText?: string;
}

export interface StoreServices {
  dineIn?: boolean;
  takeout?: boolean;
  delivery?: boolean;
  reservation?: boolean;
  catering?: boolean;
  driveThru?: boolean;
  kidsFriendly?: boolean;
  petFriendly?: boolean;
  wheelchairAccessible?: boolean;
}

export interface StoreFacilities {
  parking?: boolean;
  wifi?: boolean;
  restroom?: boolean;
  smokingArea?: boolean;
  babyChair?: boolean;
  powerOutlet?: boolean;
  seatsCount?: number | null;
}

export interface StoreBilling {
  taxEmail?: string;
  invoiceName?: string;
  invoicePhone?: string;
  invoiceAddress1?: string;
  invoiceAddress2?: string;
  bankName?: string;
  bankAccount?: string;
  bankHolder?: string;
  vatIncluded?: boolean;
  serviceChargePct?: number;
  currency?: string;
}

export interface StoreBranding {
  logoUrl?: string;
  coverImageUrl?: string;
  interiorImageUrls?: string[];
  themeColor?: string;
  notice?: string;
}

export interface StoreIntegration {
  posVendor?: string;
  posVersion?: string;
  terminalCount?: number | null;
  networkType?: string;
  localServerIp?: string;
  memo?: string;
}

export interface Store {
  _id: string;
  userid?: string;
  storeId?: string;
  agentId?: string;
  agentid?: string;
  name: string;
  description?: string;
  manager?: StoreManager;
  contact?: StoreContact;
  location?: StoreLocation;
  business?: StoreBusiness;
  operations?: StoreOperations;
  services?: StoreServices;
  facilities?: StoreFacilities;
  billing?: StoreBilling;
  branding?: StoreBranding;
  integration?: StoreIntegration;
  status?: { active?: boolean; suspended?: boolean; suspendReason?: string };
  tags?: string[];
  memoInternal?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  _id: string;
  storeId: string;
  name: string;
  description?: string;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface MenuResource {
  type: 'image' | 'video';
  url: string;
  filename: string;
  size: number;
  order: number;
  uploadedAt?: string;
}

export interface Menu {
  _id: string;
  categoryId: string | Category;
  storeId: string | Store;
  name: string;
  description?: string;
  price: number;
  order: number;
  resources: MenuResource[];
  createdAt?: string;
  updatedAt?: string;
}

export interface EqidResource {
  type: 'image' | 'video';
  url: string;
  filename: string;
  size: number;
  order: number;
  enabled?: boolean;
  displayTime?: number;
  fadeInOut?: boolean;
  uploadedAt?: string;
}

export interface DidOptions {
  loop?: boolean;
  shuffle?: boolean;
  fitMode?: 'contain' | 'cover';
  mute?: boolean;
  offlineCache?: boolean;
  wifiOnlySync?: boolean;
  maxCacheMb?: number;
}

export interface Eqid {
  _id: string;
  deviceId?: string;
  eqid?: string;
  category?: string;
  storeId?: string;
  resources?: EqidResource[];
  displayTime?: number;
  useResourceFadeInOut?: boolean;
  enabled?: boolean;
  didOptions?: DidOptions;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminUser {
  _id: string;
  username: string;
  role: string;
  createdAt?: string;
}

export interface AdminAuthResponse {
  message: string;
  token: string;
  accessToken?: string;
  refreshToken: string;
  user: AdminUser;
}
