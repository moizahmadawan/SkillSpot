// Marketplace categories (Fiverr-style). "icon" is a lucide icon name used by the client.
export const CATEGORIES = [
  { name: 'Graphic Design', icon: 'Palette', hint: 'Logos, posters, branding, social media posts', skills: ['logo design', 'branding', 'poster design', 'photoshop'] },
  { name: 'Web Development', icon: 'Code', hint: 'Websites, shops, WordPress, React', skills: ['website', 'react', 'wordpress', 'web development'] },
  { name: 'Mobile Apps', icon: 'Smartphone', hint: 'Android, iOS and React Native apps', skills: ['react native', 'android', 'flutter'] },
  { name: 'Digital Marketing', icon: 'Megaphone', hint: 'Facebook ads, SEO, social media growth', skills: ['facebook ads', 'seo', 'instagram marketing'] },
  { name: 'Writing & Translation', icon: 'PenLine', hint: 'Articles, content, Urdu and English translation', skills: ['content writing', 'translation', 'urdu to english'] },
  { name: 'Video & Animation', icon: 'Video', hint: 'Reels, promo videos, editing, animation', skills: ['video editing', 'reels', 'animation'] },
  { name: 'Photography', icon: 'Camera', hint: 'Events, weddings, products, portraits', skills: ['photography', 'product photoshoot', 'event photography'] },
  { name: 'Tutoring & Teaching', icon: 'GraduationCap', hint: 'Home tuition, O/A level, Quran, languages', skills: ['math tutor', 'physics', 'o-level', 'quran teacher'] },
  { name: 'Electrician', icon: 'Zap', hint: 'Wiring, fans, switches, solar, UPS', skills: ['electrician', 'wiring', 'fan repair'] },
  { name: 'Plumbing', icon: 'Wrench', hint: 'Leaks, taps, bathroom fittings, geysers', skills: ['plumber', 'pipe leak', 'bathroom fitting'] },
  { name: 'Carpentry', icon: 'Hammer', hint: 'Doors, cupboards, furniture, repairs', skills: ['carpenter', 'furniture', 'door repair'] },
  { name: 'Painting', icon: 'PaintRoller', hint: 'Wall painting, polish, renovation', skills: ['painter', 'wall painting', 'polish'] },
  { name: 'AC & Appliance Repair', icon: 'Snowflake', hint: 'AC, fridge, washing machine, geyser service', skills: ['ac repair', 'refrigerator repair', 'washing machine repair'] },
  { name: 'Cleaning & Home Services', icon: 'Sparkles', hint: 'Deep cleaning, laundry, pest control, gardening', skills: ['cleaning', 'pest control', 'gardening'] },
  { name: 'Delivery & Errands', icon: 'Truck', hint: 'Parcels, shifting, shopping, pick and drop', skills: ['delivery', 'parcel', 'errands'] },
  { name: 'Tailoring & Fashion', icon: 'Scissors', hint: 'Stitching, alterations, boutique work, embroidery', skills: ['tailoring', 'stitching', 'alteration'] },
  { name: 'Event Planning', icon: 'PartyPopper', hint: 'Weddings, decor, catering, DJ, mehndi', skills: ['event planning', 'decoration', 'catering'] },
  { name: 'Data Entry & VA', icon: 'Keyboard', hint: 'Typing, Excel, virtual assistant, research', skills: ['data entry', 'excel', 'virtual assistant'] },
  { name: 'Car & Bike Repair', icon: 'Car', hint: 'Mechanic, denting, detailing, tyres', skills: ['car mechanic', 'bike repair', 'car detailing'] },
  { name: 'Beauty & Makeup', icon: 'Heart', hint: 'Bridal makeup, hair, mehndi, salon at home', skills: ['makeup artist', 'hair stylist', 'mehndi'] },
  { name: 'Accounting & Legal', icon: 'Calculator', hint: 'Bookkeeping, tax filing, documents, contracts', skills: ['accounting', 'tax filing', 'bookkeeping'] },
  { name: 'Other', icon: 'Briefcase', hint: 'Anything else you need done', skills: [] },
];

export const CATEGORY_NAMES = CATEGORIES.map((c) => c.name);
// Typical budget range (Rs) per category, used by the AI gig review to spot unrealistic posts.
export const BUDGET_RANGE = { 'Graphic Design': [300, 150000], 'Web Development': [1000, 1000000], 'Mobile Apps': [3000, 1000000], 'Digital Marketing': [500, 500000], 'Writing & Translation': [300, 150000], 'Video & Animation': [500, 300000], Photography: [500, 300000], 'Tutoring & Teaching': [500, 100000], Electrician: [300, 100000], Plumbing: [300, 100000], Carpentry: [300, 300000], Painting: [500, 500000], 'AC & Appliance Repair': [300, 100000], 'Cleaning & Home Services': [300, 100000], 'Delivery & Errands': [300, 20000], 'Tailoring & Fashion': [300, 200000], 'Event Planning': [1000, 1000000], 'Data Entry & VA': [300, 150000], 'Car & Bike Repair': [300, 300000], 'Beauty & Makeup': [300, 200000], 'Accounting & Legal': [500, 300000] };
