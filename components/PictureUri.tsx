// components/PictureUri.tsx
import React from 'react';
import ItemCard from '../components/ItemCard';
import { API_HOST } from '../lib/constants';
import { useGlobalContext } from '../context/GlobalProvider';
const IMGV = String(Date.now()); // session nonce for cache-busting

interface Item {
  id: number;
  code: string;
  article: string;
  description: string;
  price: number;
  price2?: number;
  stock: string;
  picture?: string;
}

interface PictureUriProps {
  item: Item;
  onPress?: () => void; // kept for API compatibility, but we won't pass it down so ItemCard adds to cart itself
  /** Allow rendering even if stock is 0 (used when navigating from Orders) */
  allowZero?: boolean;
}

const PictureUri: React.FC<PictureUriProps> = ({ item, onPress, allowZero }) => {
  const { user } = useGlobalContext();

  // Build thumbnail URI from filename or use absolute URL
  const isAbs = (item.picture || '').startsWith('http');
  const pictureUri = (() => {
    if (!item.picture) return '';
    if (isAbs) {
      // preserve existing query if any
      const hasQ = item.picture.includes('?');
      return `${item.picture}${hasQ ? '&' : '?'}v=${encodeURIComponent(IMGV)}`;
    }
    // encode filename to avoid spaces/unicode issues and add a session version
    const fname = encodeURIComponent(item.picture);
    return `${API_HOST}/pictures/${fname}?v=${encodeURIComponent(IMGV)}`;
  })();

  // loyalty base price: price2 for action users, otherwise price
  const basePrice = user?.action ? (item.price2 ?? item.price) : item.price;
  
  // Only expose basePrice2 when action2 is enabled AND item.price2 exists
  const basePrice2 =
    user?.action2 && typeof item.price2 === 'number' && Number.isFinite(Number(item.price2))
      ? (item.price2 as number)
      : undefined;

  return (
    <ItemCard
      code={item.code}
      article={item.article}
      description={item.description}
      price={basePrice} 
      basePrice2={basePrice2}
      stock={item.stock}
      picture={pictureUri}
      /** do not pass onPress so ItemCard drives add-to-cart with selected price */
      allowZero={allowZero}
    />
  );
};

export default PictureUri;
