export type StoreCategory = 'prints' | 'accessories' | 'other';

export type StoreVariant = {
  id: string;
  title: string;
  image?: string;
  images?: string[];
  price?: number;
  currency?: string;
  formattedPrice?: string;
  options: Record<string, string>;
  optionSignature: string;
};

export type StoreProductOption = {
  name: string;
  values: string[];
};

export type StoreProduct = {
  id: string;
  name: string;
  description?: string;
  price?: string;
  status?: string;
  image?: string;
  productImages?: string[];
  tags?: string[];
  category: StoreCategory;
  variants: StoreVariant[];
  options: StoreProductOption[];
};
